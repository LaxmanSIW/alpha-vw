'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/ui-custom/modal'
import Button from '@/components/ui-custom/button'
import Input from '@/components/ui-custom/input'
import Select from '@/components/ui-custom/select'
import { useUIStore } from '@/lib/stores/ui-store'
import { useDashboardStore } from '@/lib/stores/dashboard-store'
import { createTableRow, updateTableRow, fetchTableRows } from '@/lib/api-client'
import type { FieldDefinition, ModuleTab, Viewpoint } from '@/lib/types'

interface ViewpointFormProps {
  mode: 'create' | 'edit'
}

const DEFAULT_FIELD_OPTIONS = [
  { key: 'label', label: 'Label' },
  { key: 'status', label: 'Status' },
  { key: 'host', label: 'Host' },
  { key: 'runs', label: 'Runs' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'schedule', label: 'Schedule Config' },
  { key: 'kind', label: 'Type' },
]

export default function ViewpointForm({ mode }: ViewpointFormProps) {
  // Open state per mode
  const isCreateOpen = useUIStore((s) => s.isCreateViewpointOpen)
  const editingViewpoint = useUIStore((s) => s.editingViewpoint)
  const closeCreate = useUIStore((s) => s.closeCreateViewpoint)
  const closeEdit = useUIStore((s) => s.closeEditViewpoint)
  const loadData = useDashboardStore((s) => s.loadData)
  const modules = useDashboardStore((s) => s.modules)
  const activeModuleId = useDashboardStore((s) => s.activeModuleId)

  const isOpen = mode === 'create' ? isCreateOpen : Boolean(editingViewpoint)
  const onClose = mode === 'create' ? closeCreate : closeEdit

  // Form state
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [folder, setFolder] = useState('Alpha VW / Domain A')
  const [jobCount, setJobCount] = useState(8)
  const [scope, setScope] = useState<'Public' | 'Private'>('Public')
  const [filterStatus, setFilterStatus] = useState('All')
  const [grouping, setGrouping] = useState('Folder')
  const [sortBy, setSortBy] = useState('label')
  const [saving, setSaving] = useState(false)
  const [fieldOptions, setFieldOptions] = useState(DEFAULT_FIELD_OPTIONS)

  // Initialize from editing viewpoint on open
  useEffect(() => {
    if (mode === 'edit' && editingViewpoint && isOpen) {
      setLabel(editingViewpoint.label)
      setDescription(editingViewpoint.description ?? '')
      setModuleId(editingViewpoint.moduleId)
      setFolder(editingViewpoint.folder ?? 'Alpha VW / Domain A')
      setJobCount(editingViewpoint.jobCount ?? 8)
      setScope((editingViewpoint.scope as 'Public' | 'Private') ?? 'Public')
      setFilterStatus(editingViewpoint.filterStatus ?? 'All')
      setGrouping(editingViewpoint.grouping ?? 'Folder')
      setSortBy(editingViewpoint.sortBy ?? 'label')
    } else if (mode === 'create' && isOpen) {
      setLabel('')
      setDescription('')
      setModuleId(activeModuleId)
      setFolder('Alpha VW / Domain A')
      setJobCount(8)
      setScope('Public')
      setFilterStatus('All')
      setGrouping('Folder')
      setSortBy('label')
    }
  }, [mode, editingViewpoint, isOpen, activeModuleId])

  // Fetch field definitions to populate grouping/sortBy options
  useEffect(() => {
    if (isOpen) {
      fetchTableRows<FieldDefinition>('field_definitions')
        .then((defs) => {
          const visibleDefs = defs.filter((d) => (d.isActive ?? 1) !== 0)
          setFieldOptions([
            ...DEFAULT_FIELD_OPTIONS.filter((o) => !visibleDefs.some((d) => d.key === o.key)),
            ...visibleDefs.map((d) => ({ key: d.key, label: d.label })),
          ])
        })
        .catch(() => { /* ignore; fallback to defaults */ })
    }
  }, [isOpen])

  const onSubmit = async () => {
    if (!label.trim()) {
      toast.error('Label is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        id: mode === 'edit' ? editingViewpoint!.id : `vp-${Date.now()}`,
        moduleId: moduleId || activeModuleId,
        label: label.trim(),
        description: description.trim() || null,
        folder: folder.trim() || null,
        jobCount: Number(jobCount) || 0,
        scope,
        filterStatus,
        grouping,
        sortBy,
      }
      if (mode === 'create') {
        await createTableRow('viewpoints', payload)
        toast.success(`Viewpoint "${payload.label}" created`)
      } else {
        await updateTableRow('viewpoints', editingViewpoint!.id, payload)
        toast.success(`Viewpoint "${payload.label}" updated`)
      }
      await loadData(true)
      onClose()
    } catch (err) {
      toast.error(`Failed to save viewpoint: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(o) => !o && onClose()}
      title={mode === 'create' ? 'Create Viewpoint' : `Edit Viewpoint: ${editingViewpoint?.label ?? ''}`}
      description="A viewpoint is a saved lens on the topology."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <div className="p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Domain A Critical Path" />
          <Select label="Module" value={moduleId || activeModuleId} onChange={(e) => setModuleId(e.target.value)}>
            {modules.map((m: ModuleTab) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
        </div>
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Folder Filter" value={folder} onChange={(e) => setFolder(e.target.value)} />
          <Input
            label="Job Count (target)"
            type="number"
            value={jobCount}
            onChange={(e) => setJobCount(Number(e.target.value))}
            min={0}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Scope" value={scope} onChange={(e) => setScope(e.target.value as 'Public' | 'Private')}>
            <option value="Public">Public</option>
            <option value="Private">Private</option>
          </Select>
          <Select label="Status Filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="All">All</option>
            <option value="Completed">Completed</option>
            <option value="Executing">Executing</option>
            <option value="Wait for Event">Wait for Event</option>
            <option value="Failed">Failed</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Grouping" value={grouping} onChange={(e) => setGrouping(e.target.value)}>
            <option value="Folder">Folder (default)</option>
            {fieldOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>By {opt.label}</option>
            ))}
          </Select>
          <Select label="Sort By" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="label">Label (default)</option>
            {fieldOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  )
}
