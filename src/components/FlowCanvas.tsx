import { useMemo } from 'react'
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
import FlatNode from './FlatNode'
import ContainerNode from './ContainerNode'
import {
  RELATION_LABEL,
  edgeRelation,
  getRelationColor,
  getRelationOutlineWidth,
  getRelations,
  relationOf,
} from '../graph'

interface FlowCanvasProps {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  onNodeClick: NodeMouseHandler
  onNodeContextMenu?: NodeMouseHandler
  onPaneClick: () => void
  onPaneContextMenu?: (event: MouseEvent | React.MouseEvent) => void
  children?: React.ReactNode
}

/**
 * Read-only topology canvas.
 *
 * Nodes cannot be dragged, connected, or deleted -- this is a view of a graph
 * that lives elsewhere, and letting someone nudge a node would imply an edit that
 * is never persisted. Panning and zooming stay enabled because those change the
 * viewport, not the data.
 *
 * Positions and container sizes are computed upstream in layoutHierarchy; this
 * component only adds the relation colouring on top.
 */
function FlowCanvas({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  onNodeContextMenu,
  onPaneClick,
  onPaneContextMenu,
  children,
}: FlowCanvasProps) {
  // Stable identity: React Flow remounts every node if nodeTypes changes.
  const nodeTypes = useMemo(() => ({ flat: FlatNode, container: ContainerNode }), [])

  const relations = useMemo(
    () => getRelations(edges, selectedNodeId),
    [edges, selectedNodeId],
  )

  const displayNodes = useMemo(
    () =>
      nodes.map((node) => {
        // Containers are structure, not participants -- they never take a
        // relation colour, or every box would light up whenever anything inside
        // it was selected.
        if (node.type === 'container') return node
        const relation = relationOf(node.id, selectedNodeId, relations)
        if ((node.data as { relation?: string }).relation === relation) return node
        return { ...node, data: { ...node.data, relation } }
      }),
    [nodes, selectedNodeId, relations],
  )

  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        const relation = edgeRelation(edge, selectedNodeId, relations)
        if (relation === 'none') {
          return { ...edge, style: { stroke: 'var(--border-strong)', strokeWidth: 1 } }
        }
        return {
          ...edge,
          style: { stroke: getRelationColor(relation), strokeWidth: 2 },
          animated: true,
          zIndex: 2,
        }
      }),
    [edges, selectedNodeId, relations],
  )

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
      // Straight point-to-point lines. Smoothstep added corners that read as
      // routing decisions the graph is not actually making.
      defaultEdgeOptions={{ type: 'straight' }}
      minZoom={0.1}
      maxZoom={2}
      // --- read-only ---
      nodesDraggable={false}
      nodesConnectable={false}
      edgesReconnectable={false}
      deleteKeyCode={null}
      elementsSelectable
    >
      {/* Dots rather than lines: a grid competes with the container borders, and
          here borders carry all the structure. */}
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

/** Without a key the relation colours are decoration -- nobody can be expected
 * to infer that orange means upstream. */
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

export default FlowCanvas
