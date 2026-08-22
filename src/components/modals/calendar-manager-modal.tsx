'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/ui-custom/modal'
import Button from '@/components/ui-custom/button'
import Input from '@/components/ui-custom/input'
import { useUIStore } from '@/lib/stores/ui-store'
import { fetchTableRows, createTableRow, updateTableRow, deleteTableRow } from '@/lib/api-client'

const DAYS_OF_WEEK = [
  { num: 1, label: 'Mon' },
  { num: 2, label: 'Tue' },
  { num: 3, label: 'Wed' },
  { num: 4, label: 'Thu' },
  { num: 5, label: 'Fri' },
  { num: 6, label: 'Sat' },
  { num: 7, label: 'Sun' },
]

interface CalendarRow {
  id: string
  name: string
  workdays: string
  holidays: string
}

function parseWorkdays(s: string): number[] {
  try {
    const arr = JSON.parse(s) as number[]
    return Array.isArray(arr) ? arr : [1, 2, 3, 4, 5]
  } catch {
    return [1, 2, 3, 4, 5]
  }
}

function parseHolidays(s: string): string[] {
  try {
    const arr = JSON.parse(s) as string[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export default function CalendarManagerModal() {
  const isOpen = useUIStore((s) => s.isCalendarManagerOpen)
  const close = useUIStore((s) => s.closeCalendarManager)
  const [calendars, setCalendars] = useState<CalendarRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [workdays, setWorkdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [holidays, setHolidays] = useState<string[]>([])
  const [newHoliday, setNewHoliday] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await fetchTableRows<CalendarRow>('calendars')
      setCalendars(rows)
      if (rows.length > 0 && !selectedId) {
        selectCalendar(rows[0])
      }
    } catch (err) {
      toast.error(`Failed to load calendars: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen])

  const selectCalendar = (cal: CalendarRow) => {
    setSelectedId(cal.id)
    setName(cal.name)
    setWorkdays(parseWorkdays(cal.workdays))
    setHolidays(parseHolidays(cal.holidays))
  }

  const onNew = () => {
    setSelectedId(null)
    setName('NEW_CALENDAR')
    setWorkdays([1, 2, 3, 4, 5])
    setHolidays([])
  }

  const onSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        id: selectedId ?? `cal-${Date.now()}`,
        name: name.trim().toUpperCase(),
        workdays: JSON.stringify(workdays),
        holidays: JSON.stringify(holidays),
      }
      if (selectedId) {
        await updateTableRow('calendars', selectedId, payload)
        toast.success(`Calendar "${payload.name}" updated`)
      } else {
        await createTableRow('calendars', payload)
        toast.success(`Calendar "${payload.name}" created`)
      }
      await load()
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!selectedId) return
    if (!window.confirm(`Delete calendar "${name}"?`)) return
    try {
      await deleteTableRow('calendars', selectedId)
      toast.success('Calendar deleted')
      setSelectedId(null)
      await load()
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const toggleWorkday = (num: number) => {
    setWorkdays((prev) => prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort())
  }

  const addHoliday = () => {
    if (newHoliday && /^\d{4}-\d{2}-\d{2}$/.test(newHoliday) && !holidays.includes(newHoliday)) {
      setHolidays((prev) => [...prev, newHoliday].sort())
      setNewHoliday('')
    }
  }

  const removeHoliday = (h: string) => {
    setHolidays((prev) => prev.filter((x) => x !== h))
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(o) => !o && close()}
      title="Calendar Manager"
      description="Define workdays and holidays for the RBC engine."
      size="xl"
      footer={
        <>
          <Button variant="danger" onClick={onDelete} disabled={!selectedId || saving}>Delete</Button>
          <Button variant="secondary" onClick={close} disabled={saving}>Close</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save Calendar'}</Button>
        </>
      }
    >
      <div className="flex h-full">
        <div className="w-56 shrink-0 border-r border-border bg-surface-sunken overflow-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="label-caps">Calendars</span>
            <button type="button" onClick={onNew} title="New calendar" className="inline-flex items-center justify-center size-5 text-text-muted hover:text-primary hover:bg-primary/10">
              <Plus size={12} strokeWidth={1.5} />
            </button>
          </div>
          {loading ? (
            <div className="p-3 text-xs text-text-muted">Loading…</div>
          ) : (
            <ul className="py-1">
              {calendars.map((cal) => (
                <li key={cal.id}>
                  <button
                    type="button"
                    onClick={() => selectCalendar(cal)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-hover ${selectedId === cal.id ? 'bg-primary/10 text-primary' : 'text-text'}`}
                  >
                    <span className="truncate font-mono">{cal.name}</span>
                  </button>
                </li>
              ))}
              {calendars.length === 0 && (
                <li className="px-3 py-3 text-xs text-text-muted">No calendars. Click + to create one.</li>
              )}
            </ul>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
          <Input label="Calendar Name (uppercase)" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} />

          <div>
            <span className="text-[11px] font-medium text-text-muted block mb-1.5">Workdays</span>
            <div className="flex gap-1">
              {DAYS_OF_WEEK.map((d) => (
                <button
                  key={d.num}
                  type="button"
                  onClick={() => toggleWorkday(d.num)}
                  className={`h-[var(--control-h)] w-10 text-xs font-medium border ${workdays.includes(d.num) ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface text-text-muted border-border-strong hover:bg-surface-hover'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-medium text-text-muted block mb-1.5">Holidays ({holidays.length})</span>
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="h-[var(--control-h)] px-2 text-xs bg-surface border border-border-strong text-text focus:border-primary outline-none"
              />
              <Button size="sm" variant="secondary" onClick={addHoliday} disabled={!newHoliday}>Add</Button>
            </div>
            <ul className="border border-border max-h-64 overflow-auto">
              {holidays.length === 0 ? (
                <li className="px-2 py-3 text-xs text-text-muted text-center">No holidays defined</li>
              ) : (
                holidays.map((h) => (
                  <li key={h} className="flex items-center justify-between px-2 py-1 text-xs border-b border-border last:border-b-0">
                    <span className="font-mono text-text">{h}</span>
                    <button
                      type="button"
                      onClick={() => removeHoliday(h)}
                      className="text-text-muted hover:text-danger-fg"
                    >
                      <Trash2 size={11} strokeWidth={1.5} />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  )
}
