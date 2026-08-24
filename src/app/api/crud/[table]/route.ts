/**
 * CRUD routes for /api/crud/[table] — generic table read/write with strict
 * validation. See lib/crud-schemas.ts for the column allowlist that closes
 * the original SQL-injection vector.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ALLOWED_TABLES,
  createSchema,
  updateSchema,
  normalizeRecord,
  normalizeKey,
  getPrimaryKeyColumn,
  prepareNavNodeRecord,
  syncNodeFieldValues,
  invalidateScheduleCache,
  type CrudTable,
} from '@/lib/crud-schemas'

// ─── GET /api/crud/[table] ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table } = await params
  if (!ALLOWED_TABLES.includes(table as CrudTable)) {
    return NextResponse.json({ error: `Invalid table: ${table}` }, { status: 400 })
  }

  try {
    const rows = await fetchTableRows(table as CrudTable)
    return NextResponse.json(rows)
  } catch (err) {
    console.error(`Error fetching ${table}:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function fetchTableRows(table: CrudTable) {
  switch (table) {
    case 'modules':
      return db.module.findMany()
    case 'viewpoints':
      return db.viewpoint.findMany()
    case 'nav_nodes': {
      const [rows, activeFieldDefs] = await Promise.all([
        db.navNode.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
        db.fieldDefinition.findMany({ where: { isActive: 1 }, select: { key: true } }),
      ])
      const activeKeys = new Set(activeFieldDefs.flatMap((f) => [f.key, normalizeKey(f.key)]))
      return rows.map((r) => {
        const { data, ...rest } = r
        let extra: Record<string, unknown> = {}
        if (data) {
          try { extra = JSON.parse(data) as Record<string, unknown> } catch { /* ignore */ }
        }
        const normalizedExtra: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(extra)) {
          const normKey = normalizeKey(k)
          if (!(normKey in rest) && (activeKeys.has(k) || activeKeys.has(normKey))) {
            normalizedExtra[normKey] = v
          }
        }
        return { ...rest, ...normalizedExtra }
      })
    }
    case 'edges':
      return db.edge.findMany()
    case 'node_logs':
      return db.nodeLog.findMany({ orderBy: { id: 'desc' } })
    case 'field_definitions': {
      const rows = await db.fieldDefinition.findMany({ orderBy: { sortOrder: 'asc' } })
      const seen = new Set<string>()
      const result: typeof rows = []
      for (const r of rows) {
        const normKey = normalizeKey(r.key)
        if (seen.has(normKey)) continue
        seen.add(normKey)
        result.push({ ...r, key: normKey })
      }
      return result
    }
    case 'node_field_values':
      return db.nodeFieldValue.findMany()
    case 'calendars':
      return db.calendar.findMany()
    case 'schedule_configs':
      return db.scheduleConfig.findMany()
    case 'app_config':
      return db.appConfig.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] })
  }
}

// ─── POST /api/crud/[table] (create one) ─────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table } = await params
  if (!ALLOWED_TABLES.includes(table as CrudTable)) {
    return NextResponse.json({ error: `Invalid table: ${table}` }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse({ table, data: body })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const rawData = normalizeRecord(table as CrudTable, parsed.data.data)
  if (Object.keys(rawData).length === 0) {
    return NextResponse.json({ error: 'No valid columns provided' }, { status: 400 })
  }

  try {
    const insertedId = await createRecord(table as CrudTable, rawData)
    await invalidateScheduleCache(table as CrudTable)
    return NextResponse.json({ success: true, id: insertedId })
  } catch (err) {
    console.error(`Error inserting into ${table}:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function createRecord(table: CrudTable, rawData: Record<string, unknown>): Promise<string | number> {
  switch (table) {
    case 'modules': {
      const id = String(rawData.id ?? '')
      if (id) {
        const res = await db.module.upsert({ where: { id }, create: rawData as never, update: rawData as never })
        return res.id
      }
      return (await db.module.create({ data: rawData as never })).id
    }
    case 'viewpoints': {
      const id = String(rawData.id ?? '')
      if (id) {
        const res = await db.viewpoint.upsert({ where: { id }, create: rawData as never, update: rawData as never })
        return res.id
      }
      return (await db.viewpoint.create({ data: rawData as never })).id
    }
    case 'nav_nodes': {
      const activeFieldDefs = await db.fieldDefinition.findMany({ where: { isActive: 1 }, select: { key: true } })
      const validKeys = new Set(activeFieldDefs.flatMap((f) => [f.key, normalizeKey(f.key)]))
      const navData = prepareNavNodeRecord(rawData, validKeys)
      const id = String(navData.id ?? rawData.id ?? '')
      let createdId = id
      if (id) {
        const res = await db.navNode.upsert({ where: { id }, create: navData as never, update: navData as never })
        createdId = res.id
      } else {
        const created = await db.navNode.create({ data: navData as never })
        createdId = created.id
      }
      await syncNodeFieldValues(createdId, rawData)
      return createdId
    }
    case 'edges': {
      const id = String(rawData.id ?? '')
      if (id) {
        const res = await db.edge.upsert({ where: { id }, create: rawData as never, update: rawData as never })
        return res.id
      }
      return (await db.edge.create({ data: rawData as never })).id
    }
    case 'node_logs': {
      const created = await db.nodeLog.create({ data: rawData as never })
      return created.id
    }
    case 'field_definitions': {
      const key = String(rawData.key ?? '')
      if (key) {
        const res = await db.fieldDefinition.upsert({ where: { key }, create: rawData as never, update: rawData as never })
        return res.key
      }
      return (await db.fieldDefinition.create({ data: rawData as never })).key
    }
    case 'node_field_values': {
      const nodeId = String(rawData.nodeId ?? '')
      const fieldKey = String(rawData.fieldKey ?? '')
      if (nodeId && fieldKey) {
        await db.nodeFieldValue.upsert({
          where: { nodeId_fieldKey: { nodeId, fieldKey } },
          create: rawData as never,
          update: rawData as never,
        })
        return `${nodeId}__${fieldKey}`
      }
      await db.nodeFieldValue.create({ data: rawData as never })
      return 'ok'
    }
    case 'calendars': {
      const id = String(rawData.id ?? '')
      if (id) {
        const res = await db.calendar.upsert({ where: { id }, create: rawData as never, update: rawData as never })
        return res.id
      }
      return (await db.calendar.create({ data: rawData as never })).id
    }
    case 'schedule_configs': {
      const id = String(rawData.id ?? '')
      if (id) {
        const res = await db.scheduleConfig.upsert({ where: { id }, create: rawData as never, update: rawData as never })
        return res.id
      }
      return (await db.scheduleConfig.create({ data: rawData as never })).id
    }
    case 'app_config': {
      const key = String(rawData.key ?? '')
      if (key) {
        const res = await db.appConfig.upsert({ where: { key }, create: rawData as never, update: rawData as never })
        return res.key
      }
      return (await db.appConfig.create({ data: rawData as never })).key
    }
  }
}

// ─── PUT /api/crud/[table]/[id] (in [id]/route.ts) ───────────────────────
// ─── DELETE /api/crud/[table]/[id] (in [id]/route.ts) ────────────────────

export { updateSchema, getPrimaryKeyColumn }
