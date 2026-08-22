'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Code2, MousePointerClick, ArrowRightLeft, AlertTriangle } from 'lucide-react'
import Modal from '@/components/ui-custom/modal'
import Button from '@/components/ui-custom/button'
import Input from '@/components/ui-custom/input'
import { useUIStore } from '@/lib/stores/ui-store'
import { fetchTableRows, createTableRow, updateTableRow, deleteTableRow } from '@/lib/api-client'
import type { ScheduleConfigInput } from '@/lib/schedule-engine'
import ScheduleBuilder from '@/components/schedule-builder/schedule-builder'

const DEFAULT_CONFIG: ScheduleConfigInput = {
  WEEKDAYS: ['1', '2', '3', '4', '5'],
  MONTHS: ['ALL'],
  ACTIVITY_PERIOD: { MODE: 'ALWAYS' },
}

interface ScheduleConfigRow {
  id: string
  name: string
  configData: string
  lastEvaluatedDate: string | null
  isScheduledToday: string
}

interface CalendarRow {
  id: string
  name: string
  workdays: string
  holidays: string
}

type EditMode = 'visual' | 'json'

export default function ScheduleManagerModal() {
  const isOpen = useUIStore((s) => s.isScheduleManagerOpen)
  const close = useUIStore((s) => s.closeScheduleManager)
  const [configs, setConfigs] = useState<ScheduleConfigRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [configJson, setConfigJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState<EditMode>('visual')
  const [availableCalendars, setAvailableCalendars] = useState<string[]>([])

  // Parse current JSON config for the visual builder
  const parsedConfig = useMemo<ScheduleConfigInput>(() => {
    try {
      return JSON.parse(configJson) as ScheduleConfigInput
    } catch {
      return {} as ScheduleConfigInput
    }
  }, [configJson])

  // Load schedules + calendars
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [scheduleRows, calendarRows] = await Promise.all([
        fetchTableRows<ScheduleConfigRow>('schedule_configs'),
        fetchTableRows<CalendarRow>('calendars'),
      ])
      setConfigs(scheduleRows)
      setAvailableCalendars(calendarRows.map((c) => c.name))
      if (scheduleRows.length > 0 && !selectedId) {
        selectConfig(scheduleRows[0])
      }
    } catch (err) {
      toast.error(`Failed to load: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen, load])

  const selectConfig = (sc: ScheduleConfigRow) => {
    setSelectedId(sc.id)
    setName(sc.name)
    try {
      setConfigJson(JSON.stringify(JSON.parse(sc.configData), null, 2))
    } catch {
      setConfigJson(sc.configData)
    }
  }

  const onNew = () => {
    setSelectedId(null)
    setName('NEW_SCHEDULE')
    setConfigJson(JSON.stringify(DEFAULT_CONFIG, null, 2))
  }

  // Visual builder → sync to JSON
  const onVisualChange = useCallback((newConfig: ScheduleConfigInput) => {
    setConfigJson(JSON.stringify(newConfig, null, 2))
  }, [])

  // Switch from JSON → Visual: JSON is already the source of truth
  const switchToVisual = () => {
    // Validate JSON before switching
    try {
      JSON.parse(configJson)
      setEditMode('visual')
    } catch {
      toast.error('Fix JSON errors before switching to Visual mode')
    }
  }

  // Switch from Visual → JSON: visual already writes to configJson
  const switchToJson = () => {
    setEditMode('json')
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

  // Check if JSON has parse errors
  const jsonHasError = useMemo(() => {
    try {
      JSON.parse(configJson)
      return false
    } catch {
      return true
    }
  }, [configJson])

  return (
    <Modal
      open={isOpen}
      onOpenChange={(o) => !o && close()}
      title="Schedule Config Manager"
      description="Manage RBC schedule configurations used by jobs."
      size="2xl"
      footer={
        <>
          <Button variant="danger" onClick={onDelete} disabled={!selectedId || saving}>Delete</Button>
          <Button variant="secondary" onClick={close} disabled={saving}>Close</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save Schedule'}</Button>
        </>
      }
    >
      <div className="flex h-full">
        {/* ── Left sidebar: schedule list ──────────────────────────────────── */}
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

        {/* ── Right: editor area ──────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          {/* Name field + Mode toggle */}
          <div className="px-4 pt-3 pb-2 border-b border-border space-y-2 shrink-0">
            <Input label="Schedule Name (uppercase)" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} />

            {/* Visual / JSON toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={switchToVisual}
                disabled={jsonHasError}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border rounded transition-colors ${
                  editMode === 'visual'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text-secondary border-border-strong hover:bg-surface-hover'
                } ${jsonHasError ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <MousePointerClick size={12} />
                Visual Builder
              </button>
              <button
                type="button"
                onClick={switchToJson}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border rounded transition-colors ${
                  editMode === 'json'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text-secondary border-border-strong hover:bg-surface-hover'
                }`}
              >
                <Code2 size={12} />
                JSON Editor
              </button>
              <div className="flex-1" />
              {jsonHasError && editMode === 'json' && (
                <span className="inline-flex items-center gap-1 text-[10px] text-danger-fg">
                  <AlertTriangle size={10} />
                  JSON has errors
                </span>
              )}
              {availableCalendars.length === 0 && (
                <span className="text-[10px] text-text-muted italic">No calendars defined — open Calendar Manager to create one</span>
              )}
            </div>
          </div>

          {/* Editor content */}
          <div className="flex-1 min-h-0 overflow-auto">
            {editMode === 'visual' ? (
              <div className="p-4">
                <ScheduleBuilder
                  key={selectedId ?? 'new'}
                  config={parsedConfig}
                  availableCalendars={availableCalendars}
                  onChange={onVisualChange}
                />
              </div>
            ) : (
              <div className="p-4">
                <div>
                  <label className="text-[11px] font-medium text-text-muted block mb-1">Config JSON</label>
                  <textarea
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    spellCheck={false}
                    className={`w-full h-[calc(100vh-16rem)] px-2 py-1.5 text-xs font-mono bg-surface border text-text focus:border-primary outline-none resize-none ${
                      jsonHasError ? 'border-danger-fg' : 'border-border-strong'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}