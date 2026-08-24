/**
 * Dashboard store — all data state for the dashboard plus canvas/view state.
 *
 * Replaces 25 useState calls in the original DashboardShell.
 * State is updated by actions; selectors subscribe via Zustand.
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { useMemo } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { fetchDashboardData } from '../api-client'
import { parseAppConfig, setAppConfig, type AppConfig } from '../app-config'
import { buildAdjacency, type AdjacencyMaps } from '../graph'
import { collectFolderIds } from '../layout'
import { transformViewpointData } from '../viewpoint-transformer'
import {
  VIEWPOINT_CATALOG_TAB_ID,
  type ContextMenuState,
  type FieldDefinition,
  type ModuleTab,
  type NavItem,
  type PaneId,
  type Viewpoint,
} from '../types'

interface DashboardState {
  // ── Server data ───────────────────────────────────────────────────────
  modules: ModuleTab[]
  viewpoints: Viewpoint[]
  navTree: NavItem[]
  edges: Edge[]
  fieldDefinitions: FieldDefinition[]
  appConfigRows: Array<{ key: string; category: string; label: string; value: string; sortOrder?: number }>
  businessDate: string | null

  isLoading: boolean
  isRefreshing: boolean
  loadError: string | null

  // ── Derived (recomputed when edges change) ─────────────────────────────
  adjacency: AdjacencyMaps

  // ── View state ───────────────────────────────────────────────────────
  activeModuleId: string
  selectedNodeId: string | null
  focusedPane: PaneId
  jobsExpanded: boolean
  searchOpen: boolean
  listView: boolean
  expandedNavIds: Set<string>

  // Tab state — keyed by module id
  openIdsByModule: Record<string, string[]>
  activeTabByModule: Record<string, string>

  // Context menu
  contextMenu: ContextMenuState | null
  contextList: ContextMenuState | null

  // Side panels
  leftCollapsed: boolean
  rightCollapsed: boolean

  // ── Actions ──────────────────────────────────────────────────────────
  loadData: (isRefresh?: boolean) => Promise<void>
  setActiveModuleId: (id: string) => void
  setSelectedNodeId: (id: string | null) => void
  setFocusedPane: (p: PaneId) => void
  toggleJobsExpanded: () => void
  setJobsExpanded: (v: boolean) => void
  setSearchOpen: (v: boolean) => void
  toggleSearch: () => void
  setListView: (v: boolean) => void
  toggleListView: () => void
  toggleNavExpand: (id: string) => void
  expandNavFolders: (folderIds: string[]) => void
  setExpandedNavIds: (ids: Set<string>) => void
  collapseAllNav: () => void
  expandAllNav: () => void
  setContextMenu: (m: ContextMenuState | null) => void
  setContextList: (m: ContextMenuState | null) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void

  // Viewpoint tabs
  openViewpoint: (id: string) => void
  closeViewpoint: (id: string) => void
  selectTab: (id: string) => void
}

const INITIAL_MODULES: ModuleTab[] = [{ id: 'architecture', label: 'Architecture' }]

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Server data
  modules: INITIAL_MODULES,
  viewpoints: [],
  navTree: [],
  edges: [],
  fieldDefinitions: [],
  appConfigRows: [],
  businessDate: null,
  isLoading: true,
  isRefreshing: false,
  loadError: null,

  adjacency: { forward: new Map(), reverse: new Map() },

  // View state
  activeModuleId: 'architecture',
  selectedNodeId: null,
  focusedPane: 'canvas',
  jobsExpanded: true,
  searchOpen: false,
  listView: false,
  expandedNavIds: new Set(),

  openIdsByModule: {},
  activeTabByModule: {},

  contextMenu: null,
  contextList: null,

  leftCollapsed: false,
  rightCollapsed: false,

  loadData: async (isRefresh = false) => {
    set(isRefresh ? { isRefreshing: true } : { isLoading: true })
    try {
      const data = await fetchDashboardData()
      const adjacency = buildAdjacency(data.edges)
      // Preserve existing expansion; only add new folder ids.
      const newExpandedNavIds = new Set(get().expandedNavIds)
      for (const id of collectFolderIds(data.navTree)) newExpandedNavIds.add(id)

      set({
        modules: data.modules.length > 0 ? data.modules : INITIAL_MODULES,
        viewpoints: data.viewpoints,
        navTree: data.navTree,
        edges: data.edges,
        fieldDefinitions: data.fieldDefinitions,
        appConfigRows: data.appConfig,
        businessDate: data.businessDate ?? null,
        adjacency,
        expandedNavIds: newExpandedNavIds,
        isLoading: false,
        isRefreshing: false,
        loadError: null,
      })

      // Apply app config to the Zustand store + global state
      if (data.appConfig.length > 0) {
        const cfg: AppConfig = parseAppConfig(data.appConfig)
        setAppConfig(cfg)
      }
    } catch (err) {
      set({
        isLoading: false,
        isRefreshing: false,
        loadError: err instanceof Error ? err.message : String(err),
      })
    }
  },

  setActiveModuleId: (id) => set({ activeModuleId: id }),
  setSelectedNodeId: (id) => set((s) => ({
    selectedNodeId: id,
    rightCollapsed: id !== null ? false : s.rightCollapsed,
  })),
  setFocusedPane: (p) => set({ focusedPane: p }),
  toggleJobsExpanded: () => set((s) => ({ jobsExpanded: !s.jobsExpanded })),
  setJobsExpanded: (v) => set({ jobsExpanded: v }),
  setSearchOpen: (v) => set({ searchOpen: v }),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
  setListView: (v) => set({ listView: v }),
  toggleListView: () => set((s) => ({ listView: !s.listView })),
  toggleNavExpand: (id) => set((s) => {
    const next = new Set(s.expandedNavIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { expandedNavIds: next }
  }),
  expandNavFolders: (folderIds) => set((s) => {
    const next = new Set(s.expandedNavIds)
    let changed = false
    for (const id of folderIds) {
      if (!next.has(id)) {
        next.add(id)
        changed = true
      }
    }
    return changed ? { expandedNavIds: next } : {}
  }),
  setExpandedNavIds: (ids) => set({ expandedNavIds: ids }),
  collapseAllNav: () => set({ expandedNavIds: new Set() }),
  expandAllNav: () => set((s) => ({ expandedNavIds: new Set(collectFolderIds(s.navTree)) })),
  setContextMenu: (m) => set({ contextMenu: m }),
  setContextList: (m) => set({ contextList: m }),
  toggleLeftPanel: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRightPanel: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),

  openViewpoint: (id) => set((s) => {
    const existing = s.openIdsByModule[s.activeModuleId] ?? []
    if (existing.includes(id)) {
      return { activeTabByModule: { ...s.activeTabByModule, [s.activeModuleId]: id } }
    }
    return {
      openIdsByModule: { ...s.openIdsByModule, [s.activeModuleId]: [...existing, id] },
      activeTabByModule: { ...s.activeTabByModule, [s.activeModuleId]: id },
    }
  }),

  closeViewpoint: (id) => set((s) => {
    const existing = s.openIdsByModule[s.activeModuleId] ?? []
    const index = existing.indexOf(id)
    if (index === -1) return s
    const next = existing.filter((x) => x !== id)
    const nextTabs = { ...s.activeTabByModule }
    if (nextTabs[s.activeModuleId] === id) {
      nextTabs[s.activeModuleId] = next[index - 1] ?? next[index] ?? VIEWPOINT_CATALOG_TAB_ID
    }
    return {
      openIdsByModule: { ...s.openIdsByModule, [s.activeModuleId]: next },
      activeTabByModule: nextTabs,
    }
  }),

  selectTab: (id) => set((s) => ({
    activeTabByModule: { ...s.activeTabByModule, [s.activeModuleId]: id },
  })),
}))

// ── Selectors ──────────────────────────────────────────────────────────────
// Use useShallow for any selector that returns a NEW object/array each render.
// Otherwise React 19's useSyncExternalStore sees a new reference and re-renders forever.

export function useActiveTabId(): string {
  const activeModuleId = useDashboardStore((s) => s.activeModuleId)
  const activeTabByModule = useDashboardStore((s) => s.activeTabByModule)
  const openIdsByModule = useDashboardStore((s) => s.openIdsByModule)
  const requested = activeTabByModule[activeModuleId] ?? VIEWPOINT_CATALOG_TAB_ID
  const openIds = openIdsByModule[activeModuleId] ?? []
  if (requested === VIEWPOINT_CATALOG_TAB_ID || openIds.includes(requested)) return requested
  return VIEWPOINT_CATALOG_TAB_ID
}

export function useShowingCatalog(): boolean {
  return useActiveTabId() === VIEWPOINT_CATALOG_TAB_ID
}

export function useActiveViewpoint(): Viewpoint | null {
  const activeTabId = useActiveTabId()
  const viewpoints = useDashboardStore((s) => s.viewpoints)
  if (activeTabId === VIEWPOINT_CATALOG_TAB_ID) return null
  return viewpoints.find((vp) => vp.id === activeTabId) ?? null
}

export function useOpenViewpoints(): Viewpoint[] {
  const activeModuleId = useDashboardStore((s) => s.activeModuleId)
  const openIdsByModule = useDashboardStore(useShallow((s) => s.openIdsByModule[activeModuleId] ?? []))
  const viewpoints = useDashboardStore((s) => s.viewpoints)
  return useMemo(
    () => openIdsByModule
      .map((id) => viewpoints.find((vp) => vp.id === id))
      .filter((vp): vp is Viewpoint => Boolean(vp)),
    [openIdsByModule, viewpoints],
  )
}

export function useCatalog(): Viewpoint[] {
  const activeModuleId = useDashboardStore((s) => s.activeModuleId)
  const viewpoints = useDashboardStore((s) => s.viewpoints)
  return useMemo(
    () => viewpoints.filter((vp) => vp.moduleId === activeModuleId),
    [viewpoints, activeModuleId],
  )
}

export function useActiveNavTreeAndEdges() {
  const navTree = useDashboardStore((s) => s.navTree)
  const edges = useDashboardStore((s) => s.edges)
  const activeViewpoint = useActiveViewpoint()
  // Memoize the transform so we don't recompute on every render
  // (but only recompute when inputs actually change)
  return useMemo(() => transformViewpointData(navTree, edges, activeViewpoint), [navTree, edges, activeViewpoint])
}

export function useSelectedNode(nodes: Node[]): Node | null {
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId)
  return nodes.find((n) => n.id === selectedNodeId) ?? null
}
