'use client'

import { useEffect, useMemo } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import type { NavItem } from '@/lib/types'
import {
  useDashboardStore,
  useActiveNavTreeAndEdges,
  useActiveViewpoint,
  useOpenViewpoints,
  useCatalog,
} from '@/lib/stores/dashboard-store'
import { useUIStore } from '@/lib/stores/ui-store'
import TopHeader from './top-header'
import ViewpointTabs from './viewpoint-tabs'
import ActionBar from './action-bar'
import SidePanel from './side-panel'
import NavigationTree from './navigation-tree'
import DetailsPanel from './details-panel'
import FlowCanvas from '@/components/canvas/flow-canvas'
import NodeListView from './node-list-view'
import ViewpointCatalog from './viewpoint-catalog'
import CanvasSearch from '@/components/canvas/canvas-search'
import StatusBar from './status-bar'
import ContextPopup from '@/components/canvas/context-popup'
import AdminModal from '@/components/modals/admin-modal'
import SettingsModal from '@/components/modals/settings-modal'
import ViewScheduleModal from '@/components/modals/view-schedule-modal'
import ViewpointForm from '@/components/modals/viewpoint-form'
import CalendarManagerModal from '@/components/modals/calendar-manager-modal'
import ScheduleManagerModal from '@/components/modals/schedule-manager-modal'
import { buildFlowNodes, layoutHierarchy, absolutePositionOf } from '@/lib/layout'
import { POPUP_CONFIG, CONTEXT_MENU_ACTIONS } from '@/lib/view-config'
import { calculatePopupPlacement, nextContextMenuState } from '@/components/canvas/context-popup'
import { deleteTableRow } from '@/lib/api-client'
import { toast } from 'sonner'

// Stable empty array reference — avoids new-array-per-render infinite loop in useSyncExternalStore
const STABLE_EMPTY: string[] = []

function DashboardShell() {
  // ── UI state from stores ──────────────────────────────────────────────
  const theme = useUIStore((s) => s.theme)
  const density = useUIStore((s) => s.density)
  const isAdminOpen = useUIStore((s) => s.isAdminOpen)
  const isSettingsOpen = useUIStore((s) => s.isSettingsOpen)
  const isCalendarManagerOpen = useUIStore((s) => s.isCalendarManagerOpen)
  const isScheduleManagerOpen = useUIStore((s) => s.isScheduleManagerOpen)
  const isCreateViewpointOpen = useUIStore((s) => s.isCreateViewpointOpen)
  const editingViewpoint = useUIStore((s) => s.editingViewpoint)
  const scheduleModalNode = useUIStore((s) => s.scheduleModalNode)

  // ── Dashboard state ──────────────────────────────────────────────────
  const modules = useDashboardStore((s) => s.modules)
  const activeModuleId = useDashboardStore((s) => s.activeModuleId)
  const setActiveModuleId = useDashboardStore((s) => s.setActiveModuleId)
  const isLoading = useDashboardStore((s) => s.isLoading)
  const isRefreshing = useDashboardStore((s) => s.isRefreshing)
  const loadData = useDashboardStore((s) => s.loadData)
  const fieldDefinitions = useDashboardStore((s) => s.fieldDefinitions)
  const edges = useDashboardStore((s) => s.edges)
  const adjacency = useDashboardStore((s) => s.adjacency)
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId)
  const setSelectedNodeId = useDashboardStore((s) => s.setSelectedNodeId)
  const focusedPane = useDashboardStore((s) => s.focusedPane)
  const setFocusedPane = useDashboardStore((s) => s.setFocusedPane)
  const jobsExpanded = useDashboardStore((s) => s.jobsExpanded)
  const toggleJobsExpanded = useDashboardStore((s) => s.toggleJobsExpanded)
  const searchOpen = useDashboardStore((s) => s.searchOpen)
  const toggleSearch = useDashboardStore((s) => s.toggleSearch)
  const listView = useDashboardStore((s) => s.listView)
  const toggleListView = useDashboardStore((s) => s.toggleListView)
  const expandedNavIds = useDashboardStore((s) => s.expandedNavIds)
  const toggleNavExpand = useDashboardStore((s) => s.toggleNavExpand)
  const collapseAllNav = useDashboardStore((s) => s.collapseAllNav)
  const expandAllNav = useDashboardStore((s) => s.expandAllNav)
  const leftCollapsed = useDashboardStore((s) => s.leftCollapsed)
  const rightCollapsed = useDashboardStore((s) => s.rightCollapsed)
  const toggleLeftPanel = useDashboardStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useDashboardStore((s) => s.toggleRightPanel)
  const contextMenu = useDashboardStore((s) => s.contextMenu)
  const contextList = useDashboardStore((s) => s.contextList)
  const setContextMenu = useDashboardStore((s) => s.setContextMenu)
  const setContextList = useDashboardStore((s) => s.setContextList)

  const openViewpoint = useDashboardStore((s) => s.openViewpoint)
  const closeViewpoint = useDashboardStore((s) => s.closeViewpoint)
  const selectTab = useDashboardStore((s) => s.selectTab)

  const openEditViewpoint = useUIStore((s) => s.openEditViewpoint)
  const openCreateViewpoint = useUIStore((s) => s.openCreateViewpoint)
  const openScheduleModal = useUIStore((s) => s.openScheduleModal)

  // ── Derived data ─────────────────────────────────────────────────────
  const { navTree: activeNavTree, edges: activeEdges, jobCount } = useActiveNavTreeAndEdges()

  const layout = useMemo(
    () => layoutHierarchy(activeNavTree, activeEdges, jobsExpanded),
    [activeNavTree, activeEdges, jobsExpanded],
  )

  const nodes = useMemo(
    () => buildFlowNodes(activeNavTree, layout, jobsExpanded, fieldDefinitions),
    [activeNavTree, layout, jobsExpanded, fieldDefinitions],
  )

  const jobNodes = useMemo(() => nodes.filter((n) => n.type === 'flat'), [nodes])

  // ── Initial load ─────────────────────────────────────────────────────
  useEffect(() => {
    loadData(false)
  }, [loadData])

  // ── React Flow callbacks ─────────────────────────────────────────────
  const { setCenter, fitView, getZoom } = useReactFlow()

  const focusNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    // Expand parent folders if node is nested in a folder
    const findAndExpandParents = (items: NavItem[], path: string[] = []): boolean => {
      for (const item of items) {
        if (item.id === nodeId) {
          if (path.length > 0) {
            useDashboardStore.getState().expandNavFolders(path)
          }
          return true
        }
        if (item.kind === 'folder' && item.children) {
          if (findAndExpandParents(item.children, [...path, item.id])) return true
        }
      }
      return false
    }
    findAndExpandParents(activeNavTree)

    const node = nodes.find((n) => n.id === nodeId)
    const absolute = absolutePositionOf(nodeId, nodes)
    if (!node || !absolute) return
    const width = layout.sizes.get(nodeId)?.width ?? 176
    const height = layout.sizes.get(nodeId)?.height ?? 48
    setCenter(absolute.x + width / 2, absolute.y + height / 2, { zoom: Math.max(getZoom(), 0.8), duration: 300 })
  }

  // ── Context menu handlers ────────────────────────────────────────────
  const onNodeClick = (_: React.MouseEvent, node: { id: string }) => {
    setSelectedNodeId(node.id)
    setContextMenu(null)
    setContextList(null)
  }

  const onNodeContextMenu = (event: React.MouseEvent, node: { id: string }) => {
    event.preventDefault()
    setSelectedNodeId(node.id)
    const placement = calculatePopupPlacement(
      event.clientX, event.clientY,
      POPUP_CONFIG.MENU_WIDTH, POPUP_CONFIG.MENU_HEIGHT, 'right',
    )
    setContextMenu({
      kind: 'menu',
      nodeId: node.id,
      x: placement.x,
      y: placement.y,
      side: placement.side,
      options: CONTEXT_MENU_ACTIONS,
    })
    setContextList(null)
  }

  const onPaneContextMenu = (event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setContextMenu(null)
    setContextList(null)
  }

  const onContextAction = (nodeId: string, actionId: string) => {
    const fromNode = nodes.find((n) => n.id === nodeId)
    if (!fromNode || !contextMenu) return

    if (actionId === 'schedule') {
      setContextMenu(null)
      setContextList(null)
      openScheduleModal(fromNode)
      return
    }

    const relation = actionId === 'predecessors' ? 'predecessors' : 'successors'
    const map = new Map(
      nodes.map((n) => [
        n.id,
        {
          id: n.id,
          label: String((n.data as { label?: string })?.label ?? n.id),
          status: ((n.data as { status?: string })?.status ?? 'ok'),
          data: n.data as Record<string, unknown>,
        },
      ]),
    )

    const nextMenu = nextContextMenuState(
      {
        kind: 'menu' as const,
        nodeId,
        x: contextMenu.x,
        y: contextMenu.y,
        side: contextMenu.side,
        options: CONTEXT_MENU_ACTIONS,
      },
      actionId,
      activeEdges,
      map,
    )

    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800

    const menuW = POPUP_CONFIG.MENU_WIDTH
    const listW = POPUP_CONFIG.LIST_WIDTH
    const listH = POPUP_CONFIG.LIST_HEIGHT
    const gap = 6

    // Position list panel to the right of contextMenu (or to the left if near right screen edge)
    let listX = contextMenu.x + menuW + gap
    if (listX + listW > winW - 8) {
      listX = Math.max(8, contextMenu.x - listW - gap)
    }

    // TOP EDGE ALIGNMENT: listY MUST match contextMenu.y exactly so top edges align horizontally
    const listY = contextMenu.y

    setContextList({
      ...nextMenu,
      x: listX,
      y: listY,
      items: nextMenu.items,
      relation,
    })
  }

  // ── Viewpoint handlers ───────────────────────────────────────────────
  const handleDeleteViewpoint = async (vp: { id: string; label: string }) => {
    if (!window.confirm(`Are you sure you want to delete viewpoint "${vp.label}"?`)) return
    try {
      await deleteTableRow('viewpoints', vp.id)
      toast.success(`Deleted viewpoint "${vp.label}"`)
      loadData(true)
    } catch (err) {
      toast.error(`Failed to delete viewpoint: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Compute active tab + catalog ─────────────────────────────────────
  // Use the dedicated selectors from the store (which use useShallow for stable refs)
  const activeViewpoint = useActiveViewpoint()
  const showingCatalog = activeViewpoint === null
  const catalog = useCatalog()
  const openViewpoints = useOpenViewpoints()
  // Use a module-level stable empty array to avoid new-reference-per-render infinite loops
  const openIds = useDashboardStore((s) => s.openIdsByModule[s.activeModuleId] ?? STABLE_EMPTY)
  const activeTabId = useDashboardStore((s) => {
    const requested = s.activeTabByModule[s.activeModuleId] ?? '__catalog__'
    const openIdsLocal = s.openIdsByModule[s.activeModuleId] ?? STABLE_EMPTY
    if (requested === '__catalog__' || openIdsLocal.includes(requested)) return requested
    return '__catalog__'
  })

  // ── Selected node ────────────────────────────────────────────────────
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
  const selectedLabel = selectedNode ? ((selectedNode.data as { label?: string }).label ?? null) : null

  // ── Expand target (nav or canvas) ────────────────────────────────────
  const expandTarget: 'nav' | 'canvas' = focusedPane === 'nav' ? 'nav' : 'canvas'
  const structureExpanded = expandTarget === 'nav' ? expandedNavIds.size > 0 : jobsExpanded
  const onToggleStructure = () => {
    if (expandTarget === 'nav') {
      if (expandedNavIds.size > 0) collapseAllNav()
      else expandAllNav()
    } else {
      toggleJobsExpanded()
    }
  }

  // Sync theme/density to document (also handled in store, but ensures first paint)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme
      document.documentElement.dataset.density = density
    }
  }, [theme, density])

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-text">
      <TopHeader
        modules={modules}
        activeModuleId={activeModuleId}
        onModuleChange={setActiveModuleId}
      />

      {/* Loading divider */}
      <div
        aria-hidden="true"
        className={[
          'h-[3px] shrink-0 transition-colors duration-200',
          isLoading || isRefreshing ? 'animate-pulse bg-accent' : 'bg-primary',
        ].join(' ')}
      />

      <ViewpointTabs
        openViewpoints={openViewpoints}
        activeTabId={activeTabId}
        onSelect={selectTab}
        onClose={closeViewpoint}
      />

      <ActionBar
        expandTarget={expandTarget}
        structureExpanded={structureExpanded}
        onToggleStructure={onToggleStructure}
        listView={listView}
        onListViewToggle={toggleListView}
        onFitView={() => fitView({ duration: 250 })}
        searchOpen={searchOpen}
        onSearchToggle={toggleSearch}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
        onOpenSettings={() => useUIStore.getState().openSettings()}
        onOpenAdmin={() => useUIStore.getState().openAdmin()}
      />

      {/* Active viewpoint header */}
      {activeViewpoint && !showingCatalog && (
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-surface-sunken px-4 text-xs text-text">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">{activeViewpoint.label}</span>
            <span
              className={`px-1.5 py-0.2 font-medium text-[10px] uppercase ${
                activeViewpoint.scope === 'Private'
                  ? 'bg-warning-bg text-warning-fg'
                  : 'bg-accent/15 text-accent'
              }`}
            >
              {activeViewpoint.scope ?? 'Public'}
            </span>
            <span className="text-text-muted">|</span>
            <span>
              Status Filter: <strong className="text-text">{activeViewpoint.filterStatus ?? 'All'}</strong>
            </span>
            <span className="text-text-muted">|</span>
            <span>
              Grouped by: <strong className="text-text">{activeViewpoint.grouping ?? 'Folder'}</strong>
            </span>
            <span className="text-text-muted">|</span>
            <span>
              Sorted by: <strong className="text-text">{activeViewpoint.sortBy ?? 'label'}</strong>
            </span>
            <button
              type="button"
              onClick={() => openEditViewpoint(activeViewpoint)}
              className="ml-2 inline-flex items-center gap-1 border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-text hover:bg-surface-hover hover:text-primary transition-colors"
              title="Modify Viewpoint Properties"
            >
              Edit Viewpoint
            </button>
          </div>
          <div className="text-text-muted font-medium">
            Active Viewpoint Jobs: <strong className="text-primary">{jobCount}</strong>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        <SidePanel
          side="left"
          title="Navigation Pane"
          collapsed={leftCollapsed}
          onToggle={toggleLeftPanel}
          focused={focusedPane === 'nav'}
          onFocusCapture={() => setFocusedPane('nav')}
        >
          <NavigationTree
            items={activeNavTree}
            expandedIds={expandedNavIds}
            onToggle={toggleNavExpand}
            selectedId={selectedNodeId}
            onSelect={focusNode}
          />
        </SidePanel>

        <main
          className="relative min-w-0 flex-1 bg-canvas flex flex-col"
          onPointerDownCapture={() => setFocusedPane('canvas')}
        >
          <div className="relative min-h-0 flex-1">
            {showingCatalog ? (
              <ViewpointCatalog
                viewpoints={catalog}
                openIds={openIds}
                onOpen={openViewpoint}
                onCreateViewpoint={openCreateViewpoint}
                onEditViewpoint={openEditViewpoint}
                onDeleteViewpoint={handleDeleteViewpoint}
              />
            ) : listView ? (
              <NodeListView
                nodes={jobNodes}
                selectedId={selectedNodeId}
                onSelect={setSelectedNodeId}
                fieldDefinitions={fieldDefinitions}
              />
            ) : (
              <FlowCanvas
                nodes={nodes}
                edges={activeEdges}
                adjacency={adjacency}
                selectedNodeId={selectedNodeId}
                onNodeClick={onNodeClick}
                onNodeContextMenu={onNodeContextMenu}
                onPaneClick={() => {
                  setSelectedNodeId(null)
                  setContextMenu(null)
                }}
                onPaneContextMenu={onPaneContextMenu}
              >
                {searchOpen && (
                  <CanvasSearch
                    nodes={jobNodes}
                    onPick={focusNode}
                    onClose={() => useDashboardStore.getState().setSearchOpen(false)}
                  />
                )}
              </FlowCanvas>
            )}
          </div>
        </main>

        <SidePanel
          side="right"
          title="Details Pane"
          collapsed={rightCollapsed}
          onToggle={toggleRightPanel}
          focused={focusedPane === 'details'}
          onFocusCapture={() => setFocusedPane('details')}
        >
          <DetailsPanel
            selectedNode={selectedNode}
            nodeCount={jobNodes.length}
            edgeCount={edges.length}
            onOpenViewSchedule={(nodeId) => {
              const target = nodes.find((n) => n.id === nodeId)
              if (target) openScheduleModal(target)
            }}
          />
        </SidePanel>
      </div>

      <StatusBar
        nodeCount={jobNodes.length}
        edgeCount={edges.length}
        selectedLabel={selectedLabel}
        focusedPane={focusedPane}
      />

      {/* Context popups */}
      {(contextMenu || contextList) && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          {/* Backdrop scrim to close both popups on outside click */}
          <div
            className="fixed inset-0 pointer-events-auto"
            onClick={() => {
              setContextMenu(null)
              setContextList(null)
            }}
          />
          {contextMenu && (
            <ContextPopup
              menu={contextMenu}
              onClose={() => {
                setContextMenu(null)
                setContextList(null)
              }}
              onSelectNode={(nodeId) => {
                focusNode(nodeId)
                setContextMenu(null)
                setContextList(null)
              }}
              onSelectAction={onContextAction}
              hideScrim
            />
          )}
          {contextList && (
            <ContextPopup
              menu={contextList}
              onClose={() => {
                setContextMenu(null)
                setContextList(null)
              }}
              onSelectNode={(nodeId) => {
                focusNode(nodeId)
                setContextMenu(null)
                setContextList(null)
              }}
              hideScrim
            />
          )}
        </div>
      )}

      {/* Modals */}
      <ViewpointForm mode="create" />
      <ViewpointForm mode="edit" />
      <AdminModal />
      <SettingsModal />
      <CalendarManagerModal />
      <ScheduleManagerModal />
      <ViewScheduleModal
        isOpen={Boolean(scheduleModalNode)}
        nodeLabel={scheduleModalNode ? (scheduleModalNode.data?.label as string) || scheduleModalNode.id : ''}
        scheduleName={scheduleModalNode ? (scheduleModalNode.data?.schedule as string) || 'DAILY_PROD_RUN' : 'DAILY_PROD_RUN'}
        onClose={() => useUIStore.getState().closeScheduleModal()}
      />
    </div>
  )
}

export default function DashboardShellWithProvider() {
  return (
    <ReactFlowProvider>
      <DashboardShell />
    </ReactFlowProvider>
  )
}
