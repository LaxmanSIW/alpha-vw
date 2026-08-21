export interface ModuleTab {
    id: string
    label: string
}

export interface Viewpoint {
    id: string
    /** Owning module switching modules swaps the whole viewpoint set. */
    moduleId: string
    label: string
    description?: string
    folder?: string
    jobCount?: number
    scope?: 'Public' | 'Private'
    filterStatus?: 'All' | 'ok' | 'warning' | 'danger'
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
/** The always-present first tab that lists the viewpoint catalog. It is synthetic rather than a real viewpoint, which is why it cannot be closed.
*/
export const VIEWPOINT_CATALOG_TAB_ID = '__catalog__'

export interface NavItem {
    id: string
    label: string
    kind: 'folder' | 'item'
    /**
    Job attributes surfaced on the canvas node and in the details pane. The tr
    is the single source of truth for both the navigation panel and the canvas
    canvas node ids ARE nav ids, so the two can no longer drift apart or need
    lookup table between them.
    */
    data?: Record<string, unknown>
    children?: NavItem[]
}

export type PopupSide = 'top' | 'right' | 'bottom' | 'left'
export type ContextRelationKind = 'predecessors' | 'successors'
export type NodeStatusTone = 'ok' | 'warning' | 'danger'

export interface ContextMenuAction {
    id: string
    label: string
    kind?: ContextRelationKind | 'custom'
}

export interface ContextMenuItem {
    id: string
    name: string
    status: NodeStatusTone
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
/** Which pane last had focus. Drives context-sensitive expand/collapse all. */

export type PaneId = 'nav' | 'canvas' | 'details'
export type ThemeName = 'light' | 'dark'
export type DensityName = 'compact' | 'comfortable'