import type { Edge } from '@xyflow/react'

export type RelationKind = 'selected' | 'upstream' | 'downstream' | 'none'

/**
 * Transitive upstream / downstream sets for a node.
 *
 * Transitive rather than immediate neighbours: in a dependency graph the useful
 * question is "what feeds this, and what breaks if it fails", which the direct
 * neighbours alone do not answer. Switch the BFS to a single hop if you ever
 * want strictly adjacent highlighting.
 *
 * The visited set doubles as cycle protection -- workflow graphs are supposed to
 * be acyclic but nothing here enforces that, and a cycle would otherwise hang
 * the render.
 */
function traverse(edges: Edge[], startId: string, direction: 'up' | 'down'): Set<string> {
  const found = new Set<string>()
  const queue = [startId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of edges) {
      const from = direction === 'up' ? edge.target : edge.source
      const to = direction === 'up' ? edge.source : edge.target
      if (from !== current || found.has(to) || to === startId) continue
      found.add(to)
      queue.push(to)
    }
  }

  return found
}

export interface Relations {
  upstream: Set<string>
  downstream: Set<string>
}

export function getRelations(edges: Edge[], selectedId: string | null): Relations {
  if (!selectedId) return { upstream: new Set(), downstream: new Set() }
  return {
    upstream: traverse(edges, selectedId, 'up'),
    downstream: traverse(edges, selectedId, 'down'),
  }
}

export function relationOf(
  nodeId: string,
  selectedId: string | null,
  relations: Relations,
): RelationKind {
  if (!selectedId) return 'none'
  if (nodeId === selectedId) return 'selected'
  if (relations.upstream.has(nodeId)) return 'upstream'
  if (relations.downstream.has(nodeId)) return 'downstream'
  return 'none'
}

export function predecessorsOf(nodeId: string, edges: Edge[]): string[] {
  const visited = new Set<string>()
  const queue = [nodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of edges) {
      if (edge.target !== current || visited.has(edge.source)) continue
      visited.add(edge.source)
      queue.push(edge.source)
    }
  }

  return Array.from(visited)
}

export function successorsOf(nodeId: string, edges: Edge[]): string[] {
  const visited = new Set<string>()
  const queue = [nodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of edges) {
      if (edge.source !== current || visited.has(edge.target)) continue
      visited.add(edge.target)
      queue.push(edge.target)
    }
  }

  return Array.from(visited)
}

export function levelOfNode(nodeId: string, edges: Edge[]): number {
  const visit = new Map<string, number>()

  function depth(currentId: string): number {
    const cached = visit.get(currentId)
    if (cached !== undefined) return cached

    const parents = edges
      .filter((edge) => edge.target === currentId)
      .map((edge) => edge.source)

    if (parents.length === 0) {
      visit.set(currentId, 0)
      return 0
    }

    const maxDepth = Math.max(...parents.map((parentId) => depth(parentId) + 1))
    visit.set(currentId, maxDepth)
    return maxDepth
  }

  return depth(nodeId)
}

/**
 * An edge is upstream when it carries flow *into* the selected node, i.e. its
 * source is an ancestor. Checking only the endpoints' membership would miscolour
 * an edge that merely happens to join two ancestors on an unrelated branch, so
 * the target must also be an ancestor or the selection itself.
 */
export function edgeRelation(
  edge: Edge,
  selectedId: string | null,
  relations: Relations,
): RelationKind {
  if (!selectedId) return 'none'

  const sourceUp = relations.upstream.has(edge.source)
  const targetUp = relations.upstream.has(edge.target)
  if (sourceUp && (targetUp || edge.target === selectedId)) return 'upstream'

  const targetDown = relations.downstream.has(edge.target)
  const sourceDown = relations.downstream.has(edge.source)
  if (targetDown && (sourceDown || edge.source === selectedId)) return 'downstream'

  return 'none'
}

/** Token names, so the palette stays in tokens.css rather than being hardcoded. */
export const RELATION_COLOR: Record<Exclude<RelationKind, 'none'>, string> = {
  selected: 'var(--primary)',
  upstream: 'var(--chart-3)',
  downstream: 'var(--chart-2)',
}

export const RELATION_LABEL: Record<Exclude<RelationKind, 'none'>, string> = {
  selected: 'Selected',
  upstream: 'Upstream',
  downstream: 'Downstream',
}
