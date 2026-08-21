import type { CSSProperties } from 'react'
import type { Node } from '@xyflow/react'
import { RESERVED_KEYS, type FieldDef, type FieldFormat } from './config/viewConfig'
import { resolveStatus } from './config/appConfig'

/**
 * Shared field resolution and formatting.
 *
 * Status display reads from the live app config so adding or renaming a status
 * requires only a DB edit — no code changes here.
 */

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

/**
 * Inline style object for the status text (colored text, bold).
 * Use as: style={statusTextStyle(node.status)}
 */
export function statusTextStyle(value: unknown): CSSProperties {
  const hex = resolveStatus(value).hex
  return { color: hex, fontWeight: 600 }
}

/**
 * Inline style object for a status badge pill
 * (semi-transparent background, colored border + text).
 */
export function statusBadgeStyle(value: unknown): CSSProperties {
  const hex = resolveStatus(value).hex
  return {
    backgroundColor: `${hex}28`,   // ~16% opacity
    color: hex,
    border: `1px solid ${hex}66`,  // ~40% opacity
  }
}

/** @deprecated Use statusHex() with inline style instead. */
export function statusColorClass(_value: unknown): string {
  return ''
}

/** @deprecated Use statusTextStyle() with inline style instead. */
export function statusToneClass(_value: unknown): string {
  return ''
}

/** @deprecated Use statusBadgeStyle() with inline style instead. */
export function statusBadgeClass(_value: unknown): string {
  return ''
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
