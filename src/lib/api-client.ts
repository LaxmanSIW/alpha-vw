/**
 * API client — typed fetch wrappers for the Alpha VW backend.
 *
 * Uses TanStack Query on the consumer side (in hooks/), so these are plain
 * async functions. No caching/dedup/abort here — Query handles all of that.
 */

import type { BusinessDateResult, DashboardData, NodeLogEntry } from './types'

const API_BASE = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const err = await res.json()
      message = err.error || message
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<T>
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export function fetchDashboardData(): Promise<DashboardData> {
  return request<DashboardData>('/data')
}

export function fetchBusinessDate(): Promise<BusinessDateResult> {
  return request<BusinessDateResult>('/business-date')
}

export function fetchNodeLogs(nodeId: string): Promise<NodeLogEntry[]> {
  return request<NodeLogEntry[]>(`/logs/${encodeURIComponent(nodeId)}`)
}

// ─── Generic CRUD ──────────────────────────────────────────────────────────

export type CrudTable =
  | 'modules'
  | 'viewpoints'
  | 'nav_nodes'
  | 'edges'
  | 'node_logs'
  | 'field_definitions'
  | 'node_field_values'
  | 'calendars'
  | 'schedule_configs'
  | 'app_config'

export async function fetchTableRows<T = Record<string, unknown>>(table: CrudTable): Promise<T[]> {
  return request<T[]>(`/crud/${encodeURIComponent(table)}`)
}

export async function createTableRow(
  table: CrudTable,
  data: Record<string, unknown>,
): Promise<{ success: boolean; id: string | number }> {
  return request(`/crud/${encodeURIComponent(table)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function bulkCreateRows(
  table: CrudTable,
  rows: Record<string, unknown>[],
): Promise<{ success: boolean; count: number }> {
  return request(`/crud/bulk/${encodeURIComponent(table)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
}

export async function updateTableRow(
  table: CrudTable,
  id: string | number,
  data: Record<string, unknown>,
): Promise<{ success: boolean; id: string | number }> {
  return request(`/crud/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function deleteTableRow(
  table: CrudTable,
  id: string | number,
): Promise<{ success: boolean; id: string | number }> {
  return request(`/crud/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

// ─── Schedules ──────────────────────────────────────────────────────────────

export interface SingleDateEvaluationResult {
  success: boolean
  date: string
  isEligible: boolean
  effectiveRunDate: string | null
}

export async function evaluateSingleDate(
  config: Record<string, unknown>,
  dateStr: string,
): Promise<SingleDateEvaluationResult> {
  return request('/schedules/evaluate-date', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, date: dateStr }),
  })
}

export async function evaluateYear(
  config: Record<string, unknown>,
  year: number,
): Promise<{ success: boolean; year: number; eligibleDates: string[]; errors?: string[]; warnings?: string[] }> {
  return request('/schedules/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, year }),
  })
}
