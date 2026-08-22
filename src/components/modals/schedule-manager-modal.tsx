'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/ui-custom/modal'
import Button from '@/components/ui-custom/button'
import Input from '@/components/ui-custom/input'
import { useUIStore } from '@/lib/stores/ui-store'
import { fetchTableRows, createTableRow, updateTableRow, deleteTableRow } from '@/lib/api-client'

const DEFAULT_CONFIG = {
  CALENDARS: { REGULAR: { WORKDAYS: [1, 2, 3, 4, 5], HOLIDAYS: ['2026-01-01', '2026-12-25'] } },
  WEEKDAYS_CALENDAR: 'REGULAR',
  MONTH_CALENDAR: 'REGULAR',
  WEEKDAYS: ['1', '2', '3', '4', '5'],
  MONTHDAYS: ['WORKDAYS'],
  MONTHS: ['ALL'],
  WEEK_MONTH_RELATION: 'OR',
  CONFIRMATION: { CALENDAR: 'REGULAR', EXCEPTION_POLICY: 'SHIFT_AND_RUN_ON_NEXT_CONFIRMED_DAY', SHIFT_BY: 0 },
  ACTIVITY_PERIOD: { MODE: 'ALWAYS' },
}

interface ScheduleConfigRow {
  id: string
  name: string
  configData: string
  lastEvaluatedDate: string | null
  isScheduledToday: string
}

export default function ScheduleManagerModal() {
  const isOpen = useUIStore((s) => s.isScheduleManagerOpen)
  const close = useUIStore((s) => s.closeScheduleManager)
  const [configs, setConfigs] = useState<ScheduleConfigRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [configJson, setConfigJson] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await fetchTableRows<ScheduleConfigRow>('schedule_configs')
      setConfigs(rows)
      if (rows.length > 0 && !selectedId) {
        selectConfig(rows[0])
      }
    } catch (err) {
      toast.error(`Failed to load schedule configs: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen])

  const selectConfig = (sc: ScheduleConfigRow) => {
    setSelectedId(sc.id)
    setName(sc.name)
    setConfigJson(JSON.stringify(JSON.parse(sc.configData), null, 2))
  }

  const onNew = () => {
    setSelectedId(null)
    setName('NEW_SCHEDULE')
    setConfigJson(JSON.stringify(DEFAULT_CONFIG, null, 2))
  }

  const onSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(configJson)
    } catch {
      toast.error('Config JSON is invalid')
      return
    }
    setSaving(true)
    try {
      const payload = {
        id: selectedId ?? `sched-${Date.now()}`,
        name: name.trim().toUpperCase(),
        configData: JSON.stringify(parsed),
      }
      if (selectedId) {
        await updateTableRow('schedule_configs', selectedId, payload)
        toast.success(`Schedule "${payload.name}" updated`)
      } else {
        await createTableRow('schedule_configs', payload)
        toast.success(`Schedule "${payload.name}" created`)
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
    if (!window.confirm(`Delete schedule "${name}"?`)) return
    try {
      await deleteTableRow('schedule_configs', selectedId)
      toast.success('Schedule deleted')
      setSelectedId(null)
      await load()
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(o) => !o && close()}
      title="Schedule Config Manager"
      description="Manage RBC schedule configurations used by jobs."
      size="xl"
      footer={
        <>
          <Button variant="danger" onClick={onDelete} disabled={!selectedId || saving}>Delete</Button>
          <Button variant="secondary" onClick={close} disabled={saving}>Close</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save Schedule'}</Button>
        </>
      }
    >
      <div className="flex h-full">
        <div className="w-56 shrink-0 border-r border-border bg-surface-sunken overflow-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="label-caps">Schedules</span>
            <button type="button" onClick={onNew} title="New schedule" className="inline-flex items-center justify-center size-5 text-text-muted hover:text-primary hover:bg-primary/10">
              <Plus size={12} strokeWidth={1.5} />
            </button>
          </div>
          {loading ? (
            <div className="p-3 text-xs text-text-muted">Loading…</div>
          ) : (
            <ul className="py-1">
              {configs.map((sc) => (
                <li key={sc.id}>
                  <button
                    type="button"
                    onClick={() => selectConfig(sc)}
                    className={`w-full flex flex-col gap-0.5 px-3 py-1.5 text-left hover:bg-surface-hover ${selectedId === sc.id ? 'bg-primary/10 text-primary' : 'text-text'}`}
                  >
                    <span className="truncate font-mono text-xs">{sc.name}</span>
                    <span className="text-[10px]">
                      {sc.lastEvaluatedDate ? `Eval: ${sc.lastEvaluatedDate}` : 'Not evaluated'} ·
                      Today: <strong className={sc.isScheduledToday === 'Yes' ? 'text-success-fg' : sc.isScheduledToday === 'No' ? 'text-danger-fg' : 'text-text-muted'}>{sc.isScheduledToday}</strong>
                    </span>
                  </button>
                </li>
              ))}
              {configs.length === 0 && (
                <li className="px-3 py-3 text-xs text-text-muted">No schedules. Click + to create one.</li>
              )}
            </ul>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
          <Input label="Schedule Name (uppercase)" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} />
          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1">Config JSON</label>
            <textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              spellCheck={false}
              className="w-full h-96 px-2 py-1.5 text-xs font-mono bg-surface border border-border-strong text-text focus:border-primary outline-none resize-none"
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
