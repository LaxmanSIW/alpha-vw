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
/** Which pane last had focus. Drives context-sensitive expand/collapse all. */

export type PaneId = 'nav' | 'canvas' | 'details'
export type ThemeName = 'light' | 'dark'
export type DensityName = 'compact' | 'comfortable'