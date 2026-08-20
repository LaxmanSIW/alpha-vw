import Icon from './Icon'
import { useResizablePanel } from '../hooks/useResizablePanel'

interface SidePanelProps {
  side: 'left' | 'right'
  title: string
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
  /** Marks this pane as focused so context-sensitive actions can target it. */
  onFocusCapture?: () => void
  focused?: boolean
}

/**
 * A docked panel that collapses to a narrow rail and can be dragged wider.
 *
 * Collapsed, it shows the toggle arrow plus its title set vertically, so the
 * rail still says what it is instead of being an anonymous strip. Expanded, it
 * gets a header and a drag handle on its inner edge.
 *
 * The same component serves both sides -- the only differences are which edge
 * carries the border, which way the chevron points, and the drag direction,
 * all derived from `side`.
 */
function SidePanel({
  side,
  title,
  collapsed,
  onToggle,
  children,
  onFocusCapture,
  focused = false,
}: SidePanelProps) {
  const { width, isResizing, handleProps } = useResizablePanel({ side })

  const isLeft = side === 'left'
  // The border always faces the canvas, so the two panels frame it symmetrically.
  const edgeBorder = isLeft ? 'border-r border-border-strong' : 'border-l border-border-strong'

  if (collapsed) {
    return (
      <div className={`flex w-rail shrink-0 flex-col items-center bg-surface-sunken ${edgeBorder}`}>
        <button
          type="button"
          onClick={onToggle}
          title={`Expand ${title}`}
          aria-label={`Expand ${title}`}
          aria-expanded={false}
          // No hover treatment on the arrows, by request. Focus-visible still
          // applies from the base layer, so keyboard users keep an indicator.
          className="cursor-pointer flex h-rail w-rail items-center justify-center text-text-secondary"
        >
          <Icon name={isLeft ? 'chevron-right' : 'chevron-left'} />
        </button>

        {/* Both rails read bottom-to-top. Mirroring them (one up, one down) makes
            the two sides fight each other optically; bottom-to-top is also the
            established convention for vertical UI labels in tool rails, so it
            costs nothing to learn. */}
        <button
          type="button"
          onClick={onToggle}
          title={`Expand ${title}`}
          aria-label={`Expand ${title}`}
          className="flex flex-1 cursor-pointer items-center justify-center"
        >
          <span className="text-vertical-rev label-caps whitespace-nowrap select-none">
            {title}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      onFocusCapture={onFocusCapture}
      onPointerDownCapture={onFocusCapture}
      className={`relative flex shrink-0 flex-col bg-surface ${edgeBorder}`}
      style={{ width }}
    >
      <div
        className={`flex h-rail shrink-0 items-center gap-1 border-b border-border bg-surface-sunken px-1 ${
          // A 2px accent bar on the outer edge marks the focused pane. It has to
          // be a solid bar because a glow or shadow is unavailable here, and
          // focus needs to be visible without moving any layout.
          focused ? (isLeft ? 'border-l-0 border-l-primary' : 'border-r-0 border-r-primary') : ''
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          title={`Collapse ${title}`}
          aria-label={`Collapse ${title}`}
          aria-expanded
          className="flex size-icon-btn items-center justify-center text-text-secondary cursor-pointer"
        >
          <Icon name={isLeft ? 'chevron-left' : 'chevron-right'} />
        </button>
        <span className="label-caps truncate">{title}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

      {/* Drag handle on the inner edge: a 12px grab strip, wide enough to hit
          without pixel-hunting. It stays transparent until hover so it does not
          read as a second border, but always shows a centred grip so the
          affordance is discoverable rather than something you find by accident.
          Double-click collapses, which is the usual shortcut on a splitter. */}
      <div
        {...handleProps}
        onDoubleClick={onToggle}
        title={`Drag to resize ${title}, double-click to collapse`}
        aria-label={`Resize ${title}`}
        className={[
          'group absolute top-0 z-10 flex h-full w-3 cursor-col-resize items-center justify-center',
          isLeft ? '-right-1.5' : '-left-1.5',
          isResizing ? 'bg-primary/15' : 'bg-transparent hover:bg-primary/10',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'h-8 w-0.5',
            isResizing ? 'bg-primary' : 'bg-border-strong group-hover:bg-primary',
          ].join(' ')}
        />
      </div>
    </div>
  )
}

export default SidePanel
