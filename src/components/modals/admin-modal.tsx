'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Database, Upload, HelpCircle, Plus, Trash2, Pencil, X, Check, FileDown, Copy, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/ui-custom/modal'
import Button from '@/components/ui-custom/button'
import Input from '@/components/ui-custom/input'
import Select from '@/components/ui-custom/select'
import { useUIStore } from '@/lib/stores/ui-store'
import { useDashboardStore } from '@/lib/stores/dashboard-store'
import {
  fetchTableRows,
  createTableRow,
  updateTableRow,
  deleteTableRow,
  bulkCreateRows,
  type CrudTable,
} from '@/lib/api-client'
import { normalizeKey } from '@/lib/crud-schemas'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'tables', label: 'Tables', icon: Database },
  { id: 'csv', label: 'CSV Import', icon: Upload },
  { id: 'guide', label: 'Field Guide', icon: HelpCircle },
] as const

type TabId = (typeof TABS)[number]['id']

const TABLES: Array<{ id: CrudTable; label: string }> = [
  { id: 'modules', label: 'Modules' },
  { id: 'viewpoints', label: 'Viewpoints' },
  { id: 'nav_nodes', label: 'Nav Nodes (Jobs + Folders)' },
  { id: 'edges', label: 'Edges (Dependencies)' },
  { id: 'field_definitions', label: 'Field Definitions (EAV Schema)' },
  { id: 'node_field_values', label: 'Node Field Values (EAV Data)' },
  { id: 'node_logs', label: 'Node Logs' },
  { id: 'calendars', label: 'Calendars (RBC)' },
  { id: 'schedule_configs', label: 'Schedule Configs (RBC)' },
  { id: 'app_config', label: 'App Config' },
]

const TABLE_COLUMNS: Record<CrudTable, string[]> = {
  modules: ['id', 'label'],
  viewpoints: ['id', 'moduleId', 'label', 'description', 'folder', 'jobCount', 'scope', 'filterStatus', 'grouping', 'sortBy'],
  nav_nodes: ['id', 'label', 'kind', 'parentId', 'nodeKind', 'status', 'host', 'runs', 'sortOrder', 'data'],
  edges: ['id', 'source', 'target'],
  node_logs: ['id', 'nodeId', 'timestamp', 'level', 'message'],
  field_definitions: ['key', 'label', 'sectionTitle', 'role', 'format', 'sortOrder', 'isProtected', 'showOnCard', 'showInDetails', 'isActive'],
  node_field_values: ['nodeId', 'fieldKey', 'fieldValue'],
  calendars: ['id', 'name', 'workdays', 'holidays'],
  schedule_configs: ['id', 'name', 'configData', 'lastEvaluatedDate', 'isScheduledToday'],
  app_config: ['key', 'category', 'label', 'value', 'sortOrder'],
}

const STRICT_OPTIONS: Record<string, string[]> = {
  kind: ['folder', 'job'],
  showOnCard: ['Y', 'N'],
  showInDetails: ['Y', 'N'],
  showInList: ['Y', 'N'],
  isActive: ['1', '0'],
  isProtected: ['1', '0'],
  isScheduledToday: ['Yes', 'No', 'N/A'],
}

export default function AdminModal() {
  const isOpen = useUIStore((s) => s.isAdminOpen)
  const close = useUIStore((s) => s.closeAdmin)
  const loadData = useDashboardStore((s) => s.loadData)
  const [tab, setTab] = useState<TabId>('tables')

  return (
    <Modal
      open={isOpen}
      onOpenChange={(o) => !o && close()}
      title="Database Admin"
      description="Manage database tables, import CSV data, and learn about the field schema."
      size="2xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 border-b border-border bg-surface-sunken">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-xs font-medium border-r border-border transition-colors',
                  tab === t.id
                    ? 'bg-surface text-primary border-b-2 border-b-primary -mb-px'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover',
                )}
              >
                <Icon size={12} strokeWidth={1.5} />
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === 'tables' && <TablesTab onDataChanged={() => loadData(true)} />}
          {tab === 'csv' && <CsvImportTab onDataChanged={() => loadData(true)} />}
          {tab === 'guide' && <FieldGuideTab />}
        </div>
      </div>
    </Modal>
  )
}

// ─── Tables tab ─────────────────────────────────────────────────────────────

function TablesTab({ onDataChanged }: { onDataChanged: () => void }) {
  const [activeTable, setActiveTable] = useState<CrudTable>('nav_nodes')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [fieldDefs, setFieldDefs] = useState<Record<string, unknown>[]>([])
  const [appConfigRows, setAppConfigRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, unknown>>({})
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchTableRows<Record<string, unknown>>(activeTable)
      setRows(data)
      try {
        const configs = await fetchTableRows<Record<string, unknown>>('app_config')
        setAppConfigRows(configs)
      } catch {
        /* ignore */
      }
      if (activeTable === 'nav_nodes') {
        try {
          const fdefs = await fetchTableRows<Record<string, unknown>>('field_definitions')
          setFieldDefs(fdefs)
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      toast.error(`Failed to load ${activeTable}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [activeTable])

  useEffect(() => {
    if (activeTable) load()
  }, [activeTable, load])

  const columns = useMemo(() => {
    const set = new Set<string>()
    const baseCols = TABLE_COLUMNS[activeTable] ?? []
    for (const c of baseCols) {
      if (activeTable === 'nav_nodes' && c === 'data') continue
      set.add(c)
    }

    if (activeTable === 'nav_nodes') {
      for (const fd of fieldDefs) {
        const key = String(fd.key ?? '').trim()
        if (!key || key === 'data') continue
        const normKey = normalizeKey(key)
        if (!set.has(normKey)) {
          set.add(normKey)
        }
      }
    }

    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (activeTable === 'nav_nodes' && k === 'data') continue
        const normKey = normalizeKey(k)
        set.add(normKey)
      }
    }
    return Array.from(set)
  }, [rows, activeTable, fieldDefs])

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of appConfigRows) {
      if (row.category === 'status') {
        if (row.label) set.add(String(row.label).toLowerCase())
        try {
          const parsed = JSON.parse(String(row.value)) as { aliases?: string[] }
          if (Array.isArray(parsed.aliases)) {
            for (const alias of parsed.aliases) {
              if (alias) set.add(alias.toLowerCase())
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (set.size === 0) {
      ;['completed', 'ok', 'executing', 'wait', 'failed', 'warn'].forEach((s) => set.add(s))
    }
    for (const r of rows) {
      if (r.status) set.add(String(r.status).toLowerCase())
    }
    return Array.from(set).sort()
  }, [appConfigRows, rows])

  const onCreate = () => {
    setCreating(true)
    setEditingId(null)
    setEditForm({})
  }

  const onEdit = (row: Record<string, unknown>) => {
    const id = row.nodeId && row.fieldKey ? `${row.nodeId}__${row.fieldKey}` : String(row.id ?? row.key ?? '')
    setEditingId(id)
    setCreating(false)
    setEditForm({ ...row })
  }

  const onSave = async () => {
    if (activeTable === 'node_field_values' && (!editForm.nodeId || !editForm.fieldKey)) {
      toast.error('nodeId and fieldKey are required for node_field_values')
      return
    }
    try {
      if (creating) {
        await createTableRow(activeTable, editForm)
        toast.success('Record created')
      } else if (editingId) {
        await updateTableRow(activeTable, editingId, editForm)
        toast.success('Record updated')
      }
      setEditingId(null)
      setCreating(false)
      setEditForm({})
      onDataChanged()
      await load()
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const onDelete = async (row: Record<string, unknown>) => {
    const id = row.nodeId && row.fieldKey ? `${row.nodeId}__${row.fieldKey}` : String(row.id ?? row.key ?? '')
    if (!window.confirm(`Delete record ${id}?`)) return
    try {
      await deleteTableRow(activeTable, id)
      toast.success('Record deleted')
      onDataChanged()
      await load()
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const onCancelEdit = () => {
    setEditingId(null)
    setCreating(false)
    setEditForm({})
  }

  return (
    <div className="flex h-full min-w-0">
      {/* Table list */}
      <div className="w-52 shrink-0 border-r border-border bg-surface-sunken overflow-auto custom-scrollbar">
        <div className="px-3 py-2 border-b border-border">
          <span className="label-caps">Tables</span>
        </div>
        <ul className="py-1">
          {TABLES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => { setActiveTable(t.id); onCancelEdit() }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-hover',
                  activeTable === t.id ? 'bg-primary/10 text-primary' : 'text-text',
                )}
              >
                <span className="truncate">{t.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Rows */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-3 py-2 w-full">
          <div className="flex items-center gap-2">
            <span className="label-caps">{TABLES.find((t) => t.id === activeTable)?.label}</span>
            <span className="text-xs text-text-muted">{rows.length} rows</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
            <Button size="sm" variant="primary" onClick={onCreate}>
              <Plus size={12} strokeWidth={1.5} /> New
            </Button>
          </div>
        </div>

        <EditRecordModal
          isOpen={creating || !!editingId}
          onClose={onCancelEdit}
          tableName={activeTable}
          columns={columns}
          form={editForm}
          onChange={setEditForm}
          onSave={onSave}
          isCreate={creating}
          rows={rows}
          statusOptions={statusOptions}
        />

        <div className="min-h-0 min-w-0 flex-1 overflow-auto custom-scrollbar">
          {loading && rows.length === 0 ? (
            <div className="p-4 text-xs text-text-muted">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-xs text-text-muted text-center">No rows. Click New to add one.</div>
          ) : (
            <table className="min-w-full w-max text-xs border-collapse">
              <thead className="bg-surface-sunken sticky top-0 z-10">
                <tr>
                  <th className="w-16 px-3 py-1.5 text-left font-medium text-text-muted border-r border-border bg-surface-sunken sticky left-0 z-20 shadow-[1px_0_0_0_var(--border)]">Actions</th>
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-1.5 text-left font-medium text-text-muted border-r border-border whitespace-nowrap bg-surface-sunken">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const id = row.nodeId && row.fieldKey ? `${row.nodeId}__${row.fieldKey}` : String(row.id ?? row.key ?? idx)
                  const isEditing = editingId === id
                  return (
                    <tr key={id} className={cn('border-b border-border hover:bg-surface-hover', isEditing && 'opacity-40')}>
                      <td className="px-2 py-1 border-r border-border bg-surface sticky left-0 z-10 shadow-[1px_0_0_0_var(--border)]">
                        <div className="flex items-center gap-0.5">
                          <button type="button" onClick={() => onEdit(row)} title="Edit" className="inline-flex items-center justify-center size-5 text-text-muted hover:text-primary hover:bg-primary/10">
                            <Pencil size={10} strokeWidth={1.5} />
                          </button>
                          <button type="button" onClick={() => onDelete(row)} title="Delete" className="inline-flex items-center justify-center size-5 text-text-muted hover:text-danger-fg hover:bg-danger-bg">
                            <Trash2 size={10} strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                      {columns.map((c) => (
                        <td key={c} className="px-3 py-1 border-r border-border max-w-xs truncate text-text font-mono text-[11px] whitespace-nowrap" title={String(row[c] ?? '')}>
                          {String(row[c] ?? '')}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const FIELD_HELP_INFO: Record<string, Record<string, { isRequired: boolean; description: string; codeUsage: string }>> = {
  nav_nodes: {
    id: {
      isRequired: true,
      description: 'Unique node identifier (e.g. F-ROOT, J-01).',
      codeUsage: 'Primary key used across canvas nodes, dependency edges, logs, and schedule maps.',
    },
    label: {
      isRequired: true,
      description: 'Display name for the job or folder.',
      codeUsage: 'Rendered as title text on canvas cards, details header, and list view rows.',
    },
    kind: {
      isRequired: true,
      description: 'Structural container type ("folder" or "job").',
      codeUsage: 'Determines tree navigation hierarchy, container nesting, and card styling.',
    },
    parentId: {
      isRequired: true,
      description: 'Parent node ID that contains this node.',
      codeUsage: 'Used by tree builder (getNavTree) to nest jobs inside folders.',
    },
    nodeKind: {
      isRequired: false,
      description: 'Business classification type (e.g. Source, Process, Reporter).',
      codeUsage: 'Subtitle category tag displayed on node card header.',
    },
    status: {
      isRequired: false,
      description: 'Current execution status (e.g. ok, warn, fail).',
      codeUsage: 'Maps node accent stripe color via app_config status configuration.',
    },
  },
  modules: {
    id: {
      isRequired: true,
      description: 'Unique module identifier (e.g. architecture).',
      codeUsage: 'Top-level switcher key that filters viewpoints.',
    },
    label: {
      isRequired: true,
      description: 'Module display label.',
      codeUsage: 'Header tab title for top-level module switcher.',
    },
  },
  viewpoints: {
    id: {
      isRequired: true,
      description: 'Unique viewpoint identifier (e.g. vp-default).',
      codeUsage: 'Primary key for active tab selection and lens state.',
    },
    moduleId: {
      isRequired: true,
      description: 'Parent module ID this viewpoint belongs to.',
      codeUsage: 'Foreign key filtering viewpoints under active module tab.',
    },
    label: {
      isRequired: true,
      description: 'Viewpoint title.',
      codeUsage: 'Tab bar label rendered in dashboard header.',
    },
  },
  edges: {
    id: {
      isRequired: true,
      description: 'Unique edge identifier (e.g. E-01).',
      codeUsage: 'Primary key for directed dependency edge between nodes.',
    },
    source: {
      isRequired: true,
      description: 'Predecessor node ID (dependency origin).',
      codeUsage: 'Used in React Flow & adjacency graph for dependency tracing.',
    },
    target: {
      isRequired: true,
      description: 'Successor node ID (dependency destination).',
      codeUsage: 'Used in React Flow & adjacency graph for successor tracing.',
    },
  },
  field_definitions: {
    key: {
      isRequired: true,
      description: 'Unique field key (e.g. host, schedule).',
      codeUsage: 'Primary key for EAV schema and node_field_values linkage.',
    },
    label: {
      isRequired: true,
      description: 'Display label for the field.',
      codeUsage: 'Rendered as label in details panel, list columns, and cards.',
    },
  },
  node_field_values: {
    nodeId: {
      isRequired: true,
      description: 'Target node ID.',
      codeUsage: 'Links field value to specific nav_nodes record.',
    },
    fieldKey: {
      isRequired: true,
      description: 'Field definition key.',
      codeUsage: 'Links value to corresponding field_definitions schema key.',
    },
  },
  node_logs: {
    nodeId: {
      isRequired: true,
      description: 'Associated node ID.',
      codeUsage: 'Foreign key to fetch execution log history for selected node.',
    },
    timestamp: {
      isRequired: true,
      description: 'Log timestamp string.',
      codeUsage: 'Displayed in log history tab of details panel.',
    },
    message: {
      isRequired: true,
      description: 'Log detail message.',
      codeUsage: 'Rendered in log execution feed.',
    },
  },
  calendars: {
    id: {
      isRequired: true,
      description: 'Calendar ID (e.g. cal-regular).',
      codeUsage: 'Primary key for calendar rule evaluation.',
    },
    name: {
      isRequired: true,
      description: 'Calendar name (e.g. REGULAR).',
      codeUsage: 'Referenced by schedule configs for workday/holiday calculation.',
    },
  },
  schedule_configs: {
    id: {
      isRequired: true,
      description: 'Schedule config ID (e.g. sched-daily).',
      codeUsage: 'Primary key for schedule config record.',
    },
    name: {
      isRequired: true,
      description: 'Schedule name (e.g. DAILY_PROD_RUN).',
      codeUsage: 'Referenced by node schedule fields for RBC date evaluation.',
    },
    configData: {
      isRequired: true,
      description: 'Schedule rule JSON configuration.',
      codeUsage: 'Parsed by schedule engine to evaluate if job runs today.',
    },
  },
  app_config: {
    key: {
      isRequired: true,
      description: 'Config key (e.g. status.completed).',
      codeUsage: 'System-wide configuration lookup key.',
    },
    category: {
      isRequired: true,
      description: 'Config category (e.g. status, layout).',
      codeUsage: 'Groups settings in app config manager.',
    },
    value: {
      isRequired: true,
      description: 'Config setting value (JSON or string).',
      codeUsage: 'Applied directly to layout dimensions, colors, or status mappings.',
    },
  },
}

function EditRecordModal({
  isOpen,
  onClose,
  tableName,
  columns,
  form,
  onChange,
  onSave,
  isCreate,
  rows,
  statusOptions = [],
}: {
  isOpen: boolean
  onClose: () => void
  tableName: string
  columns: string[]
  form: Record<string, unknown>
  onChange: (form: Record<string, unknown>) => void
  onSave: () => void
  isCreate: boolean
  rows: Record<string, unknown>[]
  statusOptions?: string[]
}) {
  return (
    <Modal
      open={isOpen}
      onOpenChange={(o) => !o && onClose()}
      title={isCreate ? `Create Record in ${tableName}` : `Edit Record in ${tableName}`}
      description="Provide values for the fields. Mandatory system fields are marked with *. Hover over the i icon for details on how each field is used."
      size="lg"
      fullScreen={false}
    >
      <div className="flex flex-col h-auto max-h-[calc(85vh-8rem)]">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0">
          <div className="grid grid-cols-2 gap-4">
            {columns.length === 0 ? (
              <p className="text-xs text-text-muted col-span-2">No columns found for this table.</p>
            ) : (
              columns.map((c) => {
                const help = FIELD_HELP_INFO[tableName]?.[c]
                const isRequired = help?.isRequired ?? (c === 'id' || c === 'key')
                const infoTooltip = help ? { description: help.description, codeUsage: help.codeUsage } : undefined

                // Dynamic status choices derived from app_config status definitions
                if (c === 'status') {
                  return (
                    <Select
                      key={c}
                      label={c}
                      isRequired={isRequired}
                      infoTooltip={infoTooltip}
                      value={String(form[c] ?? '')}
                      onChange={(e) => onChange({ ...form, [c]: e.target.value })}
                    >
                      <option value="">-- Select Status --</option>
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  )
                }

                // If it has strict options, show Select dropdown
                if (STRICT_OPTIONS[c]) {
                  return (
                    <Select
                      key={c}
                      label={c}
                      isRequired={isRequired}
                      infoTooltip={infoTooltip}
                      value={String(form[c] ?? '')}
                      onChange={(e) => onChange({ ...form, [c]: e.target.value })}
                    >
                      <option value="">-- Select --</option>
                      {STRICT_OPTIONS[c].map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  )
                }

                // Otherwise show Input with datalist for existing value suggestions
                const suggestions = Array.from(
                  new Set(
                    rows
                      .map((r) => String(r[c] ?? '').trim())
                      .filter(Boolean)
                  )
                ).sort()

                return (
                  <div key={c} className="flex flex-col">
                    <Input
                      label={c}
                      isRequired={isRequired}
                      infoTooltip={infoTooltip}
                      value={String(form[c] ?? '')}
                      onChange={(e) => onChange({ ...form, [c]: e.target.value })}
                      list={`datalist-${c}`}
                    />
                    {suggestions.length > 0 && (
                      <datalist id={`datalist-${c}`}>
                        {suggestions.map((val) => (
                          <option key={val} value={val} />
                        ))}
                      </datalist>
                    )}
                  </div>
                )
              })
            )}

            {/* Fallback for id if no columns exist yet */}
            {columns.length === 0 && (
              <Input
                label="id"
                value={String(form.id ?? '')}
                onChange={(e) => onChange({ ...form, id: e.target.value })}
              />
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-sunken p-3">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={onSave}>
            Save Record
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Sample CSV templates per table ─────────────────────────────────────
// Users can load these to see the expected column format.

const SAMPLE_CSV: Record<CrudTable, { headers: string[]; rows: string[][] }> = {
  modules: {
    headers: ['id', 'label'],
    rows: [
      ['architecture', 'Architecture'],
      ['data-ingestion', 'Data Ingestion'],
      ['reporting', 'Reporting'],
    ],
  },
  viewpoints: {
    headers: ['id', 'moduleId', 'label', 'description', 'folder', 'jobCount', 'scope', 'filterStatus', 'grouping', 'sortBy'],
    rows: [
      ['vp-default', 'architecture', 'Default', 'All jobs across all folders', '', '0', 'Public', 'All', 'Folder', 'label'],
      ['vp-critical', 'architecture', 'Critical Path', 'Critical path jobs only', '', '0', 'Public', 'All', 'Folder', 'label'],
    ],
  },
  nav_nodes: {
    headers: ['id', 'label', 'kind', 'parentId', 'nodeKind', 'status', 'host', 'runs', 'sortOrder'],
    rows: [
      ['F-ROOT', 'Banking Jobs', 'folder', '', '', '', '', '', '0'],
      ['F-01', 'Ingestion', 'folder', 'F-ROOT', '', '', '', '', '0'],
      ['J-01', 'Load Customer Data', 'item', 'F-01', 'Source', 'Completed', 'server-01', '142', '0'],
      ['J-02', 'Load Transaction Log', 'item', 'F-01', 'Source', 'Completed', 'server-01', '98', '0'],
      ['F-02', 'Processing', 'folder', 'F-ROOT', '', '', '', '', '0'],
      ['J-03', 'Validate Transactions', 'item', 'F-02', 'Process', 'Executing', 'server-02', '67', '0'],
    ],
  },
  edges: {
    headers: ['id', 'source', 'target'],
    rows: [
      ['E-01', 'J-01', 'J-03'],
      ['E-02', 'J-02', 'J-03'],
    ],
  },
  field_definitions: {
    headers: ['key', 'label', 'sectionTitle', 'role', 'format', 'sortOrder', 'isProtected', 'showOnCard', 'showInDetails', 'isActive'],
    rows: [
      ['id', 'Node ID', 'Identity', 'detail', 'mono', '1', '1', 'N', 'Y', '1'],
      ['label', 'Label', 'Identity', 'title', 'text', '2', '1', 'Y', 'Y', '1'],
      ['kind', 'Kind', 'Identity', 'subtitle', 'text', '3', '1', 'Y', 'Y', '1'],
      ['status', 'Status', 'State', 'detail', 'status', '6', '1', 'Y', 'Y', '1'],
      ['host', 'Host', 'Execution', 'detail', 'mono', '7', '0', 'Y', 'Y', '1'],
    ],
  },
  node_field_values: {
    headers: ['nodeId', 'fieldKey', 'fieldValue'],
    rows: [
      ['J-01', 'schedule', 'DAILY_PROD_RUN'],
      ['J-03', 'schedule', 'END_OF_MONTH_RUN'],
    ],
  },
  node_logs: {
    headers: ['id', 'nodeId', 'timestamp', 'level', 'message'],
    rows: [
      ['1', 'J-03', '2026-08-22 10:30:00', 'INFO', 'Execution started'],
      ['2', 'J-03', '2026-08-22 10:35:12', 'INFO', 'Processed 1,204 records'],
    ],
  },
  calendars: {
    headers: ['id', 'name', 'workdays', 'holidays'],
    rows: [
      ['cal-regular', 'REGULAR', '[1,2,3,4,5]', '["2026-01-01","2026-12-25"]'],
      ['cal-mfd9h', 'MFD9H', '[1,2,3,4,5,6]', '["2026-01-01","2026-12-25"]'],
    ],
  },
  schedule_configs: {
    headers: ['id', 'name', 'configData', 'lastEvaluatedDate', 'isScheduledToday'],
    rows: [
      ['sched-daily', 'DAILY_PROD_RUN', '{"WEEKDAYS":["1","2","3","4","5"],"MONTHS":["ALL"],"ACTIVITY_PERIOD":{"MODE":"ALWAYS"}}', '', 'N/A'],
    ],
  },
  app_config: {
    headers: ['key', 'category', 'label', 'value', 'sortOrder'],
    rows: [
      ['status.completed', 'status', 'Completed', '{"hex":"#22c55e","aliases":["ok","completed","success"]}', '1'],
      ['status.executing', 'status', 'Executing', '{"hex":"#f97316","aliases":["executing","running"]}', '2'],
      ['status.failed', 'status', 'Failed', '{"hex":"#f43f5e","aliases":["failed","error"]}', '3'],
    ],
  },
}

async function buildDynamicSampleCSV(table: CrudTable): Promise<string> {
  try {
    const dbRows = await fetchTableRows<Record<string, unknown>>(table)
    let fieldDefKeys: string[] = []
    if (table === 'nav_nodes') {
      try {
        const fdefs = await fetchTableRows<Record<string, unknown>>('field_definitions')
        fieldDefKeys = fdefs.map((f) => String(f.key ?? '').trim()).filter((k) => k && k !== 'data')
      } catch {
        /* ignore */
      }
    }

    const headerSet = new Set<string>()
    const baseCols = TABLE_COLUMNS[table] ?? []
    for (const c of baseCols) {
      if (table === 'nav_nodes' && c === 'data') continue
      headerSet.add(c)
    }
    if (table === 'nav_nodes') {
      for (const k of fieldDefKeys) {
        const normKey = normalizeKey(k)
        if (!headerSet.has(normKey)) {
          headerSet.add(normKey)
        }
      }
    }
    for (const r of dbRows) {
      for (const k of Object.keys(r)) {
        if (table === 'nav_nodes' && k === 'data') continue
        const normKey = normalizeKey(k)
        if (!headerSet.has(normKey)) {
          headerSet.add(normKey)
        }
      }
    }

    const headers = Array.from(headerSet)
    if (headers.length === 0) return buildStaticFallbackSampleCSV(table)

    if (dbRows.length > 0) {
      const sampleRows = dbRows.slice(0, 10).map((row) =>
        headers.map((h) => {
          const val = row[h]
          if (val === null || val === undefined) return ''
          if (typeof val === 'object') return JSON.stringify(val)
          return String(val)
        })
      )

      const headerLine = headers.join(',')
      const dataLines = sampleRows
        .map((r) =>
          r
            .map((cell) => {
              if (cell && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                return `"${cell.replace(/"/g, '""')}"`
              }
              return cell ?? ''
            })
            .join(',')
        )
        .join('\n')

      return `${headerLine}\n${dataLines}`
    }

    const fallback = SAMPLE_CSV[table]
    if (fallback) {
      const fallbackRows = fallback.rows.map((row) =>
        headers.map((h) => {
          const idx = fallback.headers.indexOf(h)
          if (idx !== -1 && row[idx] !== undefined) return row[idx]
          return ''
        })
      )
      const headerLine = headers.join(',')
      const dataLines = fallbackRows
        .map((r) =>
          r
            .map((cell) => {
              if (cell && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                return `"${cell.replace(/"/g, '""')}"`
              }
              return cell ?? ''
            })
            .join(',')
        )
        .join('\n')

      return `${headerLine}\n${dataLines}`
    }

    return headers.join(',')
  } catch {
    return buildStaticFallbackSampleCSV(table)
  }
}

function buildStaticFallbackSampleCSV(table: CrudTable): string {
  const sample = SAMPLE_CSV[table]
  if (!sample) return ''
  const headerLine = sample.headers.join(',')
  const dataLines = sample.rows.map((r) => r.map((cell) => {
    if (cell && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell ?? ''
  }).join(',')).join('\n')
  return `${headerLine}\n${dataLines}`
}

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── CSV import tab ─────────────────────────────────────────────────────────

function CsvImportTab({ onDataChanged }: { onDataChanged: () => void }) {
  const [targetTable, setTargetTable] = useState<CrudTable>('nav_nodes')
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sampleCSV, setSampleCSV] = useState<string>('')
  const [loadingSample, setLoadingSample] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let isMounted = true
    setLoadingSample(true)
    buildDynamicSampleCSV(targetTable).then((csv) => {
      if (isMounted) {
        setSampleCSV(csv)
        setLoadingSample(false)
      }
    })
    return () => { isMounted = false }
  }, [targetTable])

  const hasSample = sampleCSV.length > 0

  const loadSample = () => {
    const csv = sampleCSV
    const rows = parseCSV(csv)
    if (rows.length === 0) return
    const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim())
    const data = rows.slice(1).filter((r) => r.some((c) => c !== '')).map((r) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
      return obj
    })
    setParsedHeaders(headers)
    setParsedRows(data)
    setFileName(`sample_${targetTable}.csv`)
    toast.success(`Loaded sample data for ${targetTable} — ${data.length} rows. Edit or import directly.`)
  }

  const onCopySample = async () => {
    try {
      await navigator.clipboard.writeText(sampleCSV)
      setCopied(true)
      toast.success('Sample CSV copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const onDownloadSample = () => {
    downloadCSV(`sample_${targetTable}.csv`, sampleCSV)
  }

  const onFile = async (file: File) => {
    setFileName(file.name)
    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) {
      toast.error('CSV is empty')
      return
    }
    const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim())
    const data = rows.slice(1).filter((r) => r.some((c) => c !== '')).map((r) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
      return obj
    })
    setParsedHeaders(headers)
    setParsedRows(data)
    toast.success(`Parsed ${data.length} rows × ${headers.length} columns`)
  }

  const onImport = async () => {
    if (parsedRows.length === 0) {
      toast.error('Nothing to import')
      return
    }
    setImporting(true)
    try {
      const result = await bulkCreateRows(targetTable, parsedRows as unknown as Record<string, unknown>[])
      toast.success(`Imported ${result.count} rows into ${targetTable}`)
      onDataChanged()
      setParsedRows([])
      setParsedHeaders([])
      setFileName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-4 space-y-3 max-w-5xl">
      <div className="grid grid-cols-2 gap-3">
        <Select label="Target Table" value={targetTable} onChange={(e) => { setTargetTable(e.target.value as CrudTable); setParsedRows([]); setParsedHeaders([]); setFileName('') }}>
          {TABLES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </Select>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted">CSV File</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
            className="text-xs file:mr-2 file:h-[var(--control-h)] file:px-2 file:text-xs file:bg-surface file:text-text file:border file:border-border-strong file:hover:bg-surface-hover file:cursor-pointer"
          />
        </div>
      </div>

      {/* Sample data actions */}
      <div className="flex items-center gap-2 border border-border rounded p-2.5 bg-surface-sunken/50">
        <span className="text-[11px] font-medium text-text-muted whitespace-nowrap">Sample data:</span>
        <Button size="sm" variant="primary" onClick={loadSample} disabled={!hasSample}>
          <CheckCircle2 size={12} strokeWidth={1.5} /> Load Sample
        </Button>
        <Button size="sm" variant="secondary" onClick={onDownloadSample} disabled={!hasSample}>
          <FileDown size={12} strokeWidth={1.5} /> Download .csv
        </Button>
        <Button size="sm" variant="secondary" onClick={onCopySample} disabled={!hasSample || copied}>
          {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <div className="flex-1" />
        <span className="text-[10px] text-text-muted italic">Loads example rows so you can see the expected format</span>
      </div>

      {fileName && (
        <div className="text-xs text-text-muted">
          Loaded: <strong className="text-text">{fileName}</strong> ({parsedRows.length} rows × {parsedHeaders.length} cols)
        </div>
      )}

      {parsedRows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="label-caps">Preview (first 50 rows)</span>
            <Button size="sm" variant="primary" onClick={onImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${parsedRows.length} rows`}
            </Button>
          </div>
          <div className="border border-border overflow-auto max-h-80 custom-scrollbar">
            <table className="min-w-full w-max text-xs border-collapse">
              <thead className="bg-surface-sunken sticky top-0 z-10">
                <tr>
                  {parsedHeaders.map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-medium text-text-muted border-r border-border whitespace-nowrap bg-surface-sunken">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-border hover:bg-surface-hover">
                    {parsedHeaders.map((h) => (
                      <td key={h} className="px-3 py-1 border-r border-border max-w-xs truncate text-text font-mono text-[11px] whitespace-nowrap" title={row[h]}>{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 50 && (
            <div className="text-xs text-text-muted text-center">
              … and {parsedRows.length - 50} more rows
            </div>
          )}
        </>
      )}
    </div>
  )
}

// RFC 4180 CSV parser
function parseCSV(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]
    if (inQuotes) {
      if (char === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(field)
        field = ''
      } else if (char === '\r' || char === '\n') {
        if (field !== '' || row.length > 0) {
          row.push(field)
          rows.push(row)
          row = []
          field = ''
        }
        if (char === '\r' && cleaned[i + 1] === '\n') i++
      } else {
        field += char
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// ─── Field guide tab ────────────────────────────────────────────────────────

function FieldGuideTab() {
  return (
    <div className="p-6 max-w-3xl space-y-6 text-sm text-text">
      <section>
        <h3 className="label-caps mb-2">Field Roles</h3>
        <p className="text-xs text-text-secondary mb-2">
          Fields in <code className="font-mono bg-surface-sunken px-1">field_definitions</code> have a role that determines where they appear:
        </p>
        <ul className="text-xs space-y-1.5 border border-border p-3">
          <li><code className="font-mono bg-surface-sunken px-1">title</code> — the one prominent line on a node card.</li>
          <li><code className="font-mono bg-surface-sunken px-1">subtitle</code> — small uppercase line under the title.</li>
          <li><code className="font-mono bg-surface-sunken px-1">detail</code> — key/value rows revealed by the expand toggle.</li>
          <li><code className="font-mono bg-surface-sunken px-1">none</code> — stored but never shown on the card.</li>
        </ul>
      </section>

      <section>
        <h3 className="label-caps mb-2">Field Formats</h3>
        <ul className="text-xs space-y-1.5 border border-border p-3">
          <li><code className="font-mono bg-surface-sunken px-1">text</code> — default string display.</li>
          <li><code className="font-mono bg-surface-sunken px-1">mono</code> — monospace font for IDs, hosts, etc.</li>
          <li><code className="font-mono bg-surface-sunken px-1">status</code> — colored display via app config status map.</li>
        </ul>
      </section>

      <section>
        <h3 className="label-caps mb-2">EAV Storage</h3>
        <p className="text-xs text-text-secondary mb-2">
          The schema is split into two tables for flexibility:
        </p>
        <ul className="text-xs space-y-1.5 border border-border p-3">
          <li><code className="font-mono bg-surface-sunken px-1">field_definitions</code> — defines what fields exist (key, label, role, format).</li>
          <li><code className="font-mono bg-surface-sunken px-1">node_field_values</code> — stores per-node values keyed by <code className="font-mono bg-surface-sunken px-1">(nodeId, fieldKey)</code>.</li>
          <li>Adding a new field is a single insert into <code className="font-mono bg-surface-sunken px-1">field_definitions</code> — it appears automatically on cards, the details panel, and the list view columns.</li>
        </ul>
      </section>

      <section>
        <h3 className="label-caps mb-2">Show Flags</h3>
        <ul className="text-xs space-y-1.5 border border-border p-3">
          <li><code className="font-mono bg-surface-sunken px-1">show_on_card</code> — <strong>Y</strong> or <strong>N</strong>. Controls whether the field appears on canvas node cards.</li>
          <li><code className="font-mono bg-surface-sunken px-1">show_in_details</code> — <strong>Y</strong> or <strong>N</strong>. Controls whether the field appears in the details panel.</li>
        </ul>
      </section>

      <section>
        <h3 className="label-caps mb-2">Protected Fields</h3>
        <p className="text-xs text-text-secondary">
          Fields with <code className="font-mono bg-surface-sunken px-1">is_protected = 1</code> cannot be deleted. These are core system fields
          (id, label, kind, status, etc.) that the application depends on.
        </p>
      </section>
    </div>
  )
}