import { useCallback, useEffect, useMemo, useState } from 'react'
import { useReactFlow, type Node } from '@xyflow/react'
import TopHeader from './TopHeader'
import ViewpointTabs from './ViewpointTabs'
import ActionBar from './ActionBar'
import SidePanel from './SidePanel'
import NavigationTree from './NavigationTree'
import DetailsPanel from './DetailsPanel'
import FlowCanvas from './FlowCanvas'
import NodeListView from './NodeListView'
import ViewpointCatalog from './ViewpointCatalog'
import CanvasSearch from './CanvasSearch'
import StatusBar from './StatusBar'
import ContextPopup, { calculatePopupPlacement, nextContextMenuState } from './ContextPopup'
import { INITIAL_EDGES, MODULES, NAV_TREE, VIEWPOINTS } from '../data/mockData'
import { absolutePositionOf, buildFlowNodes, layoutHierarchy } from '../layout'
import { CONTEXT_MENU_ACTIONS } from '../config/viewConfig'
import {
  VIEWPOINT_CATALOG_TAB_ID,
  type ContextMenuState,
  type DensityName,
  type NavItem,
  type PaneId,
  type ThemeName,
  type Viewpoint,
} from '../types'

function collectFolderIds(items: NavItem[]): string[] {
  return items.flatMap((item) =>
    item.kind === 'folder' ? [item.id, ...collectFolderIds(item.children ?? [])] : [],
  )
}

const ALL_FOLDER_IDS = collectFolderIds(NAV_TREE)

/** Shared empty array: a fresh `[]` fallback would be a new reference every
 *  render and would invalidate every memo downstream of it. */
const NO_TABS: string[] = []

function DashboardShell() {
  const [theme, setTheme] = useState<ThemeName>('light')
  const [density, setDensity] = useState<DensityName>('compact')

  const [activeModuleId, setActiveModuleId] = useState(MODULES[0].id)

  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  const [focusedPane, setFocusedPane] = useState<PaneId>('canvas')
  const [listView, setListView] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const [expandedNavIds, setExpandedNavIds] = useState<Set<string>>(
    () => new Set(ALL_FOLDER_IDS),
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [contextList, setContextList] = useState<ContextMenuState | null>(null)
  /** Whether job boxes show their detail rows. One flag for all of them, since
   *  the action bar toggle is all-or-nothing. */
  const [jobsExpanded, setJobsExpanded] = useState(true)

  const { setCenter, fitView, getZoom } = useReactFlow()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.density = density
  }, [theme, density])

  const layout = useMemo(
    () => layoutHierarchy(
      NAV_TREE,
      INITIAL_EDGES,
    ),
    [],
  )

  const nodes = useMemo(
    () => buildFlowNodes(NAV_TREE, layout, jobsExpanded),
    [layout, jobsExpanded],
  )

  const jobNodes = useMemo(() => nodes.filter((node) => node.type === 'flat'), [nodes])

  const catalog = useMemo(
    () => VIEWPOINTS.filter((viewpoint) => viewpoint.moduleId === activeModuleId),
    [activeModuleId],
  )

  // Open tabs and the active tab are tracked per module so switching modules and
  // coming back does not throw away what you had open.
  const [openIdsByModule, setOpenIdsByModule] = useState<Record<string, string[]>>({
    architecture: ['arch-v1'],
  })
  const [activeTabByModule, setActiveTabByModule] = useState<Record<string, string>>({
    architecture: 'arch-v1',
  })

  const openIds = openIdsByModule[activeModuleId] ?? NO_TABS
  const openViewpoints = useMemo(
    () =>
      openIds
        .map((id) => catalog.find((viewpoint) => viewpoint.id === id))
        .filter((viewpoint): viewpoint is Viewpoint => Boolean(viewpoint)),
    [openIds, catalog],
  )

  // Resolved during render rather than corrected in an effect: an effect would
  // paint one frame pointing at a closed tab and then re-render.
  const requestedTabId = activeTabByModule[activeModuleId] ?? VIEWPOINT_CATALOG_TAB_ID
  const activeTabId =
    requestedTabId === VIEWPOINT_CATALOG_TAB_ID || openIds.includes(requestedTabId)
      ? requestedTabId
      : VIEWPOINT_CATALOG_TAB_ID
  const showingCatalog = activeTabId === VIEWPOINT_CATALOG_TAB_ID

  const onSelectTab = useCallback(
    (tabId: string) => setActiveTabByModule((current) => ({ ...current, [activeModuleId]: tabId })),
    [activeModuleId],
  )

  const onOpenViewpoint = useCallback(
    (viewpointId: string) => {
      setOpenIdsByModule((current) => {
        const existing = current[activeModuleId] ?? []
        if (existing.includes(viewpointId)) return current
        return { ...current, [activeModuleId]: [...existing, viewpointId] }
      })
      setActiveTabByModule((current) => ({ ...current, [activeModuleId]: viewpointId }))
    },
    [activeModuleId],
  )

  const onCloseTab = useCallback(
    (viewpointId: string) => {
      setOpenIdsByModule((current) => {
        const existing = current[activeModuleId] ?? []
        const index = existing.indexOf(viewpointId)
        if (index === -1) return current
        const next = existing.filter((id) => id !== viewpointId)

        // Closing the active tab hands focus to its left neighbour, falling back
        // to the catalog. Jumping to the far end would lose the user's place.
        setActiveTabByModule((tabs) => {
          if (tabs[activeModuleId] !== viewpointId) return tabs
          const neighbour = next[index - 1] ?? next[index] ?? VIEWPOINT_CATALOG_TAB_ID
          return { ...tabs, [activeModuleId]: neighbour }
        })

        return { ...current, [activeModuleId]: next }
      })
    },
    [activeModuleId],
  )

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  /**
   * Select a node and bring it to the centre. Shared by the navigation tree and
   * the search results so picking a thing from a list always lands you looking
   * at it.
   */
  const focusNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId)
      const node = nodes.find((candidate) => candidate.id === nodeId)
      const absolute = absolutePositionOf(nodeId, nodes)
      if (!node || !absolute) return
      const width = layout.sizes.get(nodeId)?.width ?? 176
      const height = layout.sizes.get(nodeId)?.height ?? 48
      setCenter(absolute.x + width / 2, absolute.y + height / 2, {
        // Preserve the current zoom -- snapping to a fixed level would discard
        // the scale the user deliberately chose.
        zoom: getZoom(),
        duration: 250,
      })
    },
    [nodes, layout, setCenter, getZoom],
  )

  const onNavSelect = useCallback(
    (navId: string) => {
      // Nav ids are node ids, so no lookup table. Folders centre on their
      // container box, which is a useful way to jump around a large graph.
      focusNode(navId)
    },
    [focusNode],
  )

  const expandTarget: 'nav' | 'canvas' = focusedPane === 'nav' ? 'nav' : 'canvas'
  const structureExpanded = expandTarget === 'nav' ? expandedNavIds.size > 0 : jobsExpanded

  const onToggleStructure = useCallback(() => {
    if (expandTarget === 'nav') {
      setExpandedNavIds((current) => (current.size > 0 ? new Set() : new Set(ALL_FOLDER_IDS)))
    } else {
      setJobsExpanded((current) => !current)
    }
  }, [expandTarget])

  const onNavToggle = useCallback((id: string) => {
    setExpandedNavIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
    setContextMenu(null)
    setContextList(null)
  }, [])

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    setSelectedNodeId(node.id)
    const placement = calculatePopupPlacement(event.clientX, event.clientY, 180, 96, 'right')
    setContextMenu({
      kind: 'menu',
      nodeId: node.id,
      x: placement.x,
      y: placement.y,
      side: placement.side,
      options: CONTEXT_MENU_ACTIONS,
    })
    setContextList(null)
  }, [])

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setContextMenu(null)
    setContextList(null)
  }, [])

  const onContextAction = useCallback(
    (nodeId: string, actionId: string) => {
      const fromNode = nodes.find((node) => node.id === nodeId)
      if (!fromNode || !contextMenu) return

      const relation = actionId === 'predecessors' ? 'predecessors' : 'successors'
      const map = new Map(
        nodes.map((node) => [
          node.id,
          {
            id: node.id,
            label: String((node.data as { label?: string })?.label ?? node.id),
            status: ((node.data as { status?: 'ok' | 'warning' | 'danger' })?.status ?? 'ok'),
            data: node.data as Record<string, unknown>,
          },
        ]),
      )

      const nextMenu = nextContextMenuState(
        {
          kind: 'menu',
          nodeId,
          x: contextMenu.x,
          y: contextMenu.y,
          side: contextMenu.side,
          options: CONTEXT_MENU_ACTIONS,
        },
        actionId,
        INITIAL_EDGES,
        map,
      )

      setContextList({
        ...nextMenu,
        items: nextMenu.items,
        relation,
      })
    },
    [contextMenu, nodes],
  )

  const selectedLabel = selectedNode
    ? ((selectedNode.data as { label?: string }).label ?? null)
    : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-text">
      <TopHeader
        modules={MODULES}
        activeModuleId={activeModuleId}
        onModuleChange={setActiveModuleId}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        density={density}
        onDensityToggle={() => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))}
      />

      <div aria-hidden="true" className="h-divider shrink-0 bg-primary" />

      <ViewpointTabs
        openViewpoints={openViewpoints}
        activeTabId={activeTabId}
        onSelect={onSelectTab}
        onClose={onCloseTab}
      />

      <ActionBar
        expandTarget={expandTarget}
        structureExpanded={structureExpanded}
        onToggleStructure={onToggleStructure}
        listView={listView}
        onListViewToggle={() => setListView((v) => !v)}
        onFitView={() => fitView({ duration: 250 })}
        searchOpen={searchOpen}
        onSearchToggle={() => setSearchOpen((v) => !v)}
      />

      <div className="flex min-h-0 flex-1">
        <SidePanel
          side="left"
          title="Navigation Pane"
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((v) => !v)}
          focused={focusedPane === 'nav'}
          onFocusCapture={() => setFocusedPane('nav')}
        >
          <NavigationTree
            items={NAV_TREE}
            expandedIds={expandedNavIds}
            onToggle={onNavToggle}
            selectedId={selectedNodeId}
            onSelect={onNavSelect}
          />
        </SidePanel>

        <main
          className="relative min-w-0 flex-1 bg-canvas"
          onPointerDownCapture={() => setFocusedPane('canvas')}
        >
          {showingCatalog ? (
            <ViewpointCatalog viewpoints={catalog} openIds={openIds} onOpen={onOpenViewpoint} />
          ) : listView ? (
            <NodeListView
              nodes={jobNodes}
              selectedId={selectedNodeId}
              onSelect={setSelectedNodeId}
            />
          ) : (
            <FlowCanvas
              nodes={nodes}
              edges={INITIAL_EDGES}
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
                  onClose={() => setSearchOpen(false)}
                />
              )}
            </FlowCanvas>
          )}
        </main>

        <SidePanel
          side="right"
          title="Details Pane"
          collapsed={rightCollapsed}
          onToggle={() => setRightCollapsed((v) => !v)}
          focused={focusedPane === 'details'}
          onFocusCapture={() => setFocusedPane('details')}
        >
          <DetailsPanel
            selectedNode={selectedNode}
            nodeCount={jobNodes.length}
            edgeCount={INITIAL_EDGES.length}
          />
        </SidePanel>
      </div>

      <StatusBar
        nodeCount={jobNodes.length}
        edgeCount={INITIAL_EDGES.length}
        selectedLabel={selectedLabel}
        focusedPane={focusedPane}
      />

      {contextMenu && (
        <ContextPopup
          menu={contextMenu}
          onClose={() => {
            setContextMenu(null)
            setContextList(null)
          }}
          onSelectNode={setSelectedNodeId}
          onSelectAction={onContextAction}
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
            setSelectedNodeId(nodeId)
            setContextMenu(null)
            setContextList(null)
          }}
        />
      )}
    </div>
  )
}

export default DashboardShell
