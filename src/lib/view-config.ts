/**
 * View configuration — what a node box shows, which tabs the details pane has,
 * and the context menu actions. All declared here, not hardcoded in components.
 */

import type { ContextMenuAction, FieldDefinition } from './types'

export const CONTEXT_MENU_ACTIONS: ContextMenuAction[] = [
  { id: 'predecessors', label: 'Predecessors', kind: 'predecessors' },
  { id: 'successors', label: 'Successors', kind: 'successors' },
]

export const POPUP_CONFIG = {
  MENU_WIDTH: 180,
  MENU_HEIGHT: 96,
  LIST_WIDTH: 260,
  LIST_HEIGHT: 320,
  GAP: 10,
} as const

export const PROTECTED_CORE_KEYS = [
  'id',
  '__id',
  'label',
  'kind',
  'parent_id',
  'node_kind',
  'status',
]

export interface NodeFieldDef {
  key: string
  label: string
  sectionTitle?: string
  role: 'title' | 'subtitle' | 'detail' | 'none'
  format?: 'text' | 'mono' | 'status'
  isProtected?: boolean
  showOnCard?: 'Y' | 'N' | boolean | number
  showInDetails?: 'Y' | 'N' | boolean | number
}

export const NODE_FIELDS: NodeFieldDef[] = [
  { key: 'label', label: 'Node Label', sectionTitle: 'Identity', role: 'title', isProtected: true },
  { key: 'kind', label: 'Kind', sectionTitle: 'Identity', role: 'subtitle', isProtected: true },
  { key: 'node_kind', label: 'Type', sectionTitle: 'Identity', role: 'subtitle', isProtected: true },
  { key: '__id', label: 'Node ID', sectionTitle: 'Identity', role: 'detail', format: 'mono', isProtected: true },
  { key: 'status', label: 'Status', sectionTitle: 'State', role: 'detail', format: 'status', isProtected: true },
]

export const STATUS_KEY = 'status'

export interface DetailsSectionDef {
  title: string
  fields: Array<{ key: string; label: string; format?: 'text' | 'mono' | 'status' }>
}

export interface DetailsTabDef {
  id: string
  label: string
  kind: 'fields' | 'log' | 'placeholder'
  sections?: DetailsSectionDef[]
}

export const DETAILS_TABS: DetailsTabDef[] = [
  {
    id: 'details',
    label: 'Details',
    kind: 'fields',
    sections: [
      {
        title: 'Identity',
        fields: [
          { key: 'label', label: 'Name' },
          { key: '__id', label: 'ID', format: 'mono' },
          { key: 'kind', label: 'Type' },
          { key: 'folder', label: 'Folder' },
        ],
      },
      {
        title: 'Execution',
        fields: [
          { key: 'host', label: 'Host', format: 'mono' },
          { key: 'runs', label: 'Runs' },
          { key: 'schedule', label: 'Schedule Config' },
          { key: 'scheduled', label: 'Scheduled Today' },
        ],
      },
      {
        title: 'State',
        fields: [{ key: 'status', label: 'Status', format: 'status' }],
      },
    ],
  },
  { id: 'log', label: 'Log', kind: 'log' },
  { id: 'props', label: 'Properties', kind: 'placeholder' },
]

export function getDynamicNodeFieldDefs(fieldDefinitions: FieldDefinition[]): FieldDefinition[] {
  return fieldDefinitions.filter(
    (f) =>
      !PROTECTED_CORE_KEYS.includes(f.key) &&
      f.role !== 'none' &&
      (f.isActive ?? 1) !== 0,
  )
}
