'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type {
  ContextMenuState,
  ContextMenuItem,
  ContextRelationKind,
  PopupSide,
} from '@/lib/types'
import type { AdjacencyMaps } from '@/lib/graph'
import { directPredecessors, directSuccessors } from '@/lib/graph'
import { statusHex } from '@/lib/fields'
import { POPUP_CONFIG } from '@/lib/view-config'
import { cn } from '@/lib/utils'

interface ContextPopupProps {
  menu: ContextMenuState
  onClose: () => void
  onSelectNode?: (id: string) => void
  onSelectAction?: (nodeId: string, actionId: string) => void
}

export default function ContextPopup({ menu, onClose, onSelectNode, onSelectAction }: ContextPopupProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Compute clamped position synchronously at render time (avoids setState in effect).
  // We use the menu's intended width to estimate; final adjustment happens via CSS
  // overflow guard, not state. For an exact fit, we'd need useLayoutEffect, but the
  // sync approach is good enough — modals will adjust their own overflow.
  const width = menu.kind === 'menu' ? POPUP_CONFIG.MENU_WIDTH : POPUP_CONFIG.LIST_WIDTH
  const height = menu.kind === 'menu' ? POPUP_CONFIG.MENU_HEIGHT : 360

  const adjustedX = Math.min(
    Math.max(menu.x, 8),
    (typeof window !== 'undefined' ? window.innerWidth : 1200) - width - 8,
  )
  const adjustedY = Math.min(
    Math.max(menu.y, 8),
    (typeof window !== 'undefined' ? window.innerHeight : 800) - height - 8,
  )

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
      <div className="fixed inset-0 z-40" aria-hidden onClick={onClose} />
      <div
        ref={ref}
        role={menu.kind === 'menu' ? 'menu' : 'dialog'}
        className={cn('fixed z-50 border border-border-strong bg-surface text-text')}
        style={{ left: adjustedX, top: adjustedY, width, maxHeight: 360 }}
      >
        {menu.kind === 'menu' ? (
          <ul className="py-1">
            {(menu.options ?? []).map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectAction?.(menu.nodeId, opt.id)
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-text hover:bg-primary/10 hover:text-primary text-left"
                >
                  <span>{opt.label}</span>
                  <ChevronRight size={11} strokeWidth={1.5} className="text-text-muted" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ContextList menu={menu} onSelectNode={onSelectNode} />
        )}
      </div>
    </>
  )
}

function ContextList({
  menu,
  onSelectNode,
}: {
  menu: ContextMenuState
  onSelectNode?: (id: string) => void
}) {
  const items = menu.items ?? []
  const heading = menu.relation === 'predecessors' ? 'Predecessors' : 'Successors'

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="label-caps">{heading}</span>
        <span className="text-[10px] text-text-muted">{items.length}</span>
      </div>
      <ul className="max-h-72 overflow-auto py-1">
        {items.length === 0 ? (
          <li className="px-3 py-3 text-center text-xs text-text-muted">No {heading.toLowerCase()} found</li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelectNode?.(item.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-hover text-left"
              >
                <span
                  className="inline-block size-2 shrink-0"
                  style={{ backgroundColor: statusHex(item.status) }}
                  aria-hidden
                />
                <span className="truncate">{item.name}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

// ─── Placement helpers ────────────────────────────────────────────────────

export function calculatePopupPlacement(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  side: PopupSide,
): { x: number; y: number; side: PopupSide } {
  let x = clientX
  let y = clientY
  if (x + width > window.innerWidth - 8) x = clientX - width
  if (y + height > window.innerHeight - 8) y = clientY - height
  if (x < 8) x = 8
  if (y < 8) y = 8
  return { x, y, side }
}

export function nextContextMenuState(
  current: ContextMenuState,
  actionId: string,
  adjacency: AdjacencyMaps,
  nodeMap: Map<string, { id: string; label: string; status: string; data: Record<string, unknown> }>,
): ContextMenuState & { items: ContextMenuItem[] } {
  let ids: string[] = []
  let relation: ContextRelationKind = 'predecessors'
  if (actionId === 'predecessors') {
    ids = directPredecessors(adjacency, current.nodeId)
    relation = 'predecessors'
  } else if (actionId === 'successors') {
    ids = directSuccessors(adjacency, current.nodeId)
    relation = 'successors'
  }
  const items: ContextMenuItem[] = ids.map((id) => {
    const meta = nodeMap.get(id)
    return {
      id,
      name: meta?.label ?? id,
      status: meta?.status ?? 'ok',
      level: 0,
    }
  })
  return {
    ...current,
    kind: 'list',
    relation,
    items,
  }
}
