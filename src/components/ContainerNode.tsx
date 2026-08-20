import type { NodeProps } from '@xyflow/react'
import Icon from './Icon'

export interface ContainerNodeData extends Record<string, unknown> {
  label: string
  count: number
}

/**
 * Folder container: a titled box that jobs and nested folders sit inside.
 *
 * Only the header carries a fill; the body stays transparent so a container two
 * or three levels deep does not stack tint on tint and turn the innermost jobs
 * grey. Depth is read from the nested borders and the indented headers instead,
 * which is the flat-design substitute for the shadow a real product would use to
 * lift each level.
 *
 * pointer-events-none on the body lets clicks fall through to the canvas, so
 * dragging to pan still works over the empty area inside a box.
 */
function ContainerNode({ data }: NodeProps) {
  const { label, count } = data as ContainerNodeData

  return (
    <div className="pointer-events-none h-full w-full border border-border-strong bg-transparent">
      <div className="pointer-events-auto flex h-6 items-center gap-1.5 border-b border-border bg-surface-sunken px-2">
        <span className="shrink-0 text-text-muted">
          <Icon name="folder" size={11} />
        </span>
        <span className="label-caps truncate">{label}</span>
        <span className="ml-auto shrink-0 text-xs text-text-muted">{count}</span>
      </div>
    </div>
  )
}

export default ContainerNode
