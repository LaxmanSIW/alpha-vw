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
      FOREIGN KEY (module_id) REFERENCES modules(id)
    )
  `)

  try { await run("ALTER TABLE viewpoints ADD COLUMN scope TEXT DEFAULT 'Public'") } catch (err) {}
  try { await run("ALTER TABLE viewpoints ADD COLUMN filter_status TEXT DEFAULT 'All'") } catch (err) {}
  try { await run("ALTER TABLE viewpoints ADD COLUMN grouping TEXT DEFAULT 'Folder'") } catch (err) {}
  try { await run("ALTER TABLE viewpoints ADD COLUMN sort_by TEXT DEFAULT 'label'") } catch (err) {}

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

  try { await run("ALTER TABLE field_definitions ADD COLUMN section_title TEXT DEFAULT 'Metadata'") } catch (err) {}
  try { await run("ALTER TABLE field_definitions ADD COLUMN is_protected INTEGER DEFAULT 0") } catch (err) {}
  try { await run("ALTER TABLE field_definitions ADD COLUMN show_on_card TEXT DEFAULT 'Y'") } catch (err) {}
  try { await run("ALTER TABLE field_definitions ADD COLUMN show_in_details TEXT DEFAULT 'Y'") } catch (err) {}

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

  // Migration helper: add data column if missing in existing database
  try {
    await run('ALTER TABLE nav_nodes ADD COLUMN data TEXT')
  } catch (err) {
    // Ignore error if column already exists
  }

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

  // Seed default field definitions
  const initialFields = [
    { key: 'id', label: 'Node ID', section_title: 'Identity', role: 'detail', format: 'mono', sort_order: 1, is_protected: 1 },
    { key: 'label', label: 'Node Label', section_title: 'Identity', role: 'title', format: 'text', sort_order: 2, is_protected: 1 },
    { key: 'kind', label: 'Kind', section_title: 'Identity', role: 'subtitle', format: 'text', sort_order: 3, is_protected: 1 },
    { key: 'parent_id', label: 'Parent Node', section_title: 'Identity', role: 'none', format: 'text', sort_order: 4, is_protected: 1 },
    { key: 'node_kind', label: 'Type', section_title: 'Identity', role: 'subtitle', format: 'text', sort_order: 5, is_protected: 1 },
    { key: 'status', label: 'Status', section_title: 'State', role: 'detail', format: 'status', sort_order: 6, is_protected: 1 },
    { key: 'host', label: 'Host', section_title: 'Execution', role: 'detail', format: 'mono', sort_order: 7, is_protected: 0 },
    { key: 'runs', label: 'Runs', section_title: 'Execution', role: 'detail', format: 'text', sort_order: 8, is_protected: 0 },
  ]

  for (const f of initialFields) {
    await run(
      'INSERT OR REPLACE INTO field_definitions (key, label, section_title, role, format, sort_order, is_protected, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [f.key, f.label, f.section_title, f.role, f.format, f.sort_order, f.is_protected]
    )
  }

  // Seed default data if modules table is empty
  const moduleCount = await get('SELECT COUNT(*) as count FROM modules')
  if (moduleCount.count === 0) {
    console.log('Seeding initial data into SQLite database...')

    // Seed Modules
    await run('INSERT INTO modules (id, label) VALUES (?, ?)', ['architecture', 'Architecture'])

    // Seed Viewpoints
    await run(
      'INSERT INTO viewpoints (id, module_id, label, description, folder, job_count) VALUES (?, ?, ?, ?, ?, ?)',
      ['arch-viewpoint_jobs', 'architecture', 'Viewpoint_jobs', 'Primary ingest and reconciliation flow', 'Alpha VW / Domain A', 8]
    )
    await run(
      'INSERT INTO viewpoints (id, module_id, label, description, folder, job_count) VALUES (?, ?, ?, ?, ?, ?)',
      ['arch-v2', 'architecture', 'v2', 'Candidate topology with split validation', 'Alpha VW / Domain B', 8]
    )
    await run(
      'INSERT INTO viewpoints (id, module_id, label, description, folder, job_count) VALUES (?, ?, ?, ?, ?, ?)',
      ['arch-shared', 'architecture', 'Shared', 'Cross-domain shared services', 'Alpha VW / Shared', 2]
    )

    // Seed Nav Nodes
    const nodesToSeed = [
      { id: 'n-shared', label: 'Shared', kind: 'folder', parent_id: null, sort_order: 1 },
      { id: 'n-7', label: 'Identity', kind: 'item', parent_id: 'n-shared', node_kind: 'Service', status: 'Completed', host: 'ctm-idp-01', runs: 1204, sort_order: 1 },
      { id: 'n-8', label: 'Audit Log', kind: 'item', parent_id: 'n-shared', node_kind: 'Service', status: 'Executing', host: 'ctm-idp-01', runs: 1204, sort_order: 2 },
      { id: 'n-alpha', label: 'Alpha VW', kind: 'folder', parent_id: null, sort_order: 2 },
      { id: 'n-domain-a', label: 'Domain A', kind: 'folder', parent_id: 'n-alpha', sort_order: 1 },
      { id: 'n-1', label: 'Ingest Gateway', kind: 'item', parent_id: 'n-domain-a', node_kind: 'Source', status: 'Completed', host: 'ctm-ingest-01', runs: 852, sort_order: 1 },
      { id: 'n-2', label: 'Validator', kind: 'item', parent_id: 'n-domain-a', node_kind: 'Process', status: 'Executing', host: 'ctm-app-01', runs: 850, sort_order: 2 },
      { id: 'n-3', label: 'Aggregator', kind: 'item', parent_id: 'n-domain-a', node_kind: 'Process', status: 'Wait for Event', host: 'ctm-app-01', runs: 848, sort_order: 3 },
      { id: 'n-domain-b', label: 'Domain B', kind: 'folder', parent_id: 'n-alpha', sort_order: 2 },
      { id: 'n-4', label: 'Ledger Store', kind: 'item', parent_id: 'n-domain-b', node_kind: 'Store', status: 'Completed', host: 'ctm-db-01', runs: 410, sort_order: 1 },
      { id: 'n-5', label: 'Reconciler', kind: 'item', parent_id: 'n-domain-b', node_kind: 'Process', status: 'Wait for Event', host: 'ctm-app-02', runs: 411, sort_order: 2 },
      { id: 'n-domain-c', label: 'Domain C', kind: 'folder', parent_id: 'n-alpha', sort_order: 3 },
      { id: 'n-6', label: 'Export Gateway', kind: 'item', parent_id: 'n-domain-c', node_kind: 'Sink', status: 'Failed', host: 'ctm-edge-01', runs: 398, sort_order: 1 },
    ]

    for (const node of nodesToSeed) {
      await run(
        `INSERT INTO nav_nodes (id, label, kind, parent_id, node_kind, status, host, runs, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          node.id,
          node.label,
          node.kind,
          node.parent_id,
          node.node_kind || null,
          node.status || null,
          node.host || null,
          node.runs || null,
          node.sort_order || 0,
        ]
      )
    }

    // Seed Edges
    const edgesToSeed = [
      { id: 'e7-3', source: 'n-7', target: 'n-3' },
      { id: 'e1-2', source: 'n-1', target: 'n-2' },
      { id: 'e2-3', source: 'n-2', target: 'n-3' },
      { id: 'e2-5', source: 'n-2', target: 'n-5' },
      { id: 'e4-5', source: 'n-4', target: 'n-5' },
      { id: 'e3-6', source: 'n-3', target: 'n-6' },
      { id: 'e5-6', source: 'n-5', target: 'n-6' },
    ]

    for (const edge of edgesToSeed) {
      await run('INSERT INTO edges (id, source, target) VALUES (?, ?, ?)', [edge.id, edge.source, edge.target])
    }

    // Seed Node Logs
    const logsToSeed = [
      { node_id: 'n-1', timestamp: new Date().toISOString(), level: 'INFO', message: 'Ingest Gateway service initialized.' },
      { node_id: 'n-1', timestamp: new Date().toISOString(), level: 'INFO', message: 'Processed 852 batches successfully.' },
      { node_id: 'n-2', timestamp: new Date().toISOString(), level: 'INFO', message: 'Validator pipeline active.' },
      { node_id: 'n-3', timestamp: new Date().toISOString(), level: 'INFO', message: 'Aggregator synchronized with Domain A.' },
      { node_id: 'n-6', timestamp: new Date().toISOString(), level: 'WARN', message: 'High network latency detected on ctm-edge-01.' },
      { node_id: 'n-6', timestamp: new Date().toISOString(), level: 'ERROR', message: 'Failed connection attempt to remote sink.' },
    ]

    for (const log of logsToSeed) {
      await run(
        'INSERT INTO node_logs (node_id, timestamp, level, message) VALUES (?, ?, ?, ?)',
        [log.node_id, log.timestamp, log.level, log.message]
      )
    }

    console.log('Initial SQLite database seeding complete.')
  }
}

/** Helper function to reconstruct hierarchical NavItem[] tree from database rows */
export async function getNavTree() {
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

      if (row.kind === 'item') {
        item.data = {
          kind: row.node_kind,
          status: row.status,
          host: row.host,
          runs: row.runs,
          ...customData,
        }
      } else {
        item.data = {
          ...customData,
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
