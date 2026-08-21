import { useState, useEffect } from 'react'
import Icon from './Icon'
import ScheduleBuilder from './ScheduleBuilder'
import { fetchTableRows, createTableRow, updateTableRow, deleteTableRow } from '../api/client'
import type { ScheduleConfigInput } from '../../api/schedule'

export interface ScheduleConfigItem {
  id: string
  name: string
  config_data: ScheduleConfigInput
}

interface ScheduleManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onSchedulesUpdated?: () => void
}

export default function ScheduleManagerModal({ isOpen, onClose, onSchedulesUpdated }: ScheduleManagerModalProps) {
  const [schedules, setSchedules] = useState<ScheduleConfigItem[]>([])
  const [availableCalendars, setAvailableCalendars] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit / Form State
  const [isEditing, setIsEditing] = useState(false)
  const [selectedSchedId, setSelectedSchedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [currentConfig, setCurrentConfig] = useState<ScheduleConfigInput>({})
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [schedRows, calRows] = await Promise.all([
        fetchTableRows<{ id: string; name: string; config_data: string }>('schedule_configs'),
        fetchTableRows<{ id: string; name: string }>('calendars'),
      ])

      const parsed: ScheduleConfigItem[] = schedRows.map((r) => ({
        id: r.id,
        name: r.name,
        config_data: typeof r.config_data === 'string' ? JSON.parse(r.config_data) : r.config_data || {},
      }))
      setSchedules(parsed)
      setAvailableCalendars(calRows.map((c) => c.name))
      if (onSchedulesUpdated) onSchedulesUpdated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOpenAdd = () => {
    setSelectedSchedId(null)
    setName('')
    setCurrentConfig({
      WEEKDAYS: ['1', '2', '3', '4', '5'],
      MONTHDAYS: ['WORKDAYS'],
      MONTHS: ['ALL'],
      WEEK_MONTH_RELATION: 'OR',
      CONFIRMATION: { EXCEPTION_POLICY: 'SHIFT_AND_RUN_ON_NEXT_CONFIRMED_DAY', SHIFT_BY: 0 },
      ACTIVITY_PERIOD: { MODE: 'ALWAYS' },
    })
    setIsEditing(true)
  }

  const handleOpenEdit = (sched: ScheduleConfigItem) => {
    setSelectedSchedId(sched.id)
    setName(sched.name)
    setCurrentConfig(sched.config_data)
    setIsEditing(true)
  }

  const handleDelete = async (sched: ScheduleConfigItem) => {
    if (!confirm(`Are you sure you want to delete schedule configuration "${sched.name}"?`)) return
    try {
      await deleteTableRow('schedule_configs', sched.id)
      await loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete schedule')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('Schedule Configuration Name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim().toUpperCase(),
        config_data: JSON.stringify(currentConfig),
      }
      if (selectedSchedId) {
        await updateTableRow('schedule_configs', selectedSchedId, payload)
      } else {
        const newId = `sched-${Date.now()}`
        await createTableRow('schedule_configs', { id: newId, ...payload })
      }
      setIsEditing(false)
      await loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save schedule configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-[92vw] 2xl:max-w-6xl border border-border bg-surface shadow-2xl text-text overflow-hidden rounded-md my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-4 py-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Icon name="calendar" size={18} />
            <span>Schedule Configuration Manager (RBC Configurations)</span>
          </div>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          {error && <div className="mb-4 p-3 text-xs bg-danger-bg/20 text-danger-fg border border-danger-fg">{error}</div>}

          {!isEditing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  Create and manage reusable Rule-Based Calendar (RBC) Schedule Configurations mapped to job nodes.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1.5 bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover shadow-xs transition-colors border border-primary"
                >
                  <Icon name="plus" size={14} />
                  <span>Create New Schedule Config</span>
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-text-muted">Loading schedule configurations...</div>
              ) : schedules.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-muted">No schedule configurations created yet.</div>
              ) : (
                <div className="divide-y divide-border border border-border rounded">
                  {schedules.map((sched) => (
                    <div key={sched.id} className="flex items-center justify-between p-3 hover:bg-surface-sunken/50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-primary">{sched.name}</span>
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                            Weekdays: {sched.config_data.WEEKDAYS?.join(', ') || 'None'}
                          </span>
                          <span className="text-[10px] bg-surface-sunken border border-border text-text-secondary px-1.5 py-0.5 rounded font-mono">
                            Monthdays: {sched.config_data.MONTHDAYS?.join(', ') || 'None'}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary">
                          Relation: <strong className="text-text font-mono">{sched.config_data.WEEK_MONTH_RELATION || 'OR'}</strong> &middot;{' '}
                          Months: <span className="font-mono text-text">{sched.config_data.MONTHS?.join(', ') || 'ALL'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(sched)}
                          className="p-1.5 text-text-secondary hover:text-primary hover:bg-surface-sunken rounded"
                          title="Edit Schedule Configuration"
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sched)}
                          className="p-1.5 text-text-secondary hover:text-danger-fg hover:bg-surface-sunken rounded"
                          title="Delete Schedule Configuration"
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
                <label className="block text-xs font-semibold text-text-secondary">Schedule Configuration Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DAILY_PROD_RUN or END_OF_MONTH_RUN"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-border bg-surface-sunken py-1.5 px-2.5 text-xs text-text uppercase focus:border-primary focus:outline-none"
                />
              </div>

              <ScheduleBuilder
                initialConfig={currentConfig}
                availableCalendars={availableCalendars}
                onChange={(newCfg) => setCurrentConfig(newCfg)}
              />

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
                  {saving ? 'Saving...' : selectedSchedId ? 'Update Schedule Config' : 'Create Schedule Config'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
