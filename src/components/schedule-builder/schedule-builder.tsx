'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Trash2, CalendarDays } from 'lucide-react'
import type { ScheduleConfigInput } from '@/lib/schedule-engine'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_LIST = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mo', full: 'Monday' },
  { id: 2, label: 'Tu', full: 'Tuesday' },
  { id: 3, label: 'We', full: 'Wednesday' },
  { id: 4, label: 'Th', full: 'Thursday' },
  { id: 5, label: 'Fr', full: 'Friday' },
  { id: 6, label: 'Sa', full: 'Saturday' },
  { id: 7, label: 'Su', full: 'Sunday' },
] as const

const EXCEPTION_POLICY_OPTIONS = [
  { value: 'DISABLE_RUN', label: 'Disable Run' },
  { value: 'RUN_ON_NEXT_CONFIRMED_DAY_AND_SHIFT', label: 'Run on Next Confirmed Day + Shift' },
  { value: 'RUN_ON_PREVIOUS_CONFIRMED_DAY_AND_SHIFT', label: 'Run on Previous Confirmed Day + Shift' },
  { value: 'RUN_IGNORE_CONFIRMATION_AND_SHIFT', label: 'Run (Ignore Confirmation) + Shift' },
  { value: 'SHIFT_AND_DISABLE_RUN', label: 'Shift, then Disable if Unconfirmed' },
  { value: 'SHIFT_AND_RUN_ON_NEXT_CONFIRMED_DAY', label: 'Shift, then Run on Next Confirmed Day' },
  { value: 'SHIFT_AND_RUN_ON_PREVIOUS_CONFIRMED_DAY', label: 'Shift, then Run on Previous Confirmed Day' },
  { value: 'SHIFT_AND_RUN_IGNORE_CONFIRMATION', label: 'Shift + Run (Ignore Confirmation)' },
] as const

const ACTIVITY_MODE_OPTIONS = [
  { value: 'ALWAYS', label: 'Always', hint: 'Schedule is active regardless of date range' },
  { value: 'ACTIVE', label: 'Active in Range', hint: 'Only active between FROM and TO dates' },
  { value: 'NOT_ACTIVE', label: 'Inactive in Range', hint: 'Active outside the FROM–TO date range' },
] as const

const MODIFIER_OPTIONS = [
  { id: '', label: 'Exact', hint: 'Match the exact day' },
  { id: '>', label: '> Next', hint: 'If non-working day, move to next working day' },
  { id: '<', label: '< Prev', hint: 'If non-working day, move to previous working day' },
  { id: '-', label: '- Exclude', hint: 'Exclude this day from matching' },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleBuilderProps {
  config: ScheduleConfigInput
  availableCalendars: string[]
  onChange: (config: ScheduleConfigInput) => void
}

// ─── Helper: section wrapper ─────────────────────────────────────────────────

function Section({ title, children, hint, enabled, onToggle }: {
  title: string
  children: React.ReactNode
  hint?: string
  enabled: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div className={`border rounded transition-opacity ${enabled ? 'border-border bg-surface-sunken/30' : 'border-border/50 bg-surface-sunken/10 opacity-60'}`}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <label className="flex items-center gap-2 font-semibold text-text text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="accent-primary"
          />
          <span>{title}</span>
        </label>
        {hint && <span className="text-[10px] text-text-muted max-w-[200px] text-right italic">{hint}</span>}
      </div>
      {enabled && <div className="p-3 space-y-3">{children}</div>}
    </div>
  )
}

// ─── Helper: pill button ─────────────────────────────────────────────────────

function Pill({ active, onClick, children, mono = false, className = '' }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium border transition-colors rounded ${mono ? 'font-mono' : ''} ${
        active
          ? 'bg-primary text-white border-primary shadow-xs'
          : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
      } ${className}`}
    >
      {children}
    </button>
  )
}

// ─── Helper: labeled field ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-text-secondary">{children}</label>
}

function NativeSelect({ value, onChange, children, className = '' }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border border-border bg-surface py-1.5 px-2.5 text-xs text-text rounded focus:border-primary focus:outline-none ${className}`}
    >
      {children}
    </select>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScheduleBuilder({ config, availableCalendars, onChange }: ScheduleBuilderProps) {
  // Guard ref to break infinite state sync loops with parent
  const lastEmittedJsonRef = useRef<string>('')

  // ── Local state (derived from config prop) ──────────────────────────────

  // Specific Dates
  const [enableSpecific, setEnableSpecific] = useState(Array.isArray(config.SPECIFIC_DATES))
  const [specificDates, setSpecificDates] = useState<string[]>(config.SPECIFIC_DATES || [])
  const [newSpecificDate, setNewSpecificDate] = useState('')

  // Weekdays
  const [enableWeekdays, setEnableWeekdays] = useState(Array.isArray(config.WEEKDAYS))
  const [weekdayCalendar, setWeekdayCalendar] = useState(config.WEEKDAYS_CALENDAR || '')
  const [weekdayModifier, setWeekdayModifier] = useState<'' | '-' | '>' | '<'>('')
  const [weekdayRulesStr, setWeekdayRulesStr] = useState(
    Array.isArray(config.WEEKDAYS) ? config.WEEKDAYS.join(', ') : ''
  )
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>(() => {
    const days: number[] = []
    for (const r of (config.WEEKDAYS || [])) {
      const m = r.match(/^[-><]?([1-7])$/)
      if (m) days.push(Number(m[1]))
    }
    return days
  })
  const [weekdayAdvancedMode, setWeekdayAdvancedMode] = useState(false)

  // Monthdays
  const [enableMonthdays, setEnableMonthdays] = useState(Array.isArray(config.MONTHDAYS))
  const [monthCalendar, setMonthCalendar] = useState(config.MONTH_CALENDAR || '')
  const [monthdayModifier, setMonthdayModifier] = useState<'' | '-' | '>' | '<'>('')
  const [monthdayRulesStr, setMonthdayRulesStr] = useState(
    Array.isArray(config.MONTHDAYS) ? config.MONTHDAYS.join(', ') : ''
  )
  const [monthdaySubTab, setMonthdaySubTab] = useState<'run' | 'start_of_month' | 'end_of_month'>('end_of_month')

  // Relation
  const [weekMonthRelation, setWeekMonthRelation] = useState<'OR' | 'AND'>(
    (config.WEEK_MONTH_RELATION as 'OR' | 'AND') || 'OR'
  )

  // Months
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const ms = config.MONTHS || ['ALL']
    if (ms.includes('ALL')) return [...MONTHS_LIST]
    return MONTHS_LIST.filter((m) => ms.map(String).map((s) => s.toUpperCase()).includes(m))
  })

  // Confirmation
  const [enableConfirmation, setEnableConfirmation] = useState(Boolean(config.CONFIRMATION))
  const [confirmationCalendar, setConfirmationCalendar] = useState(config.CONFIRMATION?.CALENDAR || '')
  const [confirmationPolicy, setConfirmationPolicy] = useState(config.CONFIRMATION?.EXCEPTION_POLICY || 'DISABLE_RUN')
  const [shiftBy, setShiftBy] = useState(config.CONFIRMATION?.SHIFT_BY ?? 0)

  // Activity Period
  const [activityMode, setActivityMode] = useState(config.ACTIVITY_PERIOD?.MODE || 'ALWAYS')
  const [activityFrom, setActivityFrom] = useState(config.ACTIVITY_PERIOD?.FROM || '')
  const [activityTo, setActivityTo] = useState(config.ACTIVITY_PERIOD?.TO || '')

  // ── Sync config prop → local state when config changes externally ───────
  useEffect(() => {
    const configStr = JSON.stringify(config || {})
    if (configStr === lastEmittedJsonRef.current) return
    lastEmittedJsonRef.current = configStr

    const hasSpecific = Array.isArray(config.SPECIFIC_DATES)
    setEnableSpecific(hasSpecific)
    setSpecificDates(config.SPECIFIC_DATES || [])

    const hasWeekdays = Array.isArray(config.WEEKDAYS)
    setEnableWeekdays(hasWeekdays)
    setWeekdayCalendar(config.WEEKDAYS_CALENDAR || '')
    setWeekdayRulesStr(hasWeekdays ? config.WEEKDAYS!.join(', ') : '')
    // Parse simple day-of-week selections for the pill UI
    const simpleDays: number[] = []
    let hasAdvanced = false
    for (const r of (config.WEEKDAYS || [])) {
      const m = r.match(/^[-><]?([1-7])$/)
      if (m) simpleDays.push(Number(m[1]))
      else hasAdvanced = true
    }
    setSelectedDaysOfWeek(simpleDays)
    setWeekdayAdvancedMode(hasAdvanced)

    const hasMonthdays = Array.isArray(config.MONTHDAYS)
    setEnableMonthdays(hasMonthdays)
    setMonthCalendar(config.MONTH_CALENDAR || '')
    setMonthdayRulesStr(hasMonthdays ? config.MONTHDAYS!.join(', ') : '')

    setWeekMonthRelation((config.WEEK_MONTH_RELATION as 'OR' | 'AND') || 'OR')

    const ms = config.MONTHS || ['ALL']
    setSelectedMonths(ms.includes('ALL') ? [...MONTHS_LIST] : MONTHS_LIST.filter((m) => ms.map(String).map((s) => s.toUpperCase()).includes(m)))

    const hasConfirmation = Boolean(config.CONFIRMATION)
    setEnableConfirmation(hasConfirmation)
    setConfirmationCalendar(config.CONFIRMATION?.CALENDAR || '')
    setConfirmationPolicy(config.CONFIRMATION?.EXCEPTION_POLICY || 'DISABLE_RUN')
    setShiftBy(config.CONFIRMATION?.SHIFT_BY ?? 0)

    setActivityMode(config.ACTIVITY_PERIOD?.MODE || 'ALWAYS')
    setActivityFrom(config.ACTIVITY_PERIOD?.FROM || '')
    setActivityTo(config.ACTIVITY_PERIOD?.TO || '')
  }, [config])

  // ── Build & emit config ─────────────────────────────────────────────────
  const buildConfig = useCallback(() => {
    const out: ScheduleConfigInput = {}

    // Specific dates
    if (enableSpecific) {
      out.SPECIFIC_DATES = [...specificDates].sort()
    }

    // Weekdays
    if (enableWeekdays) {
      out.WEEKDAYS_CALENDAR = weekdayCalendar || null
      out.WEEKDAYS = weekdayRulesStr.trim()
        ? weekdayRulesStr.split(',').map((s) => s.trim()).filter(Boolean)
        : []
    }

    // Monthdays
    if (enableMonthdays) {
      out.MONTH_CALENDAR = monthCalendar || null
      out.MONTHDAYS = monthdayRulesStr.trim()
        ? monthdayRulesStr.split(',').map((s) => s.trim()).filter(Boolean)
        : []
    }

    // Relation
    if (enableWeekdays && enableMonthdays) {
      out.WEEK_MONTH_RELATION = weekMonthRelation
    }

    // Months
    out.MONTHS = selectedMonths.length === 12 ? ['ALL'] : selectedMonths

    // Confirmation
    if (enableConfirmation) {
      out.CONFIRMATION = {
        CALENDAR: confirmationCalendar || '',
        EXCEPTION_POLICY: confirmationPolicy,
        SHIFT_BY: shiftBy,
      }
    }

    // Activity Period
    if (activityMode !== 'ALWAYS') {
      out.ACTIVITY_PERIOD = {
        MODE: activityMode,
        FROM: activityFrom || null,
        TO: activityTo || null,
      }
    } else {
      out.ACTIVITY_PERIOD = { MODE: 'ALWAYS' }
    }

    return out
  }, [
    enableSpecific, specificDates,
    enableWeekdays, weekdayCalendar, weekdayRulesStr,
    enableMonthdays, monthCalendar, monthdayRulesStr,
    weekMonthRelation, selectedMonths,
    enableConfirmation, confirmationCalendar, confirmationPolicy, shiftBy,
    activityMode, activityFrom, activityTo,
  ])

  // Emit on every state change
  useEffect(() => {
    const out = buildConfig()
    const outStr = JSON.stringify(out)
    if (outStr !== lastEmittedJsonRef.current) {
      lastEmittedJsonRef.current = outStr
      onChange(out)
    }
  }, [buildConfig, onChange])

  // ── Specific dates handlers ─────────────────────────────────────────────
  const addSpecificDate = () => {
    if (newSpecificDate && /^\d{4}-\d{2}-\d{2}$/.test(newSpecificDate) && !specificDates.includes(newSpecificDate)) {
      setSpecificDates((p) => [...p, newSpecificDate].sort())
      setNewSpecificDate('')
    }
  }

  // ── Weekday pill click handler ──────────────────────────────────────────
  const toggleDayOfWeek = (dayId: number) => {
    let updated: number[]
    if (selectedDaysOfWeek.includes(dayId)) {
      updated = selectedDaysOfWeek.filter((d) => d !== dayId)
    } else {
      updated = [...selectedDaysOfWeek, dayId].sort()
    }
    setSelectedDaysOfWeek(updated)
    setWeekdayRulesStr(updated.map((d) => `${weekdayModifier}${d}`).join(', '))
  }

  // ── Weekday modifier change ─────────────────────────────────────────────
  const setWeekdayMod = (mod: '' | '-' | '>' | '<') => {
    setWeekdayModifier(mod)
    setWeekdayRulesStr(selectedDaysOfWeek.map((d) => `${mod}${d}`).join(', '))
  }

  // ── Monthday pill click handler ─────────────────────────────────────────
  const getMonthdayPills = (): string[] => {
    if (monthdaySubTab === 'end_of_month') return ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']
    if (monthdaySubTab === 'start_of_month') return ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']
    return ['WORKDAYS', '1', '2', '3', '4', '5', '10', '15', '20', '25', '28', '29', '30', '31']
  }

  const clickMonthdayPill = (code: string) => {
    const fullCode = `${monthdayModifier}${code}`
    setMonthdayRulesStr(fullCode)
  }

  // ── Monthday modifier change ─────────────────────────────────────────────
  const setMonthdayMod = (mod: '' | '-' | '>' | '<') => {
    setMonthdayModifier(mod)
    // Re-apply modifier to current rule string
    const base = monthdayRulesStr.replace(/^[-><]/, '')
    setMonthdayRulesStr(`${mod}${base}`)
  }

  // ── Presets ──────────────────────────────────────────────────────────────
  const applyPreset = (type: string) => {
    switch (type) {
      case 'mon_to_fri':
        setEnableWeekdays(true)
        setEnableMonthdays(false)
        setEnableSpecific(false)
        setWeekdayAdvancedMode(false)
        setWeekdayModifier('')
        setSelectedDaysOfWeek([1, 2, 3, 4, 5])
        setWeekdayRulesStr('1, 2, 3, 4, 5')
        break
      case 'last_day_month':
        setEnableWeekdays(false)
        setEnableMonthdays(true)
        setEnableSpecific(false)
        setMonthdaySubTab('end_of_month')
        setMonthdayModifier('')
        setMonthdayRulesStr('L1')
        break
      case 'next_working_15':
        setEnableWeekdays(false)
        setEnableMonthdays(true)
        setEnableSpecific(false)
        setMonthdaySubTab('run')
        setMonthdayModifier('>')
        setMonthdayRulesStr('>15')
        break
      case 'prev_working_15':
        setEnableWeekdays(false)
        setEnableMonthdays(true)
        setEnableSpecific(false)
        setMonthdaySubTab('run')
        setMonthdayModifier('<')
        setMonthdayRulesStr('<15')
        break
      case 'exclude_fri':
        setEnableWeekdays(true)
        setEnableMonthdays(false)
        setEnableSpecific(false)
        setWeekdayAdvancedMode(false)
        setWeekdayModifier('')
        setSelectedDaysOfWeek([1, 2, 3, 4, 5])
        setWeekdayRulesStr('1, 2, 3, 4, -5')
        break
      case 'every_day':
        setEnableWeekdays(false)
        setEnableMonthdays(true)
        setEnableSpecific(false)
        setMonthdaySubTab('run')
        setMonthdayModifier('')
        setMonthdayRulesStr('WORKDAYS')
        break
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 text-text text-xs">
      {/* ── Header + Presets ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-text">
          <CalendarDays size={15} className="text-primary" />
          <span>Visual Schedule Builder</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <span className="text-[10px] text-text-muted font-medium mr-1">Presets:</span>
          {[
            { id: 'mon_to_fri', label: 'Mon–Fri', cls: 'bg-primary/10 text-primary border-primary/30' },
            { id: 'every_day', label: 'All Workdays', cls: 'bg-primary/10 text-primary border-primary/30' },
            { id: 'last_day_month', label: 'Month End (L1)', cls: 'bg-accent/10 text-accent border-accent/30' },
            { id: 'next_working_15', label: 'Next Work >15', cls: 'bg-warning-bg text-warning-fg border-warning-fg/30' },
            { id: 'exclude_fri', label: 'Mon–Thu', cls: 'bg-surface-hover text-text-secondary border-border' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`px-2 py-0.5 text-[11px] border rounded hover:opacity-80 transition-opacity ${p.cls}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Specific Dates ──────────────────────────────────────────────── */}
      <Section
        title="Specific Dates"
        hint="Run on exact calendar dates (YYYY-MM-DD)"
        enabled={enableSpecific}
        onToggle={setEnableSpecific}
      >
        <div className="flex gap-2">
          <input
            type="date"
            value={newSpecificDate}
            onChange={(e) => setNewSpecificDate(e.target.value)}
            className="h-[var(--control-h)] px-2 text-xs bg-surface border border-border-strong text-text focus:border-primary outline-none"
          />
          <button
            type="button"
            onClick={addSpecificDate}
            disabled={!newSpecificDate}
            className="h-[var(--control-h)] px-2 text-xs font-medium bg-surface text-text border border-border-strong hover:bg-surface-hover disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {specificDates.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {specificDates.map((d) => (
              <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono bg-primary/10 text-primary border border-primary/20 rounded">
                {d}
                <button
                  type="button"
                  onClick={() => setSpecificDates((p) => p.filter((x) => x !== d))}
                  className="hover:text-danger-fg"
                >
                  <Trash2 size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* ── Weekdays + Monthdays Grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-start">
        {/* Left: Run on Week Days */}
        <Section
          title="Run on Week Days"
          hint="Match by day of week (1=Mon … 7=Sun)"
          enabled={enableWeekdays}
          onToggle={setEnableWeekdays}
        >
          {/* Calendar dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted shrink-0">Base Calendar:</span>
            <NativeSelect value={weekdayCalendar} onChange={setWeekdayCalendar}>
              <option value="">(none – use plain dates)</option>
              {availableCalendars.map((cal) => (
                <option key={cal} value={cal}>{cal}</option>
              ))}
            </NativeSelect>
          </div>

          {/* Simple vs Advanced toggle */}
          <div className="flex items-center gap-3 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setWeekdayAdvancedMode(false)}
              className={`text-[11px] font-medium pb-1 border-b-2 transition-colors ${!weekdayAdvancedMode ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
            >
              Day Picker
            </button>
            <button
              type="button"
              onClick={() => setWeekdayAdvancedMode(true)}
              className={`text-[11px] font-medium pb-1 border-b-2 transition-colors ${weekdayAdvancedMode ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
            >
              Rule String
            </button>
          </div>

          {!weekdayAdvancedMode ? (
            <>
              {/* Modifier selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-text-muted font-medium">Modifier:</span>
                {MODIFIER_OPTIONS.map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setWeekdayMod(mod.id as '' | '-' | '>' | '<')}
                    className={`px-2 py-0.5 text-[11px] border rounded transition-colors ${
                      weekdayModifier === mod.id
                        ? 'bg-primary text-white border-primary shadow-xs font-semibold'
                        : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                    }`}
                    title={mod.hint}
                  >
                    {mod.label}
                  </button>
                ))}
              </div>

              {/* Day of week pills */}
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((d) => (
                  <Pill
                    key={d.id}
                    active={selectedDaysOfWeek.includes(d.id)}
                    onClick={() => toggleDayOfWeek(d.id)}
                  >
                    <span title={d.full}>{d.label}</span>
                  </Pill>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <FieldLabel>Weekday Rules (comma-separated)</FieldLabel>
                <input
                  type="text"
                  value={weekdayRulesStr}
                  onChange={(e) => setWeekdayRulesStr(e.target.value)}
                  placeholder="e.g. 1,2,3,4,5 or D2W2 or -5 or L1"
                  className="w-full border border-border bg-surface py-1.5 px-2.5 text-xs font-mono text-text focus:border-primary focus:outline-none rounded"
                />
              </div>
              <div className="text-[10px] text-text-muted space-y-0.5">
                <p><strong>Simple:</strong> <code className="font-mono">1,2,3,4,5</code> — Mon–Fri</p>
                <p><strong>Nth working day of week:</strong> <code className="font-mono">D2</code> = 2nd working day of the week</p>
                <p><strong>Day in week of month:</strong> <code className="font-mono">D5W2</code> = Friday of week 2</p>
                <p><strong>Nth from end of working week:</strong> <code className="font-mono">L1</code> = last working day of week</p>
                <p><strong>Exclude:</strong> <code className="font-mono">-5</code> — never on Friday</p>
                <p><strong>Shift:</strong> <code className="font-mono">&gt;5</code> or <code className="font-mono">&lt;5</code> — shift to next/prev working day</p>
              </div>
            </>
          )}

          {/* Generated rule string (read-only mirror) */}
          {!weekdayAdvancedMode && (
            <div className="space-y-1">
              <FieldLabel>Generated Rule String:</FieldLabel>
              <div className="px-2.5 py-1.5 text-xs font-mono bg-surface border border-border rounded text-text-muted">
                {weekdayRulesStr || '(none)'}
              </div>
            </div>
          )}
        </Section>

        {/* Center: Relation (only when both dims active) */}
        {enableWeekdays && enableMonthdays && (
          <div className="flex flex-col items-center justify-center self-center py-2 space-y-1">
            <span className="text-[10px] text-text-muted font-medium">Relation</span>
            <NativeSelect
              value={weekMonthRelation}
              onChange={(v) => setWeekMonthRelation(v as 'OR' | 'AND')}
              className="!w-auto !px-3 font-semibold text-primary border-primary/30"
            >
              <option value="OR">OR</option>
              <option value="AND">AND</option>
            </NativeSelect>
          </div>
        )}
        {(!enableWeekdays || !enableMonthdays) && (
          <div />
        )}

        {/* Right: Run on Month Days */}
        <Section
          title="Run on Month Days"
          hint="Match by day-of-month, L/D working-day rules"
          enabled={enableMonthdays}
          onToggle={(val) => {
            setEnableMonthdays(val)
            if (val && !monthdayRulesStr.trim()) {
              setMonthdayRulesStr('L1')
            }
          }}
        >
          {/* Calendar dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted shrink-0">Base Calendar:</span>
            <NativeSelect value={monthCalendar} onChange={setMonthCalendar}>
              <option value="">(none – use plain dates)</option>
              {availableCalendars.map((cal) => (
                <option key={cal} value={cal}>{cal}</option>
              ))}
            </NativeSelect>
          </div>

          {/* Subtabs */}
          <div className="flex border-b border-border">
            {([['run', 'Run'], ['start_of_month', 'Start (D#)'], ['end_of_month', 'End (L#)']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMonthdaySubTab(id)}
                className={`px-3 py-1 text-[11px] font-medium border-b-2 transition-colors ${
                  monthdaySubTab === id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Modifier selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-text-muted font-medium">Modifier:</span>
            {MODIFIER_OPTIONS.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => setMonthdayMod(mod.id as '' | '-' | '>' | '<')}
                className={`px-2 py-0.5 text-[11px] border rounded transition-colors ${
                  monthdayModifier === mod.id
                    ? 'bg-primary text-white border-primary shadow-xs font-semibold'
                    : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                }`}
                title={mod.hint}
              >
                {mod.label}
              </button>
            ))}
          </div>

          {/* Monthday pills */}
          <div className="flex flex-wrap gap-1.5">
            {getMonthdayPills().map((code) => {
              const fullCode = `${monthdayModifier}${code}`
              const active = monthdayRulesStr === fullCode
              return (
                <Pill key={code} active={active} onClick={() => clickMonthdayPill(code)} mono>
                  {fullCode}
                </Pill>
              )
            })}
          </div>

          {/* Rule string input (for custom values) */}
          <div className="space-y-1">
            <FieldLabel>Monthday Rule String (comma-separated)</FieldLabel>
            <input
              type="text"
              value={monthdayRulesStr}
              onChange={(e) => setMonthdayRulesStr(e.target.value)}
              placeholder="e.g. L1 or >15 or <15 or WORKDAYS or D5"
              className="w-full border border-border bg-surface py-1.5 px-2.5 text-xs font-mono text-text focus:border-primary focus:outline-none rounded"
            />
          </div>

          <div className="text-[10px] text-text-muted space-y-0.5">
            <p><strong>Calendar day:</strong> <code className="font-mono">15</code> — 15th of month</p>
            <p><strong>All working days:</strong> <code className="font-mono">WORKDAYS</code></p>
            <p><strong>Nth working day from start:</strong> <code className="font-mono">D5</code> — 5th working day</p>
            <p><strong>Nth working day from end:</strong> <code className="font-mono">L1</code> — last working day</p>
            <p><strong>Shift:</strong> <code className="font-mono">&gt;15</code> or <code className="font-mono">&lt;15</code></p>
            <p><strong>Exclude:</strong> <code className="font-mono">-L1</code></p>
          </div>
        </Section>
      </div>

      {/* ── Months ───────────────────────────────────────────────────────── */}
      <div className="border border-border rounded p-3 space-y-2 bg-surface-sunken/30">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-text text-xs">Run on Months:</label>
          <div className="flex gap-3 text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedMonths([...MONTHS_LIST])}
              className="text-primary hover:underline font-medium"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonths([])}
              className="text-text-muted hover:underline font-medium"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MONTHS_LIST.map((m) => (
            <Pill
              key={m}
              active={selectedMonths.includes(m)}
              onClick={() => {
                setSelectedMonths((prev) =>
                  prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
                )
              }}
            >
              {m}
            </Pill>
          ))}
        </div>
      </div>

      {/* ── Confirmation Calendar ────────────────────────────────────────── */}
      <Section
        title="Confirmation Calendar"
        hint="Validate/shift run dates against a confirmation calendar"
        enabled={enableConfirmation}
        onToggle={setEnableConfirmation}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          <div className="space-y-1">
            <FieldLabel>Exception Policy</FieldLabel>
            <NativeSelect value={confirmationPolicy} onChange={setConfirmationPolicy}>
              {EXCEPTION_POLICY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <FieldLabel>Calendar</FieldLabel>
            <NativeSelect value={confirmationCalendar} onChange={setConfirmationCalendar}>
              <option value="">Select a calendar</option>
              {availableCalendars.map((cal) => (
                <option key={cal} value={cal}>{cal}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <FieldLabel>Shift By</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={-62}
                max={62}
                value={shiftBy}
                onChange={(e) => setShiftBy(Number(e.target.value))}
                className="w-20 border border-border bg-surface py-1 px-2.5 text-xs text-text font-mono rounded focus:border-primary focus:outline-none"
              />
              <span className="text-[11px] text-text-muted">confirmed days</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Activity Period ──────────────────────────────────────────────── */}
      <Section
        title="Activity Period"
        hint="Restrict when this schedule is active"
        enabled={activityMode !== 'ALWAYS'}
        onToggle={(v) => setActivityMode(v ? 'ACTIVE' : 'ALWAYS')}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          <div className="space-y-1">
            <FieldLabel>Mode</FieldLabel>
            <NativeSelect value={activityMode} onChange={setActivityMode}>
              {ACTIVITY_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </NativeSelect>
            {ACTIVITY_MODE_OPTIONS.find((o) => o.value === activityMode) && (
              <p className="text-[10px] text-text-muted italic">
                {ACTIVITY_MODE_OPTIONS.find((o) => o.value === activityMode)!.hint}
              </p>
            )}
          </div>
          {activityMode !== 'ALWAYS' && (
            <>
              <div className="space-y-1">
                <FieldLabel>From (YYYY-MM-DD)</FieldLabel>
                <input
                  type="date"
                  value={activityFrom}
                  onChange={(e) => setActivityFrom(e.target.value)}
                  className="w-full border border-border bg-surface py-1.5 px-2.5 text-xs text-text font-mono rounded focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>To (YYYY-MM-DD)</FieldLabel>
                <input
                  type="date"
                  value={activityTo}
                  onChange={(e) => setActivityTo(e.target.value)}
                  className="w-full border border-border bg-surface py-1.5 px-2.5 text-xs text-text font-mono rounded focus:border-primary focus:outline-none"
                />
              </div>
            </>
          )}
        </div>
      </Section>
    </div>
  )
}