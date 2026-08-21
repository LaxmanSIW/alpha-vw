import type { Edge, Node } from '@xyflow/react'
import { LAYOUT } from './config/viewConfig'
import type { NavItem } from './types'

/**
 * Nested layered layout: folders become container boxes, jobs sit inside them,
 * and containers nest to whatever depth the tree has.
 *
 * Two things this has to get right.
 *
 * 1. CONSTANT GAPS. Positions are derived from measured sizes rather than stored,
 *    so expanding a job grows its container instead of eating the space below it.
 *    The gap between one layer and the next is always LAYOUT.vGap at every depth.
 *    Deriving rather than storing is only safe because the canvas is read-only;
 *    if dragging is ever enabled this must become a one-shot "arrange" command.
 *
 * 2. DEPENDENCIES DECIDE ORDER, AT EVERY LEVEL. Inside a container, children are
 *    layered by the edges between them. Cross-container edges are LIFTED to the
 *    containers themselves -- n-2 -> n-5 crosses from Domain A to Domain B, so
 *    Domain A is placed above Domain B. Without lifting, containers would sit in
 *    arbitrary tree order and every dependency arrow would run backwards.
 *
 * Leaf sizes come from real DOM measurement (see useMeasuredSizes). Container
 * sizes are computed here, never measured, which avoids a feedback loop where a
 * box grows because it measured itself.
 */

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** Container chrome. The header is where the folder name goes. */
const GROUP = {
  headerHeight: 36,
  padding: 20,
  /** Gap between sibling containers, tighter than the job gap so nesting reads
   *  as grouping rather than as another rank of jobs. */
  gap: 36,
} as const

/** Every descendant id of each node, so an edge endpoint can be traced to
 *  whichever direct child of a container ultimately holds it. */
function buildDescendantIndex(items: NavItem[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>()

  function walk(item: NavItem): Set<string> {
    const own = new Set<string>([item.id])
    for (const child of item.children ?? []) {
      for (const id of walk(child)) own.add(id)
    }
    index.set(item.id, own)
    return own
  }

  items.forEach(walk)
  // console.log(index)
  return index
}

/** Longest-path layering, so every edge points from a lower layer to a higher one. */
function computeLayers(ids: string[], edges: Array<[string, string]>): Map<string, number> {
  const indegree = new Map(ids.map((id) => [id, 0]))
  const adjacency = new Map(ids.map((id) => [id, [] as string[]]))

  for (const [source, target] of edges) {
    if (!adjacency.has(source) || !indegree.has(target)) continue
    adjacency.get(source)!.push(target)
    indegree.set(target, indegree.get(target)! + 1)
  }

  const layer = new Map(ids.map((id) => [id, 0]))
  const remaining = new Map(indegree)
  const queue = ids.filter((id) => indegree.get(id) === 0)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of adjacency.get(current) ?? []) {
      layer.set(next, Math.max(layer.get(next)!, layer.get(current)! + 1))
      remaining.set(next, remaining.get(next)! - 1)
      if (remaining.get(next) === 0) queue.push(next)
    }
  }

  // Nodes still holding indegree sit in a cycle and keep layer 0. Dependency
  // graphs should be acyclic, but nothing upstream enforces it and a wrong layout
  // beats a hang.
  // console.log(layer)
  return layer
}

export interface HierarchyLayout {
  /** Position relative to the parent container (React Flow's convention). */
  positions: Map<string, Point>
  /** Computed size for containers; measured size echoed back for leaves. */
  sizes: Map<string, Size>
}

export function layoutHierarchy(
  tree: NavItem[],
  edges: Edge[],
  expandedJobs: boolean = true,
): HierarchyLayout {
  const descendants = buildDescendantIndex(tree)
  const positions = new Map<string, Point>()
  const sizes = new Map<string, Size>()

  /** Edges between the direct children of a container, lifted from their leaves. */
  function liftEdges(children: NavItem[]): Array<[string, string]> {
    const ownerOf = new Map<string, string>()
    for (const child of children) {
      for (const id of descendants.get(child.id) ?? []) ownerOf.set(id, child.id)
    }

    const lifted: Array<[string, string]> = []
    for (const edge of edges) {
      const source = ownerOf.get(edge.source)
      const target = ownerOf.get(edge.target)
      // Skip edges that leave this container entirely, and edges that stay
      // within a single child -- those are that child's business, not ours.
      if (!source || !target || source === target) continue
      lifted.push([source, target])
    }

    return lifted
  }

  /**
   * Lays out one item and returns its size. Recurses depth-first so a container
   * always knows how big its children are before placing them.
   */
  function layoutItem(item: NavItem): Size {
    const children = item.children ?? []

    if (item.kind !== 'folder' || children.length === 0) {
      const size = {
        width: LAYOUT.nodeWidth,
        height: expandedJobs ? LAYOUT.nodeHeight : LAYOUT.nodeCollapsedHeight,
      }
      sizes.set(item.id, size)
      return size
    }

    const childSizes = new Map<string, Size>()
    for (const child of children) childSizes.set(child.id, layoutItem(child))

    // Folders always sit side by side; only jobs stack into dependency layers.
    // Containers laid out vertically pushed the graph into a tall column, and
    // sibling folders are peers rather than steps in a sequence.
    const hasFolders = children.some((child) => child.kind === 'folder')
    const layer = hasFolders
      ? new Map(children.map((child) => [child.id, 0]))
      : computeLayers(
          children.map((child) => child.id),
          liftEdges(children),
        )

    const rows = new Map<number, NavItem[]>()
    for (const child of children) {
      const index = layer.get(child.id) ?? 0
      const row = rows.get(index)
      if (row) row.push(child)
      else rows.set(index, [child])
    }

    const orderedLayers = [...rows.keys()].sort((a, b) => a - b)
    // Containers sit further apart than jobs so the grouping reads clearly.
    const gap = children.some((child) => child.kind === 'folder') ? GROUP.gap : LAYOUT.vGap

    const rowWidths = orderedLayers.map((index) => {
      const row = rows.get(index)!
      return (
        row.reduce((sum, child) => sum + childSizes.get(child.id)!.width, 0) +
        (row.length - 1) * LAYOUT.hGap
      )
    })
    const contentWidth = Math.max(...rowWidths)

    let y = GROUP.headerHeight + GROUP.padding
    orderedLayers.forEach((index, rowIndex) => {
      const row = rows.get(index)!
      // Centre each row inside the container so it stays symmetric as rows
      // change width.
      let x = GROUP.padding + (contentWidth - rowWidths[rowIndex]) / 2
      let rowHeight = 0

      for (const child of row) {
        const size = childSizes.get(child.id)!
        positions.set(child.id, { x, y })
        x += size.width + LAYOUT.hGap
        rowHeight = Math.max(rowHeight, size.height)
      }

      y += rowHeight + gap
    })

    const size = {
      width: contentWidth + GROUP.padding * 2,
      // The last row added a trailing gap that is not inside the box.
      height: y - gap + GROUP.padding,
    }
    sizes.set(item.id, size)
    return size
  }

  // Virtual root: top-level items are laid out the same way, but their positions
  // are absolute rather than relative to a container.
  const rootSizes = new Map<string, Size>()
  for (const item of tree) rootSizes.set(item.id, layoutItem(item))

  // Top-level items are folders, so they too go in a single row.
  const rootLayer = new Map(tree.map((item) => [item.id, 0]))
  const rootRows = new Map<number, NavItem[]>()
  for (const item of tree) {
    const index = rootLayer.get(item.id) ?? 0
    const row = rootRows.get(index)
    if (row) row.push(item)
    else rootRows.set(index, [item])
  }

  let rootY = 0
  for (const index of [...rootRows.keys()].sort((a, b) => a - b)) {
    const row = rootRows.get(index)!
    const rowWidth =
      row.reduce((sum, item) => sum + rootSizes.get(item.id)!.width, 0) +
      (row.length - 1) * LAYOUT.hGap

    let x = -rowWidth / 2
    let rowHeight = 0
    for (const item of row) {
      const size = rootSizes.get(item.id)!
      positions.set(item.id, { x, y: rootY })
      x += size.width + LAYOUT.hGap
      rowHeight = Math.max(rowHeight, size.height)
    }
    rootY += rowHeight + GROUP.gap
  }

  console.log({ positions, sizes })
  return { positions, sizes }
}

/**
 * Flattens the tree into React Flow nodes.
 *
 * Parents are emitted BEFORE their children. React Flow paints in array order,
 * so a container listed after its children would be drawn on top of them and
 * hide the jobs inside it.
 */
export function buildFlowNodes(
  tree: NavItem[],
  layout: HierarchyLayout,
  expandedJobs: boolean,
  fieldDefinitions?: unknown[],
): Node[] {
  const nodes: Node[] = []

  function walk(item: NavItem, parentId?: string, parentLabel?: string) {
    const position = layout.positions.get(item.id) ?? { x: 0, y: 0 }
    const size = layout.sizes.get(item.id)
    const isFolder = item.kind === 'folder' && (item.children?.length ?? 0) > 0

    if (isFolder) {
      nodes.push({
        id: item.id,
        type: 'container',
        position,
        ...(parentId ? { parentId } : {}),
        // Explicit dimensions: a container's size is computed from its contents,
        // not measured, so React Flow must be told rather than asked.
        width: size?.width,
        height: size?.height,
        data: { label: item.label, count: item.children!.length, fieldDefinitions },
        selectable: false,
        draggable: false,
        // Keeps containers behind their jobs regardless of paint order.
        zIndex: 0,
      })
      for (const child of item.children!) walk(child, item.id, item.label)
      return
    }

    nodes.push({
      id: item.id,
      type: 'flat',
      position,
      ...(parentId ? { parentId } : {}),
      data: {
        label: item.label,
        // Folder is derived from the container rather than duplicated on each
        // job, so moving a job in the tree cannot leave a stale folder name.
        folder: parentLabel,
        ...(item.data ?? {}),
        expanded: expandedJobs,
        fieldDefinitions,
      },
      draggable: false,
      zIndex: 1,
    })
  }

  for (const item of tree) walk(item)
  return nodes
}

/**
 * Absolute canvas coordinates for a node.
 *
 * React Flow stores a child's position relative to its container, so a nested
 * job's own `position` is meaningless to setCenter -- centring on it would jump
 * to a point near the origin. Walk the parent chain and sum the offsets.
 */
export function absolutePositionOf(nodeId: string, nodes: Node[]): Point | null {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  let current = byId.get(nodeId)
  if (!current) return null

  let x = 0
  let y = 0
  const guard = new Set<string>()

  while (current) {
    if (guard.has(current.id)) break // malformed parentId cycle
    guard.add(current.id)
    x += current.position.x
    y += current.position.y
    current = current.parentId ? byId.get(current.parentId) : undefined
  }

  return { x, y }
}

