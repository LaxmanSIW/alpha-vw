import { useMemo, useState, useEffect } from 'react'
import type { Node } from '@xyflow/react'
import Icon from './Icon'
import type { FlatNodeData } from './FlatNode'
import { NODE_FIELDS, RESERVED_KEYS } from '../config/viewConfig'
import { formatFieldValue } from '../fields'

interface NodeListViewProps {
  nodes: Node[]
  selectedId: string | null
  onSelect: (id: string) => void
}



interface ColumnConfig {
  key: string
  label: string
  align?: 'left' | 'right'
  format?: string
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'label', label: 'Name' },
  { key: 'folder', label: 'Folder' },
  { key: 'kind', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'host', label: 'Host' },
  { key: 'runs', label: 'Runs', align: 'right' },
]

/**
 * Tabular monitoring view with customizable columns and sorting.
 * Column choices persist to local storage matching BMC Control-M user profile behavior.
 */
function NodeListView({ nodes, selectedId, onSelect }: NodeListViewProps) {
  // Collect all available column definitions from node data & config
  const availableColumns = useMemo(() => {
    const map = new Map<string, ColumnConfig>()
    DEFAULT_COLUMNS.forEach((col) => map.set(col.key, col))

    NODE_FIELDS.forEach((field) => {
      if (field.key !== RESERVED_KEYS.id && !map.has(field.key)) {
        map.set(field.key, {
          key: field.key,
          label: field.label,
          align: field.key === 'runs' ? 'right' : 'left',
          format: field.format,
        })
      }
    })

    return Array.from(map.values())
  }, [])

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ctm_list_view_visible_columns')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return DEFAULT_COLUMNS.map((c) => c.key)
  })

  const [isChooserOpen, setIsChooserOpen] = useState(false)
  const [sortKey, setSortKey] = useState<string>('label')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    try {
      localStorage.setItem('ctm_list_view_visible_columns', JSON.stringify(visibleKeys))
    } catch (e) {}
  }, [visibleKeys])

  const activeColumns = useMemo(
    () => availableColumns.filter((col) => visibleKeys.includes(col.key)),
    [availableColumns, visibleKeys],
  )

  function toggleColumn(key: string) {
    setVisibleKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

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

      const valA = sortKey === 'id' ? a.id : dataA[sortKey] ?? ''
      const valB = sortKey === 'id' ? b.id : dataB[sortKey] ?? ''

      let comp = 0
      if (typeof valA === 'number' && typeof valB === 'number') {
        comp = valA - valB
      } else {
        comp = String(valA).localeCompare(String(valB))
      }

      return sortOrder === 'asc' ? comp : -comp
    })
  }, [nodes, sortKey, sortOrder])

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header bar with Add/Remove Fields control */}
      <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-3 py-1.5">
        <div className="text-xs font-semibold text-text uppercase tracking-wider">
          Job Monitoring Grid ({sortedNodes.length} jobs)
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsChooserOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
          >
            <Icon name="grid-view" size={12} />
            <span>Add/Remove Fields</span>
          </button>

          {isChooserOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-border-strong bg-surface p-2 shadow-xl">
              <div className="mb-1.5 border-b border-border pb-1 text-xs font-semibold text-text uppercase">
                Select Display Columns
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {availableColumns.map((col) => {
                  const isChecked = visibleKeys.includes(col.key)
                  return (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-1 py-0.5 text-xs text-text cursor-pointer hover:bg-surface-hover rounded"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-border text-primary focus:ring-0"
                      />
                      <span>{col.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Table */}
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
                        <span className="text-primary text-xs">
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
                    const rawVal = col.key === 'id' ? node.id : data[col.key]
                    if (col.key === 'status') {
                      return (
                        <Td key={col.key}>
                          <StatusCell status={data.status} />
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
                <td colSpan={activeColumns.length} className="px-2.5 py-3 text-text-muted">
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

function StatusCell({ status }: { status: unknown }) {
  const s = String(status ?? '').toLowerCase().trim()

  let tone = 'bg-surface-sunken text-text-muted'
  let label = String(status ?? '--')

  if (s === 'completed' || s === 'ok') {
    tone = 'bg-success-bg text-success-fg font-semibold'
    label = 'Completed'
  } else if (s === 'executing') {
    tone = 'bg-primary/20 text-primary font-semibold'
    label = 'Executing'
  } else if (s === 'wait for event' || s === 'warning') {
    tone = 'bg-warning-bg text-warning-fg font-semibold'
    label = 'Wait for Event'
  } else if (s === 'failed' || s === 'danger') {
    tone = 'bg-danger-bg text-danger-fg font-semibold'
    label = 'Failed'
  }

  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs ${tone}`}>
      {label}
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
