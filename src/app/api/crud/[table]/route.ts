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
      const rows = await db.navNode.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
      return rows.map((r) => {
        const { data, ...rest } = r
        let extra: Record<string, unknown> = {}
        if (data) {
          try { extra = JSON.parse(data) as Record<string, unknown> } catch { /* ignore */ }
        }
        return { ...rest, ...extra }
      })
    }
    case 'edges':
      return db.edge.findMany()
    case 'node_logs':
      return db.nodeLog.findMany({ orderBy: { id: 'desc' } })
    case 'field_definitions':
      return db.fieldDefinition.findMany({ orderBy: { sortOrder: 'asc' } })
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
    case 'modules':
      return (await db.module.create({ data: rawData as never })).id
    case 'viewpoints':
      return (await db.viewpoint.create({ data: rawData as never })).id
    case 'nav_nodes': {
      const navData = prepareNavNodeRecord(rawData)
      const created = await db.navNode.create({ data: navData as never })
      await syncNodeFieldValues(created.id, rawData)
      return created.id
    }
    case 'edges':
      return (await db.edge.create({ data: rawData as never })).id
    case 'node_logs': {
      const created = await db.nodeLog.create({ data: rawData as never })
      return created.id
    }
    case 'field_definitions':
      return (await db.fieldDefinition.create({ data: rawData as never })).key
    case 'node_field_values': {
      await db.nodeFieldValue.create({ data: rawData as never })
      return 'ok'
    }
    case 'calendars':
      return (await db.calendar.create({ data: rawData as never })).id
    case 'schedule_configs':
      return (await db.scheduleConfig.create({ data: rawData as never })).id
    case 'app_config':
      return (await db.appConfig.create({ data: rawData as never })).key
  }
}

// ─── PUT /api/crud/[table]/[id] (in [id]/route.ts) ───────────────────────
// ─── DELETE /api/crud/[table]/[id] (in [id]/route.ts) ────────────────────

export { updateSchema, getPrimaryKeyColumn }
