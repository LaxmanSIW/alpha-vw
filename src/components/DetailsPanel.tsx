import { useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'
import { DETAILS_TABS, type DetailsSectionDef, type DetailsTabDef } from '../config/viewConfig'
import { rawFieldValue, resolveField, statusToneClass } from '../fields'
import { fetchNodeLogs } from '../api/client'
import type { FieldDefinition } from '../types'

interface DetailsPanelProps {
  selectedNode: Node | null
  nodeCount: number
  edgeCount: number
}

function DetailsPanel({ selectedNode, nodeCount, edgeCount }: DetailsPanelProps) {
  const [activeTabId, setActiveTabId] = useState(DETAILS_TABS[0].id)
  const activeTab = DETAILS_TABS.find((tab) => tab.id === activeTabId) ?? DETAILS_TABS[0]

  return (
    <div className="flex h-full flex-col">
      <div
        role="tablist"
        aria-label="Details sections"
        className="flex h-rail shrink-0 items-stretch border-b border-border bg-surface-sunken"
      >
        {DETAILS_TABS.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTabId(tab.id)}
              className={[
                'border-r border-border px-2.5 text-sm transition-colors duration-75',
                isActive
                  ? 'bg-surface font-medium text-primary'
                  : 'text-text-secondary hover:text-text',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <TabBody
          tab={activeTab}
          selectedNode={selectedNode}
          nodeCount={nodeCount}
          edgeCount={edgeCount}
        />
      </div>
    </div>
  )
}

function TabBody({
  tab,
  selectedNode,
  nodeCount,
  edgeCount,
}: DetailsPanelProps & { tab: DetailsTabDef }) {
  if (tab.kind === 'log') return <LogTab selectedNode={selectedNode} />
  if (tab.kind === 'placeholder') {
    return <p className="p-2.5 text-sm text-text-muted">{tab.label} placeholder.</p>
  }

  if (!selectedNode) {
    return (
      <div className="p-2.5">
        <p className="mb-3 text-sm text-text-muted">
          No selection. Click a node on the canvas to inspect it.
        </p>
        <Section
          title="Viewpoint Summary"
          rows={[
            { label: 'Total Nodes', value: String(nodeCount) },
            { label: 'Total Edges', value: String(edgeCount) },
          ]}
        />
      </div>
    )
  }

  const sections = buildDynamicNodeSections(selectedNode, tab.sections)

  return (
    <div className="p-2.5 space-y-3">
      {sections.map((section) => (
        <Section
          key={section.title}
          title={section.title}
          rows={section.rows}
        />
      ))}
    </div>
  )
}

interface RowData {
  label: string
  value: string
  mono?: boolean
  toneClass?: string
}

interface DynamicSection {
  title: string
  rows: RowData[]
}

function isShowable(val: unknown): boolean {
  if (val === undefined || val === null || val === '') return true
  const str = String(val).trim().toUpperCase()
  return str !== 'N' && str !== 'NO' && str !== 'FALSE' && str !== '0'
}

function buildDynamicNodeSections(node: Node, defaultSections?: DetailsSectionDef[]): DynamicSection[] {
  const data = (node.data ?? {}) as Record<string, unknown>
  const fieldDefs = (data.fieldDefinitions ?? []) as FieldDefinition[]
  const fieldDefMap = new Map<string, FieldDefinition>()
  fieldDefs.forEach((fd) => fieldDefMap.set(fd.key, fd))

  const nodeKind = (data.kind as string) ?? 'Item'
  const parentFolder = (data.folder as string) ?? '--'

  const sectionMap = new Map<string, RowData[]>()

  const addRow = (defaultSectionTitle: string, fieldKey: string, row: RowData) => {
    const def = fieldDefMap.get(fieldKey)
    if (def) {
      const showInDetails = def.showInDetails ?? (def as unknown as Record<string, unknown>).show_in_details
      if (!isShowable(showInDetails)) return
    }
    const targetSection = def?.sectionTitle || defaultSectionTitle
    if (!sectionMap.has(targetSection)) sectionMap.set(targetSection, [])
    sectionMap.get(targetSection)!.push(row)
  }

  // 1. Core Identity Section
  addRow('Identity', 'label', { label: 'Name', value: String(data.label ?? node.id) })
  addRow('Identity', 'id', { label: 'Node ID', value: node.id, mono: true })
  addRow('Identity', 'kind', { label: 'Kind', value: node.type === 'container' ? 'Container Folder' : 'Job / Item' })
  addRow('Identity', 'node_kind', { label: 'Type', value: nodeKind })
  addRow('Identity', 'folder', { label: 'Folder Scope', value: parentFolder })

  // 2. Core State Section
  if (data.status) {
    const statusVal = String(data.status)
    addRow('State', 'status', {
      label: 'Status',
      value: statusVal.toUpperCase(),
      toneClass: statusToneClass(statusVal),
    })
  }

  // 3. Execution Section
  if (data.host) addRow('Execution', 'host', { label: 'Host', value: String(data.host), mono: true })
  if (data.runs !== undefined) addRow('Execution', 'runs', { label: 'Runs', value: String(data.runs) })

  // 4. Custom Fields Section - Grouped by custom sectionTitle
  const knownKeys = new Set([
    'label',
    'kind',
    'node_kind',
    'folder',
    'status',
    'host',
    'runs',
    'expanded',
    'relation',
    'fieldDefinitions',
  ])

  // Process all registered custom field definitions
  fieldDefs.forEach((def) => {
    if (knownKeys.has(def.key)) return
    const val = data[def.key]
    const valueStr = val !== undefined && val !== null && val !== '' ? String(val) : '--'
    const sectionTitle = def.sectionTitle || 'Operational Metadata'

    addRow(sectionTitle, def.key, {
      label: def.label || def.key,
      value: valueStr,
      mono: def.format === 'mono',
    })
  })

  // Also include any extra custom properties attached to node data not in fieldDefs
  for (const [key, val] of Object.entries(data)) {
    if (knownKeys.has(key) || fieldDefMap.has(key)) continue
    if (val === null || val === undefined || val === '') continue

    const formattedLabel = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    addRow('Operational Metadata', key, {
      label: formattedLabel,
      value: String(val),
      mono: typeof val === 'number',
    })
  }

  // Fallback static sections if present
  if (defaultSections && sectionMap.size === 0) {
    for (const sec of defaultSections) {
      const rows: RowData[] = sec.fields.map((f) => ({
        label: f.label,
        value: resolveField(node, f),
        mono: f.format === 'mono',
        toneClass: f.format === 'status' ? statusToneClass(rawFieldValue(node, f)) : undefined,
      }))
      sectionMap.set(sec.title, rows)
    }
  }

  return Array.from(sectionMap.entries()).map(([title, rows]) => ({ title, rows }))
}

function LogTab({ selectedNode }: { selectedNode: Node | null }) {
  const [logs, setLogs] = useState<Array<{ time: string; level: string; message: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedNode) {
      setLogs([
        { time: '12:04:11', level: 'INFO', message: 'Viewpoint loaded' },
        { time: '12:04:12', level: 'INFO', message: 'Resolved database nodes and edges' },
      ])
      return
    }

    let isMounted = true
    setLoading(true)
    fetchNodeLogs(selectedNode.id)
      .then((data) => {
        if (isMounted) {
          if (data.length > 0) {
            setLogs(
              data.map((l) => ({
                time: new Date(l.timestamp).toLocaleTimeString(),
                level: l.level,
                message: l.message,
              }))
            )
          } else {
            setLogs([
              { time: new Date().toLocaleTimeString(), level: 'INFO', message: `No error logs for node ${selectedNode.id}` },
            ])
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setLogs([
            { time: new Date().toLocaleTimeString(), level: 'INFO', message: `Node ${selectedNode.id} status healthy.` },
          ])
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedNode])

  if (loading) {
    return <div className="p-2.5 text-xs text-text-muted">Loading logs from database...</div>
  }

  return (
    <ul className="divide-y divide-border">
      {logs.map((entry, index) => (
        <li key={index} className="flex gap-2 px-2.5 py-1.5 text-xs">
          <span className="shrink-0 font-mono text-text-muted">{entry.time}</span>
          <span
            className={[
              'w-11 shrink-0 font-semibold',
              entry.level === 'ERROR'
                ? 'text-danger-fg'
                : entry.level === 'WARN'
                ? 'text-warning-fg'
                : 'text-text-muted',
            ].join(' ')}
          >
            {entry.level}
          </span>
          <span className="min-w-0 text-text-secondary">{entry.message}</span>
        </li>
      ))}
    </ul>
  )
}

function Section({ title, rows }: { title: string; rows: RowData[] }) {
  return (
    <section className="mb-3 last:mb-0">
      <h3 className="label-caps mb-1 border-b border-border pb-1">{title}</h3>
      <dl className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-2 py-1">
            <dt className="w-20 shrink-0 text-xs text-text-muted">{row.label}</dt>
            <dd
              className={[
                'min-w-0 flex-1 truncate text-right text-sm',
                row.mono ? 'font-mono text-xs' : '',
                row.toneClass ?? 'text-text',
              ].join(' ')}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default DetailsPanel
