import { useCallback, useEffect, useState } from 'react'
import { fetchTableRows, updateTableRow, createTableRow, deleteTableRow, fetchBusinessDate } from '../api/client'
import type { BusinessDateResult } from '../api/client'
import Icon, { type IconName } from './Icon'

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

type TabId = 'status' | 'layout' | 'relation' | 'business'

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
      <div className="flex flex-col w-[680px] h-[85vh] border border-border bg-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-5 py-3 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text">Application Settings</h2>
            <p className="text-xs text-text-muted mt-0.5">Configure status colors, canvas layout, node highlight colors, and business date settings</p>
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
          {(
            [
              ['status',   'palette',       'Status Colors'],
              ['layout',   'ruler',          'Canvas Layout'],
              ['relation', 'node-highlight', 'Node Highlights'],
              ['business', 'clock',          'Business Date'],
            ] as [TabId, IconName, string][]
          ).map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text',
              ].join(' ')}
            >
              <Icon name={icon} size={12} />
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
          {activeTab === 'business' && (
            <BusinessDateTab saving={saving} setSaving={setSaving} onSaved={showSaved} />
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

// ── Business Date Tab ─────────────────────────────────────────────────────────

function BusinessDateTab({
  saving,
  setSaving,
  onSaved,
}: {
  saving: boolean
  setSaving: (v: boolean) => void
  onSaved: (msg?: string) => void
}) {
  const [loading, setLoading] = useState(true)
  /** Controlled value for the time picker — stored as "HH:MM" string */
  const [timeValue, setTimeValue] = useState('00:00')
  const [liveResult, setLiveResult] = useState<BusinessDateResult | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load persisted values from app_config
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchTableRows<{ key: string; value: string }>('app_config')
      const hourRow   = rows.find((r) => r.key === 'business.dayStartHour')
      const minuteRow = rows.find((r) => r.key === 'business.dayStartMinute')
      const h = String(hourRow   ? parseInt(hourRow.value,   10) : 0).padStart(2, '0')
      const m = String(minuteRow ? parseInt(minuteRow.value, 10) : 0).padStart(2, '0')
      setTimeValue(`${h}:${m}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Refresh the live server preview whenever timeValue changes
  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true)
    setLiveError(null)
    try {
      const result = await fetchBusinessDate()
      setLiveResult(result)
    } catch (err) {
      setLiveError('API server not reachable — start it with `npm run api`.')
      setLiveResult(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  // Initial preview load
  useEffect(() => { refreshPreview() }, [refreshPreview])

  const save = async () => {
    const [hStr, mStr] = timeValue.split(':')
    const hour   = Math.min(23, Math.max(0, parseInt(hStr, 10) || 0))
    const minute = Math.min(59, Math.max(0, parseInt(mStr, 10) || 0))
    setSaving(true)
    try {
      await updateTableRow('app_config', 'business.dayStartHour',   { value: String(hour) })
      await updateTableRow('app_config', 'business.dayStartMinute', { value: String(minute) })
      onSaved('Business date settings saved. Refresh to apply.')
      // Re-fetch the live preview so it reflects the new setting immediately
      await refreshPreview()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-5 text-sm text-text-muted">Loading…</div>

  const [hDisplay, mDisplay] = timeValue.split(':')
  const hNum = parseInt(hDisplay, 10) || 0
  const mNum = parseInt(mDisplay, 10) || 0
  const isDefaultMidnight = hNum === 0 && mNum === 0

  // Human-readable description of the rule
  const ruleSummary = isDefaultMidnight
    ? 'The business date matches the calendar date (default — rolls over at midnight).'
    : `The business date rolls over at ${timeValue}. Before that time the business date is still the previous calendar day.`

  return (
    <div className="p-4 space-y-5">
      <p className="text-xs text-text-muted">
        Set the time at which the business day begins. Jobs run before this threshold are
        considered part of the <em>previous</em> business date.
      </p>

      {/* ── Time picker ── */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary" htmlFor="biz-day-start">
          Day Start Time
        </label>
        <div className="flex items-center gap-3">
          <input
            id="biz-day-start"
            type="time"
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            className="border border-border bg-surface-sunken px-3 py-1.5 text-sm text-text font-mono focus:outline-none focus:border-primary w-36"
          />
          <span className="text-xs text-text-muted">
            {isDefaultMidnight ? '(default — midnight)' : '24-hour format'}
          </span>
        </div>
      </div>

      {/* ── Rule summary card ── */}
      <div className="border border-border bg-surface-sunken px-4 py-3 space-y-1">
        <p className="text-xs text-text-secondary leading-relaxed">{ruleSummary}</p>
        {!isDefaultMidnight && (
          <p className="text-xs text-text-muted">
            Example: at <strong className="font-mono text-text">{timeValue.replace(':', ':').slice(0, 5)}</strong>{' '}
            minus one minute, the business date would be{' '}
            <strong className="text-text">yesterday</strong>.
          </p>
        )}
      </div>

      {/* ── Live server preview ── */}
      <div className="border border-border bg-surface px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text uppercase tracking-wide">
            Live Server Response
          </span>
          <button
            type="button"
            onClick={refreshPreview}
            disabled={previewLoading}
            className="text-[11px] text-primary hover:underline disabled:opacity-50"
          >
            {previewLoading ? 'Fetching…' : '↻ Refresh'}
          </button>
        </div>

        {liveError ? (
          <p className="text-xs text-warning-fg bg-warning-bg/20 border border-warning-fg/30 px-3 py-2">
            {liveError}
          </p>
        ) : liveResult ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-text-muted">Business Date</dt>
            <dd className="font-semibold text-primary font-mono">{liveResult.businessDate}</dd>
            <dt className="text-text-muted">Day Start (configured)</dt>
            <dd className="font-mono text-text">{liveResult.dayStart}</dd>
            <dt className="text-text-muted">Server Time</dt>
            <dd className="font-mono text-text-secondary text-[11px]">
              {new Date(liveResult.serverTime).toLocaleTimeString()}
            </dd>
          </dl>
        ) : (
          <p className="text-xs text-text-muted">Loading server data…</p>
        )}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="px-4 py-2 text-sm font-medium bg-primary text-white hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {saving ? 'Saving…' : 'Save Business Date Settings'}
      </button>
    </div>
  )
}
