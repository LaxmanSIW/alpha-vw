import { useState, useEffect } from 'react'
import Icon from './Icon'
import { fetchTableRows, createTableRow, updateTableRow, deleteTableRow } from '../api/client'

export interface CalendarItem {
  id: string
  name: string
  workdays: number[]
  holidays: string[]
}

interface CalendarManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onCalendarsUpdated?: () => void
}

const DAY_LABELS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
]

export default function CalendarManagerModal({ isOpen, onClose, onCalendarsUpdated }: CalendarManagerModalProps) {
  const [calendars, setCalendars] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit / Form state
  const [isEditing, setIsEditing] = useState(false)
  const [selectedCalId, setSelectedCalId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [workdays, setWorkdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [holidays, setHolidays] = useState<string[]>([])
  const [newHolidayInput, setNewHolidayInput] = useState('')
  const [saving, setSaving] = useState(false)

  const loadCalendars = async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchTableRows<{ id: string; name: string; workdays: string; holidays: string }>('calendars')
      const parsed: CalendarItem[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        workdays: typeof r.workdays === 'string' ? JSON.parse(r.workdays) : r.workdays || [1, 2, 3, 4, 5],
        holidays: typeof r.holidays === 'string' ? JSON.parse(r.holidays) : r.holidays || [],
      }))
      setCalendars(parsed)
      if (onCalendarsUpdated) onCalendarsUpdated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load calendars')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadCalendars()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOpenAdd = () => {
    setSelectedCalId(null)
    setName('')
    setWorkdays([1, 2, 3, 4, 5])
    setHolidays([])
    setIsEditing(true)
  }

  const handleOpenEdit = (cal: CalendarItem) => {
    setSelectedCalId(cal.id)
    setName(cal.name)
    setWorkdays([...cal.workdays])
    setHolidays([...cal.holidays])
    setIsEditing(true)
  }

  const handleDelete = async (cal: CalendarItem) => {
    if (!confirm(`Are you sure you want to delete calendar "${cal.name}"?`)) return
    try {
      await deleteTableRow('calendars', cal.id)
      await loadCalendars()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete calendar')
    }
  }

  const toggleWorkday = (day: number) => {
    if (workdays.includes(day)) {
      setWorkdays(workdays.filter((d) => d !== day))
    } else {
      setWorkdays([...workdays, day].sort())
    }
  }

  const handleAddHoliday = () => {
    if (!newHolidayInput || !/^\d{4}-\d{2}-\d{2}$/.test(newHolidayInput)) {
      alert('Please enter a valid date in YYYY-MM-DD format')
      return
    }
    if (!holidays.includes(newHolidayInput)) {
      setHolidays([...holidays, newHolidayInput].sort())
    }
    setNewHolidayInput('')
  }

  const handleRemoveHoliday = (dateStr: string) => {
    setHolidays(holidays.filter((h) => h !== dateStr))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('Calendar Name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim().toUpperCase(),
        workdays: JSON.stringify(workdays),
        holidays: JSON.stringify(holidays),
      }
      if (selectedCalId) {
        await updateTableRow('calendars', selectedCalId, payload)
      } else {
        const newId = `cal-${Date.now()}`
        await createTableRow('calendars', { id: newId, ...payload })
      }
      setIsEditing(false)
      await loadCalendars()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save calendar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-[88vw] 2xl:max-w-5xl border border-border bg-surface shadow-2xl text-text overflow-hidden rounded-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-4 py-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Icon name="calendar" size={18} />
            <span>Calendar Management (RBC Workdays & Holidays)</span>
          </div>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 max-h-[75vh] overflow-y-auto">
          {error && <div className="mb-4 p-3 text-xs bg-danger-bg/20 text-danger-fg border border-danger-fg">{error}</div>}

          {!isEditing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  Configure custom working days and holiday exclusion dates used by Rule-Based Calendars.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1.5 bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover shadow-xs transition-colors border border-primary"
                >
                  <Icon name="plus" size={14} />
                  <span>Create New Calendar</span>
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-text-muted">Loading calendars...</div>
              ) : calendars.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-muted">No calendars defined yet.</div>
              ) : (
                <div className="divide-y divide-border border border-border rounded">
                  {calendars.map((cal) => (
                    <div key={cal.id} className="flex items-center justify-between p-3 hover:bg-surface-sunken/50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-primary">{cal.name}</span>
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                            {cal.workdays.length} Workdays
                          </span>
                          <span className="text-[10px] bg-warning-bg text-warning-fg px-1.5 py-0.5 rounded font-mono">
                            {cal.holidays.length} Holidays
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary">
                          Workdays:{' '}
                          {DAY_LABELS.filter((d) => cal.workdays.includes(d.id))
                            .map((d) => d.label)
                            .join(', ')}
                        </div>
                        {cal.holidays.length > 0 && (
                          <div className="text-xs text-text-muted font-mono truncate max-w-md">
                            Holidays: {cal.holidays.join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cal)}
                          className="p-1.5 text-text-secondary hover:text-primary hover:bg-surface-sunken rounded"
                          title="Edit Calendar"
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cal)}
                          className="p-1.5 text-text-secondary hover:text-danger-fg hover:bg-surface-sunken rounded"
                          title="Delete Calendar"
                        >
                          <Icon name="close" size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-secondary">Calendar Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. REGULAR or MFD9H"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-border bg-surface-sunken py-1.5 px-2.5 text-xs text-text uppercase focus:border-primary focus:outline-none"
                />
              </div>

              {/* Workdays Selector */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-secondary">Working Days (Mon - Sun)</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {DAY_LABELS.map((day) => {
                    const active = workdays.includes(day.id)
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleWorkday(day.id)}
                        className={`px-3 py-1.5 text-xs font-medium border transition-colors rounded ${
                          active
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-surface-sunken text-text-secondary border-border hover:bg-surface-hover'
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Holidays Picker */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-text-secondary">Holiday Dates (YYYY-MM-DD)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newHolidayInput}
                    onChange={(e) => setNewHolidayInput(e.target.value)}
                    className="border border-border bg-surface-sunken py-1 px-2 text-xs text-text focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddHoliday}
                    className="bg-primary/10 text-primary border border-primary/30 px-3 py-1 text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    + Add Holiday Date
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2 max-h-32 overflow-y-auto">
                  {holidays.length === 0 ? (
                    <span className="text-xs text-text-muted italic">No holiday dates added.</span>
                  ) : (
                    holidays.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-1 bg-surface-sunken border border-border px-2 py-0.5 text-xs font-mono text-text"
                      >
                        <span>{h}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveHoliday(h)}
                          className="text-text-muted hover:text-danger-fg"
                        >
                          <Icon name="close" size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="border border-primary/40 bg-white px-3.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 hover:border-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover shadow-xs border border-primary transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : selectedCalId ? 'Update Calendar' : 'Create Calendar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
