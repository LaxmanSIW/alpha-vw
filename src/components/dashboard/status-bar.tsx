'use client'

interface StatusBarProps {
  nodeCount: number
  edgeCount: number
  selectedLabel: string | null
  focusedPane: 'nav' | 'canvas' | 'details'
}

export default function StatusBar({ nodeCount, edgeCount, selectedLabel, focusedPane }: StatusBarProps) {
  return (
    <footer className="flex h-[var(--footer-h)] shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-[11px] text-text-muted">
      <div className="flex items-center gap-3">
        <span>
          Nodes: <strong className="text-text">{nodeCount}</strong>
        </span>
        <span>
          Edges: <strong className="text-text">{edgeCount}</strong>
        </span>
        {selectedLabel && (
          <span className="text-text-secondary">
            Selected: <strong className="text-text">{selectedLabel}</strong>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="uppercase tracking-wider">Focus: <strong className="text-text">{focusedPane}</strong></span>
      </div>
    </footer>
  )
}
