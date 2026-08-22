/**
 * GET /api/logs/[nodeId] — recent logs for a node, newest first.
 * Capped at 200 rows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const { nodeId } = await params
  if (!nodeId) {
    return NextResponse.json({ error: 'Node ID is required' }, { status: 400 })
  }
  try {
    const logs = await db.nodeLog.findMany({
      where: { nodeId },
      orderBy: { id: 'desc' },
      take: 200,
    })
    return NextResponse.json(
      logs.map((l) => ({
        id: l.id,
        nodeId: l.nodeId,
        timestamp: l.timestamp,
        level: l.level,
        message: l.message,
      })),
    )
  } catch (err) {
    console.error('Error fetching node logs:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
