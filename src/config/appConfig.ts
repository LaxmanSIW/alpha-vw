/**
 * appConfig.ts — runtime configuration loaded from app_config DB table.
 *
 * A single module-level ref holds the active config so every component reads
 * the same values without prop drilling. Call setAppConfig() once on load and
 * on every refresh; all consumers get the new values immediately.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface StatusDef {
  /** DB primary key, e.g. 'status.completed' */
  key: string
  /** Human label, e.g. 'Completed' */
  label: string
  /** Hex color string, e.g. '#22c55e' */
  hex: string
  /** All raw status strings that resolve to this tone (lowercase) */
  aliases: string[]
  sortOrder: number
}

export interface LayoutConfig {
  vGap: number
  hGap: number
  nodeWidth: number
  nodeHeight: number
  nodeCollapsedHeight: number
}

export interface RelationConfig {
  selectedColor: string
  predColor: string
  succColor: string
  outlineWidth: number
}

export interface BusinessConfig {
  /** Hour (0-23) at which the business day rolls over to the next calendar date. */
  dayStartHour: number
  /** Minute (0-59) at which the business day rolls over. */
  dayStartMinute: number
}

export interface AppConfig {
  statuses: StatusDef[]
  layout: LayoutConfig
  relation: RelationConfig
  business: BusinessConfig
}

// ── Defaults (match current hardcoded values exactly) ────────────────────────

export const DEFAULT_APP_CONFIG: AppConfig = {
  statuses: [
    { key: 'status.completed', label: 'Completed',      hex: '#22c55e', aliases: ['ok', 'completed', 'ended ok', 'success'],                       sortOrder: 1 },
    { key: 'status.executing', label: 'Executing',      hex: '#f97316', aliases: ['executing', 'execution', 'running'],                             sortOrder: 2 },
    { key: 'status.wait',      label: 'Wait for Event', hex: '#94a3b8', aliases: ['wait for event', 'wait event', 'waiting', 'warning', 'hold'],   sortOrder: 3 },
    { key: 'status.failed',    label: 'Failed',         hex: '#f43f5e', aliases: ['failed', 'danger', 'error', 'ended notok', 'notok'],            sortOrder: 4 },
  ],
  layout: {
    vGap: 50,
    hGap: 40,
    nodeWidth: 190,
    nodeHeight: 130,
    nodeCollapsedHeight: 48,
  },
  relation: {
    selectedColor: '#6366f1',
    predColor: '#f97316',
    succColor: '#22d3ee',
    outlineWidth: 1,
  },
  business: {
    dayStartHour: 0,
    dayStartMinute: 0,
  },
}

/** Neutral fallback for unknown status values — never throws. */
const FALLBACK_STATUS: StatusDef = {
  key: 'status.unknown',
  label: 'Unknown',
  hex: '#94a3b8',
  aliases: [],
  sortOrder: 99,
}

// ── Module-level active config ref ───────────────────────────────────────────

let _active: AppConfig = DEFAULT_APP_CONFIG

export function getAppConfig(): AppConfig {
  return _active
}

export function setAppConfig(cfg: AppConfig): void {
  _active = cfg
}

// ── Status resolution ────────────────────────────────────────────────────────

/**
 * Resolves any raw status string to its StatusDef.
 * Always returns a value — unknown statuses get the neutral grey fallback,
 * so components never need to guard against undefined.
 */
export function resolveStatus(rawValue: unknown): StatusDef {
  if (rawValue === null || rawValue === undefined || rawValue === '') return FALLBACK_STATUS
  const key = String(rawValue).toLowerCase().trim()
  const statuses = _active.statuses
  for (const def of statuses) {
    if (def.aliases.includes(key)) return def
  }
  // Try matching the display label directly (e.g. value stored as 'Completed')
  for (const def of statuses) {
    if (def.label.toLowerCase() === key) return def
  }
  return FALLBACK_STATUS
}

// ── DB row → AppConfig parser ────────────────────────────────────────────────

export interface RawConfigRow {
  key: string
  category: string
  label: string
  value: string
  sortOrder?: number
}

export function parseAppConfig(rows: RawConfigRow[]): AppConfig {
  const cfg: AppConfig = structuredClone(DEFAULT_APP_CONFIG)
  const statuses: StatusDef[] = []

  for (const row of rows) {
    switch (row.category) {
      case 'status': {
        try {
          const parsed = JSON.parse(row.value) as { hex: string; aliases: string[] }
          statuses.push({
            key: row.key,
            label: row.label,
            hex: parsed.hex ?? '#94a3b8',
            aliases: (parsed.aliases ?? []).map((a) => String(a).toLowerCase().trim()),
            sortOrder: row.sortOrder ?? 99,
          })
        } catch {
          // Malformed JSON — skip this row safely
        }
        break
      }
      case 'layout': {
        const num = Number(row.value)
        if (isNaN(num)) break
        const field = row.key.replace('layout.', '') as keyof LayoutConfig
        if (field in cfg.layout) {
          ;(cfg.layout as unknown as Record<string, number>)[field] = num
        }
        break
      }
      case 'relation': {
        const field = row.key.replace('relation.', '') as keyof RelationConfig
        if (field === 'outlineWidth') {
          cfg.relation.outlineWidth = Number(row.value) || 1
        } else if (field in cfg.relation) {
          ;(cfg.relation as unknown as Record<string, string>)[field] = row.value
        }
        break
      }
      case 'business': {
        const field = row.key.replace('business.', '') as keyof BusinessConfig
        if (field === 'dayStartHour') {
          cfg.business.dayStartHour = Math.min(23, Math.max(0, Number(row.value) || 0))
        } else if (field === 'dayStartMinute') {
          cfg.business.dayStartMinute = Math.min(59, Math.max(0, Number(row.value) || 0))
        }
        break
      }
    }
  }

  if (statuses.length > 0) {
    cfg.statuses = statuses.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  return cfg
}
