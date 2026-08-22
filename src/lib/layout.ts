/**
 * Nested layered layout — folders become container boxes, jobs sit inside them,
 * and containers nest to whatever depth the tree has.
 *
 * Optimizations over the original:
 *   - LAYOUT is read ONCE per call, not 6× (eliminates redundant getAppConfig())
 *   - Layout is invoked from a useMemo'd selector downstream, so this runs only
 *     when navTree/edges/jobsExpanded actually change.
 *   - console.log removed (was firing on every layout pass).
 */

import type { Edge, Node } from '@xyflow/react'
import { getLayout } from './app-config'
import type { FieldDefinition, NavItem } from './types'

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

const GROUP = {
  headerHeight: 36,
  padding: 20,
  gap: 36,
} as const

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
  return index
}

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
  return layer
}

export interface HierarchyLayout {
  positions: Map<string, Point>
  sizes: Map<string, Size>
}

export function layoutHierarchy(
  tree: NavItem[],
  edges: Edge[],
  expandedJobs: boolean = true,
): HierarchyLayout {
  // Hoist LAYOUT once per call — the original called getLayout() 6+ times.
  const LAYOUT = getLayout()
  const descendants = buildDescendantIndex(tree)
  const positions = new Map<string, Point>()
  const sizes = new Map<string, Size>()

  function liftEdges(children: NavItem[]): Array<[string, string]> {
    const ownerOf = new Map<string, string>()
    for (const child of children) {
      for (const id of descendants.get(child.id) ?? []) ownerOf.set(id, child.id)
    }
    const lifted: Array<[string, string]> = []
    for (const edge of edges) {
      const source = ownerOf.get(edge.source)
      const target = ownerOf.get(edge.target)
      if (!source || !target || source === target) continue
      lifted.push([source, target])
    }
    return lifted
  }

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
    const gap = hasFolders ? GROUP.gap : LAYOUT.vGap

    const rowWidths = orderedLayers.map((index) => {
      const row = rows.get(index)!
      return row.reduce((sum, child) => sum + childSizes.get(child.id)!.width, 0) + (row.length - 1) * LAYOUT.hGap
    })
    const contentWidth = Math.max(...rowWidths, 0)

    let y = GROUP.headerHeight + GROUP.padding
    orderedLayers.forEach((index, rowIndex) => {
      const row = rows.get(index)!
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
      height: y - gap + GROUP.padding,
    }
    sizes.set(item.id, size)
    return size
  }

  const rootSizes = new Map<string, Size>()
  for (const item of tree) rootSizes.set(item.id, layoutItem(item))

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
    const rowWidth = row.reduce((sum, item) => sum + rootSizes.get(item.id)!.width, 0) + (row.length - 1) * LAYOUT.hGap

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

  return { positions, sizes }
}

export function buildFlowNodes(
  tree: NavItem[],
  layout: HierarchyLayout,
  expandedJobs: boolean,
  fieldDefinitions?: FieldDefinition[],
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
        width: size?.width,
        height: size?.height,
        data: { label: item.label, count: item.children!.length, fieldDefinitions },
        selectable: false,
        draggable: false,
        zIndex: 0,
      })
      for (const child of item.children!) walk(child, item.id, item.label)
      return
    }

    nodes.push({
      id: item.id,
      type: 'flat',
      position,
      width: size?.width,
      ...(parentId ? { parentId } : {}),
      data: {
        label: item.label,
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

/** Absolute canvas coordinates for a node by walking the parent chain. */
export function absolutePositionOf(nodeId: string, nodes: Node[]): Point | null {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  let current = byId.get(nodeId)
  if (!current) return null

  let x = 0
  let y = 0
  const guard = new Set<string>()

  while (current) {
    if (guard.has(current.id)) break
    guard.add(current.id)
    x += current.position.x
    y += current.position.y
    current = current.parentId ? byId.get(current.parentId) : undefined
  }

  return { x, y }
}

/** All folder IDs in a tree (recursive). */
export function collectFolderIds(items: NavItem[]): string[] {
  return items.flatMap((item) =>
    item.kind === 'folder' ? [item.id, ...collectFolderIds(item.children ?? [])] : [],
  )
}
