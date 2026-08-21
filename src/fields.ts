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
  completed: 'Completed',
  'ended ok': 'Completed',
  success: 'Completed',

  executing: 'Executing',
  execution: 'Executing',
  running: 'Executing',

  'wait for event': 'Wait for Event',
  'wait event': 'Wait for Event',
  waiting: 'Wait for Event',
  warning: 'Wait for Event',
  hold: 'Wait for Event',

  failed: 'Failed',
  danger: 'Failed',
  error: 'Failed',
  'ended notok': 'Failed',
  notok: 'Failed',
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
  if (!value) return 'text-slate-400 font-semibold'
  const s = String(value).toLowerCase().trim()
  if (s === 'executing' || s === 'execution' || s === 'running') return 'text-orange-400 font-semibold'
  if (s === 'wait for event' || s === 'wait event' || s === 'waiting' || s === 'warning' || s === 'hold') return 'text-slate-400 font-semibold'
  if (s === 'completed' || s === 'ok' || s === 'ended ok' || s === 'success') return 'text-emerald-400 font-semibold'
  if (s === 'failed' || s === 'danger' || s === 'error' || s === 'ended notok' || s === 'notok') return 'text-rose-500 font-semibold'
  return 'text-slate-400 font-semibold'
}

export function statusColorClass(value: unknown): string {
  if (!value) return 'bg-slate-400'
  const s = String(value).toLowerCase().trim()
  if (s === 'executing' || s === 'execution' || s === 'running') return 'bg-orange-500'
  if (s === 'wait for event' || s === 'wait event' || s === 'waiting' || s === 'warning' || s === 'hold') return 'bg-slate-400'
  if (s === 'completed' || s === 'ok' || s === 'ended ok' || s === 'success') return 'bg-emerald-500'
  if (s === 'failed' || s === 'danger' || s === 'error' || s === 'ended notok' || s === 'notok') return 'bg-rose-500'
  return 'bg-slate-400'
}

export function statusBadgeClass(value: unknown): string {
  if (!value) return 'bg-slate-500/20 text-slate-300 border-slate-500/40'
  const s = String(value).toLowerCase().trim()
  if (s === 'executing' || s === 'execution' || s === 'running') return 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
  if (s === 'wait for event' || s === 'wait event' || s === 'waiting' || s === 'warning' || s === 'hold') return 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
  if (s === 'completed' || s === 'ok' || s === 'ended ok' || s === 'success') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
  if (s === 'failed' || s === 'danger' || s === 'error' || s === 'ended notok' || s === 'notok') return 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
  return 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
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
