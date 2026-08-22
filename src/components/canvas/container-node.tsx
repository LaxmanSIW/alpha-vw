'use client'

import { memo } from 'react'
import { Folder } from 'lucide-react'
import type { NodeProps } from '@xyflow/react'

export interface ContainerNodeData extends Record<string, unknown> {
  label: string
  count: number
}

function ContainerNodeInner({ data }: NodeProps) {
  const { label, count } = data as ContainerNodeData
  return (
    <div className="pointer-events-none h-full w-full border border-border-strong bg-transparent">
      <div className="pointer-events-auto flex h-9 items-center gap-1.5 border-b border-border bg-surface-sunken px-2">
        <Folder size={11} strokeWidth={1.5} className="shrink-0 text-text-muted" />
        <span className="label-caps truncate">{label}</span>
        <span className="ml-auto shrink-0 text-xs text-text-muted">{count}</span>
      </div>
    </div>
  )
}

const ContainerNode = memo(ContainerNodeInner)
export default ContainerNode
