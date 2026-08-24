/**
 * GET /api/data — combined dashboard payload (modules + viewpoints + navTree
 * + edges + fieldDefinitions + appConfig + businessDate).
 *
 * This is the only endpoint the dashboard shell needs on load. Syncs schedule
 * configs against the current business date in a single pass.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evaluateScheduledDate } from '@/lib/schedule-engine'
import type { NavItem } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Business date ──────────────────────────────────────────────────────────

async function computeBusinessDateInfo() {
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

  return { businessDate, businessDateStr, startHour, startMinute }
}

// ─── Schedule sync ────────────────────────────────────────────────────────

async function syncScheduleConfigsForBusinessDate(
  businessDateStr: string,
  businessDateObj: Date,
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>()
  const [schedConfigs, calendars] = await Promise.all([
    db.scheduleConfig.findMany(),
    db.calendar.findMany(),
  ])

  if (schedConfigs.length === 0) return resultMap

  // Build calendars map once (not per schedule)
  const calendarsMap: Record<string, { WORKDAYS: number[]; HOLIDAYS: string[] }> = {}
  for (const c of calendars) {
    let workdays = [1, 2, 3, 4, 5]
    let holidays: string[] = []
    try {
      if (c.workdays) workdays = JSON.parse(c.workdays) as number[]
      if (c.holidays) holidays = JSON.parse(c.holidays) as string[]
    } catch {
      // ignore parse errors, fall back
    }
    calendarsMap[c.name] = { WORKDAYS: workdays, HOLIDAYS: holidays }
  }

  // Update each schedule config in parallel
  await Promise.all(
    schedConfigs.map(async (sc) => {
      // Cache hit
      if (sc.lastEvaluatedDate === businessDateStr && sc.isScheduledToday) {
        resultMap.set(sc.name, sc.isScheduledToday)
        return
      }

      let isScheduledToday = 'No'
      try {
        const config = JSON.parse(sc.configData) as Record<string, unknown>
        const fullConfig = {
          ...config,
          CALENDARS: { ...calendarsMap, ...((config.CALENDARS as object) || {}) },
        }
        const targetDate = new Date(
          Date.UTC(businessDateObj.getFullYear(), businessDateObj.getMonth(), businessDateObj.getDate()),
        )
        const effectiveDate = evaluateScheduledDate(targetDate, fullConfig)
        isScheduledToday = effectiveDate !== null ? 'Yes' : 'No'
      } catch (err) {
        console.error(`Error evaluating schedule_config ${sc.name}:`, err)
      }

      await db.scheduleConfig.update({
        where: { id: sc.id },
        data: { lastEvaluatedDate: businessDateStr, isScheduledToday },
      })
      resultMap.set(sc.name, isScheduledToday)
    }),
  )

  return resultMap
}

// ─── Nav tree builder ────────────────────────────────────────────────────

async function getNavTree(scheduledMap: Map<string, string>): Promise<NavItem[]> {
  const [rows, fieldValues] = await Promise.all([
    db.navNode.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    db.nodeFieldValue.findMany(),
  ])

  // Group field values by node
  const valuesByNode = new Map<string, Record<string, string>>()
  for (const fv of fieldValues) {
    if (!valuesByNode.has(fv.nodeId)) valuesByNode.set(fv.nodeId, {})
    valuesByNode.get(fv.nodeId)![fv.fieldKey] = fv.fieldValue ?? ''
  }

  // Group rows by parentId (avoids O(N²) recursive filtering)
  const byParent = new Map<string | null, typeof rows>()
  for (const row of rows) {
    const key = row.parentId ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(row)
  }

  function buildTree(parentId: string | null): NavItem[] {
    const children = byParent.get(parentId) ?? []
    return children.map((row): NavItem => {
      let customData: Record<string, unknown> = {}
      if (row.data) {
        try {
          customData = JSON.parse(row.data) as Record<string, unknown>
        } catch {
          // ignore
        }
      }
      const eavValues = valuesByNode.get(row.id) ?? {}
      customData = { ...customData, ...eavValues }

      const scheduleConfigName = (customData.schedule as string) ?? null
      let scheduledValue = 'N/A'
      if (scheduleConfigName) {
        scheduledValue = scheduledMap.has(scheduleConfigName)
          ? scheduledMap.get(scheduleConfigName)!
          : 'No'
      }

      if (row.kind === 'item' || row.kind === 'job') {
        return {
          id: row.id,
          label: row.label,
          kind: 'item',
          data: {
            kind: row.nodeKind ?? undefined,
            status: row.status ?? undefined,
            host: row.host ?? undefined,
            runs: row.runs ?? undefined,
            ...customData,
            scheduled: scheduledValue,
          },
        }
      }
      const item: NavItem = {
        id: row.id,
        label: row.label,
        kind: 'folder',
        data: { ...customData, scheduled: scheduledValue },
      }
      const subChildren = buildTree(row.id)
      if (subChildren.length > 0) item.children = subChildren
      return item
    })
  }

  return buildTree(null)
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { businessDateStr, businessDate } = await computeBusinessDateInfo()
    const scheduledMap = await syncScheduleConfigsForBusinessDate(businessDateStr, businessDate)

    const [modules, viewpoints, navTree, edges, fieldDefinitions, appConfig] = await Promise.all([
      db.module.findMany(),
      db.viewpoint.findMany(),
      getNavTree(scheduledMap),
      db.edge.findMany(),
      db.fieldDefinition.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.appConfig.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
    ])

    return NextResponse.json({
      modules: modules.map((m) => ({ id: m.id, label: m.label })),
      viewpoints: viewpoints.map((v) => ({
        id: v.id,
        moduleId: v.moduleId,
        label: v.label,
        description: v.description,
        folder: v.folder,
        jobCount: v.jobCount,
        scope: v.scope,
        filterStatus: v.filterStatus,
        grouping: v.grouping,
        sortBy: v.sortBy,
      })),
      navTree,
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      fieldDefinitions: fieldDefinitions.map((f) => ({
        key: f.key,
        label: f.label,
        sectionTitle: f.sectionTitle,
        role: f.role as 'title' | 'subtitle' | 'detail' | 'none',
        format: f.format as 'text' | 'mono' | 'status' | undefined,
        sortOrder: f.sortOrder,
        isProtected: f.isProtected === 1,
        showOnCard: f.showOnCard,
        showInDetails: f.showInDetails,
        isActive: f.isActive,
      })),
      appConfig: appConfig.map((r) => ({
        key: r.key,
        category: r.category,
        label: r.label,
        value: r.value,
        sortOrder: r.sortOrder,
      })),
      businessDate: businessDateStr,
    })
  } catch (err) {
    console.error('Error fetching dashboard data:', err)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 },
    )
  }
}
