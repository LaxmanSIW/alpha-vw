import { useCallback, useEffect, useState } from 'react'
import { fetchTableRows, updateTableRow, createTableRow, deleteTableRow } from '../api/client'

// ── Types ────────────────────────────────────────────────────────────────────

interface RawRow {
  key: string
  category: string
  label: string
  value: string
  sort_order: number
}

interface StatusRow {
  key: string
  label: string
  hex: string
  aliases: string   // comma-separated string for editing
  sortOrder: number
  isNew?: boolean
}

interface LayoutRow {
  key: string
  label: string
  value: number
}

interface RelationRow {
  key: string
  label: string
  value: string   // hex or number string
}

// ── Main Modal ───────────────────────────────────────────────────────────────

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type TabId = 'status' | 'layout' | 'relation'

export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('status')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const showSaved = (msg = 'Saved! Click Refresh to apply changes.') => {
    setSaveMsg(msg)
    setTimeout(() => setSaveMsg(null), 4000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex flex-col w-[680px] max-h-[85vh] border border-border bg-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-5 py-3 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text">Application Settings</h2>
            <p className="text-xs text-text-muted mt-0.5">Configure status colors, canvas layout, and node highlight colors</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border bg-surface-sunken px-4 gap-0">
          {([
            ['status',   '🎨 Status Colors'],
            ['layout',   '📐 Canvas Layout'],
            ['relation', '🔗 Node Highlights'],
          ] as [TabId, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={[
                'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Save feedback */}
        {saveMsg && (
          <div className="shrink-0 px-5 py-2 text-xs font-medium bg-success-bg/20 border-b border-success-fg/30 text-success-fg">
            ✓ {saveMsg}
          </div>
        )}

        {/* Tab content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === 'status' && (
            <StatusColorsTab saving={saving} setSaving={setSaving} onSaved={showSaved} onDataChanged={onSaved} />
          )}
          {activeTab === 'layout' && (
            <CanvasLayoutTab saving={saving} setSaving={setSaving} onSaved={showSaved} />
          )}
          {activeTab === 'relation' && (
            <NodeHighlightTab saving={saving} setSaving={setSaving} onSaved={showSaved} />
          )}
        </div>

        {/* Footer note */}
        <div className="shrink-0 px-5 py-2 border-t border-border bg-surface-sunken">
          <p className="text-xs text-text-muted">
            Changes take effect after clicking <strong className="text-text">Refresh</strong> in the toolbar (or reloading the page).
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Status Colors Tab ─────────────────────────────────────────────────────────

function StatusColorsTab({
  saving,
  setSaving,
  onSaved,
  onDataChanged,
}: {
  saving: boolean
  setSaving: (v: boolean) => void
  onSaved: (msg?: string) => void
  onDataChanged: () => void
}) {
  const [rows, setRows] = useState<StatusRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await fetchTableRows<RawRow>('app_config')
      const statusRows = all
        .filter((r) => r.category === 'status')
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((r) => {
          try {
            const parsed = JSON.parse(r.value) as { hex: string; aliases: string[] }
            return {
              key: r.key,
              label: r.label,
              hex: parsed.hex ?? '#94a3b8',
              aliases: (parsed.aliases ?? []).join(', '),
              sortOrder: r.sort_order,
            }
          } catch {
            return { key: r.key, label: r.label, hex: '#94a3b8', aliases: '', sortOrder: r.sort_order }
          }
        })
      setRows(statusRows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const update = (idx: number, patch: Partial<StatusRow>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const addNew = () => {
    const newKey = `status.custom_${Date.now()}`
    setRows((prev) => [
      ...prev,
      { key: newKey, label: 'New Status', hex: '#6366f1', aliases: '', sortOrder: prev.length + 1, isNew: true },
    ])
  }

  const saveRow = async (row: StatusRow) => {
    setSaving(true)
    try {
      const aliasArr = row.aliases
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      const value = JSON.stringify({ hex: row.hex, aliases: aliasArr })
      if (row.isNew) {
        await createTableRow('app_config', {
          key: row.key,
          category: 'status',
          label: row.label,
          value,
          sort_order: row.sortOrder,
        })
        setRows((prev) => prev.map((r) => r.key === row.key ? { ...r, isNew: false } : r))
      } else {
        await updateTableRow('app_config', row.key, { label: row.label, value, sort_order: row.sortOrder })
      }
      onSaved()
      onDataChanged()
    } finally {
      setSaving(false)
    }
  }

  const deleteRow = async (row: StatusRow) => {
    if (row.isNew) {
      setRows((prev) => prev.filter((r) => r.key !== row.key))
      return
    }
    if (!confirm(`Delete status "${row.label}"? This cannot be undone.`)) return
    setSaving(true)
    try {
      await deleteTableRow('app_config', row.key)
      setRows((prev) => prev.filter((r) => r.key !== row.key))
      onSaved('Status deleted.')
      onDataChanged()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-5 text-sm text-text-muted">Loading...</div>

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-text-muted">
        Define status tones with a display label, hex color, and comma-separated aliases (the raw values that map to this status).
        Unknown status values fall back to grey automatically.
      </p>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div
            key={row.key}
            className="border border-border bg-surface p-3 space-y-2"
          >
            <div className="flex items-center gap-3">
              {/* Color swatch + picker */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="h-6 w-6 rounded-sm border border-border-strong shrink-0"
                  style={{ backgroundColor: row.hex }}
                />
                <input
                  type="color"
                  value={row.hex}
                  onChange={(e) => update(idx, { hex: e.target.value })}
                  className="h-6 w-10 cursor-pointer border-0 bg-transparent p-0"
                  title="Pick color"
                />
              </div>

              {/* Label */}
              <input
                type="text"
                value={row.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="Display label"
                className="flex-1 min-w-0 border border-border bg-surface-sunken px-2 py-1 text-sm text-text focus:outline-none focus:border-primary"
              />

              {/* Preview badge */}
              <span
                className="shrink-0 px-2 py-0.5 text-xs font-semibold rounded"
                style={{
                  backgroundColor: `${row.hex}28`,
                  color: row.hex,
                  border: `1px solid ${row.hex}66`,
                }}
              >
                {row.label || 'Preview'}
              </span>

              {/* Save button */}
              <button
                type="button"
                disabled={saving}
                onClick={() => saveRow(row)}
                className="shrink-0 px-2 py-1 text-xs font-medium bg-primary text-white hover:opacity-80 disabled:opacity-40 transition-opacity"
              >
                Save
              </button>

              {/* Delete button */}
              <button
                type="button"
                disabled={saving}
                onClick={() => deleteRow(row)}
                className="shrink-0 px-2 py-1 text-xs font-medium text-text-muted hover:text-danger-fg hover:bg-danger-bg/20 transition-colors"
                title="Delete this status"
              >
                ✕
              </button>
            </div>

            {/* Aliases */}
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-text-muted w-14">Aliases</label>
              <input
                type="text"
                value={row.aliases}
                onChange={(e) => update(idx, { aliases: e.target.value })}
                placeholder="ok, completed, ended ok, success"
                className="flex-1 border border-border bg-surface-sunken px-2 py-1 text-xs text-text-secondary font-mono focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addNew}
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-dashed border-border text-text-muted hover:border-primary hover:text-primary transition-colors w-full justify-center"
      >
        + Add New Status
      </button>
    </div>
  )
}

// ── Canvas Layout Tab ─────────────────────────────────────────────────────────

function CanvasLayoutTab({
  saving,
  setSaving,
  onSaved,
}: {
  saving: boolean
  setSaving: (v: boolean) => void
  onSaved: (msg?: string) => void
}) {
  const [rows, setRows] = useState<LayoutRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchTableRows<RawRow>('app_config').then((all) => {
      const layoutRows = all
        .filter((r) => r.category === 'layout')
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((r) => ({ key: r.key, label: r.label, value: Number(r.value) }))
      setRows(layoutRows)
      setLoading(false)
    })
  }, [])

  const update = (idx: number, value: number) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value } : r)))

  const saveAll = async () => {
    setSaving(true)
    try {
      await Promise.all(rows.map((r) => updateTableRow('app_config', r.key, { value: String(r.value) })))
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-5 text-sm text-text-muted">Loading...</div>

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-text-muted">
        Canvas layout dimensions. Changes take effect after Refresh.
      </p>

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={row.key} className="flex items-center gap-4">
            <label className="w-44 text-sm text-text-secondary shrink-0">{row.label}</label>
            <input
              type="number"
              min={1}
              max={800}
              value={row.value}
              onChange={(e) => update(idx, Number(e.target.value))}
              className="w-24 border border-border bg-surface-sunken px-2 py-1 text-sm text-text focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-text-muted">px</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={saveAll}
        className="px-4 py-2 text-sm font-medium bg-primary text-white hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {saving ? 'Saving…' : 'Save Layout'}
      </button>
    </div>
  )
}

// ── Node Highlight Colors Tab ─────────────────────────────────────────────────

function NodeHighlightTab({
  saving,
  setSaving,
  onSaved,
}: {
  saving: boolean
  setSaving: (v: boolean) => void
  onSaved: (msg?: string) => void
}) {
  const [rows, setRows] = useState<RelationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchTableRows<RawRow>('app_config').then((all) => {
      const relRows = all
        .filter((r) => r.category === 'relation')
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((r) => ({ key: r.key, label: r.label, value: r.value }))
      setRows(relRows)
      setLoading(false)
    })
  }, [])

  const update = (idx: number, value: string) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value } : r)))

  const saveAll = async () => {
    setSaving(true)
    try {
      await Promise.all(rows.map((r) => updateTableRow('app_config', r.key, { value: r.value })))
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-5 text-sm text-text-muted">Loading...</div>

  const colorRows = rows.filter((r) => !r.key.includes('outlineWidth'))
  const widthRow = rows.find((r) => r.key.includes('outlineWidth'))
  const widthIdx = rows.findIndex((r) => r.key.includes('outlineWidth'))

  return (
    <div className="p-4 space-y-5">
      <p className="text-xs text-text-muted">
        Colors applied to node borders and outlines when a node is selected or identified as a predecessor / successor.
      </p>

      {/* Color pickers */}
      <div className="space-y-3">
        {colorRows.map((row) => {
          const globalIdx = rows.findIndex((r) => r.key === row.key)
          return (
            <div key={row.key} className="flex items-center gap-4">
              <label className="w-44 text-sm text-text-secondary shrink-0">{row.label}</label>
              <div className="flex items-center gap-2">
                <span
                  className="h-7 w-7 rounded-sm border border-border-strong shrink-0"
                  style={{ backgroundColor: row.value }}
                />
                <input
                  type="color"
                  value={row.value}
                  onChange={(e) => update(globalIdx, e.target.value)}
                  className="h-7 w-12 cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="font-mono text-xs text-text-muted">{row.value}</span>
              </div>
              {/* Preview: dashed box */}
              <span
                className="px-2 py-1 text-xs font-medium"
                style={{
                  border: `${widthRow?.value ?? '1'}px solid ${row.value}`,
                  outline: `${widthRow?.value ?? '1'}px solid ${row.value}`,
                  color: row.value,
                }}
              >
                Node
              </span>
            </div>
          )
        })}
      </div>

      {/* Outline width */}
      {widthRow && (
        <div className="flex items-center gap-4">
          <label className="w-44 text-sm text-text-secondary shrink-0">{widthRow.label}</label>
          <input
            type="number"
            min={1}
            max={8}
            value={widthRow.value}
            onChange={(e) => update(widthIdx, e.target.value)}
            className="w-20 border border-border bg-surface-sunken px-2 py-1 text-sm text-text focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-text-muted">px</span>
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={saveAll}
        className="px-4 py-2 text-sm font-medium bg-primary text-white hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {saving ? 'Saving…' : 'Save Highlight Settings'}
      </button>
    </div>
  )
}
