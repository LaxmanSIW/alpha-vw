/**
 * Field resolution and formatting.
 *
 * Status display reads from the live app config (Zustand) so adding or
 * renaming a status requires only a DB edit — no code changes here.
 */

import type { CSSProperties } from 'react'
import type { Node } from '@xyflow/react'
import { resolveStatus } from './app-config'
import { normalizeKey } from './crud-schemas'

export type FieldFormat = 'text' | 'mono' | 'status'

export interface FieldDef {
  key: string
  label: string
  sectionTitle?: string
  format?: FieldFormat
  isProtected?: boolean
  showOnCard?: 'Y' | 'N' | boolean | number
  showInDetails?: 'Y' | 'N' | boolean | number
  role?: 'title' | 'subtitle' | 'detail' | 'none'
  sortOrder?: number
}

export function formatFieldValue(value: unknown, format: FieldFormat = 'text'): string {
  if (value === null || value === undefined || value === '') return '--'
  if (format === 'status') {
    return resolveStatus(value).label
  }
  return String(value)
}

/** Returns the hex color string for a status value. Always returns a color. */
export function statusHex(value: unknown): string {
  return resolveStatus(value).hex
}

/** Inline style object for the status text (colored text, bold). */
export function statusTextStyle(value: unknown): CSSProperties {
  const hex = resolveStatus(value).hex
  return { color: hex, fontWeight: 600 }
}

/** Inline style object for a status badge pill. */
export function statusBadgeStyle(value: unknown): CSSProperties {
  const hex = resolveStatus(value).hex
  return {
    backgroundColor: `${hex}28`,
    color: hex,
    border: `1px solid ${hex}66`,
  }
}

/** Reserved keys resolved from the node itself rather than node.data. */
export const RESERVED_KEYS = {
  id: '__id',
  position: '__position',
} as const

/** Resolves a field against a node, including the reserved node-level keys. */
export function resolveField(node: Node, field: FieldDef): string {
  if (field.key === RESERVED_KEYS.id) return node.id
  if (field.key === RESERVED_KEYS.position) {
    return `${Math.round(node.position.x)}, ${Math.round(node.position.y)}`
  }
  const data = (node.data as Record<string, unknown>) ?? {}
  const val = data[field.key] ?? data[normalizeKey(field.key)]
  return formatFieldValue(val, field.format)
}

export function rawFieldValue(node: Node, field: FieldDef): unknown {
  if (field.key === RESERVED_KEYS.id) return node.id
  const data = (node.data as Record<string, unknown>) ?? {}
  if (field.key in data) return data[field.key]
  const norm = normalizeKey(field.key)
  if (norm in data) return data[norm]
  return undefined
}

/** Whether a value should be shown. 'N', 'NO', 'FALSE', '0' are all hidden. */
export function isShowable(val: unknown): boolean {
  if (val === undefined || val === null || val === '') return true
  const str = String(val).trim().toUpperCase()
  return str !== 'N' && str !== 'NO' && str !== 'FALSE' && str !== '0'
}
