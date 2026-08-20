import { useState } from 'react'
import type { Node } from '@xyflow/react'
import { DETAILS_TABS, type DetailsSectionDef, type DetailsTabDef } from '../config/viewConfig'
import { rawFieldValue, resolveField, statusToneClass } from '../fields'

interface DetailsPanelProps {
  selectedNode: Node | null
  nodeCount: number
  edgeCount: number
}

/**
 * Right-hand inspector. Tabs and the headings/fields inside them come from
 * DETAILS_TABS in viewConfig -- adding a heading is a config edit, not a
 * component edit.
 *
 * The tab strip matches the viewpoint tabs (white fill plus text colour) so
 * "active tab" looks the same everywhere in the app.
 */
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
  if (tab.kind === 'log') return <LogTab />
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

function LogTab() {
  const entries = [
    { time: '12:04:11', level: 'INFO', message: 'Viewpoint loaded' },
    { time: '12:04:12', level: 'INFO', message: 'Resolved 5 nodes, 5 edges' },
    { time: '12:05:02', level: 'WARN', message: 'Rules Engine latency above threshold' },
    { time: '12:06:44', level: 'ERROR', message: 'Export Gateway unreachable' },
  ]

  return (
    <ul className="divide-y divide-border">
      {entries.map((entry, index) => (
        <li key={index} className="flex gap-2 px-2.5 py-1.5 text-xs">
          <span className="shrink-0 font-mono text-text-muted">{entry.time}</span>
          {/* Level is spelled out, not just coloured -- status by colour alone
              fails for colourblind users and in greyscale. */}
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
            {/* Right-aligned so a column of values can be compared without reading. */}
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
