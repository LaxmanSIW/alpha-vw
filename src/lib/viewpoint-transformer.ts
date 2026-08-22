/**
 * Viewpoint transformer — filters, groups, and sorts the nav tree based on a
 * viewpoint's saved configuration.
 *
 * Status filter uses resolveStatus() (alias-aware) instead of a hardcoded
 * three-way mapping like the original.
 */

import type { Edge } from '@xyflow/react'
import { resolveStatus } from './app-config'
import type { NavItem, Viewpoint } from './types'

export interface TransformedViewpoint {
  navTree: NavItem[]
  edges: Edge[]
  jobCount: number
}

function extractAllItems(items: NavItem[], currentPath = ''): Array<{ item: NavItem; path: string }> {
  const result: Array<{ item: NavItem; path: string }> = []
  for (const item of items) {
    const fullPath = currentPath ? `${currentPath} / ${item.label}` : item.label
    if (item.kind === 'item') {
      result.push({ item, path: currentPath })
    } else if (item.children && item.children.length > 0) {
      result.push(...extractAllItems(item.children, fullPath))
    }
  }
  return result
}

function pruneFolderTree(items: NavItem[], validItemIds: Set<string>): NavItem[] {
  const result: NavItem[] = []
  for (const item of items) {
    if (item.kind === 'item') {
      if (validItemIds.has(item.id)) result.push(item)
    } else if (item.kind === 'folder' && item.children) {
      const prunedChildren = pruneFolderTree(item.children, validItemIds)
      if (prunedChildren.length > 0) {
        result.push({ ...item, children: prunedChildren })
      }
    }
  }
  return result
}

function sortItems(items: NavItem[], sortByKey?: string): NavItem[] {
  if (!sortByKey) return items
  return [...items].sort((a, b) => {
    const valA = a.data?.[sortByKey] ?? (a as unknown as Record<string, unknown>)[sortByKey] ?? a.label ?? ''
    const valB = b.data?.[sortByKey] ?? (b as unknown as Record<string, unknown>)[sortByKey] ?? b.label ?? ''
    if (typeof valA === 'number' && typeof valB === 'number') return valA - valB
    return String(valA).localeCompare(String(valB))
  })
}

function sortTreeItems(items: NavItem[], sortByKey?: string): NavItem[] {
  if (!sortByKey) return items
  return items.map((node) => {
    if (node.kind === 'folder' && node.children) {
      return { ...node, children: sortTreeItems(sortItems(node.children, sortByKey), sortByKey) }
    }
    return node
  })
}

export function transformViewpointData(
  originalTree: NavItem[],
  originalEdges: Edge[],
  viewpoint?: Viewpoint | null,
): TransformedViewpoint {
  if (!viewpoint) {
    const allItems = extractAllItems(originalTree)
    return { navTree: originalTree, edges: originalEdges, jobCount: allItems.length }
  }

  const allExtracted = extractAllItems(originalTree)
  let filteredExtracted = allExtracted

  // 1. Status filter — alias-aware via resolveStatus
  if (viewpoint.filterStatus && viewpoint.filterStatus !== 'All') {
    const filter = viewpoint.filterStatus.toLowerCase().trim()
    filteredExtracted = filteredExtracted.filter((entry) => {
      const itemStatus = String(entry.item.data?.status ?? '').toLowerCase().trim()
      if (!itemStatus) return false
      // Use resolveStatus: the raw status resolves to a StatusDef whose
      // label we compare to the filter (which is also a status label).
      const resolved = resolveStatus(itemStatus)
      return resolved.label.toLowerCase() === filter || itemStatus === filter
    })
  }

  // 2. Folder scope filter
  if (viewpoint.folder && viewpoint.folder.trim()) {
    const folderScope = viewpoint.folder.toLowerCase().trim()
    filteredExtracted = filteredExtracted.filter((entry) =>
      entry.path.toLowerCase().includes(folderScope),
    )
  }

  const validItemIds = new Set(filteredExtracted.map((entry) => entry.item.id))

  // 3. Filter edges to only those between matching items
  const filteredEdges = originalEdges.filter(
    (edge) => validItemIds.has(edge.source) && validItemIds.has(edge.target),
  )

  const grouping = viewpoint.grouping ?? 'Folder'
  let transformedTree: NavItem[] = []

  // 4. Grouping
  if (grouping !== 'Folder') {
    const groupMap = new Map<string, NavItem[]>()
    for (const entry of filteredExtracted) {
      const rawVal = entry.item.data?.[grouping] ?? (entry.item as unknown as Record<string, unknown>)[grouping] ?? 'Unassigned'
      const groupVal = String(rawVal === null || rawVal === undefined || rawVal === '' ? 'Unassigned' : rawVal)
      if (!groupMap.has(groupVal)) groupMap.set(groupVal, [])
      groupMap.get(groupVal)!.push({
        ...entry.item,
        data: { ...entry.item.data, folder: `${grouping} / ${groupVal}` },
      })
    }

    transformedTree = Array.from(groupMap.entries()).map(([groupVal, items]) => ({
      id: `group-${grouping}-${groupVal.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      label: groupVal,
      kind: 'folder' as const,
      children: sortItems(items, viewpoint.sortBy),
    }))
  } else {
    transformedTree = sortTreeItems(pruneFolderTree(originalTree, validItemIds), viewpoint.sortBy)
  }

  return {
    navTree: transformedTree,
    edges: filteredEdges,
    jobCount: validItemIds.size,
  }
}
