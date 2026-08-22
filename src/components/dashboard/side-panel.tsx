'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const MIN_W = 180
const MAX_W = 560
const DEFAULT_W = 260
const COLLAPSED_W = 32

interface SidePanelProps {
  side: 'left' | 'right'
  title: string
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
  focused?: boolean
  onFocusCapture?: () => void
}

export default function SidePanel({
  side,
  title,
  collapsed,
  onToggle,
  children,
  focused = false,
  onFocusCapture,
}: SidePanelProps) {
  const [width, setWidth] = useState(DEFAULT_W)
  const draggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      draggingRef.current = true
      const startX = e.clientX
      const startW = width

      const onMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return
        const delta = ev.clientX - startX
        const next = side === 'left' ? startW + delta : startW - delta
        setWidth(Math.min(MAX_W, Math.max(MIN_W, next)))
      }
      const onUp = () => {
        draggingRef.current = false
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [side, width],
  )

  useEffect(() => {
    if (collapsed) {
      document.body.style.userSelect = ''
    }
  }, [collapsed])

  if (collapsed) {
    return (
      <div
        className={cn(
          'flex shrink-0 flex-col items-center py-2 border-b border-border bg-surface h-full',
          side === 'left' ? 'border-r' : 'border-l',
        )}
        style={{ width: COLLAPSED_W }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Expand ${title}`}
          title={`Expand ${title}`}
          className="inline-flex items-center justify-center h-[var(--icon-btn)] w-[var(--icon-btn)] text-text-muted hover:text-text hover:bg-surface-hover mb-4 shrink-0"
        >
          {side === 'left' ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronLeft size={14} strokeWidth={1.5} />}
        </button>
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
          <span className="text-vertical label-caps text-text-muted select-none">{title}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={onFocusCapture}
      className={cn(
        'relative flex shrink-0 flex-col bg-surface',
        side === 'left' ? 'border-r' : 'border-l',
        'border-border',
        focused && 'ring-1 ring-inset ring-primary/40',
      )}
      style={{ width }}
    >
      <div className="flex h-[var(--viewtabs-h)] shrink-0 items-center justify-between border-b border-border px-3">
        <span className="label-caps">{title}</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Collapse ${title}`}
          title={`Collapse ${title}`}
          className="inline-flex items-center justify-center h-[var(--icon-btn)] w-[var(--icon-btn)] text-text-muted hover:text-text hover:bg-surface-hover"
        >
          {side === 'left' ? <ChevronLeft size={14} strokeWidth={1.5} /> : <ChevronRight size={14} strokeWidth={1.5} />}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title}`}
        aria-valuenow={width}
        aria-valuemin={MIN_W}
        aria-valuemax={MAX_W}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' && side === 'right') setWidth((w) => Math.min(MAX_W, w + 16))
          if (e.key === 'ArrowRight' && side === 'left') setWidth((w) => Math.min(MAX_W, w + 16))
          if (e.key === 'ArrowLeft' && side === 'left') setWidth((w) => Math.max(MIN_W, w - 16))
          if (e.key === 'ArrowRight' && side === 'right') setWidth((w) => Math.max(MIN_W, w - 16))
        }}
        className={cn(
          'absolute top-0 bottom-0 w-[12px] cursor-col-resize z-50 flex items-center justify-center transition-colors',
          'hover:bg-primary/20 focus:bg-primary/20 bg-transparent',
          side === 'left' ? 'right-0 translate-x-[6px]' : 'left-0 -translate-x-[6px]',
        )}
        style={{ touchAction: 'none' }}
      >
        {/* 6x2 dot grip handle */}
        <div className="flex flex-col gap-0.5 items-center justify-center py-1 bg-surface border border-border rounded shadow-sm opacity-60 hover:opacity-100 transition-opacity">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-0.5 px-0.5">
              <div className="size-0.5 rounded-full bg-text-muted" />
              <div className="size-0.5 rounded-full bg-text-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// re-export ChevronDown to silence unused warning if imported elsewhere
export { ChevronDown }
