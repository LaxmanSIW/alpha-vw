/**
 * POST /api/crud/reset-topology — Purge all nodes, edges, node field values, and node logs.
 * Leaves field definitions, app config, calendars, modules, viewpoints, and schedule configs intact.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateScheduleCache } from '@/lib/crud-schemas'

export async function POST() {
  try {
    const result = await db.$transaction(async (tx) => {
      const nodeCount = await tx.navNode.count()
      const edgeCount = await tx.edge.count()
      const fieldValueCount = await tx.nodeFieldValue.count()
      const logCount = await tx.nodeLog.count()

      await tx.edge.deleteMany({})
      await tx.nodeFieldValue.deleteMany({})
      await tx.nodeLog.deleteMany({})
      await tx.navNode.deleteMany({})

      return {
        edges: edgeCount,
        fieldValues: fieldValueCount,
        logs: logCount,
        nodes: nodeCount,
      }
    })

    await invalidateScheduleCache('nav_nodes')
    await invalidateScheduleCache('edges')

    return NextResponse.json({ success: true, deleted: result })
  } catch (err) {
    console.error('Error purging topology data:', err)
    return NextResponse.json({ error: 'Failed to purge topology data' }, { status: 500 })
  }
}
