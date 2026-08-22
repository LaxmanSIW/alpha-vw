import sqlite3 from 'sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.resolve(__dirname, 'database.sqlite')
const db = new sqlite3.Database(dbPath)

// Helper methods returning Promises for async/await usage
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

/** Initialize tables and seed default data if empty */
export async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS viewpoints (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      folder TEXT,
      job_count INTEGER,
      scope TEXT DEFAULT 'Public',
      filter_status TEXT DEFAULT 'All',
      grouping TEXT DEFAULT 'Folder',
      sort_by TEXT DEFAULT 'label',
      FOREIGN KEY (module_id) REFERENCES modules(id)
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS field_definitions (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      section_title TEXT DEFAULT 'Metadata',
      role TEXT NOT NULL DEFAULT 'detail',
      format TEXT DEFAULT 'text',
      sort_order INTEGER DEFAULT 0,
      is_protected INTEGER DEFAULT 0,
      show_on_card TEXT DEFAULT 'Y',
      show_in_details TEXT DEFAULT 'Y',
      is_active INTEGER DEFAULT 1
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS node_field_values (
      node_id TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_value TEXT,
      PRIMARY KEY (node_id, field_key)
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS nav_nodes (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      parent_id TEXT,
      node_kind TEXT,
      status TEXT,
      host TEXT,
      runs INTEGER,
      sort_order INTEGER DEFAULT 0,
      data TEXT
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      target TEXT NOT NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS node_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      workdays TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
      holidays TEXT NOT NULL DEFAULT '[]'
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS schedule_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      config_data TEXT NOT NULL,
      last_evaluated_date TEXT,
      is_scheduled_today TEXT DEFAULT 'N/A'
    )
  `)

  try {
    await run(`ALTER TABLE schedule_configs ADD COLUMN last_evaluated_date TEXT`)
  } catch (e) { /* column exists */ }
  try {
    await run(`ALTER TABLE schedule_configs ADD COLUMN is_scheduled_today TEXT DEFAULT 'N/A'`)
  } catch (e) { /* column exists */ }

  await run(`
    CREATE TABLE IF NOT EXISTS app_config (
      key        TEXT PRIMARY KEY,
      category   TEXT NOT NULL,
      label      TEXT NOT NULL,
      value      TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `)

  // Seed default app config rows (INSERT OR IGNORE — safe for existing DBs)
  const defaultConfigRows = [
    // ── Status definitions ──────────────────────────────────────────────────
    // value is JSON: { hex, aliases[] }
    {
      key: 'status.completed', category: 'status', label: 'Completed', sort_order: 1,
      value: JSON.stringify({ hex: '#22c55e', aliases: ['ok', 'completed', 'ended ok', 'success'] }),
    },
    {
      key: 'status.executing', category: 'status', label: 'Executing', sort_order: 2,
      value: JSON.stringify({ hex: '#f97316', aliases: ['executing', 'execution', 'running'] }),
    },
    {
      key: 'status.wait', category: 'status', label: 'Wait for Event', sort_order: 3,
      value: JSON.stringify({ hex: '#94a3b8', aliases: ['wait for event', 'wait event', 'waiting', 'warning', 'hold'] }),
    },
    {
      key: 'status.failed', category: 'status', label: 'Failed', sort_order: 4,
      value: JSON.stringify({ hex: '#f43f5e', aliases: ['failed', 'danger', 'error', 'ended notok', 'notok'] }),
    },

    // ── Canvas layout ────────────────────────────────────────────────────────
    { key: 'layout.vGap',               category: 'layout',   label: 'Vertical Gap',         value: '50',  sort_order: 1 },
    { key: 'layout.hGap',               category: 'layout',   label: 'Horizontal Gap',       value: '40',  sort_order: 2 },
    { key: 'layout.nodeWidth',           category: 'layout',   label: 'Node Width',           value: '190', sort_order: 3 },
    { key: 'layout.nodeHeight',          category: 'layout',   label: 'Node Height',          value: '130', sort_order: 4 },
    { key: 'layout.nodeCollapsedHeight', category: 'layout',   label: 'Node Collapsed Height',value: '48',  sort_order: 5 },

    // ── Node relation highlight colors ────────────────────────────────────────
    { key: 'relation.selectedColor', category: 'relation', label: 'Selected Node Color',     value: '#6366f1', sort_order: 1 },
    { key: 'relation.predColor',     category: 'relation', label: 'Predecessor Node Color',  value: '#f97316', sort_order: 2 },
    { key: 'relation.succColor',     category: 'relation', label: 'Successor Node Color',    value: '#22d3ee', sort_order: 3 },
    { key: 'relation.outlineWidth',  category: 'relation', label: 'Highlight Outline Width', value: '1',       sort_order: 4 },

    // ── Business date ─────────────────────────────────────────────────────────
    // The business day is considered "today" only once the clock passes dayStart.
    // Before that threshold the business date is still the previous calendar day.
    { key: 'business.dayStartHour',   category: 'business', label: 'Day Start Hour',   value: '0', sort_order: 1 },
    { key: 'business.dayStartMinute', category: 'business', label: 'Day Start Minute', value: '0', sort_order: 2 },
  ]

  for (const row of defaultConfigRows) {
    await run(
      'INSERT OR IGNORE INTO app_config (key, category, label, value, sort_order) VALUES (?, ?, ?, ?, ?)',
      [row.key, row.category, row.label, row.value, row.sort_order]
    )
  }

  // Seed default field definitions
  const initialFields = [
    { key: 'id', label: 'Node ID', section_title: 'Identity', role: 'detail', format: 'mono', sort_order: 1, is_protected: 1, show_on_card: 'Y', show_in_details: 'Y' },
    { key: 'label', label: 'Node Label', section_title: 'Identity', role: 'title', format: 'text', sort_order: 2, is_protected: 1, show_on_card: 'Y', show_in_details: 'Y' },
    { key: 'kind', label: 'Kind', section_title: 'Identity', role: 'subtitle', format: 'text', sort_order: 3, is_protected: 1, show_on_card: 'Y', show_in_details: 'Y' },
    { key: 'parent_id', label: 'Parent Node', section_title: 'Identity', role: 'none', format: 'text', sort_order: 4, is_protected: 1, show_on_card: 'N', show_in_details: 'N' },
    { key: 'node_kind', label: 'Type', section_title: 'Identity', role: 'subtitle', format: 'text', sort_order: 5, is_protected: 1, show_on_card: 'Y', show_in_details: 'Y' },
    { key: 'status', label: 'Status', section_title: 'State', role: 'detail', format: 'status', sort_order: 6, is_protected: 1, show_on_card: 'Y', show_in_details: 'Y' },
    { key: 'host', label: 'Host', section_title: 'Execution', role: 'detail', format: 'mono', sort_order: 7, is_protected: 0, show_on_card: 'Y', show_in_details: 'Y' },
    { key: 'runs', label: 'Runs', section_title: 'Execution', role: 'detail', format: 'text', sort_order: 8, is_protected: 0, show_on_card: 'Y', show_in_details: 'Y' },
    { key: 'scheduled', label: 'Scheduled', section_title: 'Execution', role: 'detail', format: 'text', sort_order: 8.5, is_protected: 1, show_on_card: 'Y', show_in_details: 'Y' },
    { key: 'schedule', label: 'Schedule Config', section_title: 'Scheduling', role: 'detail', format: 'text', sort_order: 9, is_protected: 1, show_on_card: 'N', show_in_details: 'Y' },
  ]

  for (const f of initialFields) {
    await run(
      'INSERT OR REPLACE INTO field_definitions (key, label, section_title, role, format, sort_order, is_protected, show_on_card, show_in_details, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [f.key, f.label, f.section_title, f.role, f.format, f.sort_order, f.is_protected, f.show_on_card, f.show_in_details]
    )
  }

  // Seed default calendars if empty
  const calCount = await get('SELECT COUNT(*) as count FROM calendars')
  if (calCount.count === 0) {
    await run('INSERT INTO calendars (id, name, workdays, holidays) VALUES (?, ?, ?, ?)', [
      'cal-regular',
      'REGULAR',
      JSON.stringify([1, 2, 3, 4, 5]),
      JSON.stringify(['2026-01-01', '2026-12-25'])
    ])
    await run('INSERT INTO calendars (id, name, workdays, holidays) VALUES (?, ?, ?, ?)', [
      'cal-mfd9h',
      'MFD9H',
      JSON.stringify([1, 2, 3, 4, 5, 6]),
      JSON.stringify(['2026-01-01', '2026-12-25'])
    ])
  }

  // Seed default schedule configs if empty
  const schedCount = await get('SELECT COUNT(*) as count FROM schedule_configs')
  if (schedCount.count === 0) {
    const dailyRunConfig = {
      CALENDARS: {
        REGULAR: { WORKDAYS: [1, 2, 3, 4, 5], HOLIDAYS: ['2026-01-01', '2026-12-25'] }
      },
      WEEKDAYS_CALENDAR: 'REGULAR',
      MONTH_CALENDAR: 'REGULAR',
      WEEKDAYS: ['1', '2', '3', '4', '5'],
      MONTHDAYS: ['WORKDAYS'],
      MONTHS: ['ALL'],
      WEEK_MONTH_RELATION: 'OR',
      CONFIRMATION: { CALENDAR: 'REGULAR', EXCEPTION_POLICY: 'SHIFT_AND_RUN_ON_NEXT_CONFIRMED_DAY', SHIFT_BY: 0 },
      ACTIVITY_PERIOD: { MODE: 'ALWAYS' }
    }

    const monthEndConfig = {
      CALENDARS: {
        MFD9H: { WORKDAYS: [1, 2, 3, 4, 5, 6], HOLIDAYS: ['2026-01-01', '2026-12-25'] }
      },
      WEEKDAYS_CALENDAR: 'MFD9H',
      MONTH_CALENDAR: 'MFD9H',
      WEEKDAYS: [],
      MONTHDAYS: ['L1', 'L2'],
      MONTHS: ['ALL'],
      WEEK_MONTH_RELATION: 'OR',
      CONFIRMATION: { CALENDAR: 'MFD9H', EXCEPTION_POLICY: 'RUN_ON_NEXT_CONFIRMED_DAY_AND_SHIFT', SHIFT_BY: 0 },
      ACTIVITY_PERIOD: { MODE: 'ALWAYS' }
    }

    await run('INSERT INTO schedule_configs (id, name, config_data) VALUES (?, ?, ?)', [
      'sched-daily',
      'DAILY_PROD_RUN',
      JSON.stringify(dailyRunConfig)
    ])
    await run('INSERT INTO schedule_configs (id, name, config_data) VALUES (?, ?, ?)', [
      'sched-monthend',
      'END_OF_MONTH_RUN',
      JSON.stringify(monthEndConfig)
    ])
  }

  // Seed default data if modules table is empty
  const moduleCount = await get('SELECT COUNT(*) as count FROM modules')
  if (moduleCount.count === 0) {
    console.log('Seeding initial data into SQLite database...')

    // Seed Modules
    await run('INSERT INTO modules (id, label) VALUES (?, ?)', ['architecture', 'Architecture'])

    // Seed Viewpoint (Single Default Viewpoint)
    await run(
      'INSERT INTO viewpoints (id, module_id, label, description, folder, job_count) VALUES (?, ?, ?, ?, ?, ?)',
      ['default', 'architecture', 'Default', 'Default topology viewpoint', 'Alpha VW', 0]
    )

    console.log('Initial SQLite database structure initialized.')
  }
}

/** Helper function to reconstruct hierarchical NavItem[] tree from database rows */
export async function getNavTree(scheduledMap = null) {
  const rows = await all('SELECT * FROM nav_nodes ORDER BY sort_order ASC, id ASC')
  const fieldValues = await all('SELECT * FROM node_field_values')
  const valuesByNode = new Map()
  for (const fv of fieldValues) {
    if (!valuesByNode.has(fv.node_id)) valuesByNode.set(fv.node_id, {})
    valuesByNode.get(fv.node_id)[fv.field_key] = fv.field_value
  }

  function buildTree(parentId = null) {
    const children = rows.filter((row) => row.parent_id === parentId)
    return children.map((row) => {
      const item = {
        id: row.id,
        label: row.label,
        kind: row.kind,
      }

      let customData = {}
      if (row.data) {
        try {
          customData = JSON.parse(row.data)
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      const eavValues = valuesByNode.get(row.id) || {}
      customData = { ...customData, ...eavValues }

      const scheduleConfigName = customData.schedule
      let scheduledValue = 'N/A'
      if (scheduleConfigName) {
        if (scheduledMap && scheduledMap.has(scheduleConfigName)) {
          scheduledValue = scheduledMap.get(scheduleConfigName)
        } else {
          scheduledValue = 'No'
        }
      }

      if (row.kind === 'item') {
        item.data = {
          kind: row.node_kind,
          status: row.status,
          host: row.host,
          runs: row.runs,
          ...customData,
          scheduled: scheduledValue,
        }
      } else {
        item.data = {
          ...customData,
          scheduled: scheduledValue,
        }
        const subChildren = buildTree(row.id)
        if (subChildren.length > 0) {
          item.children = subChildren
        }
      }
      return item
    })
  }

  return buildTree(null)
}

export default db
