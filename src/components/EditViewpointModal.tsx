import { useEffect, useState } from 'react'
import Icon from './Icon'
import { fetchTableRows, updateTableRow } from '../api/client'
import type { FieldDefinition, Viewpoint } from '../types'

interface EditViewpointModalProps {
  isOpen: boolean
  viewpoint: Viewpoint | null
  onClose: () => void
  onSuccess: () => void
}

const DEFAULT_FIELD_OPTIONS = [
  { value: 'Folder', label: 'Folder (Default Hierarchy)' },
  { value: 'host', label: 'Host (Host Server)' },
  { value: 'kind', label: 'Kind (Job Type)' },
  { value: 'status', label: 'Status (Operational State)' },
  { value: 'runs', label: 'Runs (Execution Count)' },
  { value: 'id', label: 'Node ID' },
  { value: 'label', label: 'Node Label' },
]

export default function EditViewpointModal({
  isOpen,
  viewpoint,
  onClose,
  onSuccess,
}: EditViewpointModalProps) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<'Public' | 'Private'>('Public')
  const [filterStatus, setFilterStatus] = useState<'All' | 'ok' | 'warning' | 'danger'>('All')
  const [grouping, setGrouping] = useState('Folder')
  const [sortBy, setSortBy] = useState('label')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [availableFields, setAvailableFields] = useState<Array<{ value: string; label: string }>>(DEFAULT_FIELD_OPTIONS)

  useEffect(() => {
    if (viewpoint) {
      setLabel(viewpoint.label ?? '')
      setDescription(viewpoint.description ?? '')
      setScope(viewpoint.scope ?? 'Public')
      setFilterStatus(viewpoint.filterStatus ?? 'All')
      setGrouping(viewpoint.grouping ?? 'Folder')
      setSortBy(viewpoint.sortBy ?? 'label')
    }
  }, [viewpoint])

  useEffect(() => {
    if (!isOpen) return
    let isMounted = true

    fetchTableRows<FieldDefinition>('field_definitions')
      .then((fields) => {
        if (!isMounted) return
        const map = new Map<string, string>()
        map.set('Folder', 'Folder (Default Hierarchy)')

        fields.forEach((f) => {
          map.set(f.key, `${f.label} (${f.key})`)
        })

        if (!map.has('id')) map.set('id', 'Node ID (id)')
        if (!map.has('label')) map.set('label', 'Node Label (label)')
        if (!map.has('kind')) map.set('kind', 'Kind (kind)')
        if (!map.has('status')) map.set('status', 'Status (status)')

        const opts = Array.from(map.entries()).map(([value, labelStr]) => ({
          value,
          label: labelStr,
        }))
        setAvailableFields(opts)
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [isOpen])

  if (!isOpen || !viewpoint) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return

    setSaving(true)
    setError(null)

    try {
      await updateTableRow('viewpoints', viewpoint.id, {
        label: label.trim(),
        description: description.trim(),
        scope,
        filter_status: filterStatus,
        grouping,
        sort_by: sortBy,
      })

      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg border border-border bg-surface p-5 shadow-2xl text-text">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <Icon name="edit" size={18} className="text-primary" />
            <span>Modify Viewpoint Properties: {viewpoint.label}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs bg-danger-bg/20 border border-danger-fg text-danger-fg font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-secondary">
              Viewpoint Name <span className="text-danger-fg">*</span>
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Host Topology View"
              className="w-full border border-border bg-surface py-1.5 px-3 text-xs text-text focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-secondary">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Grouped by host server"
              className="w-full border border-border bg-surface py-1.5 px-3 text-xs text-text focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-secondary">
                Privacy Scope
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'Public' | 'Private')}
                className="w-full border border-border bg-surface py-1.5 px-3 text-xs text-text focus:border-primary focus:outline-none"
              >
                <option value="Public">Public (All Operators)</option>
                <option value="Private">Private (My Operator Only)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-secondary">
                Status Filter
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full border border-border bg-surface py-1.5 px-3 text-xs text-text focus:border-primary focus:outline-none"
              >
                <option value="All">All Statuses (Show All)</option>
                <option value="Completed">Completed Only</option>
                <option value="Executing">Executing Only</option>
                <option value="Wait for Event">Wait for Event Only</option>
                <option value="Failed">Failed Only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-secondary">
                Group Container Boxes By Field
              </label>
              <select
                value={grouping}
                onChange={(e) => setGrouping(e.target.value)}
                className="w-full border border-border bg-surface py-1.5 px-3 text-xs text-text focus:border-primary focus:outline-none"
              >
                {availableFields.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-secondary">
                Sort Nodes Inside Boxes By Field
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border border-border bg-surface py-1.5 px-3 text-xs text-text focus:border-primary focus:outline-none"
              >
                {availableFields
                  .filter((f) => f.value !== 'Folder')
                  .map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="border border-primary/40 bg-white px-3.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 hover:border-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !label.trim()}
              className="bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover shadow-xs border border-primary transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving Changes...' : 'Save Viewpoint Properties'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
