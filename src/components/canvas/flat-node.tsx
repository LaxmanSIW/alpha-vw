'use client'

import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import {
  getRelationColor,
  getRelationOutlineWidth,
  type RelationKind,
} from '@/lib/graph'
import {
  NODE_FIELDS,
  STATUS_KEY,
} from '@/lib/view-config'
import {
  RESERVED_KEYS,
  formatFieldValue,
  statusHex,
  statusTextStyle,
  isShowable,
} from '@/lib/fields'
import { useAppConfig } from '@/lib/app-config'
import { useDashboardStore } from '@/lib/stores/dashboard-store'
import type { FieldDefinition } from '@/lib/types'

export interface FlatNodeData extends Record<string, unknown> {
  label: string
  kind: string
  status: string
  expanded?: boolean
  relation?: RelationKind
}

const TITLE_FIELD = NODE_FIELDS.find((f) => f.role === 'title')
const SUBTITLE_FIELD = NODE_FIELDS.find((f) => f.role === 'subtitle')
const DETAIL_FIELDS = NODE_FIELDS.filter((f) => f.role === 'detail')

interface FlatNodeProps extends NodeProps {
  data: FlatNodeData
}

/**
 * Node box. Content comes from NODE_FIELDS in view-config, so which lines
 * appear here is configuration rather than markup.
 *
 * Optimizations vs original:
 *   - React.memo wraps the component (avoids re-rendering unchanged nodes)
 *   - useMemo deps are FIXED: dynamicFieldDefs is the only real input. The
 *     original had `node` in deps, which is a new ref every render.
 *   - getLayout() is read from Zustand selector (re-renders when config changes)
 */

function FlatNodeInner({ id, data, selected }: FlatNodeProps) {
  const node = data as FlatNodeData
  const { expanded = false, relation = 'none' } = node

  // Subscribe to layout config and dashboard store field definitions
  const layout = useAppConfig((s) => s.config.layout)
  const storeFieldDefs = useDashboardStore((s) => s.fieldDefinitions)

  const stripe = statusHex(node[STATUS_KEY])

  const fieldDefs = useMemo(() => {
    const source =
      storeFieldDefs.length > 0
        ? storeFieldDefs
        : (((node as Record<string, unknown>).fieldDefinitions ?? []) as FieldDefinition[])
    return source.filter((f) => f.isActive !== 0 && f.isActive !== false)
  }, [storeFieldDefs, node])

  // Memoize field filters — react dynamically to added/deleted field definitions
  const activeDetailFields = useMemo(() => {
    if (fieldDefs.length > 0) {
      return fieldDefs
        .filter((f) => {
          const role = f.role || 'detail'
          if (role === 'title' || role === 'subtitle' || role === 'none') return false
          return isShowable(f.showOnCard)
        })
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    }
    return DETAIL_FIELDS.filter((field) => isShowable(field.showOnCard))
  }, [fieldDefs])

  const titleFields = useMemo(() => {
    if (fieldDefs.length > 0) {
      const match = fieldDefs.filter((f) => f.role === 'title' && isShowable(f.showOnCard))
      if (match.length > 0) return match
    }
    return TITLE_FIELD ? [TITLE_FIELD] : []
  }, [fieldDefs])

  const subtitleFields = useMemo(() => {
    if (fieldDefs.length > 0) {
      const match = fieldDefs.filter((f) => f.role === 'subtitle' && isShowable(f.showOnCard))
      if (match.length > 0) return match
    }
    return SUBTITLE_FIELD ? [SUBTITLE_FIELD] : []
  }, [fieldDefs])

  const isRelated = relation !== 'none'
  const relationColor = isRelated ? getRelationColor(relation as Exclude<RelationKind, 'none'>) : undefined
  const outlineWidth = isRelated ? getRelationOutlineWidth() : 0

  function valueOf(field: { key: string; format?: 'text' | 'mono' | 'status' }): string {
    if (field.key === RESERVED_KEYS.id || field.key === 'id') return id
    const val = node[field.key]
    return formatFieldValue(val, field.format)
  }

  return (
    <div
      className={[
        'flex items-stretch border bg-surface overflow-hidden',
        isRelated ? '' : 'border-border-strong',
        selected && !isRelated ? 'border-primary' : '',
      ].join(' ')}
      style={{
        width: layout.nodeWidth,
        ...(expanded
          ? { minHeight: layout.nodeHeight }
          : { height: layout.nodeCollapsedHeight, overflow: 'hidden' }),
        ...(relationColor
          ? { borderColor: relationColor, outline: `${outlineWidth}px solid ${relationColor}` }
          : {}),
      }}
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
            {activeDetailFields.map((field: { key: string; label: string; format?: 'text' | 'mono' | 'status' }) => (
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

const FlatNode = memo(FlatNodeInner)
export default FlatNode
