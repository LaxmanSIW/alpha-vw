import { useState, useEffect } from 'react'
import Icon from './Icon'
import type { ScheduleConfigInput } from '../../api/schedule'

interface ScheduleBuilderProps {
  initialConfig?: ScheduleConfigInput
  availableCalendars?: string[]
  onChange?: (config: ScheduleConfigInput) => void
}

const MONTHS_LIST = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS_OF_WEEK = [
  { id: 1, label: 'Mo' },
  { id: 2, label: 'Tu' },
  { id: 3, label: 'We' },
  { id: 4, label: 'Th' },
  { id: 5, label: 'Fr' },
  { id: 6, label: 'Sa' },
  { id: 7, label: 'Su' },
]

const EXCEPTION_POLICY_OPTIONS = [
  { value: 'DISABLE_RUN', label: 'Disable Run' },
  { value: 'RUN_ON_NEXT_CONFIRMED_DAY_AND_SHIFT', label: 'Run on Next Confirmed Day and Shift' },
  { value: 'RUN_ON_PREVIOUS_CONFIRMED_DAY_AND_SHIFT', label: 'Run on Previous Confirmed Day and Shift' },
  { value: 'RUN_IGNORE_CONFIRMATION_AND_SHIFT', label: 'Run Ignore Confirmation and Shift' },
  { value: 'SHIFT_AND_DISABLE_RUN', label: 'Shift and Disable Run' },
  { value: 'SHIFT_AND_RUN_ON_NEXT_CONFIRMED_DAY', label: 'Shift and Run on Next Confirmed Day' },
  { value: 'SHIFT_AND_RUN_ON_PREVIOUS_CONFIRMED_DAY', label: 'Shift and Run on Previous Confirmed Day' },
  { value: 'SHIFT_AND_RUN_IGNORE_CONFIRMATION', label: 'Shift and Run Ignore Confirmation' },
]

export default function ScheduleBuilder({
  initialConfig,
  availableCalendars = [],
  onChange,
}: ScheduleBuilderProps) {
  // Dimension Enable Toggles
  const [enableWeekdays, setEnableWeekdays] = useState<boolean>(
    Boolean(initialConfig?.WEEKDAYS && initialConfig.WEEKDAYS.length > 0)
  )
  const [enableMonthdays, setEnableMonthdays] = useState<boolean>(
    Boolean(initialConfig?.MONTHDAYS && initialConfig.MONTHDAYS.length > 0)
  )

  // Weekday Section State
  const [weekdayCalendar, setWeekdayCalendar] = useState<string>(initialConfig?.WEEKDAYS_CALENDAR || '')
  const [weekdaySubTab, setWeekdaySubTab] = useState<'run' | 'start_of_week' | 'end_of_week'>('run')
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [weekdayModifier, setWeekdayModifier] = useState<'' | '-' | '>' | '<'>('')
  const [customWeekdayRulesStr, setCustomWeekdayRulesStr] = useState<string>(
    initialConfig?.WEEKDAYS ? initialConfig.WEEKDAYS.join(',') : '1,2,3,4,5'
  )

  // Monthday Section State
  const [monthCalendar, setMonthCalendar] = useState<string>(initialConfig?.MONTH_CALENDAR || 'MFD9H')
  const [monthdaySubTab, setMonthdaySubTab] = useState<'run' | 'start_of_month' | 'end_of_month'>('end_of_month')
  const [selectedMonthdays, setSelectedMonthdays] = useState<string[]>(['L1'])
  const [monthdayModifier, setMonthdayModifier] = useState<'' | '-' | '>' | '<'>('')
  const [customMonthdayRulesStr, setCustomMonthdayRulesStr] = useState<string>(
    initialConfig?.MONTHDAYS ? initialConfig.MONTHDAYS.join(',') : 'L1'
  )

  // Relation between Week & Month
  const [weekMonthRelation, setWeekMonthRelation] = useState<'OR' | 'AND'>(
    (initialConfig?.WEEK_MONTH_RELATION as 'OR' | 'AND') || 'OR'
  )

  // Months Selection State
  const [selectedMonths, setSelectedMonths] = useState<string[]>(
    initialConfig?.MONTHS && !initialConfig.MONTHS.includes('ALL') ? initialConfig.MONTHS : MONTHS_LIST
  )

  // Confirmation Calendar State
  const [confirmationPolicy, setConfirmationPolicy] = useState<string>(
    initialConfig?.CONFIRMATION?.EXCEPTION_POLICY || 'DISABLE_RUN'
  )
  const [confirmationCalendar, setConfirmationCalendar] = useState<string>(initialConfig?.CONFIRMATION?.CALENDAR || '')
  const [shiftBy, setShiftBy] = useState<number>(initialConfig?.CONFIRMATION?.SHIFT_BY ?? 0)

  // Notify parent on state change
  useEffect(() => {
    if (!onChange) return

    const wRules = enableWeekdays
      ? customWeekdayRulesStr.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const mRules = enableMonthdays
      ? customMonthdayRulesStr.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const config: ScheduleConfigInput = {
      WEEKDAYS_CALENDAR: enableWeekdays ? weekdayCalendar || null : null,
      WEEKDAYS: wRules,
      MONTH_CALENDAR: enableMonthdays ? monthCalendar || null : null,
      MONTHDAYS: mRules,
      WEEK_MONTH_RELATION: weekMonthRelation,
      MONTHS: selectedMonths.length === 12 ? ['ALL'] : selectedMonths,
      CONFIRMATION: confirmationCalendar
        ? {
            CALENDAR: confirmationCalendar,
            EXCEPTION_POLICY: confirmationPolicy,
            SHIFT_BY: shiftBy,
          }
        : null,
      ACTIVITY_PERIOD: { MODE: 'ALWAYS' },
    }

    onChange(config)
  }, [
    enableWeekdays,
    enableMonthdays,
    weekdayCalendar,
    customWeekdayRulesStr,
    monthCalendar,
    customMonthdayRulesStr,
    weekMonthRelation,
    selectedMonths,
    confirmationPolicy,
    confirmationCalendar,
    shiftBy,
  ])

  // Presets Quick Fill Handlers
  const applyPreset = (type: 'mon_to_fri' | 'last_day_month' | 'next_working_15' | 'prev_working_15' | 'exclude_fri') => {
    if (type === 'mon_to_fri') {
      setEnableWeekdays(true)
      setEnableMonthdays(false)
      setWeekdaySubTab('run')
      setSelectedDaysOfWeek([1, 2, 3, 4, 5])
      setWeekdayModifier('')
      setCustomWeekdayRulesStr('1,2,3,4,5')
    } else if (type === 'last_day_month') {
      setEnableWeekdays(false)
      setEnableMonthdays(true)
      setMonthdaySubTab('end_of_month')
      setSelectedMonthdays(['L1'])
      setMonthdayModifier('')
      setCustomMonthdayRulesStr('L1')
    } else if (type === 'next_working_15') {
      setEnableWeekdays(false)
      setEnableMonthdays(true)
      setMonthdaySubTab('run')
      setSelectedMonthdays(['>15'])
      setMonthdayModifier('>')
      setCustomMonthdayRulesStr('>15')
    } else if (type === 'prev_working_15') {
      setEnableWeekdays(false)
      setEnableMonthdays(true)
      setMonthdaySubTab('run')
      setSelectedMonthdays(['<15'])
      setMonthdayModifier('<')
      setCustomMonthdayRulesStr('<15')
    } else if (type === 'exclude_fri') {
      setEnableWeekdays(true)
      setEnableMonthdays(false)
      setWeekdaySubTab('run')
      setCustomWeekdayRulesStr('1,2,3,4,-5')
    }
  }

  return (
    <div className="space-y-4 bg-surface p-4 border border-border rounded-md text-text text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm">
          <Icon name="calendar" size={16} className="text-primary" />
          <span>Scheduling - Advanced Rule Configurator</span>
        </div>

        {/* Quick Fill Presets */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-text-muted font-medium mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset('mon_to_fri')}
            className="px-2 py-0.5 text-[11px] bg-primary/10 text-primary border border-primary/30 rounded hover:bg-primary/20"
          >
            Mon-Fri
          </button>
          <button
            type="button"
            onClick={() => applyPreset('last_day_month')}
            className="px-2 py-0.5 text-[11px] bg-accent/10 text-accent border border-accent/30 rounded hover:bg-accent/20"
          >
            End of Month (L1)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('next_working_15')}
            className="px-2 py-0.5 text-[11px] bg-warning-bg text-warning-fg border border-warning-fg/30 rounded hover:bg-warning-bg/80"
          >
            Next Work Day (&gt;15)
          </button>
        </div>
      </div>

      {/* Grid: Left (Run on Week Days) | Center (Relation) | Right (Run on Month Days) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* Left Column: Run on Week Days */}
        <div className={`border rounded p-3 space-y-3 transition-opacity ${enableWeekdays ? 'border-border bg-surface-sunken/30' : 'border-border/50 bg-surface-sunken/10 opacity-60'}`}>
          <div className="flex items-center justify-between border-b border-border pb-2">
            <label className="flex items-center gap-2 font-semibold text-text cursor-pointer">
              <input
                type="checkbox"
                checked={enableWeekdays}
                onChange={(e) => setEnableWeekdays(e.target.checked)}
                className="accent-primary"
              />
              <span>Run on Week Days</span>
            </label>

            {enableWeekdays && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted text-[11px]">Calendar:</span>
                <select
                  value={weekdayCalendar}
                  onChange={(e) => setWeekdayCalendar(e.target.value)}
                  className="border border-border bg-surface py-0.5 px-2 text-xs text-text rounded focus:border-primary focus:outline-none"
                >
                  <option value="">Available options</option>
                  {availableCalendars.map((cal) => (
                    <option key={cal} value={cal}>
                      {cal}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {enableWeekdays && (
            <>
              {/* Subtabs: Run | Start of week | End of week */}
              <div className="flex border-b border-border">
                <button
                  type="button"
                  onClick={() => setWeekdaySubTab('run')}
                  className={`px-3 py-1 font-medium border-b-2 transition-colors ${
                    weekdaySubTab === 'run' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  Run
                </button>
                <button
                  type="button"
                  onClick={() => setWeekdaySubTab('start_of_week')}
                  className={`px-3 py-1 font-medium border-b-2 transition-colors ${
                    weekdaySubTab === 'start_of_week' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  Start of week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekdaySubTab('end_of_week')}
                  className={`px-3 py-1 font-medium border-b-2 transition-colors ${
                    weekdaySubTab === 'end_of_week' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  End of week
                </button>
              </div>

              {/* Modifiers Selector: None, >, <, - */}
              <div className="flex items-center gap-2 pt-1 text-[11px]">
                <span className="text-text-muted font-medium">Modifier:</span>
                {[
                  { id: '', label: 'None (Exact)' },
                  { id: '>', label: '> (Next Working Day)' },
                  { id: '<', label: '< (Prev Working Day)' },
                  { id: '-', label: '- (Exclusion / NOT)' },
                ].map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setWeekdayModifier(mod.id as any)}
                    className={`px-2 py-0.5 border rounded transition-colors ${
                      weekdayModifier === mod.id
                        ? 'bg-primary text-white border-primary shadow-xs font-semibold'
                        : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                    }`}
                  >
                    {mod.label}
                  </button>
                ))}
              </div>

              {/* Days of Week Selection */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((d) => {
                    const active = selectedDaysOfWeek.includes(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          let updated: number[]
                          if (active) updated = selectedDaysOfWeek.filter((id) => id !== d.id)
                          else updated = [...selectedDaysOfWeek, d.id].sort()
                          setSelectedDaysOfWeek(updated)
                          setCustomWeekdayRulesStr(updated.map((id) => `${weekdayModifier}${id}`).join(','))
                        }}
                        className={`px-2.5 py-1 text-xs font-medium border transition-colors rounded ${
                          active
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                        }`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Rule Expression Box */}
              <div className="pt-2 space-y-1">
                <label className="block text-[11px] font-semibold text-text-secondary">Weekday Rule String (comma-separated):</label>
                <input
                  type="text"
                  value={customWeekdayRulesStr}
                  onChange={(e) => setCustomWeekdayRulesStr(e.target.value)}
                  placeholder="e.g. 1,2,3,4,5 or D2W2,D3W2 or -5"
                  className="w-full border border-border bg-surface py-1.5 px-2.5 text-xs font-mono text-text focus:border-primary focus:outline-none rounded"
                />
              </div>
            </>
          )}
        </div>

        {/* Center Relation (OR / AND) Dropdown */}
        <div className="flex flex-col items-center justify-center self-center py-2 space-y-1">
          <label className="text-[10px] text-text-muted font-medium">Relation</label>
          <select
            value={weekMonthRelation}
            onChange={(e) => setWeekMonthRelation(e.target.value as 'OR' | 'AND')}
            className="border border-border bg-surface py-1.5 px-3 font-semibold text-xs text-primary rounded focus:border-primary focus:outline-none shadow-xs"
          >
            <option value="OR">Or</option>
            <option value="AND">And</option>
          </select>
        </div>

        {/* Right Column: Run on Month Days */}
        <div className={`border rounded p-3 space-y-3 transition-opacity ${enableMonthdays ? 'border-border bg-surface-sunken/30' : 'border-border/50 bg-surface-sunken/10 opacity-60'}`}>
          <div className="flex items-center justify-between border-b border-border pb-2">
            <label className="flex items-center gap-2 font-semibold text-text cursor-pointer">
              <input
                type="checkbox"
                checked={enableMonthdays}
                onChange={(e) => setEnableMonthdays(e.target.checked)}
                className="accent-primary"
              />
              <span>Run on Month Days</span>
            </label>

            {enableMonthdays && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted text-[11px]">Calendar:</span>
                <select
                  value={monthCalendar}
                  onChange={(e) => setMonthCalendar(e.target.value)}
                  className="border border-border bg-surface py-0.5 px-2 text-xs text-text rounded focus:border-primary focus:outline-none"
                >
                  <option value="">Available options</option>
                  {availableCalendars.map((cal) => (
                    <option key={cal} value={cal}>
                      {cal}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {enableMonthdays && (
            <>
              {/* Subtabs: Run | Start of month | End of month */}
              <div className="flex border-b border-border">
                <button
                  type="button"
                  onClick={() => setMonthdaySubTab('run')}
                  className={`px-3 py-1 font-medium border-b-2 transition-colors ${
                    monthdaySubTab === 'run' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  Run
                </button>
                <button
                  type="button"
                  onClick={() => setMonthdaySubTab('start_of_month')}
                  className={`px-3 py-1 font-medium border-b-2 transition-colors ${
                    monthdaySubTab === 'start_of_month' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  Start of month
                </button>
                <button
                  type="button"
                  onClick={() => setMonthdaySubTab('end_of_month')}
                  className={`px-3 py-1 font-medium border-b-2 transition-colors ${
                    monthdaySubTab === 'end_of_month' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  End of month
                </button>
              </div>

              {/* Modifiers Selector: None, >, <, - */}
              <div className="flex items-center gap-2 pt-1 text-[11px]">
                <span className="text-text-muted font-medium">Modifier:</span>
                {[
                  { id: '', label: 'None (Exact)' },
                  { id: '>', label: '> (Next Work Day)' },
                  { id: '<', label: '< (Prev Work Day)' },
                  { id: '-', label: '- (Exclusion / NOT)' },
                ].map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => {
                      setMonthdayModifier(mod.id as any)
                      const base = customMonthdayRulesStr.replace(/^[-><]/, '')
                      setCustomMonthdayRulesStr(`${mod.id}${base}`)
                    }}
                    className={`px-2 py-0.5 border rounded transition-colors ${
                      monthdayModifier === mod.id
                        ? 'bg-primary text-white border-primary shadow-xs font-semibold'
                        : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                    }`}
                  >
                    {mod.label}
                  </button>
                ))}
              </div>

              {/* Monthday Selector Pills */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {(monthdaySubTab === 'end_of_month'
                    ? ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']
                    : monthdaySubTab === 'start_of_month'
                    ? ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']
                    : ['15', 'WORKDAYS', '1', '2', '3', '4', '5']
                  ).map((code) => {
                    const fullCode = `${monthdayModifier}${code}`
                    const active = customMonthdayRulesStr.split(',').includes(fullCode) || selectedMonthdays.includes(code)
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setSelectedMonthdays([code])
                          setCustomMonthdayRulesStr(fullCode)
                        }}
                        className={`px-2.5 py-1 text-xs font-mono font-medium border transition-colors rounded ${
                          active
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                        }`}
                      >
                        {fullCode}
                      </button>
                    )
                  })}
                </div>

                <p className="text-[11px] text-text-muted italic pt-1">
                  Run on working day from end of month (<strong>L</strong>), start of month (<strong>D</strong>), or calendar date (<strong>1-31</strong>). Use <strong>&gt;</strong> or <strong>&lt;</strong> to shift to adjacent working days.
                </p>
              </div>

              {/* Generated Monthday Rule Text Box */}
              <div className="pt-2 space-y-1">
                <label className="block text-[11px] font-semibold text-text-secondary">Monthday Rule String (comma-separated):</label>
                <input
                  type="text"
                  value={customMonthdayRulesStr}
                  onChange={(e) => setCustomMonthdayRulesStr(e.target.value)}
                  placeholder="e.g. L1 or >15 or <15 or WORKDAYS"
                  className="w-full border border-border bg-surface py-1.5 px-2.5 text-xs font-mono text-text focus:border-primary focus:outline-none rounded"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Relation Divider: And */}
      <div className="text-center font-semibold text-xs text-text-secondary uppercase tracking-wider py-1">
        And
      </div>

      {/* Run on Months Bar */}
      <div className="border border-border rounded p-3 space-y-2 bg-surface-sunken/30">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-text">Run on Months:</label>
          <div className="flex gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedMonths([...MONTHS_LIST])}
              className="text-primary hover:underline font-medium"
            >
              Select all
            </button>
            <button type="button" onClick={() => setSelectedMonths([])} className="text-text-muted hover:underline font-medium">
              Clear all
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {MONTHS_LIST.map((m) => {
            const active = selectedMonths.includes(m)
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (active) setSelectedMonths(selectedMonths.filter((item) => item !== m))
                  else setSelectedMonths([...selectedMonths, m])
                }}
                className={`px-3 py-1 text-xs font-semibold border transition-colors rounded ${
                  active
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                }`}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {/* Confirmation Calendar Section */}
      <div className="border border-border rounded p-3 space-y-3 bg-surface-sunken/30">
        <h4 className="font-semibold text-text">Confirmation Calendar</h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-text-secondary">Exception Policy</label>
            <select
              value={confirmationPolicy}
              onChange={(e) => setConfirmationPolicy(e.target.value)}
              className="w-full border border-border bg-surface py-1.5 px-2.5 text-xs text-text rounded focus:border-primary focus:outline-none"
            >
              {EXCEPTION_POLICY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-text-secondary">Calendar</label>
            <select
              value={confirmationCalendar}
              onChange={(e) => setConfirmationCalendar(e.target.value)}
              className="w-full border border-border bg-surface py-1.5 px-2.5 text-xs text-text rounded focus:border-primary focus:outline-none"
            >
              <option value="">Available options</option>
              {availableCalendars.map((cal) => (
                <option key={cal} value={cal}>
                  {cal}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-text-secondary">Shift by</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="-62"
                max="62"
                value={shiftBy}
                onChange={(e) => setShiftBy(Number(e.target.value))}
                className="w-20 border border-border bg-surface py-1 px-2.5 text-xs text-text font-mono rounded focus:border-primary focus:outline-none"
              />
              <span className="text-xs text-text-muted">confirmed days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
