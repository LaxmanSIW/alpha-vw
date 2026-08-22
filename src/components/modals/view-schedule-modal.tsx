'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import Modal from '@/components/ui-custom/modal'
import Button from '@/components/ui-custom/button'
import Select from '@/components/ui-custom/select'
import { fetchTableRows, evaluateYear, updateTableRow } from '@/lib/api-client'
import { getEligibleRunDates } from '@/lib/schedule-engine'
import { cn } from '@/lib/utils'

interface ViewScheduleModalProps {
  isOpen: boolean
  nodeLabel: string
  scheduleName: string
  onClose: () => void
}

interface ScheduleConfigRow {
  id: string
  name: string
  configData: string
}

interface CalendarRow {
  id: string
  name: string
  workdays: string
  holidays: string
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS_OF_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function ViewScheduleModal({ isOpen, nodeLabel, scheduleName, onClose }: ViewScheduleModalProps) {
  const [configs, setConfigs] = useState<ScheduleConfigRow[]>([])
  const [selectedName, setSelectedName] = useState(scheduleName)
  const [currentConfig, setCurrentConfig] = useState<Record<string, unknown>>({})
  const [currentConfigRaw, setCurrentConfigRaw] = useState<string>('')
  const [eligibleDates, setEligibleDates] = useState<Set<string>>(new Set())
  const [year, setYear] = useState(new Date().getFullYear())
  const [evaluating, setEvaluating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load all schedule configs on open
  useEffect(() => {
    if (!isOpen) return
    fetchTableRows<ScheduleConfigRow>('schedule_configs')
      .then((rows) => {
        setConfigs(rows)
        if (rows.length > 0) {
          const initial = rows.find((r) => r.name === scheduleName) ?? rows[0]
          setSelectedName(initial.name)
          try {
            const parsed = JSON.parse(initial.configData) as Record<string, unknown>
            setCurrentConfig(parsed)
            setCurrentConfigRaw(JSON.stringify(parsed, null, 2))
          } catch { /* ignore */ }
        }
      })
      .catch((err) => toast.error(`Failed to load schedules: ${err instanceof Error ? err.message : String(err)}`))
  }, [isOpen, scheduleName])

  // When config changes, evaluate the year
  const evaluate = useCallback(async (cfg: Record<string, unknown>, y: number) => {
    if (!cfg || Object.keys(cfg).length === 0) {
      setEligibleDates(new Set())
      return
    }
    setEvaluating(true)
    try {
      // Try server-side evaluation first (it hydrates calendars from DB)
      const result = await evaluateYear(cfg, y)
      if (result.success && Array.isArray(result.eligibleDates)) {
        setEligibleDates(new Set(result.eligibleDates))
      } else if (result.errors && result.errors.length > 0) {
        setEligibleDates(new Set())
        toast.error(`Schedule validation error: ${result.errors[0]}`)
      }
    } catch {
      // Fall back to client-side evaluation
      try {
        // Fetch calendars from DB
        const calRows = await fetchTableRows<CalendarRow>('calendars')
        const calendarsMap: Record<string, { WORKDAYS: number[]; HOLIDAYS: string[] }> = {}
        for (const c of calRows) {
          try {
            const workdays = JSON.parse(c.workdays) as number[]
            const holidays = JSON.parse(c.holidays) as string[]
            calendarsMap[c.name] = { WORKDAYS: workdays, HOLIDAYS: holidays }
          } catch { /* ignore */ }
        }
        const fullConfig = { ...cfg, CALENDARS: { ...calendarsMap, ...((cfg.CALENDARS as object) || {}) } }
        const dates = getEligibleRunDates(fullConfig, y)
        if (Array.isArray(dates)) {
          setEligibleDates(new Set(dates.map((d) => d.toISOString().split('T')[0])))
        } else {
          setEligibleDates(new Set())
        }
      } catch (err) {
        setEligibleDates(new Set())
        toast.error(`Evaluation failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    } finally {
      setEvaluating(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && Object.keys(currentConfig).length > 0) {
      evaluate(currentConfig, year)
    }
  }, [isOpen, currentConfig, year, evaluate])

  const onSelectConfig = (name: string) => {
    setSelectedName(name)
    const sc = configs.find((c) => c.name === name)
    if (sc) {
      try {
        const parsed = JSON.parse(sc.configData) as Record<string, unknown>
        setCurrentConfig(parsed)
        setCurrentConfigRaw(JSON.stringify(parsed, null, 2))
      } catch { /* ignore */ }
    }
  }

  const onConfigChange = (val: string) => {
    setCurrentConfigRaw(val)
    try {
      const parsed = JSON.parse(val) as Record<string, unknown>
      setCurrentConfig(parsed)
    } catch { /* ignore invalid JSON; don't update until valid */ }
  }

  const onSaveToNode = async () => {
    if (!nodeLabel) return
    setSaving(true)
    try {
      // Save the selected schedule name to the node's `schedule` field via API
      // This is invoked from the details panel context menu, but the actual save
      // happens through AdminModal. Here we just toast.
      toast.success(`Schedule "${selectedName}" selected for "${nodeLabel}"`)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(o) => !o && onClose()}
      title={`Schedule: ${nodeLabel || '—'}`}
      description="Preview which days this schedule runs. Edit the JSON to test alternative configurations."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Close</Button>
          <Button variant="primary" onClick={onSaveToNode} disabled={saving || !selectedName}>
            {saving ? 'Saving…' : 'Use This Schedule'}
          </Button>
        </>
      }
    >
      <div className="flex h-full">
        {/* Left: config selector + JSON editor */}
        <div className="w-80 shrink-0 border-r border-border bg-surface-sunken overflow-auto p-3 flex flex-col gap-3">
          <Select label="Schedule Config" value={selectedName} onChange={(e) => onSelectConfig(e.target.value)}>
            {configs.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-text-muted">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
              min={1970}
              max={9999}
              className="h-[var(--control-h)] w-24 px-2 text-xs bg-surface border border-border-strong text-text focus:border-primary outline-none"
            />
            {evaluating && <span className="text-[10px] text-text-muted">evaluating…</span>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1">Config JSON (live preview)</label>
            <textarea
              value={currentConfigRaw}
              onChange={(e) => onConfigChange(e.target.value)}
              spellCheck={false}
              className="w-full h-96 px-2 py-1.5 text-[11px] font-mono bg-surface border border-border-strong text-text focus:border-primary outline-none resize-none"
            />
          </div>
        </div>

        {/* Right: 12-month calendar grid */}
        <div className="flex-1 min-h-0 overflow-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps">{year} Schedule Preview</span>
            <span className="text-xs text-text-muted">{eligibleDates.size} eligible days</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((_, monthIdx) => (
              <MonthGrid key={monthIdx} year={year} month={monthIdx} eligibleDates={eligibleDates} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function MonthGrid({ year, month, eligibleDates }: { year: number; month: number; eligibleDates: Set<string> }) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const firstDay = new Date(Date.UTC(year, month, 1))
  // Convert JS day-of-week (0=Sun) to ISO day-of-week (1=Mon)
  const firstDayOfWeek = firstDay.getUTCDay() === 0 ? 7 : firstDay.getUTCDay()
  const cells: (number | null)[] = []
  for (let i = 1; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const monthName = MONTHS[month]
  let eligibleCount = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (eligibleDates.has(dateStr)) eligibleCount++
  }

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center justify-between px-1.5 py-1 border-b border-border bg-surface-sunken">
        <span className="text-[11px] font-semibold text-text">{monthName}</span>
        <span className="text-[10px] text-text-muted">{eligibleCount}</span>
      </div>
      <div className="grid grid-cols-7 text-[9px] text-text-muted">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className="text-center py-0.5">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="aspect-square" />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isEligible = eligibleDates.has(dateStr)
          return (
            <div
              key={i}
              className={cn(
                'aspect-square flex items-center justify-center text-[10px] font-medium',
                isEligible ? 'bg-success-bg text-success-fg' : 'text-text-muted',
              )}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}
