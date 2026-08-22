'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { cn } from '@/lib/utils'

interface CanvasSearchProps {
  nodes: Node[]
  onPick: (id: string) => void
  onClose: () => void
}

export default function CanvasSearch({ nodes, onPick, onClose }: CanvasSearchProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const matches = useMemo(() => {
    if (!query.trim()) return nodes.slice(0, 50)
    const q = query.toLowerCase()
    return nodes
      .filter((n) => {
        const label = String((n.data as { label?: string })?.label ?? '')
        return label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
      })
      .slice(0, 50)
  }, [nodes, query])

  // Reset active index when query changes — handled in the input onChange, not an effect
  const onQueryChange = (val: string) => {
    setQuery(val)
    setActiveIndex(0)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(matches.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = matches[activeIndex]
      if (picked) onPick(picked.id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      role="search"
      className="absolute top-2 left-2 z-20 w-72 border border-border-strong bg-surface"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <Search size={12} strokeWidth={1.5} className="text-text-muted shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search nodes…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKey}
          className="flex-1 bg-transparent text-xs text-text outline-none placeholder:text-text-muted"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="inline-flex items-center justify-center size-4 text-text-muted hover:text-text"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>
      {matches.length > 0 ? (
        <ul role="listbox" className="max-h-64 overflow-auto">
          {matches.map((n, i) => (
            <li
              key={n.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onPick(n.id)}
              className={cn(
                'cursor-pointer px-2 py-1.5 text-xs',
                i === activeIndex ? 'bg-primary/10 text-primary' : 'text-text hover:bg-surface-hover',
              )}
            >
              <div className="font-medium truncate">
                {(n.data as { label?: string }).label ?? n.id}
              </div>
              <div className="text-[10px] text-text-muted truncate font-mono">{n.id}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-2 py-3 text-center text-xs text-text-muted">No matches</div>
      )}
    </div>
  )
}
