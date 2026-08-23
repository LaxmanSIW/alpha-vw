/**
 * POST /api/crud/bulk/[table] — bulk insert rows in a single transaction.
 * Wraps the inserts in BEGIN/COMMIT so a failure rolls back the partial state.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ALLOWED_TABLES,
  bulkCreateSchema,
  normalizeRecord,
  prepareNavNodeRecord,
  syncNodeFieldValues,
  invalidateScheduleCache,
  type CrudTable,
} from '@/lib/crud-schemas'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table } = await params
  if (!ALLOWED_TABLES.includes(table as CrudTable)) {
    return NextResponse.json({ error: `Invalid table: ${table}` }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const rawRows = Array.isArray(body) ? body : body?.rows
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return NextResponse.json({ error: 'No rows provided for bulk insertion' }, { status: 400 })
  }

  const parsed = bulkCreateSchema.safeParse({ table, rows: rawRows })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    let insertedCount = 0

    // Use a single transaction — atomic insert or rollback with extended timeout for large datasets
    await db.$transaction(
      async (tx) => {
        for (const rawRow of parsed.data.rows) {
          const rowData = normalizeRecord(table as CrudTable, rawRow)
          if (Object.keys(rowData).length === 0) continue

          let recordData: Record<string, unknown> = rowData
          if (table === 'nav_nodes') {
            recordData = prepareNavNodeRecord(rowData)
          }

          // Use upsert semantics (insert-or-replace) so re-imports don't fail
          await upsertRow(tx, table as CrudTable, recordData)

          if (table === 'nav_nodes') {
            const id = String(recordData.id ?? rawRow.id)
            if (id) await syncNodeFieldValues(id, rawRow, tx)
          }
          insertedCount++
        }
      },
      {
        maxWait: 10000,
        timeout: 60000,
      },
    )

    await invalidateScheduleCache(table as CrudTable)
    return NextResponse.json({ success: true, count: insertedCount })
  } catch (err) {
    console.error(`Error in bulk insert into ${table}:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Per-table upsert ──────────────────────────────────────────────────────
// Prisma upsert requires the full PK in the where clause. Since we may not
// have it for some inserts (e.g. auto-increment node_logs), fall back to
// raw INSERT OR REPLACE for SQLite via $executeRawUnsafe where needed.

async function upsertRow(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  table: CrudTable,
  data: Record<string, unknown>,
) {
  switch (table) {
    case 'modules':
      await tx.module.upsert({
        where: { id: String(data.id) },
        create: data as never,
        update: data as never,
      })
      break
    case 'viewpoints':
      await tx.viewpoint.upsert({
        where: { id: String(data.id) },
        create: data as never,
        update: data as never,
      })
      break
    case 'nav_nodes':
      await tx.navNode.upsert({
        where: { id: String(data.id) },
        create: data as never,
        update: data as never,
      })
      break
    case 'edges':
      await tx.edge.upsert({
        where: { id: String(data.id) },
        create: data as never,
        update: data as never,
      })
      break
    case 'node_logs':
      await tx.nodeLog.create({ data: data as never })
      break
    case 'field_definitions':
      await tx.fieldDefinition.upsert({
        where: { key: String(data.key) },
        create: data as never,
        update: data as never,
      })
      break
    case 'node_field_values': {
      const nodeId = String(data.nodeId)
      const fieldKey = String(data.fieldKey)
      await tx.nodeFieldValue.upsert({
        where: { nodeId_fieldKey: { nodeId, fieldKey } },
        create: data as never,
        update: data as never,
      })
      break
    }
    case 'calendars':
      await tx.calendar.upsert({
        where: { id: String(data.id) },
        create: data as never,
        update: data as never,
      })
      break
    case 'schedule_configs':
      await tx.scheduleConfig.upsert({
        where: { id: String(data.id) },
        create: data as never,
        update: data as never,
      })
      break
    case 'app_config':
      await tx.appConfig.upsert({
        where: { key: String(data.key) },
        create: data as never,
        update: data as never,
      })
      break
  }
}
