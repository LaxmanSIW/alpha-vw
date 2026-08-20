import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_W = 180
const MAX_W = 560

interface Options {
  /** Which edge the panel is docked to. Determines drag direction sign. */
  side: 'left' | 'right'
  initialWidth?: number
  min?: number
  max?: number
}

/**
 * Drag-to-resize for a docked side panel.
 *
 * Pointer events (not mouse events) so a pen or touch drag works, and
 * setPointerCapture so the drag survives the cursor leaving the 4px handle --
 * without capture, a fast drag detaches from the handle and the panel stops
 * following, which feels broken.
 */
export function useResizablePanel({ side, initialWidth = 260, min = MIN_W, max = MAX_W }: Options) {
  const [width, setWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)

  // Held in refs so the move handler stays referentially stable and does not
  // need to be torn down and rebound on every pointer move.
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      startX.current = event.clientX
      startWidth.current = width
      setIsResizing(true)
    },
    [width],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizing) return
      const delta = event.clientX - startX.current
      // A left-docked panel grows as the pointer moves right; a right-docked
      // panel grows as it moves left.
      const raw = side === 'left' ? startWidth.current + delta : startWidth.current - delta
      setWidth(Math.min(max, Math.max(min, raw)))
    },
    [isResizing, side, min, max],
  )

  const stop = useCallback(() => setIsResizing(false), [])

  // While dragging, force the resize cursor and kill text selection document
  // wide. Otherwise the cursor flickers back to a caret whenever it crosses
  // text, and the drag selects half the UI.
  useEffect(() => {
    if (!isResizing) return
    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
    }
  }, [isResizing])

  /** Keyboard resize, so the handle is not mouse-only. */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 40 : 8
      const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft'
      const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight'
      if (event.key === grow) {
        event.preventDefault()
        setWidth((w) => Math.min(max, w + step))
      } else if (event.key === shrink) {
        event.preventDefault()
        setWidth((w) => Math.max(min, w - step))
      }
    },
    [side, min, max],
  )

  return {
    width,
    isResizing,
    setWidth,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stop,
      onPointerCancel: stop,
      onKeyDown,
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-valuenow': width,
      'aria-valuemin': min,
      'aria-valuemax': max,
      tabIndex: 0,
    },
  }
}
