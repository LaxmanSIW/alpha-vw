/**
 * POST /api/schedules/evaluate-date — is a single date eligible?
 *
 * Returns { isEligible, effectiveRunDate } where effectiveRunDate accounts
 * for the confirmation calendar policy.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evaluateScheduledDate } from '@/lib/schedule-engine'

async function buildCalendarsMap(): Promise<Record<string, { WORKDAYS: number[]; HOLIDAYS: string[] }>> {
  const calRows = await db.calendar.findMany()
  const calendarsMap: Record<string, { WORKDAYS: number[]; HOLIDAYS: string[] }> = {}
  for (const c of calRows) {
    let workdays = [1, 2, 3, 4, 5]
    let holidays: string[] = []
    try {
      if (c.workdays) workdays = JSON.parse(c.workdays) as number[]
      if (c.holidays) holidays = JSON.parse(c.holidays) as string[]
    } catch { /* ignore */ }
    calendarsMap[c.name] = { WORKDAYS: workdays, HOLIDAYS: holidays }
  }
  return calendarsMap
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const { config, date } = body ?? {}
    if (!config || !date) {
      return NextResponse.json(
        { error: 'Config object and date string (YYYY-MM-DD) are required' },
        { status: 400 },
      )
    }

    if (typeof date !== 'string' || !DATE_RE.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Expected YYYY-MM-DD' }, { status: 400 })
    }

    const [y, m, d] = date.split('-').map(Number)
    const targetDate = new Date(Date.UTC(y, m - 1, d))

    const calendarsMap = await buildCalendarsMap()
    const fullConfig = {
      ...config,
      CALENDARS: { ...calendarsMap, ...((config.CALENDARS as object) || {}) },
    }

    const effectiveDate = evaluateScheduledDate(targetDate, fullConfig)
    const isEligible = effectiveDate !== null
    const effectiveRunDate = effectiveDate ? effectiveDate.toISOString().split('T')[0] : null

    return NextResponse.json({ success: true, date, isEligible, effectiveRunDate })
  } catch (err) {
    console.error('Error evaluating single date:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
