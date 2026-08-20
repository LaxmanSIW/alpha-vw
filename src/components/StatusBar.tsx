import type { PaneId } from '../types'

interface StatusBarProps {
  nodeCount: number
  edgeCount: number
  selectedLabel: string | null
  focusedPane: PaneId
  zoomLabel?: string
}

const PANE_LABEL: Record<PaneId, string> = {
  nav: 'Navigation',
  canvas: 'Canvas',
  details: 'Details',
}

/**
 * Thin status bar. 24px tall with 11px text -- about as thin as this can be
 * while the text stays readable; the originally-specced 10px could not fit a
 * glyph at all.
 *
 * Counts use tabular figures (inherited from the base layer) so the bar does not
 * reflow as numbers change during editing.
 */
function StatusBar({
  nodeCount,
  edgeCount,
  selectedLabel,
  focusedPane,
  zoomLabel,
}: StatusBarProps) {
  return (
    <footer className="flex h-footer shrink-0 items-center gap-2 border-t border-border-strong bg-surface-sunken px-2 text-xs text-text-muted">
      <span>
        Nodes <span className="font-medium text-text-secondary">{nodeCount}</span>
      </span>
      <Divider />
      <span>
        Edges <span className="font-medium text-text-secondary">{edgeCount}</span>
      </span>
      <Divider />
      <span className="min-w-0 truncate">
        {selectedLabel ? (
          <>
            Selected <span className="font-medium text-text-secondary">{selectedLabel}</span>
          </>
        ) : (
          'No selection'
        )}
      </span>

      <span className="flex-1" />

      <span className="hidden sm:inline">Focus {PANE_LABEL[focusedPane]}</span>
      {zoomLabel && (
        <>
          <Divider />
          <span>{zoomLabel}</span>
        </>
      )}
      <Divider />
      <span>Ready</span>
    </footer>
  )
}

function Divider() {
  return <span aria-hidden="true" className="h-2.5 w-px shrink-0 bg-border" />
}

export default StatusBar
