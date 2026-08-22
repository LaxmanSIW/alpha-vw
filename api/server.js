import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { all, get, getNavTree, initDb, run } from './db.js'
import { getEligibleRunDates, evaluateScheduledDate, ScheduleConfig } from './schedule.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.join(__dirname, '..', 'dist')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Serve static production build files from dist/
app.use(express.static(distPath))

const ALLOWED_TABLES = [
  'modules',
  'viewpoints',
  'nav_nodes',
  'edges',
  'node_logs',
  'field_definitions',
  'node_field_values',
  'calendars',
  'schedule_configs',
  'app_config',
]
const FIXED_NAV_NODE_COLUMNS = [
  'id',
  'label',
  'kind',
  'parent_id',
  'node_kind',
  'status',
  'host',
  'runs',
  'sort_order',
]

function prepareNavNodeRecord(data) {
  const record = {}
  const extraData = {}

  for (const [key, value] of Object.entries(data)) {
    if (FIXED_NAV_NODE_COLUMNS.includes(key)) {
      record[key] = value === '' ? null : value
    } else {
      if (value !== '' && value !== null && value !== undefined) {
        extraData[key] = value
      }
    }
  }

  if (Object.keys(extraData).length > 0) {
    record.data = JSON.stringify(extraData)
  } else {
    record.data = null
  }

  return record
}

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Schedule evaluation endpoint
app.post('/api/schedules/evaluate', async (req, res) => {
  try {
    const { config, year = new Date().getUTCFullYear() } = req.body
    if (!config) {
      return res.status(400).json({ error: 'Missing schedule configuration' })
    }
    const schedule = new ScheduleConfig(config)
    const datesOrValidation = getEligibleRunDates(schedule, Number(year))
    if (!Array.isArray(datesOrValidation)) {
      return res.status(400).json({ error: 'Validation failed', details: datesOrValidation })
    }
    const dateStrings = datesOrValidation.map((d) => {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })
    res.json({ success: true, year, eligibleDates: dateStrings })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function computeBusinessDateInfo() {
  const hourRow   = await get("SELECT value FROM app_config WHERE key = 'business.dayStartHour'")  
  const minuteRow = await get("SELECT value FROM app_config WHERE key = 'business.dayStartMinute'")

  const startHour   = hourRow   ? parseInt(hourRow.value,   10) : 0
  const startMinute = minuteRow ? parseInt(minuteRow.value, 10) : 0

  const now = new Date()
  const nowHour   = now.getHours()
  const nowMinute = now.getMinutes()

  const beforeThreshold =
    nowHour < startHour ||
    (nowHour === startHour && nowMinute < startMinute)

  const businessDate = new Date(now)
  if (beforeThreshold) {
    businessDate.setDate(businessDate.getDate() - 1)
  }

  const y = businessDate.getFullYear()
  const m = String(businessDate.getMonth() + 1).padStart(2, '0')
  const d = String(businessDate.getDate()).padStart(2, '0')
  const businessDateStr = `${y}-${m}-${d}`

  return { businessDate, businessDateStr, startHour, startMinute }
}

async function syncScheduleConfigsForBusinessDate(businessDateStr, businessDateObj) {
  const schedConfigs = await all('SELECT * FROM schedule_configs')
  const resultMap = new Map()
  if (!schedConfigs || schedConfigs.length === 0) return resultMap

  const calendars = await all('SELECT * FROM calendars')
  const calendarsMap = {}
  calendars.forEach((c) => {
    let workdays = [1, 2, 3, 4, 5]
    let holidays = []
    try {
      if (c.workdays) workdays = typeof c.workdays === 'string' ? JSON.parse(c.workdays) : c.workdays
      if (c.holidays) holidays = typeof c.holidays === 'string' ? JSON.parse(c.holidays) : c.holidays
    } catch (e) {}
    calendarsMap[c.name] = { WORKDAYS: workdays, HOLIDAYS: holidays }
  })

  for (const sc of schedConfigs) {
    if (sc.last_evaluated_date === businessDateStr && sc.is_scheduled_today) {
      resultMap.set(sc.name, sc.is_scheduled_today)
      continue
    }

    let isScheduledToday = 'No'
    try {
      const config = JSON.parse(sc.config_data)
      const fullConfig = {
        ...config,
        CALENDARS: {
          ...calendarsMap,
          ...(config.CALENDARS || {}),
        },
      }
      const targetDate = businessDateObj || new Date(businessDateStr + 'T00:00:00Z')
      const effectiveDate = evaluateScheduledDate(targetDate, fullConfig)
      isScheduledToday = effectiveDate !== null ? 'Yes' : 'No'
    } catch (err) {
      console.error(`Error evaluating schedule_config ${sc.name}:`, err)
    }

    await run(
      'UPDATE schedule_configs SET last_evaluated_date = ?, is_scheduled_today = ? WHERE id = ?',
      [businessDateStr, isScheduledToday, sc.id]
    )

    resultMap.set(sc.name, isScheduledToday)
  }

  return resultMap
}

// Combined dashboard payload for fast loading and refresh
app.get('/api/data', async (req, res) => {
  try {
    const { businessDateStr, businessDate } = await computeBusinessDateInfo()
    const scheduledMap = await syncScheduleConfigsForBusinessDate(businessDateStr, businessDate)

    const modules = await all('SELECT id, label FROM modules')
    const viewpointsRows = await all(
      'SELECT id, module_id as moduleId, label, description, folder, job_count as jobCount, scope, filter_status as filterStatus, grouping, sort_by as sortBy FROM viewpoints'
    )
    const navTree = await getNavTree(scheduledMap)
    const edges = await all('SELECT id, source, target FROM edges')
    const fieldDefinitions = await all(
      'SELECT key, label, section_title as sectionTitle, role, format, sort_order as sortOrder, is_protected as isProtected, show_on_card as showOnCard, show_in_details as showInDetails, is_active as isActive FROM field_definitions ORDER BY sort_order ASC'
    )
    const appConfig = await all('SELECT key, category, label, value, sort_order as sortOrder FROM app_config ORDER BY category ASC, sort_order ASC')

    res.json({
      modules,
      viewpoints: viewpointsRows,
      navTree,
      edges,
      fieldDefinitions,
      appConfig,
    })
  } catch (err) {
    console.error('Error fetching dashboard data:', err)
    res.status(500).json({ error: 'Failed to fetch dashboard data from database' })
  }
})

// Individual read endpoints
app.get('/api/modules', async (req, res) => {
  try {
    const modules = await all('SELECT id, label FROM modules')
    res.json(modules)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch modules' })
  }
})

app.get('/api/viewpoints', async (req, res) => {
  try {
    const { moduleId } = req.query
    let sql =
      'SELECT id, module_id as moduleId, label, description, folder, job_count as jobCount, scope, filter_status as filterStatus, grouping FROM viewpoints'
    const params = []
    if (moduleId) {
      sql += ' WHERE module_id = ?'
      params.push(moduleId)
    }
    const viewpoints = await all(sql, params)
    res.json(viewpoints)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch viewpoints' })
  }
})

app.get('/api/nav-tree', async (req, res) => {
  try {
    const navTree = await getNavTree()
    res.json(navTree)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch navigation tree' })
  }
})

app.get('/api/edges', async (req, res) => {
  try {
    const edges = await all('SELECT id, source, target FROM edges')
    res.json(edges)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch edges' })
  }
})

app.get('/api/logs/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params
    const logs = await all('SELECT id, node_id as nodeId, timestamp, level, message FROM node_logs WHERE node_id = ? ORDER BY id DESC', [nodeId])
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch node logs' })
  }
})

// Generic CRUD endpoints for Admin Management
app.get('/api/crud/:table', async (req, res) => {
  const { table } = req.params
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Invalid table: ${table}` })
  }
  try {
    const rows = await all(`SELECT * FROM ${table}`)
    if (table === 'nav_nodes') {
      const parsedRows = rows.map((r) => {
        const rowObj = { ...r }
        if (r.data) {
          try {
            const extra = JSON.parse(r.data)
            Object.assign(rowObj, extra)
          } catch (e) {}
          delete rowObj.data
        }
        return rowObj
      })
      return res.json(parsedRows)
    }
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function normalizeRecordKeys(table, rawData) {
  if (!rawData || typeof rawData !== 'object') return rawData
  const mapped = {}

  for (const [rawKey, val] of Object.entries(rawData)) {
    // Strip BOM (\uFEFF) and quotes/whitespace from key names
    const key = rawKey.replace(/^\uFEFF/, '').trim().replace(/^["']|["']$/g, '')
    mapped[key] = val
  }

  if ('sectionTitle' in mapped) { mapped.section_title = mapped.sectionTitle; delete mapped.sectionTitle }
  if ('sortOrder' in mapped) { mapped.sort_order = mapped.sortOrder; delete mapped.sortOrder }
  if ('isProtected' in mapped) { mapped.is_protected = mapped.isProtected ? 1 : 0; delete mapped.isProtected }
  if ('showOnCard' in mapped) { mapped.show_on_card = mapped.showOnCard; delete mapped.showOnCard }
  if ('showInDetails' in mapped) { mapped.show_in_details = mapped.showInDetails; delete mapped.showInDetails }
  if ('isActive' in mapped) { mapped.is_active = mapped.isActive ? 1 : 0; delete mapped.isActive }
  if ('filterStatus' in mapped) { mapped.filter_status = mapped.filterStatus; delete mapped.filterStatus }
  if ('sortBy' in mapped) { mapped.sort_by = mapped.sortBy; delete mapped.sortBy }
  if ('nodeKind' in mapped) { mapped.node_kind = mapped.nodeKind; delete mapped.nodeKind }
  if ('jobCount' in mapped) { mapped.job_count = mapped.jobCount; delete mapped.jobCount }
  if ('moduleId' in mapped) { mapped.module_id = mapped.moduleId; delete mapped.moduleId }

  if (table === 'edges') {
    const edgeCols = ['id', 'source', 'target']
    const edgeRecord = {}
    for (const col of edgeCols) {
      if (col in mapped && mapped[col] !== undefined && mapped[col] !== '') {
        edgeRecord[col] = mapped[col]
      }
    }
    return edgeRecord
  }

  return mapped
}

async function syncNodeFieldValues(nodeId, rawData) {
  if (!nodeId || !rawData || typeof rawData !== 'object') return
  const ignore = ['id', 'label', 'kind', 'parent_id', 'sort_order', 'data']
  for (const [key, value] of Object.entries(rawData)) {
    if (ignore.includes(key)) continue
    if (value !== null && value !== undefined && value !== '') {
      try {
        await run(
          'INSERT OR REPLACE INTO node_field_values (node_id, field_key, field_value) VALUES (?, ?, ?)',
          [nodeId, key, String(value)]
        )
      } catch (e) {}
    }
  }
}

async function invalidateScheduleCacheIfNeeded(table) {
  if (table === 'schedule_configs' || table === 'calendars' || table === 'app_config') {
    try {
      await run("UPDATE schedule_configs SET last_evaluated_date = NULL")
    } catch (e) {}
  }
}

// Bulk Insertion Endpoint for CSV uploads
app.post('/api/crud/bulk/:table', async (req, res) => {
  const { table } = req.params
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Invalid table: ${table}` })
  }
  const rawRows = Array.isArray(req.body) ? req.body : req.body.rows
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return res.status(400).json({ error: 'No rows provided for bulk insertion' })
  }

  try {
    let insertedCount = 0
    for (let rawRow of rawRows) {
      let row = normalizeRecordKeys(table, rawRow)
      if (table === 'nav_nodes') {
        row = prepareNavNodeRecord(row)
      }
      const keys = Object.keys(row).filter(
        (k) => !(table === 'node_logs' && k === 'id' && !row[k])
      )
      if (keys.length === 0) continue
      const placeholders = keys.map(() => '?').join(', ')
      const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`
      const params = keys.map((k) => (row[k] === '' || row[k] === undefined ? null : row[k]))
      await run(sql, params)
      if (table === 'nav_nodes' && (rawRow.id || row.id)) {
        await syncNodeFieldValues(String(rawRow.id || row.id), rawRow)
      }
      insertedCount++
    }
    await invalidateScheduleCacheIfNeeded(table)
    res.json({ success: true, count: insertedCount })
  } catch (err) {
    console.error(`Error in bulk insert into ${table}:`, err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/crud/:table', async (req, res) => {
  const { table } = req.params
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Invalid table: ${table}` })
  }
  const rawData = normalizeRecordKeys(table, req.body)
  let data = rawData
  if (table === 'nav_nodes') {
    data = prepareNavNodeRecord(rawData)
  }

  const keys = Object.keys(data).filter(
    (k) => !(table === 'node_logs' && k === 'id' && !data[k])
  )
  if (keys.length === 0) {
    return res.status(400).json({ error: 'No data provided to insert' })
  }
  const placeholders = keys.map(() => '?').join(', ')
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`
  const params = keys.map((k) => (data[k] === '' ? null : data[k]))

  try {
    const result = await run(sql, params)
    const insertedId = data.id || result.lastID
    if (table === 'nav_nodes' && insertedId) {
      await syncNodeFieldValues(String(insertedId), rawData)
    }
    await invalidateScheduleCacheIfNeeded(table)
    res.json({ success: true, id: insertedId })
  } catch (err) {
    console.error(`Error inserting into ${table}:`, err)
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/crud/:table/:id', async (req, res) => {
  const { table, id } = req.params
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Invalid table: ${table}` })
  }
  const rawData = normalizeRecordKeys(table, req.body)
  let data = rawData
  if (table === 'nav_nodes') {
    data = prepareNavNodeRecord(rawData)
  }

  const pkColumn = (table === 'field_definitions' || table === 'app_config') ? 'key' : 'id'
  const keys = Object.keys(data).filter((k) => k !== pkColumn && k !== 'id')
  if (keys.length === 0) {
    return res.status(400).json({ error: 'No data provided to update' })
  }
  const setClause = keys.map((k) => `${k} = ?`).join(', ')
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${pkColumn} = ?`
  const params = [...keys.map((k) => (data[k] === '' ? null : data[k])), id]

  try {
    await run(sql, params)
    if (table === 'nav_nodes') {
      await syncNodeFieldValues(id, rawData)
    }
    await invalidateScheduleCacheIfNeeded(table)
    res.json({ success: true, id })
  } catch (err) {
    console.error(`Error updating ${table}:`, err)
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/crud/:table/:id', async (req, res) => {
  const { table, id } = req.params
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Invalid table: ${table}` })
  }
  try {
    if (table === 'field_definitions') {
      const target = await get('SELECT is_protected FROM field_definitions WHERE key = ?', [id])
      if (target && target.is_protected === 1) {
        return res.status(400).json({ error: 'Cannot delete protected core system field.' })
      }
    }
    const pkColumn = (table === 'field_definitions' || table === 'app_config') ? 'key' : 'id'
    await run(`DELETE FROM ${table} WHERE ${pkColumn} = ?`, [id])
    await invalidateScheduleCacheIfNeeded(table)
    res.json({ success: true, id })
  } catch (err) {
    console.error(`Error deleting from ${table}:`, err)
    res.status(500).json({ error: err.message })
  }
})

// Endpoint to evaluate scheduled run dates for a given configuration
app.post('/api/schedules/evaluate', async (req, res) => {
  try {
    const { config, year } = req.body
    if (!config) {
      return res.status(400).json({ error: 'Config object is required' })
    }

    const targetYear = Number(year) || new Date().getUTCFullYear()

    // Fetch all active database calendars to hydrate config.CALENDARS
    const calRows = await all('SELECT * FROM calendars')
    const calendarsMap = {}
    calRows.forEach((c) => {
      let workdays = [1, 2, 3, 4, 5]
      let holidays = []
      try {
        if (c.workdays) workdays = typeof c.workdays === 'string' ? JSON.parse(c.workdays) : c.workdays
        if (c.holidays) holidays = typeof c.holidays === 'string' ? JSON.parse(c.holidays) : c.holidays
      } catch (e) {}
      calendarsMap[c.name] = { WORKDAYS: workdays, HOLIDAYS: holidays }
    })

    const fullConfig = {
      ...config,
      CALENDARS: {
        ...calendarsMap,
        ...(config.CALENDARS || {}),
      },
    }

    const result = getEligibleRunDates(fullConfig, targetYear)
    const eligibleDates = Array.isArray(result)
      ? result.map((d) => d.toISOString().split('T')[0])
      : []

    res.json({ success: true, year: targetYear, eligibleDates })
  } catch (err) {
    console.error('Error evaluating schedule dates:', err)
    res.status(500).json({ error: err.message })
  }
})

// Endpoint to evaluate whether a SINGLE specific date is an eligible run date
app.post('/api/schedules/evaluate-date', async (req, res) => {
  try {
    const { config, date } = req.body
    if (!config || !date) {
      return res.status(400).json({ error: 'Config object and date string (YYYY-MM-DD) are required' })
    }

    const dateParts = String(date).split('-')
    if (dateParts.length !== 3) {
      return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' })
    }

    const targetDate = new Date(Date.UTC(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])))

    // Fetch all active database calendars to hydrate config.CALENDARS
    const calRows = await all('SELECT * FROM calendars')
    const calendarsMap = {}
    calRows.forEach((c) => {
      let workdays = [1, 2, 3, 4, 5]
      let holidays = []
      try {
        if (c.workdays) workdays = typeof c.workdays === 'string' ? JSON.parse(c.workdays) : c.workdays
        if (c.holidays) holidays = typeof c.holidays === 'string' ? JSON.parse(c.holidays) : c.holidays
      } catch (e) {}
      calendarsMap[c.name] = { WORKDAYS: workdays, HOLIDAYS: holidays }
    })

    const fullConfig = {
      ...config,
      CALENDARS: {
        ...calendarsMap,
        ...(config.CALENDARS || {}),
      },
    }

    const effectiveDate = evaluateScheduledDate(targetDate, fullConfig)
    const isEligible = effectiveDate !== null
    const effectiveRunDate = effectiveDate ? effectiveDate.toISOString().split('T')[0] : null

    res.json({
      success: true,
      date: String(date),
      isEligible,
      effectiveRunDate,
    })
  } catch (err) {
    console.error('Error evaluating single date:', err)
    res.status(500).json({ error: err.message })
  }
})

// Business date endpoint
// Returns the current business date based on a configurable day-start threshold.
// If the server clock is before the threshold (e.g. 03:00) the business date is
// still the previous calendar day.
app.get('/api/business-date', async (req, res) => {
  try {
    const { businessDate, businessDateStr, startHour, startMinute } = await computeBusinessDateInfo()
    const scheduledMap = await syncScheduleConfigsForBusinessDate(businessDateStr, businessDate)

    const sh = String(startHour).padStart(2, '0')
    const sm = String(startMinute).padStart(2, '0')

    res.json({
      businessDate: businessDateStr,
      dayStart: `${sh}:${sm}`,
      serverTime: new Date().toISOString(),
      scheduleConfigsEvaluated: Array.from(scheduledMap.entries()).map(([name, isScheduledToday]) => ({
        name,
        isScheduledToday,
      })),
    })
  } catch (err) {
    console.error('Error computing business date:', err)
    res.status(500).json({ error: 'Failed to compute business date' })
  }
})

// SPA Fallback: serve dist/index.html for non-API GET requests
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        next()
      }
    })
  }
  next()
})

// Initialize DB then start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend API server running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Failed to initialize SQLite database:', err)
    process.exit(1)
  })
