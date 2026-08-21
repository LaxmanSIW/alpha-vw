import { useState, useEffect } from 'react'
import Icon from './Icon'
import ScheduleBuilder from './ScheduleBuilder'
import { fetchTableRows } from '../api/client'
import type { ScheduleConfigInput } from '../../api/schedule'

interface ViewScheduleModalProps {
  isOpen: boolean
  nodeLabel?: string
  scheduleName?: string
  config?: ScheduleConfigInput
  onClose: () => void
  onSaveConfig?: (newConfig: ScheduleConfigInput) => Promise<void>
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DAYS_HEADER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function ViewScheduleModal({
  isOpen,
  nodeLabel = 'Job Node',
  scheduleName = 'DAILY_PROD_RUN',
  config,
  onClose,
  onSaveConfig,
}: ViewScheduleModalProps) {
  const [rangeMode, setRangeMode] = useState<'current_year' | 'one_year_ahead' | 'next_year'>('current_year')
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [eligibleDates, setEligibleDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [availableCalendars, setAvailableCalendars] = useState<string[]>([])

  // Toggle config inspector / builder
  const [showConfigInspector, setShowConfigInspector] = useState(false)
  const [currentConfig, setCurrentConfig] = useState<ScheduleConfigInput>(config || {})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    // Fetch calendars from DB via client API helper
    fetchTableRows<{ id: string; name: string }>('calendars')
      .then((cals) => {
        if (Array.isArray(cals)) {
          setAvailableCalendars(cals.map((c) => c.name))
        }
      })
      .catch((err) => console.warn('Failed to load calendars:', err))

    if (config) {
      setCurrentConfig(config)
    } else if (scheduleName) {
      // Fetch schedule configuration from database via client API helper
      fetchTableRows<{ id: string; name: string; config_data: string }>('schedule_configs')
        .then((rows) => {
          if (Array.isArray(rows)) {
            const found = rows.find((r) => r.name === scheduleName)
            if (found && found.config_data) {
              const parsed = typeof found.config_data === 'string' ? JSON.parse(found.config_data) : found.config_data
              setCurrentConfig(parsed)
            }
          }
        })
        .catch((err) => console.warn('Failed to load schedule config:', err))
    }
  }, [config, scheduleName, isOpen])

  // Fetch evaluated run dates from server
  const evaluateRunDates = async (cfg: ScheduleConfigInput, yr: number) => {
    if (!cfg || Object.keys(cfg).length === 0) {
      setEligibleDates(new Set())
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/schedules/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg, year: yr }),
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.eligibleDates)) {
        setEligibleDates(new Set(data.eligibleDates))
      }
    } catch (e) {
      console.error('Failed to evaluate schedule dates:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && currentConfig && Object.keys(currentConfig).length > 0) {
      evaluateRunDates(currentConfig, selectedYear)
    }
  }, [isOpen, selectedYear, currentConfig])

  if (!isOpen) return null

  // Generate 12 months for selectedYear
  const monthsData = Array.from({ length: 12 }, (_, i) => {
    const monthIndex = i // 0 to 11
    const firstDay = new Date(Date.UTC(selectedYear, monthIndex, 1))
    let jsDay = firstDay.getUTCDay()
    const isoDayOfWeek = jsDay === 0 ? 7 : jsDay // 1=Mon, 7=Sun
    const daysInMonth = new Date(Date.UTC(selectedYear, monthIndex + 1, 0)).getUTCDate()

    return {
      year: selectedYear,
      monthIndex,
      monthName: MONTH_NAMES[monthIndex],
      startOffset: isoDayOfWeek - 1, // 0 for Mon, 6 for Sun
      daysInMonth,
    }
  })

  const handleYearChange = (mode: 'current_year' | 'one_year_ahead' | 'next_year') => {
    setRangeMode(mode)
    const baseYear = new Date().getUTCFullYear()
    if (mode === 'current_year') setSelectedYear(baseYear)
    else if (mode === 'next_year') setSelectedYear(baseYear + 1)
    else setSelectedYear(baseYear)
  }

  const handleSaveConfigClick = async () => {
    if (!onSaveConfig) return
    setSaving(true)
    try {
      await onSaveConfig(currentConfig)
      await evaluateRunDates(currentConfig, selectedYear)
    } catch (e) {
      alert('Failed to save schedule configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-[94vw] 2xl:max-w-7xl border border-border bg-surface shadow-2xl text-text overflow-hidden rounded-md my-auto">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-primary">
              <Icon name="calendar" size={18} />
            </span>
            <h2 className="text-sm font-semibold tracking-wide text-text">
              View Schedule &middot; <span className="text-primary">{nodeLabel}</span> ({scheduleName})
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-border bg-surface px-4 py-2 text-xs gap-2">
          <div className="flex items-center gap-2">
            <span className="text-text-muted font-medium">Range:</span>
            <select
              value={rangeMode}
              onChange={(e) => handleYearChange(e.target.value as any)}
              className="border border-border bg-surface-sunken py-1 px-2.5 text-xs text-text rounded focus:border-primary focus:outline-none"
            >
              <option value="current_year">Current year ({new Date().getUTCFullYear()})</option>
              <option value="one_year_ahead">One year ahead</option>
              <option value="next_year">Next year ({new Date().getUTCFullYear() + 1})</option>
            </select>

            {loading && <span className="text-xs text-primary font-medium italic animate-pulse">Calculating run dates...</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfigInspector(!showConfigInspector)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border transition-colors ${
                showConfigInspector
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-sunken text-primary border-primary/40 hover:bg-primary/5'
              }`}
            >
              <Icon name="edit" size={13} />
              <span>{showConfigInspector ? 'Hide Schedule Config' : 'View / Edit Schedule Config'}</span>
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div className="p-4 max-h-[75vh] overflow-y-auto space-y-4">
          {/* 12-Month Calendar Grid (Image 4) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {monthsData.map((m) => (
              <div key={m.monthName} className="border border-border rounded p-2 bg-surface-sunken/20 space-y-1.5">
                {/* Month Name Header */}
                <div className="text-center font-semibold text-xs text-text-secondary border-b border-border pb-1">
                  {m.monthName} {m.year}
                </div>

                {/* Day Labels Row */}
                <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-text-muted">
                  {DAYS_HEADER.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                {/* Day Cells Grid */}
                <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
                  {/* Empty cells before start of month */}
                  {Array.from({ length: m.startOffset }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-6" />
                  ))}

                  {/* Month Date Cells */}
                  {Array.from({ length: m.daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1
                    const dateStr = `${m.year}-${String(m.monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                    const isRunDate = eligibleDates.has(dateStr)

                    return (
                      <div
                        key={dateStr}
                        title={isRunDate ? `Scheduled Run Date: ${dateStr}` : dateStr}
                        className={`h-6 flex items-center justify-center font-mono rounded transition-colors ${
                          isRunDate
                            ? 'bg-primary text-white font-bold shadow-xs border border-primary'
                            : 'text-text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        {dayNum}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Config Inspector / Builder Section */}
          {showConfigInspector && (
            <div className="pt-4 border-t border-border space-y-3">
              <ScheduleBuilder
                initialConfig={currentConfig}
                availableCalendars={availableCalendars}
                onChange={(newCfg) => setCurrentConfig(newCfg)}
              />

              {onSaveConfig && (
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveConfigClick}
                    disabled={saving}
                    className="bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover shadow-xs border border-primary transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save & Re-Evaluate Schedule'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-surface-sunken px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="inline-block w-3 h-3 bg-primary rounded" />
            <span>Highlighted dates indicate scheduled job execution days.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-primary/40 bg-white px-4 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 hover:border-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
