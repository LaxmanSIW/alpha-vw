/**
 * GET /api/business-date — current business date + day-start threshold.
 *
 * Business date rolls over at the configured threshold (e.g. 03:00) so before
 * the threshold the business date is still the previous calendar day.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evaluateScheduledDate } from '@/lib/schedule-engine'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const [hourRow, minuteRow] = await Promise.all([
      db.appConfig.findUnique({ where: { key: 'business.dayStartHour' } }),
      db.appConfig.findUnique({ where: { key: 'business.dayStartMinute' } }),
    ])

    const startHour = hourRow ? parseInt(hourRow.value, 10) || 0 : 0
    const startMinute = minuteRow ? parseInt(minuteRow.value, 10) || 0 : 0

    const now = new Date()
    const beforeThreshold =
      now.getHours() < startHour ||
      (now.getHours() === startHour && now.getMinutes() < startMinute)

    const businessDate = new Date(now)
    if (beforeThreshold) businessDate.setDate(businessDate.getDate() - 1)

    const y = businessDate.getFullYear()
    const m = String(businessDate.getMonth() + 1).padStart(2, '0')
    const d = String(businessDate.getDate()).padStart(2, '0')
    const businessDateStr = `${y}-${m}-${d}`

    // Sync schedule configs
    const [schedConfigs, calendars] = await Promise.all([
      db.scheduleConfig.findMany(),
      db.calendar.findMany(),
    ])

    const calendarsMap: Record<string, { WORKDAYS: number[]; HOLIDAYS: string[] }> = {}
    for (const c of calendars) {
      let workdays = [1, 2, 3, 4, 5]
      let holidays: string[] = []
      try {
        if (c.workdays) workdays = JSON.parse(c.workdays) as number[]
        if (c.holidays) holidays = JSON.parse(c.holidays) as string[]
      } catch { /* ignore */ }
      calendarsMap[c.name] = { WORKDAYS: workdays, HOLIDAYS: holidays }
    }

    const evaluationEntries: Array<{ name: string; isScheduledToday: string }> = []
    const targetDateObj = new Date(Date.UTC(y, businessDate.getMonth(), businessDate.getDate()))

    await Promise.all(
      schedConfigs.map(async (sc) => {
        if (sc.lastEvaluatedDate === businessDateStr && sc.isScheduledToday) {
          evaluationEntries.push({ name: sc.name, isScheduledToday: sc.isScheduledToday })
          return
        }
        let isScheduledToday = 'No'
        try {
          const config = JSON.parse(sc.configData) as Record<string, unknown>
          const fullConfig = {
            ...config,
            CALENDARS: { ...calendarsMap, ...((config.CALENDARS as object) || {}) },
          }
          const effectiveDate = evaluateScheduledDate(targetDateObj, fullConfig)
          isScheduledToday = effectiveDate !== null ? 'Yes' : 'No'
        } catch { /* ignore */ }

        await db.scheduleConfig.update({
          where: { id: sc.id },
          data: { lastEvaluatedDate: businessDateStr, isScheduledToday },
        })
        evaluationEntries.push({ name: sc.name, isScheduledToday: isScheduledToday })
      }),
    )

    const sh = String(startHour).padStart(2, '0')
    const sm = String(startMinute).padStart(2, '0')

    return NextResponse.json({
      businessDate: businessDateStr,
      dayStart: `${sh}:${sm}`,
      serverTime: now.toISOString(),
      scheduleConfigsEvaluated: evaluationEntries,
    })
  } catch (err) {
    console.error('Error computing business date:', err)
    return NextResponse.json({ error: 'Failed to compute business date' }, { status: 500 })
  }
}
