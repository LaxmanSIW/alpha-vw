import type { Node } from '@xyflow/react'
import { RESERVED_KEYS, type FieldDef, type FieldFormat } from './config/viewConfig'

/**
 * Shared field resolution and formatting.
 *
 * The node box and the details pane read the same config, so they must also read
 * values the same way -- otherwise "Status" could render as `ok` in one place and
 * `Healthy` in the other, and nobody would trust either.
 */

const STATUS_LABELS: Record<string, string> = {
  ok: 'Healthy',
  warning: 'Degraded',
  danger: 'Unreachable',
}

export function formatFieldValue(value: unknown, format: FieldFormat = 'text'): string {
  if (value === null || value === undefined || value === '') return '--'
  if (format === 'status') return STATUS_LABELS[String(value)] ?? String(value)
  return String(value)
}

export function statusToneClass(value: unknown): string {
  if (value === 'danger') return 'text-danger-fg'
  if (value === 'warning') return 'text-warning-fg'
  if (value === 'ok') return 'text-success-fg'
  return 'text-text-secondary'
}

/** Resolves a field against a node, including the reserved node-level keys. */
export function resolveField(node: Node, field: FieldDef): string {
  if (field.key === RESERVED_KEYS.id) return node.id
  if (field.key === RESERVED_KEYS.position) {
    return `${Math.round(node.position.x)}, ${Math.round(node.position.y)}`
  }
  return formatFieldValue((node.data as Record<string, unknown>)[field.key], field.format)
}

export function rawFieldValue(node: Node, field: FieldDef): unknown {
  if (field.key === RESERVED_KEYS.id) return node.id
  return (node.data as Record<string, unknown>)[field.key]
}
