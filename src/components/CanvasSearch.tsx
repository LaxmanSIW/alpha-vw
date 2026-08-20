import { useEffect, useMemo, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import Icon from './Icon'
import type { FlatNodeData } from './FlatNode'

interface CanvasSearchProps {
  nodes: Node[]
  onPick: (nodeId: string) => void
  onClose: () => void
}

/**
 * Floating live-search over the canvas, opened from the action bar.
 *
 * Sits at top-centre of the canvas rather than in the toolbar so the results
 * list can drop straight over the graph it is filtering -- a toolbar-anchored
 * dropdown would open away from the thing being searched.
 */
function CanvasSearch({ nodes, onPick, onClose }: CanvasSearchProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Autofocus on open: the user clicked search to type, so making them click
  // again into the field is a wasted interaction.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return nodes.filter((node) => {
      const data = node.data as FlatNodeData
      return (
        data.label?.toLowerCase().includes(q) || data.kind?.toLowerCase().includes(q)
      )
    })
  }, [nodes, query])

  // Clamp rather than reset, so narrowing the query does not throw the
  // highlight to an unrelated row.
  const safeIndex = Math.min(activeIndex, Math.max(0, matches.length - 1))

  function pick(nodeId: string) {
    onPick(nodeId)
    onClose()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(matches.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter' && matches[safeIndex]) {
      event.preventDefault()
      pick(matches[safeIndex].id)
    }
  }

  return (
    <div
      // Double-click to dismiss, as specified. Escape and the toolbar toggle do
      // the same thing -- double-click alone is not discoverable, so it is an
      // addition to the usual exits rather than the only one.
      onDoubleClick={onClose}
      onKeyDown={onKeyDown}
      className="absolute top-2 left-1/2 z-20 w-80 -translate-x-1/2 border border-border-strong bg-surface"
      role="search"
    >
      <div className="flex h-control items-center border-b border-border">
        <span className="flex w-7 shrink-0 items-center justify-center text-text-muted">
          <Icon name="search" size={13} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          placeholder="Search nodes"
          aria-label="Search nodes"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          title="Close search (Esc)"
          aria-label="Close search"
          className="flex w-7 shrink-0 items-center justify-center text-text-muted hover:text-text"
        >
          <Icon name="close" size={12} />
        </button>
      </div>

      {query.trim() && (
        <ul role="listbox" className="max-h-64 overflow-auto">
          {matches.map((node, index) => {
            const data = node.data as FlatNodeData
            const isActive = index === safeIndex
            return (
              <li key={node.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(node.id)}
                  className={[
                    'flex h-row w-full items-center gap-2 px-2 text-left text-sm',
                    isActive
                      ? 'bg-surface-selected text-text'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                  ].join(' ')}
                >
                  <span className="shrink-0 text-text-muted">
                    <Icon name="node" size={12} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{data.label}</span>
                  <span className="label-caps shrink-0">{data.kind}</span>
                </button>
              </li>
            )
          })}
          {matches.length === 0 && (
            <li className="px-2 py-2 text-sm text-text-muted">No matching nodes.</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default CanvasSearch
