import type { Edge } from '@xyflow/react'
import type { FieldDefinition, ModuleTab, NavItem, Viewpoint } from '../types'
import type { RawConfigRow } from '../config/appConfig'

export interface DashboardData {
  modules: ModuleTab[]
  viewpoints: Viewpoint[]
  navTree: NavItem[]
  edges: Edge[]
  fieldDefinitions?: FieldDefinition[]
  appConfig?: RawConfigRow[]
}

export interface NodeLogEntry {
  id: number
  nodeId: string
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
}

const API_BASE = '/api'

export async function fetchDashboardData(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/data`)
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard data: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchNodeLogs(nodeId: string): Promise<NodeLogEntry[]> {
  const res = await fetch(`${API_BASE}/logs/${encodeURIComponent(nodeId)}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch logs for node ${nodeId}: ${res.statusText}`)
  }
  return res.json()
}

// CRUD API Functions
export async function fetchTableRows<T = Record<string, unknown>>(table: string): Promise<T[]> {
  const res = await fetch(`${API_BASE}/crud/${encodeURIComponent(table)}`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch table ${table}`)
  }
  return res.json()
}

export async function createTableRow(table: string, data: Record<string, unknown>): Promise<{ success: boolean; id: string | number }> {
  const res = await fetch(`${API_BASE}/crud/${encodeURIComponent(table)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to create record in ${table}`)
  }
  return res.json()
}

export async function bulkCreateRows(table: string, rows: Record<string, unknown>[]): Promise<{ success: boolean; count: number }> {
  const res = await fetch(`${API_BASE}/crud/${encodeURIComponent(table)}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed bulk insert into ${table}`)
  }
  return res.json()
}

export interface SingleDateEvaluationResult {
  success: boolean
  date: string
  isEligible: boolean
  effectiveRunDate: string | null
}

export async function evaluateSingleDate(
  config: Record<string, unknown>,
  dateStr: string
): Promise<SingleDateEvaluationResult> {
  const res = await fetch(`${API_BASE}/schedules/evaluate-date`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, date: dateStr }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to evaluate date')
  }
  return res.json()
}

export async function updateTableRow(
  table: string,
  id: string | number,
  data: Record<string, unknown>
): Promise<{ success: boolean; id: string | number }> {
  const res = await fetch(`${API_BASE}/crud/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to update record ${id} in ${table}`)
  }
  return res.json()
}

export async function deleteTableRow(table: string, id: string | number): Promise<{ success: boolean; id: string | number }> {
  const res = await fetch(`${API_BASE}/crud/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to delete record ${id} from ${table}`)
  }
  return res.json()
}
