'use client'

import { memo, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import FlatNode from './flat-node'
import ContainerNode from './container-node'
import {
  RELATION_LABEL,
  edgeRelation,
  getRelationColor,
  getRelations,
  relationOf,
  type AdjacencyMaps,
} from '@/lib/graph'

interface FlowCanvasProps {
  nodes: Node[]
  edges: Edge[]
  adjacency: AdjacencyMaps
  selectedNodeId: string | null
  onNodeClick: NodeMouseHandler
  onNodeContextMenu?: NodeMouseHandler
  onPaneClick: () => void
  onPaneContextMenu?: (event: MouseEvent | React.MouseEvent) => void
  children?: React.ReactNode
}

/**
 * Read-only topology canvas. Memoized for performance:
 *   - nodeTypes is defined ONCE (avoids React Flow remounting nodes)
 *   - displayNodes/displayEdges patch only the `relation` data when selection
 *     changes, preserving object identity for unchanged nodes
 */
function FlowCanvasInner({
  nodes,
  edges,
  adjacency,
  selectedNodeId,
  onNodeClick,
  onNodeContextMenu,
  onPaneClick,
  onPaneContextMenu,
  children,
}: FlowCanvasProps) {
  // Stable identity — never recreate nodeTypes
  const nodeTypes = useMemo(() => ({ flat: FlatNode, container: ContainerNode }), [])

  const relations = useMemo(
    () => getRelations(adjacency, selectedNodeId),
    [adjacency, selectedNodeId],
  )

  const displayNodes = useMemo(() => {
    const result: Node[] = []
    for (const node of nodes) {
      // Containers are structure, not participants
      if (node.type === 'container') {
        result.push(node)
        continue
      }
      const relation = relationOf(node.id, selectedNodeId, relations)
      const existingRelation = (node.data as { relation?: string }).relation
      if (existingRelation === relation) {
        result.push(node)
      } else {
        result.push({ ...node, data: { ...node.data, relation } })
      }
    }
    return result
  }, [nodes, selectedNodeId, relations])

  const displayEdges = useMemo(() => {
    const result: Edge[] = []
    for (const edge of edges) {
      const relation = edgeRelation(edge, selectedNodeId, relations)
      if (relation === 'none') {
        if ((edge.style as { stroke?: string } | undefined)?.stroke === 'var(--border-strong)') {
          result.push(edge)
        } else {
          result.push({ ...edge, style: { stroke: 'var(--border-strong)', strokeWidth: 1 }, animated: false })
        }
      } else {
        result.push({
          ...edge,
          style: { stroke: getRelationColor(relation), strokeWidth: 2 },
          animated: true,
          zIndex: 2,
        })
      }
    }
    return result
  }, [edges, selectedNodeId, relations])

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={displayEdges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onNodeContextMenu={onNodeContextMenu}
      onPaneClick={onPaneClick}
      onPaneContextMenu={onPaneContextMenu}
      fitView
      defaultEdgeOptions={{ type: 'straight' }}
      minZoom={0.1}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesReconnectable={false}
      deleteKeyCode={null}
      elementsSelectable
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        nodeColor="var(--border-strong)"
        maskColor="var(--scrim)"
      />
      {selectedNodeId && <RelationLegend />}
      {children}
    </ReactFlow>
  )
}

function RelationLegend() {
  const entries = ['selected', 'upstream', 'downstream'] as const
  return (
    <div className="absolute top-2 right-2 z-10 border border-border-strong bg-surface px-2 py-1.5">
      <ul className="flex flex-col gap-1">
        {entries.map((kind) => (
          <li key={kind} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0"
              style={{ backgroundColor: getRelationColor(kind) }}
            />
            <span className="label-caps">{RELATION_LABEL[kind]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const FlowCanvas = memo(FlowCanvasInner)
export default FlowCanvas
