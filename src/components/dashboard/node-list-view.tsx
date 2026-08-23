'use client'

import { useMemo, useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Download, Columns3 } from 'lucide-react'
import type { Node } from '@xyflow/react'
import type { FieldDefinition } from '@/lib/types'
import { formatFieldValue, statusHex, statusBadgeStyle, isShowable } from '@/lib/fields'
import { useDashboardStore } from '@/lib/stores/dashboard-store'
import { useAppConfig } from '@/lib/app-config'
import { cn } from '@/lib/utils'

interface NodeListViewProps {
  nodes: Node[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  fieldDefinitions: FieldDefinition[]
}

const DEFAULT_COLUMNS = [
  { key: 'label', label: 'Job Name', width: 220, sortable: true, visible: true },
  { key: 'status', label: 'Status', width: 110, sortable: true, visible: true },
  { key: 'host', label: 'Host', width: 140, sortable: true, visible: true },
  { key: 'runs', label: 'Runs', width: 80, sortable: true, visible: true },
  { key: 'scheduled', label: 'Scheduled', width: 100, sortable: true, visible: true },
  { key: 'schedule', label: 'Schedule Config', width: 160, sortable: true, visible: true },
  { key: 'kind', label: 'Type', width: 100, sortable: true, visible: true },
  { key: '__id', label: 'Node ID', width: 140, sortable: true, visible: true },
]

const STORAGE_KEY = 'alpha-vw-nodelistview-columns'

interface ColumnDef {
  key: string
  label: string
  width: number
  sortable: boolean
  visible: boolean
}

export default function NodeListView({ nodes, selectedId, onSelect, fieldDefinitions }: NodeListViewProps) {
  const storeFieldDefs = useDashboardStore((s) => s.fieldDefinitions)
  const activeDefs = storeFieldDefs.length > 0 ? storeFieldDefs : fieldDefinitions

  const [columns, setColumns] = useState<ColumnDef[]>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as ColumnDef[]
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch { /* ignore */ }
    }
    return DEFAULT_COLUMNS
  })
  const [sortBy, setSortBy] = useState<string>('label')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showColumnChooser, setShowColumnChooser] = useState(false)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  // Dynamically sync list view columns when field definitions are created or deleted
  useEffect(() => {
    setColumns((prevCols) => {
      const baseKeys = new Set(['label', 'status', 'host', 'runs', 'scheduled', 'schedule', 'kind', '__id'])
      const activeDefKeys = new Set(
        activeDefs.filter((f) => f.isActive !== 0 && f.isActive !== false).map((f) => f.key),
      )

      // Keep base columns + currently active field definition columns (removes deleted fields)
      const updated = prevCols.filter((c) => baseKeys.has(c.key) || activeDefKeys.has(c.key))
      const existingKeys = new Set(updated.map((c) => c.key))

      // Append newly created active field definitions
      for (const f of activeDefs) {
        if (f.isActive !== 0 && f.isActive !== false && !existingKeys.has(f.key)) {
          updated.push({
            key: f.key,
            label: f.label,
            width: 140,
            sortable: true,
            visible: isShowable(f.showInDetails),
          })
        }
      }
      return updated
    })
  }, [activeDefs])

  // Persist columns
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columns))
    } catch { /* ignore */ }
  }, [columns])

  const visibleCols = useMemo(() => columns.filter((c) => c.visible), [columns])

  const sorted = useMemo(() => {
    const arr = [...nodes]
    arr.sort((a, b) => {
      const av = a.data?.[sortBy] ?? (a as unknown as Record<string, unknown>)[sortBy] ?? ''
      const bv = b.data?.[sortBy] ?? (b as unknown as Record<string, unknown>)[sortBy] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const sa = String(av)
      const sb = String(bv)
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })
    return arr
  }, [nodes, sortBy, sortDir])

  const onSort = (key: string) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  const onExport = () => {
    const rows = sorted.map((n) => {
      const out: Record<string, string> = {}
      for (const col of visibleCols) {
        if (col.key === '__id') {
          out[col.label] = n.id
        } else {
          out[col.label] = String(n.data?.[col.key] ?? '')
        }
      }
      return out
    })
    const headers = visibleCols.map((c) => c.label)
    const csv = [
      headers.map(escapeCSV).join(','),
      ...rows.map((r) => headers.map((h) => escapeCSV(r[h] ?? '')).join(',')),
    ].join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'node-list-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onDragStart = (idx: number) => setDragging(idx)
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOver(idx)
  }
  const onDrop = (idx: number) => {
    if (dragging === null || dragging === idx) return
    const next = [...columns]
    const [moved] = next.splice(dragging, 1)
    next.splice(idx, 0, moved)
    setColumns(next)
    setDragging(null)
    setDragOver(null)
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex h-[var(--actionbar-h)] shrink-0 items-center justify-between border-b border-border bg-surface px-3">
        <div className="flex items-center gap-2">
          <span className="label-caps">Job Monitoring Grid</span>
          <span className="text-xs text-text-muted">{sorted.length} jobs</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 h-[var(--control-h)] px-2 text-xs font-medium border border-transparent rounded bg-transparent hover:bg-surface-hover text-text transition-colors"
          >
            <Download size={12} strokeWidth={1.5} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowColumnChooser((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 h-[var(--control-h)] px-2 text-xs font-medium border border-transparent rounded transition-colors',
              showColumnChooser
                ? 'bg-primary/10 text-primary'
                : 'bg-transparent text-text hover:bg-surface-hover',
            )}
          >
            <Columns3 size={12} strokeWidth={1.5} />
            Columns
          </button>
        </div>
      </div>

      {showColumnChooser && (
        <div className="border-b border-border bg-surface-sunken px-3 py-2">
          <div className="label-caps mb-1.5">Show / Hide Columns</div>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((col, idx) => (
              <label key={col.key} className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs border border-border bg-surface">
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={() => {
                    const next = [...columns]
                    next[idx] = { ...col, visible: !col.visible }
                    setColumns(next)
                  }}
                  className="accent-[var(--primary)]"
                />
                <span className="text-text">{col.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-text-muted">Drag column headers in the grid to reorder.</div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-sunken sticky top-0 z-10">
            <tr className="text-text-muted">
              {visibleCols.map((col, idx) => (
                <th
                  key={col.key}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={() => onDrop(idx)}
                  className={cn(
                    'h-[var(--row-h)] px-2 text-left font-medium border-r border-border cursor-ew-resize select-none',
                    dragOver === idx && 'bg-primary/10',
                  )}
                  style={{ width: col.width, minWidth: col.width }}
                >
                  <button
                    type="button"
                    onClick={() => col.sortable && onSort(col.key)}
                    className="flex w-full items-center justify-between gap-1 text-text-muted hover:text-text"
                  >
                    <span>{col.label}</span>
                    {sortBy === col.key && (
                      <span className="text-text">
                        {sortDir === 'asc' ? <ChevronDown size={11} strokeWidth={2} /> : <ChevronUp size={11} strokeWidth={2} />}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((node) => {
              const isSelected = selectedId === node.id
              return (
                <tr
                  key={node.id}
                  onClick={() => onSelect(node.id)}
                  className={cn(
                    'border-b border-border cursor-pointer hover:bg-surface-hover transition-colors',
                    isSelected && 'bg-primary/10 hover:bg-primary/15',
                  )}
                >
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      className="h-[var(--row-h)] px-2 border-r border-border"
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      <Cell node={node} col={col} />
                    </td>
                  ))}
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length} className="py-12 text-center text-text-muted">
                  No jobs in the current view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Cell({ node, col }: { node: Node; col: ColumnDef }) {
  const value = col.key === '__id' ? node.id : node.data?.[col.key]

  if (col.key === 'status') {
    const hex = statusHex(value)
    return (
      <span
        style={statusBadgeStyle(value)}
        className="inline-block px-1.5 py-0.5 text-[11px] font-medium"
      >
        {formatFieldValue(value, 'status')}
      </span>
    )
  }

  if (col.key === '__id') {
    return <span className="font-mono text-text-secondary truncate">{value as React.ReactNode}</span>
  }

  if (col.key === 'runs') {
    return <span className="tabular-nums text-text">{String(value ?? '--')}</span>
  }

  if ((col as { format?: string }).format === 'mono' || col.key === 'host' || col.key === 'schedule') {
    return <span className="font-mono text-text-secondary truncate">{String(value ?? '--')}</span>
  }

  return <span className="text-text truncate">{String(value ?? '--')}</span>
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}
