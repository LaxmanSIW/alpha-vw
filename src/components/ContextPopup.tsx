import { useEffect, useMemo } from 'react'
import type { Edge } from '@xyflow/react'
import type { ContextMenuAction, ContextMenuItem, ContextMenuState, PopupSide } from '../types'
import { POPUP_CONFIG } from '../config/viewConfig'

const MENU_WIDTH = POPUP_CONFIG.MENU_WIDTH
const MENU_HEIGHT = POPUP_CONFIG.MENU_HEIGHT
const LIST_WIDTH = POPUP_CONFIG.LIST_WIDTH
const LIST_HEIGHT = POPUP_CONFIG.LIST_HEIGHT
const GAP = POPUP_CONFIG.GAP

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function calculatePopupPlacement(
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  preferredSide: PopupSide = 'right',
): { x: number; y: number; side: PopupSide } {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const place = (side: PopupSide) => {
    switch (side) {
      case 'right': {
        const fitsRight = anchorX + width <= viewportWidth - 8
        const x = fitsRight ? anchorX : anchorX - width
        return {
          side,
          x: clamp(x, 8, viewportWidth - width - 8),
          y: clamp(anchorY, 8, viewportHeight - height - 8),
        }
      }
      case 'bottom': {
        const fitsBottom = anchorY + height <= viewportHeight - 8
        const y = fitsBottom ? anchorY : anchorY - height
        return {
          side,
          x: clamp(anchorX, 8, viewportWidth - width - 8),
          y: clamp(y, 8, viewportHeight - height - 8),
        }
      }
      case 'left': {
        const fitsLeft = anchorX - width >= 8
        const x = fitsLeft ? anchorX - width : anchorX
        return {
          side,
          x: clamp(x, 8, viewportWidth - width - 8),
          y: clamp(anchorY, 8, viewportHeight - height - 8),
        }
      }
      case 'top': {
        const fitsTop = anchorY - height >= 8
        const y = fitsTop ? anchorY - height : anchorY
        return {
          side,
          x: clamp(anchorX, 8, viewportWidth - width - 8),
          y: clamp(y, 8, viewportHeight - height - 8),
        }
      }
    }
  }

  const ordered = preferredSide === 'right'
    ? ['right', 'bottom', 'left', 'top']
    : preferredSide === 'left'
      ? ['left', 'bottom', 'right', 'top']
      : preferredSide === 'top'
        ? ['top', 'right', 'bottom', 'left']
        : ['bottom', 'right', 'left', 'top']

  const candidate = ordered
    .map((side) => place(side as PopupSide))
    .find((entry) => {
      const xInBounds = entry.x >= 8 && entry.x + width <= viewportWidth - 8
      const yInBounds = entry.y >= 8 && entry.y + height <= viewportHeight - 8
      return xInBounds && yInBounds
    })

  return candidate ?? place(preferredSide)
}

function statusClass(status: ContextMenuItem['status']) {
  if (status === 'danger') return 'bg-danger-fg'
  if (status === 'warning') return 'bg-warning-fg'
  return 'bg-success-fg'
}

interface ContextPopupProps {
  menu: ContextMenuState | null
  onClose: () => void
  onSelectNode: (id: string) => void
  onSelectAction?: (nodeId: string, actionId: string) => void
}

export default function ContextPopup({
  menu,
  onClose,
  onSelectNode,
  onSelectAction,
}: ContextPopupProps) {
  useEffect(() => {
    if (!menu) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-context-popup="true"]')) return
      onClose()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu, onClose])

  const placement = useMemo(() => {
    if (!menu) return null
    
    // For list, use coordinates directly (already calculated)
    if (menu.kind === 'list') {
      return {
        x: menu.x,
        y: menu.y,
        side: menu.side,
      }
    }
    
    // For menu, calculate placement
    return calculatePopupPlacement(menu.x, menu.y, MENU_WIDTH, MENU_HEIGHT, menu.side)
  }, [menu])

  if (!menu || !placement) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50" data-context-popup="true">
      <div
        className="pointer-events-auto absolute overflow-hidden border border-border-strong bg-surface text-text shadow-sm"
        style={{
          left: placement.x,
          top: placement.y,
          width: menu.kind === 'menu' ? MENU_WIDTH : LIST_WIDTH,
          minHeight: menu.kind === 'menu' ? MENU_HEIGHT : LIST_HEIGHT,
        }}
      >
        {menu.kind === 'menu' ? (
          <div className="flex flex-col py-1">
            {(menu.options ?? []).map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onSelectAction?.(menu.nodeId, option.id)
                }}
                className="flex h-9 w-full items-center justify-between px-3 text-left text-sm text-text-secondary hover:bg-surface-hover hover:text-text"
              >
                <span>{option.label}</span>
                <span aria-hidden="true" className="text-xs text-text-muted">→</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col" style={{ maxHeight: LIST_HEIGHT }}>
            <div className="border-b border-border bg-surface-sunken px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
              {menu.relation === 'predecessors' ? 'Predecessors' : 'Successors'}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: LIST_HEIGHT - 40 }}>
              {(menu.items ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelectNode(item.id)
                    onClose()
                  }}
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left hover:bg-surface-hover"
                >
                  <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 ${statusClass(item.status)}`} />
                  <span className="min-w-10 text-xs font-medium text-text-muted">L{item.level}</span>
                  <span className="truncate text-sm text-text">{item.name}</span>
                </button>
              ))}
              {(menu.items ?? []).length === 0 && (
                <div className="px-3 py-3 text-sm text-text-muted">No related nodes</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
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

export function getContextMenuActionOptions(actions: ContextMenuAction[] = []) {
  return actions.length > 0 ? actions : [{ id: 'predecessors', label: 'Predecessors', kind: 'predecessors' }, { id: 'successors', label: 'Successors', kind: 'successors' }]
}

export function nextContextMenuState(
  menu: ContextMenuState,
  actionId: string,
  edges: Edge[],
  nodesById: Map<string, { id: string; label: string; status?: ContextMenuItem['status']; data?: Record<string, unknown> }>,
): ContextMenuState {
  const relation = actionId === 'predecessors' ? 'predecessors' : 'successors'
  const items = buildContextMenuItems(menu.nodeId, relation, edges, nodesById)
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Determine which side the list should go
  let side: PopupSide = menu.side

  if (menu.side === 'right') {
    // Menu is on right side
    // Case 1: (right, right) - try right first
    // Case 2: (right, left) - fallback to left
    const fitsRight = menu.x + MENU_WIDTH + GAP + LIST_WIDTH <= viewportWidth - 8
    const fitsLeft = menu.x - GAP - LIST_WIDTH >= 8
    side = fitsRight ? 'right' : fitsLeft ? 'left' : 'right'
  } else if (menu.side === 'left') {
    // Menu is on left side
    // Case 3: (left, left) - try left first
    // Case 4: (left, right) - fallback to right
    const fitsLeft = menu.x - GAP - LIST_WIDTH >= 8
    const fitsRight = menu.x + MENU_WIDTH + GAP + LIST_WIDTH <= viewportWidth - 8
    side = fitsLeft ? 'left' : fitsRight ? 'right' : 'left'
  }

  // Position list based on menu side + list side
  let x: number
  let y: number

  if (menu.side === 'right') {
    if (side === 'right') {
      // Case 1: (right, right)
      // List: (x+menuWidth+gap, y)
      x = clamp(menu.x + MENU_WIDTH + GAP, 8, viewportWidth - LIST_WIDTH - 8)
    } else {
      // Case 2: (right, left)
      // List: (x-gap-listwidth, y)
      x = clamp(menu.x - GAP - LIST_WIDTH, 8, viewportWidth - LIST_WIDTH - 8)
    }
  } else if (menu.side === 'left') {
    if (side === 'left') {
      // Case 3: (left, left)
      // Menu left edge = menu.x
      // List right edge = menu.x - GAP (gap between them)
      // List left edge = menu.x - GAP - LIST_WIDTH
      x = menu.x - GAP - LIST_WIDTH
    } else {
      // Case 4: (left, right)
      x = clamp(menu.x + MENU_WIDTH + GAP, 8, viewportWidth - LIST_WIDTH - 8)
    }
  } else {
    x = clamp(menu.x, 8, viewportWidth - LIST_WIDTH - 8)
  }

  y = clamp(menu.y, 8, viewportHeight - LIST_HEIGHT - 8)

  console.log('=== Context Popup ===')
  console.log('Menu:', { x: menu.x, y: menu.y, side: menu.side, width: MENU_WIDTH, height: MENU_HEIGHT })
  console.log('List:', { x, y, side, width: LIST_WIDTH, height: LIST_HEIGHT })
  console.log('Menu edges: left=' + menu.x + ', right=' + (menu.x + MENU_WIDTH))
  console.log('List edges: left=' + x + ', right=' + (x + LIST_WIDTH))
  console.log('Gap: ' + (menu.side === 'right' && side === 'right' ? menu.x + MENU_WIDTH + 10 - (menu.x + MENU_WIDTH) : menu.x - 10 - (x + LIST_WIDTH)))

  return {
    kind: 'list',
    nodeId: menu.nodeId,
    x,
    y,
    side,
    relation,
    items,
  }
}
