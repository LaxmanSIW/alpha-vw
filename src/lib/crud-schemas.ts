/**
 * CRUD schemas + helpers — strict per-table validation that eliminates the
 * SQL injection vector on column names that the original code had.
 *
 * Each allowed table has:
 *   - a fixed list of column names (no user-supplied keys pass through)
 *   - a Zod schema for create / update payloads
 *   - a Prisma client accessor
 *
 * Anything not in the column list is rejected with a 400.
 */

import { z } from 'zod'
import { db } from './db'

export type CrudTable =
  | 'modules'
  | 'viewpoints'
  | 'nav_nodes'
  | 'edges'
  | 'node_logs'
  | 'field_definitions'
  | 'node_field_values'
  | 'calendars'
  | 'schedule_configs'
  | 'app_config'

export const ALLOWED_TABLES: CrudTable[] = [
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

// ─── Column allowlists ────────────────────────────────────────────────────
// Critical: any column not listed here is REJECTED. This closes the SQL
// injection vector that the original PUT endpoint had on column names.

const TABLE_COLUMNS: Record<CrudTable, string[]> = {
  modules: ['id', 'label'],
  viewpoints: ['id', 'moduleId', 'label', 'description', 'folder', 'jobCount', 'scope', 'filterStatus', 'grouping', 'sortBy'],
  nav_nodes: ['id', 'label', 'kind', 'parentId', 'nodeKind', 'status', 'host', 'runs', 'sortOrder', 'data'],
  edges: ['id', 'source', 'target'],
  node_logs: ['id', 'nodeId', 'timestamp', 'level', 'message'],
  field_definitions: ['key', 'label', 'sectionTitle', 'role', 'format', 'sortOrder', 'isProtected', 'showOnCard', 'showInDetails', 'isActive'],
  node_field_values: ['nodeId', 'fieldKey', 'fieldValue'],
  calendars: ['id', 'name', 'workdays', 'holidays'],
  schedule_configs: ['id', 'name', 'configData', 'lastEvaluatedDate', 'isScheduledToday'],
  app_config: ['key', 'category', 'label', 'value', 'sortOrder'],
}

// ─── Zod schemas ───────────────────────────────────────────────────────────
// `passthrough()` allows extra keys (EAV fields) but they're filtered out
// by normalizeRecord before hitting the DB.

const recordSchema = z.record(z.string(), z.unknown())

export const createSchema = z.object({
  table: z.enum(ALLOWED_TABLES as [CrudTable, ...CrudTable[]]),
  data: recordSchema,
})

export const updateSchema = z.object({
  table: z.enum(ALLOWED_TABLES as [CrudTable, ...CrudTable[]]),
  id: z.union([z.string(), z.number()]),
  data: recordSchema,
})

export const bulkCreateSchema = z.object({
  table: z.enum(ALLOWED_TABLES as [CrudTable, ...CrudTable[]]),
  rows: z.array(recordSchema).min(1),
})

// ─── Helpers ───────────────────────────────────────────────────────────────

/** camelCase → snake_case normalization for legacy column names. */
function normalizeKey(k: string): string {
  const mapping: Record<string, string> = {
    sectionTitle: 'section_title',
    sortOrder: 'sort_order',
    isProtected: 'is_protected',
    showOnCard: 'show_on_card',
    showInDetails: 'show_in_details',
    isActive: 'is_active',
    filterStatus: 'filter_status',
    sortBy: 'sort_by',
    nodeKind: 'node_kind',
    jobCount: 'job_count',
    moduleId: 'module_id',
    parentId: 'parent_id',
    configData: 'config_data',
    lastEvaluatedDate: 'last_evaluated_date',
    isScheduledToday: 'is_scheduled_today',
    fieldValue: 'field_value',
    fieldKey: 'field_key',
    nodeId: 'node_id',
  }
  return mapping[k] ?? k
}

/** Strip BOM, quotes, whitespace from key names; reject keys not in the column list. */
export function normalizeRecord(table: CrudTable, rawData: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(TABLE_COLUMNS[table])
  const result: Record<string, unknown> = {}

  for (const [rawKey, val] of Object.entries(rawData)) {
    const cleanKey = rawKey.replace(/^\uFEFF/, '').trim().replace(/^["']|["']$/g, '')
    const normalized = normalizeKey(cleanKey)
    if (!allowed.has(normalized)) continue
    if (val === undefined) continue
    result[normalized] = val
  }

  // Convert booleans to integers for is_protected / is_active
  if ('is_protected' in result && typeof result.is_protected === 'boolean') {
    result.is_protected = result.is_protected ? 1 : 0
  }
  if ('is_active' in result && typeof result.is_active === 'boolean') {
    result.is_active = result.is_active ? 1 : 0
  }

  // For edges, only keep the three allowed columns
  if (table === 'edges') {
    const edgeCols = ['id', 'source', 'target']
    for (const k of Object.keys(result)) {
      if (!edgeCols.includes(k)) delete result[k]
    }
  }

  return result
}

export function getPrimaryKeyColumn(table: CrudTable): 'id' | 'key' {
  return table === 'field_definitions' || table === 'app_config' ? 'key' : 'id'
}

// ─── nav_nodes special handling ────────────────────────────────────────────

const FIXED_NAV_NODE_COLUMNS = ['id', 'label', 'kind', 'parentId', 'nodeKind', 'status', 'host', 'runs', 'sortOrder', 'data']

/** Split a nav_nodes record into fixed columns + JSON blob in `data`. */
export function prepareNavNodeRecord(rawData: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  const extraData: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(rawData)) {
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

/** Write non-fixed nav_node fields to the node_field_values EAV table. */
export async function syncNodeFieldValues(nodeId: string, rawData: Record<string, unknown>): Promise<void> {
  if (!nodeId || !rawData) return
  const ignore = new Set(['id', 'label', 'kind', 'parentId', 'sortOrder', 'data'])
  for (const [key, value] of Object.entries(rawData)) {
    if (ignore.has(key)) continue
    if (value === null || value === undefined || value === '') continue
    try {
      await db.nodeFieldValue.upsert({
        where: { nodeId_fieldKey: { nodeId, fieldKey: key } },
        create: { nodeId, fieldKey: key, fieldValue: String(value) },
        update: { fieldValue: String(value) },
      })
    } catch (err) {
      console.error(`Error syncing field ${key} for node ${nodeId}:`, err)
    }
  }
}

/** Invalidate schedule cache when relevant tables change. */
export async function invalidateScheduleCache(table: CrudTable): Promise<void> {
  if (table === 'schedule_configs' || table === 'calendars' || table === 'app_config') {
    try {
      await db.scheduleConfig.updateMany({
        where: {},
        data: { lastEvaluatedDate: null },
      })
    } catch (err) {
      console.error('Error invalidating schedule cache:', err)
    }
  }
}
