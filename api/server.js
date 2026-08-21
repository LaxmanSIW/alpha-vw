import express from 'express'
import cors from 'cors'
import { all, getNavTree, initDb, run } from './db.js'

const app = express()
const PORT = process.env.PORT || 3001

const ALLOWED_TABLES = ['modules', 'viewpoints', 'nav_nodes', 'edges', 'node_logs']
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

// Combined dashboard payload for fast loading and refresh
app.get('/api/data', async (req, res) => {
  try {
    const modules = await all('SELECT id, label FROM modules')
    const viewpointsRows = await all('SELECT id, module_id as moduleId, label, description, folder, job_count as jobCount FROM viewpoints')
    const navTree = await getNavTree()
    const edges = await all('SELECT id, source, target FROM edges')

    res.json({
      modules,
      viewpoints: viewpointsRows,
      navTree,
      edges,
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
    let sql = 'SELECT id, module_id as moduleId, label, description, folder, job_count as jobCount FROM viewpoints'
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

app.post('/api/crud/:table', async (req, res) => {
  const { table } = req.params
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Invalid table: ${table}` })
  }
  let data = req.body
  if (table === 'nav_nodes') {
    data = prepareNavNodeRecord(data)
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
    res.json({ success: true, id: data.id || result.lastID })
  } catch (err) {
    console.error(`Error inserting into ${table}:`, err)
    res.status(500).json({ error: err.message })
  }
})

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
    for (let row of rawRows) {
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
      insertedCount++
    }
    res.json({ success: true, count: insertedCount })
  } catch (err) {
    console.error(`Error in bulk insert into ${table}:`, err)
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/crud/:table/:id', async (req, res) => {
  const { table, id } = req.params
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Invalid table: ${table}` })
  }
  let data = req.body
  if (table === 'nav_nodes') {
    data = prepareNavNodeRecord(data)
  }

  const keys = Object.keys(data).filter((k) => k !== 'id')
  if (keys.length === 0) {
    return res.status(400).json({ error: 'No data provided to update' })
  }
  const setClause = keys.map((k) => `${k} = ?`).join(', ')
  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`
  const params = [...keys.map((k) => (data[k] === '' ? null : data[k])), id]

  try {
    await run(sql, params)
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
    await run(`DELETE FROM ${table} WHERE id = ?`, [id])
    res.json({ success: true, id })
  } catch (err) {
    console.error(`Error deleting from ${table}:`, err)
    res.status(500).json({ error: err.message })
  }
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
