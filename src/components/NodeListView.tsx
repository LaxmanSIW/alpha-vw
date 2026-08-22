import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { Node } from '@xyflow/react'
import Icon from './Icon'
import type { FlatNodeData } from './FlatNode'
import type { FieldDefinition } from '../types'
import { formatFieldValue, statusBadgeStyle, statusHex } from '../fields'

interface NodeListViewProps {
  nodes: Node[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Field definitions loaded from the DB (field_definitions table). */
  fieldDefinitions?: FieldDefinition[]
}

interface ColumnConfig {
  key: string
  label: string
  align?: 'left' | 'right'
  format?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTruthy(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toUpperCase()
  return s === 'Y' || s === 'TRUE' || s === '1'
}

function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Fallback columns used when the DB hasn't returned field definitions yet.
 * These match the DB seed defaults so there's no visual jump on load.
 */
const FALLBACK_COLUMNS: ColumnConfig[] = [
  { key: 'label',     label: 'Name' },
  { key: 'kind',      label: 'Folder / Kind' },
  { key: 'node_kind', label: 'Type' },
  { key: 'status',    label: 'Status' },
  { key: 'host',      label: 'Host',  format: 'mono' },
  { key: 'runs',      label: 'Runs',  align: 'right' },
]
const FALLBACK_VISIBLE_KEYS = FALLBACK_COLUMNS.map((c) => c.key)

const LS_KEY = 'ctm_list_view_visible_columns'

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Tabular monitoring view driven by DB field definitions.
 *
 * Available columns = every active field definition that has showInDetails = Y.
 * Default visible columns = those flagged showOnCard = Y in the DB.
 * Column order is controlled by visibleKeys order (drag-and-drop reorderable).
 * Column choices and order persist to localStorage.
 */
function NodeListView({ nodes, selectedId, onSelect, fieldDefinitions }: NodeListViewProps) {

  // ── Column pool from DB ───────────────────────────────────────────────────
  const availableColumns = useMemo<ColumnConfig[]>(() => {
    if (!fieldDefinitions || fieldDefinitions.length === 0) return FALLBACK_COLUMNS
    return fieldDefinitions
      .filter((f) => isTruthy(f.isActive) && isTruthy(f.showInDetails) && f.role !== 'none')
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
      .map((f) => ({
        key: f.key,
        label: f.label,
        align: (f.key === 'runs' ? 'right' : 'left') as 'left' | 'right',
        format: f.format ?? 'text',
      }))
  }, [fieldDefinitions])

  const columnByKey = useMemo(() => {
    const map = new Map<string, ColumnConfig>()
    availableColumns.forEach((c) => map.set(c.key, c))
    return map
  }, [availableColumns])

  // ── Default visible (showOnCard) ──────────────────────────────────────────
  const defaultVisibleKeys = useMemo<string[]>(() => {
    if (!fieldDefinitions || fieldDefinitions.length === 0) return FALLBACK_VISIBLE_KEYS
    return fieldDefinitions
      .filter((f) => isTruthy(f.isActive) && isTruthy(f.showOnCard) && f.role !== 'none')
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
      .map((f) => f.key)
  }, [fieldDefinitions])

  // ── visibleKeys — drives both which columns show AND their order ──────────
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) return JSON.parse(saved) as string[]
    } catch { /* ignore */ }
    return FALLBACK_VISIBLE_KEYS
  })

  // Switch from fallback to DB defaults on first load (if no saved pref)
  const [initialised, setInitialised] = useState(false)
  useEffect(() => {
    if (initialised) return
    if (!fieldDefinitions || fieldDefinitions.length === 0) return
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (!saved) setVisibleKeys(defaultVisibleKeys)
    } catch { /* ignore */ }
    setInitialised(true)
  }, [fieldDefinitions, defaultVisibleKeys, initialised])

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(visibleKeys)) } catch { /* ignore */ }
  }, [visibleKeys])

  // ── Active columns — ordered by visibleKeys (user's drag order) ───────────
  const activeColumns = useMemo<ColumnConfig[]>(() =>
    visibleKeys
      .map((k) => columnByKey.get(k))
      .filter((c): c is ColumnConfig => c !== undefined),
    [visibleKeys, columnByKey],
  )

  // Hidden columns: available but not in visibleKeys
  const hiddenColumns = useMemo<ColumnConfig[]>(() =>
    availableColumns.filter((c) => !visibleKeys.includes(c.key)),
    [availableColumns, visibleKeys],
  )

  // ── Column toggle / reset ─────────────────────────────────────────────────
  function addColumn(key: string) {
    setVisibleKeys((prev) => prev.includes(key) ? prev : [...prev, key])
  }
  function removeColumn(key: string) {
    setVisibleKeys((prev) => prev.filter((k) => k !== key))
  }
  function resetToDefaults() {
    setVisibleKeys(defaultVisibleKeys)
    try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
  }

  // ── Drag-and-drop reordering (HTML5 native) ───────────────────────────────
  const dragKey = useRef<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const onDragStart = useCallback((key: string) => {
    dragKey.current = key
  }, [])

  const onDragOver = useCallback((e: React.DragEvent, key: string) => {
    e.preventDefault()
    if (key !== dragKey.current) setDragOverKey(key)
  }, [])

  const onDrop = useCallback((targetKey: string) => {
    const from = dragKey.current
    if (!from || from === targetKey) {
      dragKey.current = null
      setDragOverKey(null)
      return
    }
    setVisibleKeys((prev) => {
      const next = [...prev]
      const fromIdx = next.indexOf(from)
      const toIdx = next.indexOf(targetKey)
      if (fromIdx === -1 || toIdx === -1) return prev
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, from)
      return next
    })
    dragKey.current = null
    setDragOverKey(null)
  }, [])

  const onDragEnd = useCallback(() => {
    dragKey.current = null
    setDragOverKey(null)
  }, [])

  // ── Sorting ───────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<string>('label')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      const dataA = a.data as Record<string, unknown>
      const dataB = b.data as Record<string, unknown>
      const valA = sortKey === 'id' ? a.id : (dataA[sortKey] ?? '')
      const valB = sortKey === 'id' ? b.id : (dataB[sortKey] ?? '')
      let comp = 0
      if (typeof valA === 'number' && typeof valB === 'number') {
        comp = valA - valB
      } else {
        comp = String(valA).localeCompare(String(valB))
      }
      return sortOrder === 'asc' ? comp : -comp
    })
  }, [nodes, sortKey, sortOrder])

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = activeColumns.map((c) => escapeCSVCell(c.label))
    const rows = sortedNodes.map((node) => {
      const data = node.data as Record<string, unknown>
      return activeColumns.map((col) => {
        const raw = col.key === 'id' ? node.id : data[col.key]
        // Resolve status to label for readability
        return escapeCSVCell(
          col.format === 'status' ? formatFieldValue(raw, 'status') : raw
        )
      })
    })
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jobs-export-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Chooser panel ─────────────────────────────────────────────────────────
  const [isChooserOpen, setIsChooserOpen] = useState(false)
  const chooserRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isChooserOpen) return
    function handleClick(e: MouseEvent) {
      if (chooserRef.current && !chooserRef.current.contains(e.target as HTMLElement)) {
        setIsChooserOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isChooserOpen])

  const hiddenCount = hiddenColumns.length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-surface">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-text uppercase tracking-wider">
            Job Monitoring Grid
          </span>
          <span className="text-xs text-text-muted">
            {sortedNodes.length} jobs · {activeColumns.length} columns
            {hiddenCount > 0 && (
              <span className="ml-1">({hiddenCount} hidden)</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Export CSV */}
          <button
            id="list-view-export-csv"
            type="button"
            onClick={exportCSV}
            title="Export visible data as CSV"
            className="inline-flex items-center gap-1.5 border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
          >
            <Icon name="download" size={12} />
            <span>Export CSV</span>
          </button>

          {/* Add / Remove Fields */}
          <div className="relative" ref={chooserRef}>
            <button
              id="list-view-column-chooser"
              type="button"
              onClick={() => setIsChooserOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
            >
              <Icon name="grid-view" size={12} />
              <span>Add / Remove Fields</span>
              {hiddenCount > 0 && (
                <span className="ml-0.5 bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                  {hiddenCount}
                </span>
              )}
            </button>

            {/* ── Column chooser panel ── */}
            {isChooserOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-64 border border-border-strong bg-surface shadow-xl">

                {/* Panel header */}
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold text-text uppercase tracking-wide">
                    Display Columns
                  </span>
                  <button
                    type="button"
                    onClick={resetToDefaults}
                    className="text-[11px] text-primary hover:underline"
                    title="Reset to DB defaults"
                  >
                    Reset
                  </button>
                </div>

                {/* ── Visible columns (draggable) ── */}
                {activeColumns.length > 0 && (
                  <div>
                    <div className="px-3 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wide bg-surface-sunken border-b border-border">
                      Visible · drag to reorder
                    </div>
                    <div className="py-0.5">
                      {activeColumns.map((col) => {
                        const isOver = dragOverKey === col.key
                        return (
                          <div
                            key={col.key}
                            draggable
                            onDragStart={() => onDragStart(col.key)}
                            onDragOver={(e) => onDragOver(e, col.key)}
                            onDrop={() => onDrop(col.key)}
                            onDragEnd={onDragEnd}
                            className={[
                              'flex items-center gap-2 px-2 py-1 text-xs text-text select-none',
                              'transition-colors duration-75',
                              isOver
                                ? 'bg-primary/10 border-t-2 border-primary'
                                : 'hover:bg-surface-hover',
                            ].join(' ')}
                          >
                            {/* Drag handle */}
                            <span
                              className="shrink-0 text-text-muted cursor-grab active:cursor-grabbing"
                              title="Drag to reorder"
                            >
                              <Icon name="drag-handle" size={12} />
                            </span>

                            {/* Column label */}
                            <span className="flex-1 truncate">{col.label}</span>

                            {/* Remove (×) */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeColumn(col.key) }}
                              className="shrink-0 text-text-muted hover:text-danger-fg transition-colors"
                              title={`Hide ${col.label}`}
                            >
                              <Icon name="x" size={10} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Hidden columns ── */}
                {hiddenColumns.length > 0 && (
                  <div className="border-t border-border">
                    <div className="px-3 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wide bg-surface-sunken border-b border-border">
                      Hidden · click to show
                    </div>
                    <div className="max-h-40 overflow-y-auto py-0.5">
                      {hiddenColumns.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => addColumn(col.key)}
                          className="flex w-full items-center gap-2 px-2 py-1 text-xs text-text-muted hover:bg-surface-hover hover:text-text transition-colors"
                        >
                          <Icon name="plus" size={11} />
                          <span>{col.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="border-t border-border px-3 py-1.5 text-[11px] text-text-muted">
                  {activeColumns.length} of {availableColumns.length} columns visible
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-sunken">
            <tr>
              {activeColumns.map((col) => {
                const isSorted = sortKey === col.key
                return (
                  <Th
                    key={col.key}
                    align={col.align}
                    onClick={() => handleSort(col.key)}
                    className="cursor-pointer hover:text-text"
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        col.align === 'right' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span>{col.label}</span>
                      {isSorted && (
                        <span className="text-primary text-[10px]">
                          {sortOrder === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </Th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedNodes.map((node) => {
              const data = node.data as FlatNodeData
              const isSelected = node.id === selectedId
              return (
                <tr
                  key={node.id}
                  onClick={() => onSelect(node.id)}
                  className={[
                    'h-row cursor-default border-b border-border transition-colors duration-75',
                    isSelected
                      ? 'bg-surface-selected font-medium text-text'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                  ].join(' ')}
                >
                  {activeColumns.map((col) => {
                    const rawVal = col.key === 'id'
                      ? node.id
                      : (data as Record<string, unknown>)[col.key]
                    if (col.key === 'status') {
                      return (
                        <Td key={col.key}>
                          <StatusCell status={rawVal} />
                        </Td>
                      )
                    }
                    return (
                      <Td key={col.key} align={col.align}>
                        {formatFieldValue(rawVal, col.format as 'text' | 'mono' | 'status')}
                      </Td>
                    )
                  })}
                </tr>
              )
            })}
            {sortedNodes.length === 0 && (
              <tr>
                <td
                  colSpan={activeColumns.length || 1}
                  className="px-2.5 py-3 text-text-muted text-xs"
                >
                  No nodes available in list view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusCell({ status }: { status: unknown }) {
  const label = formatFieldValue(status, 'status')
  const badgeStyle = statusBadgeStyle(status)
  const dotColor = statusHex(status)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold"
      style={badgeStyle}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
      <span>{label}</span>
    </span>
  )
}

function Th({
  children,
  align = 'left',
  onClick,
  className = '',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  onClick?: () => void
  className?: string
}) {
  return (
    <th
      scope="col"
      onClick={onClick}
      className={`label-caps border-b border-border-strong px-2.5 py-1 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <td className={`px-2.5 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  )
}

export default NodeListView
