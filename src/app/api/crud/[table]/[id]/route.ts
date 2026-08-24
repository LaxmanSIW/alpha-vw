/**
 * PUT /api/crud/[table]/[id] — update one record.
 * DELETE /api/crud/[table]/[id] — delete one record.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ALLOWED_TABLES,
  updateSchema,
  normalizeRecord,
  normalizeKey,
  getPrimaryKeyColumn,
  prepareNavNodeRecord,
  syncNodeFieldValues,
  cleanupNavNodeDataForKey,
  invalidateScheduleCache,
  type CrudTable,
} from '@/lib/crud-schemas'

// ─── PUT ────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> },
) {
  const { table, id } = await params
  if (!ALLOWED_TABLES.includes(table as CrudTable)) {
    return NextResponse.json({ error: `Invalid table: ${table}` }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse({ table, id, data: body })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const rawData = normalizeRecord(table as CrudTable, parsed.data.data)
  const pk = getPrimaryKeyColumn(table as CrudTable)
  // Strip the PK from the update payload
  if (pk in rawData) delete rawData[pk]
  if ('id' in rawData) delete rawData.id

  if (Object.keys(rawData).length === 0) {
    return NextResponse.json({ error: 'No valid columns provided' }, { status: 400 })
  }

  try {
    await updateRecord(table as CrudTable, id, rawData)
    await invalidateScheduleCache(table as CrudTable)
    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error(`Error updating ${table}/${id}:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function updateRecord(table: CrudTable, id: string, data: Record<string, unknown>) {
  switch (table) {
    case 'modules':
      await db.module.update({ where: { id }, data: data as never })
      break
    case 'viewpoints':
      await db.viewpoint.update({ where: { id }, data: data as never })
      break
    case 'nav_nodes': {
      const activeFieldDefs = await db.fieldDefinition.findMany({ where: { isActive: 1 }, select: { key: true } })
      const validKeys = new Set(activeFieldDefs.flatMap((f) => [f.key, normalizeKey(f.key)]))
      const navData = prepareNavNodeRecord(data, validKeys)
      await db.navNode.update({ where: { id }, data: navData as never })
      await syncNodeFieldValues(id, data)
      break
    }
    case 'edges':
      await db.edge.update({ where: { id }, data: data as never })
      break
    case 'node_logs':
      await db.nodeLog.update({ where: { id: Number(id) }, data: data as never })
      break
    case 'field_definitions':
      await db.fieldDefinition.update({ where: { key: id }, data: data as never })
      if ('isActive' in data && Number(data.isActive) === 0) {
        await cleanupNavNodeDataForKey(id)
      }
      break
    case 'node_field_values': {
      const { nodeId, fieldKey } = parseCompositeId(id)
      await db.nodeFieldValue.update({
        where: { nodeId_fieldKey: { nodeId, fieldKey } },
        data: data as never,
      })
      break
    }
    case 'calendars':
      await db.calendar.update({ where: { id }, data: data as never })
      break
    case 'schedule_configs':
      await db.scheduleConfig.update({ where: { id }, data: data as never })
      break
    case 'app_config':
      await db.appConfig.update({ where: { key: id }, data: data as never })
      break
  }
}

function parseCompositeId(id: string): { nodeId: string; fieldKey: string } {
  const [nodeId, fieldKey] = id.split('__')
  if (!nodeId || !fieldKey) throw new Error('Invalid composite id; expected nodeId__fieldKey')
  return { nodeId, fieldKey }
}

// ─── DELETE ────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> },
) {
  const { table, id } = await params
  if (!ALLOWED_TABLES.includes(table as CrudTable)) {
    return NextResponse.json({ error: `Invalid table: ${table}` }, { status: 400 })
  }

  try {
    // Protected field check
    if (table === 'field_definitions') {
      const target = await db.fieldDefinition.findUnique({ where: { key: id } })
      if (target && target.isProtected === 1) {
        return NextResponse.json(
          { error: 'Cannot delete protected core system field.' },
          { status: 400 },
        )
      }
    }

    await deleteRecord(table as CrudTable, id)
    await invalidateScheduleCache(table as CrudTable)
    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error(`Error deleting from ${table}:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function deleteRecord(table: CrudTable, id: string) {
  switch (table) {
    case 'modules':
      await db.module.delete({ where: { id } })
      break
    case 'viewpoints':
      await db.viewpoint.delete({ where: { id } })
      break
    case 'nav_nodes':
      await db.navNode.delete({ where: { id } })
      break
    case 'edges':
      await db.edge.delete({ where: { id } })
      break
    case 'node_logs':
      await db.nodeLog.delete({ where: { id: Number(id) } })
      break
    case 'field_definitions':
      await db.fieldDefinition.delete({ where: { key: id } })
      await cleanupNavNodeDataForKey(id)
      break
    case 'node_field_values': {
      const { nodeId, fieldKey } = parseCompositeId(id)
      await db.nodeFieldValue.delete({ where: { nodeId_fieldKey: { nodeId, fieldKey } } })
      break
    }
    case 'calendars':
      await db.calendar.delete({ where: { id } })
      break
    case 'schedule_configs':
      await db.scheduleConfig.delete({ where: { id } })
      break
    case 'app_config':
      await db.appConfig.delete({ where: { key: id } })
      break
  }
}
