import { useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getRelationColor, getRelationOutlineWidth, type RelationKind } from '../graph'
import { NODE_FIELDS, STATUS_KEY, RESERVED_KEYS } from '../config/viewConfig'
import { formatFieldValue, statusHex, statusTextStyle } from '../fields'
import type { FieldDefinition } from '../types'

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
function isShowable(val: unknown): boolean {
  if (val === undefined || val === null || val === '') return true
  const str = String(val).trim().toUpperCase()
  return str !== 'N' && str !== 'NO' && str !== 'FALSE' && str !== '0'
}

function FlatNode({ id, data, selected }: NodeProps) {
  const node = data as FlatNodeData
  const { expanded = false, relation = 'none' } = node

  const stripe = statusHex(node[STATUS_KEY])

  const dynamicFieldDefs = ((node as Record<string, unknown>).fieldDefinitions ?? []) as FieldDefinition[]

  const activeDetailFields = useMemo(() => {
    if (dynamicFieldDefs.length > 0) {
      return dynamicFieldDefs
        .filter((f) => {
          const role = f.role || 'detail'
          if (role === 'title' || role === 'subtitle' || role === 'none') return false
          const showOnCard = f.showOnCard ?? (f as unknown as Record<string, unknown>).show_on_card
          return isShowable(showOnCard)
        })
        .map((f) => ({
          key: f.key,
          label: f.label,
          role: 'detail' as const,
          format: f.format,
          showOnCard: f.showOnCard,
        }))
    }
    return DETAIL_FIELDS.filter((field) => isShowable(field.showOnCard))
  }, [dynamicFieldDefs, node])

  const isRelated = relation !== 'none'
  const relationColor = isRelated ? getRelationColor(relation as Exclude<RelationKind, 'none'>) : undefined
  const outlineWidth = isRelated ? getRelationOutlineWidth() : 0

  function valueOf(field: { key: string; format?: string }): string {
    if (field.key === RESERVED_KEYS.id || field.key === 'id') return id
    const val = node[field.key] !== undefined ? node[field.key] : (node as Record<string, unknown>)[field.key]
    return formatFieldValue(val, field.format as any)
  }

  const titleFields = useMemo(() => {
    if (dynamicFieldDefs.length > 0) {
      return dynamicFieldDefs.filter(
        (f) =>
          f.role === 'title' &&
          isShowable(f.showOnCard ?? (f as unknown as Record<string, unknown>).show_on_card),
      )
    }
    return TITLE_FIELD ? [TITLE_FIELD] : []
  }, [dynamicFieldDefs])

  const subtitleFields = useMemo(() => {
    if (dynamicFieldDefs.length > 0) {
      return dynamicFieldDefs.filter(
        (f) =>
          f.role === 'subtitle' &&
          isShowable(f.showOnCard ?? (f as unknown as Record<string, unknown>).show_on_card),
      )
    }
    return SUBTITLE_FIELD ? [SUBTITLE_FIELD] : []
  }, [dynamicFieldDefs])

  return (
    <div
      className={[
        'fed-node flex w-[190px] items-stretch border bg-surface',
        isRelated ? '' : 'border-border-strong',
        selected && !isRelated ? 'border-primary' : '',
      ].join(' ')}
      style={
        relationColor
          ? { borderColor: relationColor, outline: `${outlineWidth}px solid ${relationColor}` }
          : undefined
      }
    >
      <span aria-hidden="true" className="w-1 shrink-0" style={{ backgroundColor: stripe }} />

      <div className="min-w-0 flex-1">
        <div className="px-2 py-1.5">
          {titleFields.length > 0 && (
            <div className="truncate text-sm font-medium text-text">
              {titleFields.map((f) => valueOf(f)).join(' · ')}
            </div>
          )}
          {subtitleFields.length > 0 && (
            <div className="label-caps truncate">
              {subtitleFields.map((f) => valueOf(f)).join(' • ')}
            </div>
          )}
        </div>

        {expanded && activeDetailFields.length > 0 && (
          <dl className="divide-y divide-border border-t border-border">
            {activeDetailFields.map((field: { key: string; label: string; format?: string }) => (
              <div
                key={field.key}
                className="flex items-baseline justify-between gap-2 px-2 py-0.5"
              >
                <dt className="shrink-0 text-xs text-text-muted">{field.label}</dt>
                <dd
                  className={[
                    'min-w-0 truncate text-xs',
                    field.format === 'mono' ? 'font-mono text-text-secondary' : 'text-text-secondary',
                  ].join(' ')}
                  style={field.format === 'status' ? statusTextStyle(node[field.key]) : undefined}
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
