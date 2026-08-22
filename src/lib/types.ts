/**
 * Shared domain types for Alpha VW.
 */

import type { Edge } from '@xyflow/react'

export interface ModuleTab {
  id: string
  label: string
}

export interface Viewpoint {
  id: string
  moduleId: string
  label: string
  description?: string
  folder?: string
  jobCount?: number
  scope?: 'Public' | 'Private'
  filterStatus?: string
  grouping?: string
  sortBy?: string
}

export interface FieldDefinition {
  key: string
  label: string
  sectionTitle?: string
  role: 'title' | 'subtitle' | 'detail' | 'none'
  format?: 'text' | 'mono' | 'status'
  sortOrder?: number
  isProtected?: number | boolean
  showOnCard?: 'Y' | 'N' | boolean | number
  showInDetails?: 'Y' | 'N' | boolean | number
  isActive?: number | boolean
}

export interface NavItem {
  id: string
  label: string
  kind: 'folder' | 'item'
  data?: Record<string, unknown>
  children?: NavItem[]
}

export const VIEWPOINT_CATALOG_TAB_ID = '__catalog__'

// ── Context menu ────────────────────────────────────────────────────────────

export type PopupSide = 'top' | 'right' | 'bottom' | 'left'
export type ContextRelationKind = 'predecessors' | 'successors'

export interface ContextMenuAction {
  id: string
  label: string
  kind?: ContextRelationKind | 'custom'
}

export interface ContextMenuItem {
  id: string
  name: string
  status: string
  level: number
}

export interface ContextPopupPosition {
  x: number
  y: number
  width: number
  height: number
  side: PopupSide
}

export interface ContextMenuState {
  kind: 'menu' | 'list'
  nodeId: string
  x: number
  y: number
  side: PopupSide
  options?: ContextMenuAction[]
  relation?: ContextRelationKind
  items?: ContextMenuItem[]
}

// ── Other ──────────────────────────────────────────────────────────────────

export type PaneId = 'nav' | 'canvas' | 'details'
export type ThemeName = 'light' | 'dark'
export type DensityName = 'compact' | 'comfortable'

export interface DashboardData {
  modules: ModuleTab[]
  viewpoints: Viewpoint[]
  navTree: NavItem[]
  edges: Edge[]
  fieldDefinitions: FieldDefinition[]
  appConfig: Array<{
    key: string
    category: string
    label: string
    value: string
    sortOrder?: number
  }>
  businessDate?: string
}

export interface NodeLogEntry {
  id: number
  nodeId: string
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
}

export interface BusinessDateResult {
  businessDate: string
  dayStart: string
  serverTime: string
}
