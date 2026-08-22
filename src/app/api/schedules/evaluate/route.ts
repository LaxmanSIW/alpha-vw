/**
 * POST /api/schedules/evaluate — get all eligible run dates for a year.
 *
 * Hydrates CALENDARS from the database, then runs the RBC engine across
 * every day of the year.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getEligibleRunDates } from '@/lib/schedule-engine'

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const { config, year } = body ?? {}
    if (!config) {
      return NextResponse.json({ error: 'Config object is required' }, { status: 400 })
    }

    const targetYear = Number(year) || new Date().getUTCFullYear()

    const calendarsMap = await buildCalendarsMap()
    const fullConfig = {
      ...config,
      CALENDARS: { ...calendarsMap, ...((config.CALENDARS as object) || {}) },
    }

    const result = getEligibleRunDates(fullConfig, targetYear)
    if (!Array.isArray(result)) {
      // Validation failed
      return NextResponse.json(
        { success: false, year: targetYear, eligibleDates: [], errors: result.errors, warnings: result.warnings },
        { status: 400 },
      )
    }

    const eligibleDates = result.map((d) => d.toISOString().split('T')[0])
    return NextResponse.json({ success: true, year: targetYear, eligibleDates })
  } catch (err) {
    console.error('Error evaluating schedule dates:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
