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
  ok: 'Completed',
  warning: 'Wait for Event',
  danger: 'Failed',
  completed: 'Completed',
  executing: 'Executing',
  'wait for event': 'Wait for Event',
  failed: 'Failed',
}

export function formatFieldValue(value: unknown, format: FieldFormat = 'text'): string {
  if (value === null || value === undefined || value === '') return '--'
  if (format === 'status') {
    const key = String(value).toLowerCase().trim()
    return STATUS_LABELS[key] ?? String(value)
  }
  return String(value)
}

export function statusToneClass(value: unknown): string {
  if (!value) return 'text-text-secondary'
  const s = String(value).toLowerCase().trim()
  if (s === 'completed' || s === 'ok') return 'text-success-fg font-semibold'
  if (s === 'executing') return 'text-primary font-semibold'
  if (s === 'wait for event' || s === 'warning') return 'text-warning-fg font-semibold'
  if (s === 'failed' || s === 'danger') return 'text-danger-fg font-semibold'
  return 'text-text-secondary'
}

export function statusColorClass(value: unknown): string {
  if (!value) return 'bg-text-muted'
  const s = String(value).toLowerCase().trim()
  if (s === 'failed' || s === 'danger') return 'bg-danger-fg'
  if (s === 'executing') return 'bg-primary'
  if (s === 'wait for event' || s === 'warning') return 'bg-warning-fg'
  if (s === 'completed' || s === 'ok') return 'bg-success-fg'
  return 'bg-text-muted'
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
