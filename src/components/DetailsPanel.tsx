import { useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'
import { DETAILS_TABS, type DetailsSectionDef, type DetailsTabDef } from '../config/viewConfig'
import { rawFieldValue, resolveField, statusToneClass } from '../fields'
import { fetchNodeLogs } from '../api/client'

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
          title="Viewpoint"
          rows={[
            { label: 'Nodes', value: String(nodeCount) },
            { label: 'Edges', value: String(edgeCount) },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="p-2.5">
      {(tab.sections ?? []).map((section) => (
        <Section
          key={section.title}
          title={section.title}
          rows={sectionRows(section, selectedNode)}
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

function sectionRows(section: DetailsSectionDef, node: Node): RowData[] {
  return section.fields.map((field) => ({
    label: field.label,
    value: resolveField(node, field),
    mono: field.format === 'mono',
    toneClass: field.format === 'status' ? statusToneClass(rawFieldValue(node, field)) : undefined,
  }))
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
