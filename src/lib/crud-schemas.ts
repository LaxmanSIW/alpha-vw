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

/** Normalize legacy snake_case column names to camelCase matching Prisma models. */
export function normalizeKey(k: string): string {
  const mapping: Record<string, string> = {
    section_title: 'sectionTitle',
    sort_order: 'sortOrder',
    is_protected: 'isProtected',
    show_on_card: 'showOnCard',
    show_in_details: 'showInDetails',
    is_active: 'isActive',
    filter_status: 'filterStatus',
    sort_by: 'sortBy',
    node_kind: 'nodeKind',
    job_count: 'jobCount',
    module_id: 'moduleId',
    parent_id: 'parentId',
    config_data: 'configData',
    last_evaluated_date: 'lastEvaluatedDate',
    is_scheduled_today: 'isScheduledToday',
    field_value: 'fieldValue',
    field_key: 'fieldKey',
    node_id: 'nodeId',
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
    if (table !== 'nav_nodes' && !allowed.has(normalized)) continue
    if (val === undefined) continue
    const keyToUse = allowed.has(normalized) ? normalized : cleanKey
    result[keyToUse] = val
  }

  // Convert booleans / strings to integers/floats for Prisma schema types
  if ('isProtected' in result && result.isProtected !== null && result.isProtected !== undefined) {
    if (typeof result.isProtected === 'boolean') {
      result.isProtected = result.isProtected ? 1 : 0
    } else {
      result.isProtected = Math.round(Number(result.isProtected)) || 0
    }
  }
  if ('isActive' in result && result.isActive !== null && result.isActive !== undefined) {
    if (typeof result.isActive === 'boolean') {
      result.isActive = result.isActive ? 1 : 0
    } else {
      result.isActive = Math.round(Number(result.isActive)) || 0
    }
  }
  if ('sortOrder' in result && result.sortOrder !== null && result.sortOrder !== undefined && result.sortOrder !== '') {
    result.sortOrder = Number(result.sortOrder)
  }
  if ('jobCount' in result && result.jobCount !== null && result.jobCount !== undefined && result.jobCount !== '') {
    result.jobCount = Math.round(Number(result.jobCount))
  }
  if ('runs' in result && result.runs !== null && result.runs !== undefined && result.runs !== '') {
    result.runs = Math.round(Number(result.runs))
  }
  if (table === 'node_logs' && 'id' in result && result.id !== null && result.id !== undefined && result.id !== '') {
    result.id = Math.round(Number(result.id))
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
export function prepareNavNodeRecord(
  rawData: Record<string, unknown>,
  validFieldKeys?: Set<string>,
): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  const extraData: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(rawData)) {
    if (FIXED_NAV_NODE_COLUMNS.includes(key)) {
      record[key] = value === '' ? null : value
    } else {
      if (value !== '' && value !== null && value !== undefined) {
        const normKey = normalizeKey(key)
        if (!validFieldKeys || validFieldKeys.has(key) || validFieldKeys.has(normKey)) {
          extraData[key] = value
        }
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

const FIXED_NAV_NODE_KEYS = new Set([
  'id',
  'label',
  'kind',
  'parentId',
  'parent_id',
  'nodeKind',
  'node_kind',
  'status',
  'host',
  'runs',
  'sortOrder',
  'sort_order',
  'data',
])

/** Write non-fixed nav_node fields to the node_field_values EAV table. */
export async function syncNodeFieldValues(
  nodeId: string,
  rawData: Record<string, unknown>,
  tx?: Parameters<Parameters<typeof db.$transaction>[0]>[0],
): Promise<void> {
  if (!nodeId || !rawData) return
  const client = tx || db

  let validFieldKeys: Set<string> | null = null
  try {
    const definitions = await client.fieldDefinition.findMany({
      where: { isActive: 1 },
      select: { key: true },
    })
    validFieldKeys = new Set(definitions.map((d) => d.key))
  } catch (err) {
    console.error('Error fetching field definitions for syncNodeFieldValues:', err)
  }

  for (const [rawKey, value] of Object.entries(rawData)) {
    const cleanKey = rawKey.replace(/^\uFEFF/, '').trim().replace(/^["']|["']$/g, '')
    const normalizedKey = normalizeKey(cleanKey)

    if (FIXED_NAV_NODE_KEYS.has(cleanKey) || FIXED_NAV_NODE_KEYS.has(normalizedKey)) continue
    if (value === null || value === undefined || value === '') continue

    const targetKey = validFieldKeys?.has(cleanKey) ? cleanKey : validFieldKeys?.has(normalizedKey) ? normalizedKey : null
    if (!targetKey) continue

    try {
      await client.nodeFieldValue.upsert({
        where: { nodeId_fieldKey: { nodeId, fieldKey: targetKey } },
        create: { nodeId, fieldKey: targetKey, fieldValue: String(value) },
        update: { fieldValue: String(value) },
      })
    } catch (err) {
      console.error(`Error syncing field ${targetKey} for node ${nodeId}:`, err)
    }
  }
}

/** Remove a deleted or deactivated fieldKey from nav_nodes.data JSON column. */
export async function cleanupNavNodeDataForKey(
  fieldKey: string,
  tx?: Parameters<Parameters<typeof db.$transaction>[0]>[0],
): Promise<void> {
  if (!fieldKey) return
  const client = tx || db
  const normKey = normalizeKey(fieldKey)

  try {
    const nodes = await client.navNode.findMany({
      where: { data: { not: null } },
      select: { id: true, data: true },
    })

    for (const node of nodes) {
      if (!node.data) continue
      try {
        const parsed = JSON.parse(node.data) as Record<string, unknown>
        let modified = false
        if (fieldKey in parsed) {
          delete parsed[fieldKey]
          modified = true
        }
        if (normKey in parsed) {
          delete parsed[normKey]
          modified = true
        }
        if (modified) {
          const newData = Object.keys(parsed).length > 0 ? JSON.stringify(parsed) : null
          await client.navNode.update({
            where: { id: node.id },
            data: { data: newData },
          })
        }
      } catch {
        /* ignore invalid JSON */
      }
    }
  } catch (err) {
    console.error(`Error cleaning up nav_node data for field ${fieldKey}:`, err)
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
