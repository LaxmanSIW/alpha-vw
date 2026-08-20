import { Handle, Position, type NodeProps } from '@xyflow/react'
import { RELATION_COLOR, type RelationKind } from '../graph'
import { NODE_FIELDS, STATUS_KEY, RESERVED_KEYS, type NodeFieldDef } from '../config/viewConfig'
import { formatFieldValue, statusToneClass } from '../fields'

export interface FlatNodeData extends Record<string, unknown> {
  label: string
  kind: string
  status: 'ok' | 'warning' | 'danger'
  expanded?: boolean
  relation?: RelationKind
}

const TITLE_FIELD = NODE_FIELDS.find((f) => f.role === 'title')
const SUBTITLE_FIELD = NODE_FIELDS.find((f) => f.role === 'subtitle')
const DETAIL_FIELDS = NODE_FIELDS.filter((f) => f.role === 'detail')

/**
 * Node box. Content comes from NODE_FIELDS in viewConfig, so which lines appear
 * here is configuration rather than markup.
 *
 * Relation is signalled by the outline colour alone -- no label bands. The
 * legend carries the meaning, which keeps the box height identical whether or
 * not something is selected. That matters for more than tidiness: a box that
 * grew when selected would shift the layout under the cursor.
 */
function FlatNode({ id, data, selected }: NodeProps) {
  const node = data as FlatNodeData
  const { expanded = false, relation = 'none' } = node

  const status = node[STATUS_KEY] as FlatNodeData['status']
  const stripe =
    status === 'danger' ? 'bg-danger-fg' : status === 'warning' ? 'bg-warning-fg' : 'bg-success-fg'

  const isRelated = relation !== 'none'
  const relationColor = isRelated ? RELATION_COLOR[relation] : undefined

  function valueOf(field: NodeFieldDef): string {
    if (field.key === RESERVED_KEYS.id) return id
    return formatFieldValue(node[field.key], field.format)
  }

  return (
    <div
      className={[
        'fed-node flex w-44 items-stretch border bg-surface',
        isRelated ? '' : 'border-border-strong',
        selected && !isRelated ? 'border-primary' : '',
      ].join(' ')}
      style={
        relationColor
          ? // Border plus a same-colour outline reads as a 2px emphasis without
            // changing the box's footprint, so nothing reflows on selection.
            { borderColor: relationColor, outline: `1px solid ${relationColor}` }
          : undefined
      }
    >
      <span aria-hidden="true" className={`w-1 shrink-0 ${stripe}`} />

      <div className="min-w-0 flex-1">
        <div className="px-2 py-1.5">
          {TITLE_FIELD && (
            <div className="truncate text-sm font-medium text-text">{valueOf(TITLE_FIELD)}</div>
          )}
          {SUBTITLE_FIELD && <div className="label-caps truncate">{valueOf(SUBTITLE_FIELD)}</div>}
        </div>

        {expanded && DETAIL_FIELDS.length > 0 && (
          <dl className="divide-y divide-border border-t border-border">
            {DETAIL_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-baseline justify-between gap-2 px-2 py-0.5"
              >
                <dt className="shrink-0 text-xs text-text-muted">{field.label}</dt>
                <dd
                  className={[
                    'min-w-0 truncate text-xs',
                    field.format === 'mono' ? 'font-mono' : '',
                    field.format === 'status'
                      ? statusToneClass(node[field.key])
                      : 'text-text-secondary',
                  ].join(' ')}
                >
                  {valueOf(field)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Read-only canvas: handles anchor edges but are not connectable. */}
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  )
}

export default FlatNode
