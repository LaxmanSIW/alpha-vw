'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Palette, Ruler, MousePointerClick, Clock, Trash2, AlertTriangle } from 'lucide-react'
import Modal from '@/components/ui-custom/modal'
import Button from '@/components/ui-custom/button'
import Input from '@/components/ui-custom/input'
import { useUIStore } from '@/lib/stores/ui-store'
import { useDashboardStore } from '@/lib/stores/dashboard-store'
import { fetchTableRows, createTableRow, updateTableRow, deleteTableRow } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'status', label: 'Status Colors', icon: Palette },
  { id: 'layout', label: 'Canvas Layout', icon: Ruler },
  { id: 'relation', label: 'Node Highlight', icon: MousePointerClick },
  { id: 'business', label: 'Business Date', icon: Clock },
  { id: 'data', label: 'Data Management', icon: Trash2 },
] as const

type TabId = (typeof TABS)[number]['id']

interface StatusRow {
  key: string
  label: string
  hex: string
  aliases: string
  sortOrder: number
}

interface LayoutConfig {
  vGap: number
  hGap: number
  nodeWidth: number
  nodeHeight: number
  nodeCollapsedHeight: number
}

interface RelationConfig {
  selectedColor: string
  predColor: string
  succColor: string
  outlineWidth: number
}

export default function SettingsModal() {
  const isOpen = useUIStore((s) => s.isSettingsOpen)
  const close = useUIStore((s) => s.closeSettings)
  const loadData = useDashboardStore((s) => s.loadData)

  const [activeTab, setActiveTab] = useState<TabId>('status')
  const [statusRows, setStatusRows] = useState<StatusRow[]>([])
  const [layout, setLayout] = useState<LayoutConfig>({ vGap: 50, hGap: 40, nodeWidth: 190, nodeHeight: 130, nodeCollapsedHeight: 48 })
  const [relation, setRelation] = useState<RelationConfig>({ selectedColor: '#4f46e5', predColor: '#f97316', succColor: '#0891b2', outlineWidth: 1 })
  const [dayStartHour, setDayStartHour] = useState(0)
  const [dayStartMinute, setDayStartMinute] = useState(0)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteInputText, setDeleteInputText] = useState('')
  const [purging, setPurging] = useState(false)

  const onPurgeTopology = async () => {
    if (deleteInputText.trim().toLowerCase() !== 'delete') {
      toast.error('Please type "delete" to confirm.')
      return
    }
    setPurging(true)
    try {
      const res = await fetch('/api/crud/reset-topology', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to purge data')
      const json = (await res.json()) as { deleted?: { nodes: number; edges: number; fieldValues: number; logs: number } }
      toast.success(`Purged ${json.deleted?.nodes ?? 0} nodes and ${json.deleted?.edges ?? 0} edges.`)
      setConfirmOpen(false)
      setDeleteInputText('')
      await loadData(true)
      close()
    } catch (err) {
      toast.error(`Purge failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPurging(false)
    }
  }

  // Single fetch on open
  useEffect(() => {
    if (!isOpen) return
    fetchTableRows<{ key: string; category: string; label: string; value: string; sortOrder: number }>('app_config')
      .then((rows) => {
        const statuses: StatusRow[] = []
        for (const row of rows) {
          if (row.category === 'status') {
            try {
              const parsed = JSON.parse(row.value) as { hex: string; aliases: string[] }
              statuses.push({
                key: row.key,
                label: row.label,
                hex: parsed.hex,
                aliases: parsed.aliases.join(', '),
                sortOrder: row.sortOrder,
              })
            } catch { /* ignore */ }
          } else if (row.category === 'layout') {
            const num = Number(row.value)
            if (!Number.isNaN(num)) {
              const field = row.key.replace('layout.', '') as keyof LayoutConfig
              setLayout((prev) => ({ ...prev, [field]: num }))
            }
          } else if (row.category === 'relation') {
            if (row.key === 'relation.outlineWidth') {
              setRelation((prev) => ({ ...prev, outlineWidth: Number(row.value) || 1 }))
            } else {
              const field = row.key.replace('relation.', '') as keyof Omit<RelationConfig, 'outlineWidth'>
              setRelation((prev) => ({ ...prev, [field]: row.value }))
            }
          } else if (row.category === 'business') {
            if (row.key === 'business.dayStartHour') setDayStartHour(Number(row.value) || 0)
            if (row.key === 'business.dayStartMinute') setDayStartMinute(Number(row.value) || 0)
          }
        }
        statuses.sort((a, b) => a.sortOrder - b.sortOrder)
        setStatusRows(statuses)
      })
      .catch((err) => toast.error(`Failed to load settings: ${err instanceof Error ? err.message : String(err)}`))
  }, [isOpen])

  const onSaveStatuses = async () => {
    setSaving(true)
    try {
      const existingRows = await fetchTableRows<{ key: string }>('app_config')
      const existingKeys = new Set(existingRows.map((r) => r.key))
      for (const row of statusRows) {
        const value = JSON.stringify({ hex: row.hex, aliases: row.aliases.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean) })
        const payload = { key: row.key, category: 'status', label: row.label, value, sortOrder: row.sortOrder }
        if (existingKeys.has(row.key)) {
          await updateTableRow('app_config', row.key, payload)
        } else {
          await createTableRow('app_config', payload)
        }
      }
      toast.success('Status definitions saved')
      await loadData(true)
      close()
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const onSaveLayout = async () => {
    setSaving(true)
    try {
      for (const [k, v] of Object.entries(layout)) {
        await updateTableRow('app_config', `layout.${k}`, { value: String(v) })
      }
      toast.success('Layout saved (refresh to apply)')
      await loadData(true)
      close()
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const onSaveRelation = async () => {
    setSaving(true)
    try {
      for (const [k, v] of Object.entries(relation)) {
        await updateTableRow('app_config', `relation.${k}`, { value: String(v) })
      }
      toast.success('Highlight colors saved')
      await loadData(true)
      close()
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const onSaveBusiness = async () => {
    setSaving(true)
    try {
      await updateTableRow('app_config', 'business.dayStartHour', { value: String(dayStartHour) })
      await updateTableRow('app_config', 'business.dayStartMinute', { value: String(dayStartMinute) })
      toast.success('Business date config saved')
      await loadData(true)
      close()
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const onAddStatus = async () => {
    const key = `status.custom_${Date.now()}`
    const newRow: StatusRow = {
      key,
      label: 'New Status',
      hex: '#94a3b8',
      aliases: 'new',
      sortOrder: statusRows.length + 1,
    }
    setStatusRows((rows) => [...rows, newRow])
  }

  const onDeleteStatus = async (key: string) => {
    if (key.startsWith('status.completed') || key.startsWith('status.executing') || key.startsWith('status.wait') || key.startsWith('status.failed')) {
      toast.error('Cannot delete built-in status')
      return
    }
    try {
      await deleteTableRow('app_config', key)
      setStatusRows((rows) => rows.filter((r) => r.key !== key))
      toast.success('Status deleted')
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(o) => !o && close()}
      title="Settings"
      description="Configure status colors, layout, highlight colors, and business date."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving || purging}>
            {activeTab === 'data' ? 'Close' : 'Cancel'}
          </Button>
          {activeTab !== 'data' && (
            <Button
              variant="primary"
              onClick={() => {
                if (activeTab === 'status') onSaveStatuses()
                else if (activeTab === 'layout') onSaveLayout()
                else if (activeTab === 'relation') onSaveRelation()
                else onSaveBusiness()
              }}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex h-full">
        <nav className="w-48 shrink-0 border-r border-border bg-surface-sunken py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors',
                  activeTab === tab.id
                    ? 'bg-surface text-primary border-l-2 border-l-primary -ml-px'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover',
                )}
              >
                <Icon size={12} strokeWidth={1.5} />
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="flex-1 min-h-0 overflow-auto p-4 custom-scrollbar">
          {activeTab === 'status' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="label-caps">Status Definitions</span>
                <Button size="sm" variant="secondary" onClick={onAddStatus}>+ Add Status</Button>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-surface-sunken">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium text-text-muted">Label</th>
                    <th className="text-left px-2 py-1 font-medium text-text-muted">Color</th>
                    <th className="text-left px-2 py-1 font-medium text-text-muted">Aliases (comma-separated)</th>
                    <th className="text-right px-2 py-1 font-medium text-text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {statusRows.map((row) => (
                    <tr key={row.key} className="border-b border-border">
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={row.label}
                          onChange={(e) => setStatusRows((rows) => rows.map((r) => r.key === row.key ? { ...r, label: e.target.value } : r))}
                          className="w-full h-6 px-1 text-xs bg-surface border border-border focus:border-primary outline-none"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={row.hex}
                            onChange={(e) => setStatusRows((rows) => rows.map((r) => r.key === row.key ? { ...r, hex: e.target.value } : r))}
                            className="size-6 border border-border cursor-pointer p-0"
                          />
                          <input
                            type="text"
                            value={row.hex}
                            onChange={(e) => setStatusRows((rows) => rows.map((r) => r.key === row.key ? { ...r, hex: e.target.value } : r))}
                            className="w-20 h-6 px-1 text-xs font-mono bg-surface border border-border focus:border-primary outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={row.aliases}
                          onChange={(e) => setStatusRows((rows) => rows.map((r) => r.key === row.key ? { ...r, aliases: e.target.value } : r))}
                          className="w-full h-6 px-1 text-xs bg-surface border border-border focus:border-primary outline-none"
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteStatus(row.key)}
                          disabled={row.key.startsWith('status.completed') || row.key.startsWith('status.executing') || row.key.startsWith('status.wait') || row.key.startsWith('status.failed')}
                          className="text-text-muted hover:text-danger-fg disabled:opacity-30 disabled:hover:text-text-muted text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'layout' && (
            <div className="space-y-3 max-w-md">
              <p className="text-xs text-text-muted">Canvas layout values. Changes apply on the next refresh.</p>
              <Input label="Vertical Gap (px)" type="number" value={layout.vGap} onChange={(e) => setLayout((p) => ({ ...p, vGap: Number(e.target.value) }))} />
              <Input label="Horizontal Gap (px)" type="number" value={layout.hGap} onChange={(e) => setLayout((p) => ({ ...p, hGap: Number(e.target.value) }))} />
              <Input label="Node Width (px)" type="number" value={layout.nodeWidth} onChange={(e) => setLayout((p) => ({ ...p, nodeWidth: Number(e.target.value) }))} />
              <Input label="Node Height (px)" type="number" value={layout.nodeHeight} onChange={(e) => setLayout((p) => ({ ...p, nodeHeight: Number(e.target.value) }))} />
              <Input label="Node Collapsed Height (px)" type="number" value={layout.nodeCollapsedHeight} onChange={(e) => setLayout((p) => ({ ...p, nodeCollapsedHeight: Number(e.target.value) }))} />
            </div>
          )}

          {activeTab === 'relation' && (
            <div className="space-y-3 max-w-md">
              <p className="text-xs text-text-muted">Colors used to highlight selected nodes and their upstream/downstream relations on the canvas.</p>
              <ColorField label="Selected Node Color" value={relation.selectedColor} onChange={(v) => setRelation((p) => ({ ...p, selectedColor: v }))} />
              <ColorField label="Predecessor (Upstream) Color" value={relation.predColor} onChange={(v) => setRelation((p) => ({ ...p, predColor: v }))} />
              <ColorField label="Successor (Downstream) Color" value={relation.succColor} onChange={(v) => setRelation((p) => ({ ...p, succColor: v }))} />
              <Input label="Highlight Outline Width (px)" type="number" min={0} max={10} value={relation.outlineWidth} onChange={(e) => setRelation((p) => ({ ...p, outlineWidth: Number(e.target.value) }))} />
            </div>
          )}

          {activeTab === 'business' && (
            <div className="space-y-3 max-w-md">
              <p className="text-xs text-text-muted">The business date rolls over at the configured threshold. Before the threshold, the business date is the previous calendar day.</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Day Start Hour (0-23)" type="number" min={0} max={23} value={dayStartHour} onChange={(e) => setDayStartHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))} />
                <Input label="Day Start Minute (0-59)" type="number" min={0} max={59} value={dayStartMinute} onChange={(e) => setDayStartMinute(Math.min(59, Math.max(0, Number(e.target.value) || 0)))} />
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4 max-w-lg">
              <div className="border border-danger-fg/30 bg-danger-bg/20 rounded p-4 space-y-3">
                <div className="flex items-center gap-2 text-danger-fg font-semibold text-xs">
                  <AlertTriangle size={16} strokeWidth={2} />
                  <span>Danger Zone — Purge Topology Data</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Purges all batch topology node records (<code className="text-primary font-mono text-[11px]">nav_nodes</code>), dependency links (<code className="text-primary font-mono text-[11px]">edges</code>), custom node values (<code className="text-primary font-mono text-[11px]">node_field_values</code>), and execution history (<code className="text-primary font-mono text-[11px]">node_logs</code>).
                </p>
                <div className="text-[11px] text-text-muted bg-surface-sunken p-2.5 rounded border border-border space-y-1 font-mono">
                  <div className="text-success-fg font-medium">✓ Preserves: Field Definitions, Modules, Viewpoints, Calendars, Schedules, App Config</div>
                  <div className="text-danger-fg font-medium">✗ Deletes: All Nodes, Edges, Custom Field Values, and Logs</div>
                </div>
                <div className="pt-2">
                  <Button variant="danger" size="sm" onClick={() => { setDeleteInputText(''); setConfirmOpen(true) }}>
                    <Trash2 size={12} strokeWidth={1.5} /> Purge All Nodes & Edges
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onOpenChange={(o) => !o && setConfirmOpen(false)}
        title="Confirm Topology Data Deletion"
        description='This action cannot be undone. To permanently delete all nodes and edges data, type "delete" below.'
        size="sm"
      >
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Type "delete" to confirm:</label>
            <Input
              value={deleteInputText}
              onChange={(e) => setDeleteInputText(e.target.value)}
              placeholder="delete"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={purging}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={onPurgeTopology}
              disabled={deleteInputText.trim().toLowerCase() !== 'delete' || purging}
            >
              {purging ? 'Purging…' : 'Confirm & Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-[var(--control-h)] border border-border-strong cursor-pointer p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[var(--control-h)] w-32 px-2 text-xs font-mono bg-surface border border-border-strong text-text focus:border-primary outline-none"
        />
      </div>
    </div>
  )
}
