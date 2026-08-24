'use client'

import { useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Edge } from '@xyflow/react'
import type {
  ContextMenuState,
  ContextMenuItem,
  ContextRelationKind,
  PopupSide,
} from '@/lib/types'
import { statusHex } from '@/lib/fields'
import { POPUP_CONFIG } from '@/lib/view-config'
import { cn } from '@/lib/utils'

interface ContextPopupProps {
  menu: ContextMenuState
  onClose: () => void
  onSelectNode?: (id: string) => void
  onSelectAction?: (nodeId: string, actionId: string) => void
  hideScrim?: boolean
}

export default function ContextPopup({ menu, onClose, onSelectNode, onSelectAction, hideScrim = false }: ContextPopupProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Compute clamped position synchronously at render time (avoids setState in effect).
  // We use the menu's intended width to estimate; final adjustment happens via CSS
  // overflow guard, not state. For an exact fit, we'd need useLayoutEffect, but the
  // sync approach is good enough — modals will adjust their own overflow.
  const width = menu.kind === 'menu' ? POPUP_CONFIG.MENU_WIDTH : POPUP_CONFIG.LIST_WIDTH

  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800

  const adjustedX = Math.min(
    Math.max(menu.x, 8),
    winW - width - 8,
  )
  const adjustedY = Math.max(menu.y, 8)
  const maxAvailableHeight = Math.max(160, winH - adjustedY - 12)

  // Click outside closes
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [onClose])

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Scrim — invisible, but catches pointerdown to close */}
      {!hideScrim && <div className="fixed inset-0 z-40 pointer-events-auto" aria-hidden onClick={onClose} />}
      <div
        ref={ref}
        role={menu.kind === 'menu' ? 'menu' : 'dialog'}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn('fixed z-50 border border-border-strong bg-surface text-text shadow-lg rounded-md overflow-hidden pointer-events-auto')}
        style={{
          left: adjustedX,
          top: adjustedY,
          width,
          maxHeight: menu.kind === 'menu' ? POPUP_CONFIG.MENU_HEIGHT : Math.min(360, maxAvailableHeight),
        }}
      >
        {menu.kind === 'menu' ? (
          <ul className="py-1">
            {(menu.options ?? []).map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelectAction?.(menu.nodeId, opt.id)
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-text hover:bg-primary/10 hover:text-primary text-left cursor-pointer"
                >
                  <span>{opt.label}</span>
                  <ChevronRight size={11} strokeWidth={1.5} className="text-text-muted" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ContextList menu={menu} onSelectNode={onSelectNode} onClose={onClose} />
        )}
      </div>
    </>
  )
}

function ContextList({
  menu,
  onSelectNode,
  onClose,
}: {
  menu: ContextMenuState
  onSelectNode?: (id: string) => void
  onClose?: () => void
}) {
  const items = menu.items ?? []
  const heading = menu.relation === 'predecessors' ? 'Predecessors' : 'Successors'

  return (
    <div className="flex flex-col max-h-[380px]">
      <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted shrink-0">
        <span>{heading}</span>
        <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 border border-border">{items.length}</span>
      </div>
      <ul className="overflow-y-auto py-1 divide-y divide-border min-h-0 flex-1">
        {items.length === 0 ? (
          <li className="px-3 py-4 text-center text-xs text-text-muted">No {heading.toLowerCase()} found</li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onSelectNode?.(item.id)
                  onClose?.()
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-hover text-left transition-colors cursor-pointer"
              >
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: statusHex(item.status) }}
                  aria-hidden
                />
                <span className="min-w-6 text-[10px] font-mono font-semibold text-primary/90 bg-primary/10 px-1 py-0.5 rounded text-center">
                  L{item.level}
                </span>
                <span className="truncate text-xs text-text font-medium">{item.name}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

// ─── Placement & Multi-level Traversal helpers ──────────────────────────

export function calculatePopupPlacement(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  side: PopupSide,
): { x: number; y: number; side: PopupSide } {
  let x = clientX
  let y = clientY
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800

  if (x + width > winW - 8) x = Math.max(8, clientX - width)
  if (y + height > winH - 8) y = Math.max(8, winH - height - 8)
  if (x < 8) x = 8
  if (y < 8) y = 8
  return { x, y, side }
}

export function buildContextMenuItems(
  sourceNodeId: string,
  relation: 'predecessors' | 'successors',
  edges: Edge[],
  nodesById: Map<string, { id: string; label: string; status?: ContextMenuItem['status']; data?: Record<string, unknown> }>,
): ContextMenuItem[] {
  const bestByNode = new Map<string, number>([[sourceNodeId, 0]])
  const queue: Array<{ id: string; level: number }> = [{ id: sourceNodeId, level: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of edges) {
      const nextId = relation === 'predecessors' ? edge.source : edge.target
      const currentId = relation === 'predecessors' ? edge.target : edge.source
      if (currentId !== current.id) continue

      const nextLevel = current.level + 1
      const existingLevel = bestByNode.get(nextId)
      if (existingLevel === undefined || nextLevel > existingLevel) {
        bestByNode.set(nextId, nextLevel)
        queue.push({ id: nextId, level: nextLevel })
      }
    }
  }

  return Array.from(bestByNode.entries())
    .filter(([id]) => id !== sourceNodeId)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([id, level]) => {
      const node = nodesById.get(id)
      return {
        id,
        name: node?.label ?? id,
        status: (node?.data?.status as ContextMenuItem['status']) ?? (node?.status ?? 'ok'),
        level,
      }
    })
}

export function nextContextMenuState(
  current: ContextMenuState,
  actionId: string,
  edges: Edge[],
  nodeMap: Map<string, { id: string; label: string; status: string; data: Record<string, unknown> }>,
): ContextMenuState & { items: ContextMenuItem[] } {
  const relation: ContextRelationKind = actionId === 'predecessors' ? 'predecessors' : 'successors'
  const items = buildContextMenuItems(current.nodeId, relation, edges, nodeMap)
  return {
    ...current,
    kind: 'list',
    relation,
    items,
  }
}
