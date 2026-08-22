'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Calendar } from 'lucide-react'
import type { Node } from '@xyflow/react'
import {
  DETAILS_TABS,
  type DetailsTabDef,
} from '@/lib/view-config'
import {
  formatFieldValue,
  rawFieldValue,
  statusHex,
  statusTextStyle,
  isShowable,
  type FieldDef,
} from '@/lib/fields'
import { useAppConfig } from '@/lib/app-config'
import { resolveStatus } from '@/lib/app-config'
import { fetchNodeLogs, type NodeLogEntry } from '@/lib/api-client'
import { useDashboardStore } from '@/lib/stores/dashboard-store'
import { cn } from '@/lib/utils'

interface DetailsPanelProps {
  selectedNode: Node | null
  nodeCount: number
  edgeCount: number
  onOpenViewSchedule: (nodeId: string) => void
}

export default function DetailsPanel({ selectedNode, nodeCount, edgeCount, onOpenViewSchedule }: DetailsPanelProps) {
  const [activeTabId, setActiveTabId] = useState<string>(DETAILS_TABS[0].id)
  const lastSelectedIdRef = useRef<string | null>(null)

  // Reset to first tab when selection CHANGES (not on every render)
  // Using ref + setState pattern instead of useEffect to avoid cascading renders
  if (selectedNode?.id !== lastSelectedIdRef.current) {
    lastSelectedIdRef.current = selectedNode?.id ?? null
    if (activeTabId !== DETAILS_TABS[0].id) {
      setActiveTabId(DETAILS_TABS[0].id)
    }
  }

  const activeTab = DETAILS_TABS.find((t) => t.id === activeTabId) ?? DETAILS_TABS[0]

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" className="flex shrink-0 border-b border-border bg-surface-sunken">
        {DETAILS_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTabId === tab.id}
            type="button"
            onClick={() => setActiveTabId(tab.id)}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium transition-colors',
              activeTabId === tab.id
                ? 'bg-surface text-text border-b-2 border-b-primary -mb-px'
                : 'text-text-muted hover:text-text hover:bg-surface-hover',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <TabBody tab={activeTab} selectedNode={selectedNode} nodeCount={nodeCount} edgeCount={edgeCount} onOpenViewSchedule={onOpenViewSchedule} />
      </div>
    </div>
  )
}

function TabBody({
  tab,
  selectedNode,
  nodeCount,
  edgeCount,
  onOpenViewSchedule,
}: {
  tab: DetailsTabDef
  selectedNode: Node | null
  nodeCount: number
  edgeCount: number
  onOpenViewSchedule: (nodeId: string) => void
}) {
  if (!selectedNode) {
    return (
      <div className="p-4 text-xs text-text-muted text-center">
        <div className="mb-2 label-caps">No Selection</div>
        <div>Select a node on the canvas to view its details.</div>
        <div className="mt-4 text-[10px]">
          <strong className="text-text">{nodeCount}</strong> jobs · <strong className="text-text">{edgeCount}</strong> edges in current view.
        </div>
      </div>
    )
  }

  if (tab.kind === 'placeholder') {
    return (
      <div className="p-4 text-xs text-text-muted">
        <div className="label-caps mb-2">Properties</div>
        <p>Custom properties will appear here.</p>
      </div>
    )
  }

  if (tab.kind === 'log') {
    return <LogTab nodeId={selectedNode.id} />
  }

  return (
    <FieldsTab
      tab={tab}
      selectedNode={selectedNode}
      onOpenViewSchedule={onOpenViewSchedule}
    />
  )
}

function FieldsTab({
  tab,
  selectedNode,
  onOpenViewSchedule,
}: {
  tab: DetailsTabDef
  selectedNode: Node
  onOpenViewSchedule: (nodeId: string) => void
}) {
  const storeFieldDefs = useDashboardStore((s) => s.fieldDefinitions)

  // Build sections — combine dynamic EAV field definitions with static defaults
  const sections = useMemo(() => {
    const activeDefs = storeFieldDefs.filter(
      (f) => f.isActive !== 0 && f.isActive !== false && isShowable(f.showInDetails),
    )

    if (activeDefs.length > 0) {
      const map = new Map<string, FieldDef[]>()
      for (const f of activeDefs) {
        const title = f.sectionTitle || 'General'
        if (!map.has(title)) map.set(title, [])
        map.get(title)!.push({
          key: f.key,
          label: f.label,
          sectionTitle: title,
          format: f.format,
          isProtected: Boolean(f.isProtected),
          showOnCard: f.showOnCard,
          showInDetails: f.showInDetails,
          role: f.role,
          sortOrder: f.sortOrder,
        })
      }
      return Array.from(map.entries()).map(([title, fields]) => ({
        title,
        fields: fields.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      }))
    }

    const sectionsMap = new Map<string, FieldDef[]>()
    for (const section of tab.sections ?? []) {
      sectionsMap.set(section.title, [...section.fields])
    }
    return Array.from(sectionsMap.entries()).map(([title, fields]) => ({ title, fields }))
  }, [storeFieldDefs, tab])

  return (
    <div className="p-2">
      {sections.map(({ title, fields }) => (
        <section key={title} className="mb-4">
          <h4 className="label-caps mb-1.5 px-1">{title}</h4>
          <dl className="border border-border">
            {fields.map((field) => {
              const value = rawFieldValue(selectedNode, field)
              const formatted = formatFieldValue(value, field.format)
              return (
                <div
                  key={field.key}
                  className="flex items-baseline justify-between gap-2 px-2 py-1.5 border-b border-border last:border-b-0"
                >
                  <dt className="shrink-0 text-xs text-text-muted">{field.label}</dt>
                  <dd
                    className={cn(
                      'min-w-0 truncate text-xs text-text',
                      field.format === 'mono' && 'font-mono',
                    )}
                    style={field.format === 'status' ? statusTextStyle(value) : undefined}
                  >
                    {formatted}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}

      {/* Schedule action */}
      <button
        type="button"
        onClick={() => onOpenViewSchedule(selectedNode.id)}
        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium border border-border-strong bg-surface hover:bg-surface-hover text-text"
      >
        <Calendar size={12} strokeWidth={1.5} />
        View Schedule
      </button>
    </div>
  )
}

function LogTab({ nodeId }: { nodeId: string }) {
  const [logs, setLogs] = useState<NodeLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch with AbortController to prevent race conditions on rapid selection
  const fetchLogs = useCallback(async (id: string, signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNodeLogs(id)
      if (!signal.aborted) {
        setLogs(data)
      }
    } catch (err) {
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchLogs(nodeId, controller.signal)
    return () => controller.abort()
  }, [nodeId, fetchLogs])

  if (loading) {
    return <div className="p-4 text-xs text-text-muted">Loading logs…</div>
  }
  if (error) {
    return <div className="p-4 text-xs text-danger-fg">Error: {error}</div>
  }
  if (logs.length === 0) {
    return <div className="p-4 text-xs text-text-muted text-center">No logs recorded for this node.</div>
  }

  return (
    <ul className="divide-y divide-border">
      {logs.map((log) => (
        <li key={log.id} className="px-2 py-1.5 text-xs">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={cn(
                'inline-block size-1.5 shrink-0',
                log.level === 'ERROR' && 'bg-danger-fg',
                log.level === 'WARN' && 'bg-warning-fg',
                log.level === 'INFO' && 'bg-info-fg',
              )}
              aria-hidden
            />
            <span className="text-[10px] text-text-muted font-mono">{log.timestamp}</span>
            <span className="text-[10px] text-text-muted font-medium">{log.level}</span>
          </div>
          <div className="text-text pl-3.5 break-words">{log.message}</div>
        </li>
      ))}
    </ul>
  )
}

// Used by FieldsTab above; keep status hex helper available
export { statusHex }
