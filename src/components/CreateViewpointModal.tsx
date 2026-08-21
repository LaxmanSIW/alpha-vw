import { useEffect, useState } from 'react'
import Icon from './Icon'
import { createTableRow, fetchTableRows } from '../api/client'
import type { FieldDefinition, ModuleTab } from '../types'

interface CreateViewpointModalProps {
  isOpen: boolean
  modules: ModuleTab[]
  activeModuleId: string
  onClose: () => void
  onCreated: () => void
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

function CreateViewpointModal({
  isOpen,
  modules,
  activeModuleId,
  onClose,
  onCreated,
}: CreateViewpointModalProps) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [moduleId, setModuleId] = useState(activeModuleId || modules[0]?.id || 'architecture')
  const [folder, setFolder] = useState('Alpha VW / Domain A')
  const [scope, setScope] = useState<'Public' | 'Private'>('Public')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [grouping, setGrouping] = useState('Folder')
  const [sortBy, setSortBy] = useState('label')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [availableFields, setAvailableFields] = useState<Array<{ value: string; label: string }>>(DEFAULT_FIELD_OPTIONS)

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

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) {
      setError('Viewpoint name is required')
      return
    }

    const id = `vp-${Date.now().toString(36)}`
    setIsSubmitting(true)
    setError(null)

    try {
      await createTableRow('viewpoints', {
        id,
        module_id: moduleId,
        label: label.trim(),
        description: description.trim(),
        folder: folder.trim(),
        job_count: 8,
        scope,
        filter_status: filterStatus,
        grouping,
        sort_by: sortBy,
      })

      setLabel('')
      setDescription('')
      onCreated()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create Viewpoint'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border-strong bg-surface shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-primary">
              <Icon name="folder" size={16} />
            </span>
            <h2 className="text-sm font-semibold tracking-wide text-text uppercase">
              Create New Monitoring Viewpoint
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-md border border-danger-fg/30 bg-danger-bg p-2.5 text-xs text-danger-fg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase mb-1">
              Viewpoint Name <span className="text-danger-fg">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Ingest & Validation Pipeline"
              className="w-full rounded border border-border-strong bg-surface-sunken px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Primary operational monitoring view for ingest jobs"
              className="w-full rounded border border-border-strong bg-surface-sunken px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase mb-1">
                Module Domain
              </label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full rounded border border-border-strong bg-surface-sunken px-2.5 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted uppercase mb-1">
                Privacy Scope (CTM)
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'Public' | 'Private')}
                className="w-full rounded border border-border-strong bg-surface-sunken px-2.5 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
              >
                <option value="Public">Public (Shared with Team)</option>
                <option value="Private">Private (Personal View)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase mb-1">
                Status Filter
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded border border-border-strong bg-surface-sunken px-2.5 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Completed">Completed Only</option>
                <option value="Executing">Executing Only</option>
                <option value="Wait for Event">Wait for Event Only</option>
                <option value="Failed">Failed Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted uppercase mb-1">
                Group Container Boxes By
              </label>
              <select
                value={grouping}
                onChange={(e) => setGrouping(e.target.value)}
                className="w-full rounded border border-border-strong bg-surface-sunken px-2.5 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
              >
                {availableFields.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase mb-1">
                Sort Nodes Inside Boxes By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded border border-border-strong bg-surface-sunken px-2.5 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
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

            <div>
              <label className="block text-xs font-medium text-text-muted uppercase mb-1">
                Target Scope Path
              </label>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="e.g. Alpha VW / Domain A"
                className="w-full rounded border border-border-strong bg-surface-sunken px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-primary/40 bg-white px-3.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 hover:border-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover shadow-xs border border-primary transition-colors disabled:opacity-50"
            >
              <Icon name="check" size={14} />
              {isSubmitting ? 'Creating...' : 'Create Viewpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateViewpointModal
