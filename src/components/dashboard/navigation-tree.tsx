'use client'

import { Folder, FileText } from 'lucide-react'
import type { NavItem } from '@/lib/types'
import { statusHex } from '@/lib/fields'
import { cn } from '@/lib/utils'

interface NavigationTreeProps {
  items: NavItem[]
  expandedIds: Set<string>
  onToggle: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function NavigationTree({ items, expandedIds, onToggle, selectedId, onSelect }: NavigationTreeProps) {
  return (
    <ul role="tree" className="py-1 text-xs">
      {items.map((item) => (
        <TreeRow
          key={item.id}
          item={item}
          depth={0}
          expandedIds={expandedIds}
          onToggle={onToggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}

interface TreeRowProps {
  item: NavItem
  depth: number
  expandedIds: Set<string>
  onToggle: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
}

function TreeRow({ item, depth, expandedIds, onToggle, selectedId, onSelect }: TreeRowProps) {
  const isFolder = item.kind === 'folder'
  const isExpanded = expandedIds.has(item.id)
  const isSelected = selectedId === item.id
  const children = item.children ?? []

  return (
    <>
      <li role="treeitem" aria-expanded={isFolder ? isExpanded : undefined} aria-selected={isSelected}>
        <button
          type="button"
          onClick={() => (isFolder ? onToggle(item.id) : onSelect(item.id))}
          className={cn(
            'flex w-full items-center gap-1.5 h-[var(--row-h)] text-left hover:bg-surface-hover transition-colors',
            isSelected && 'bg-primary/10 text-primary hover:bg-primary/15',
          )}
          style={{ paddingLeft: `calc(${depth} * var(--gap) * 1.5 + var(--pad-x))` }}
        >
          {isFolder ? (
            <>
              <span
                className={cn(
                  'inline-flex size-3.5 items-center justify-center text-text-muted transition-transform',
                  isExpanded && 'rotate-90',
                )}
              >
                ▶
              </span>
              <Folder size={12} strokeWidth={1.5} className="shrink-0 text-text-muted" />
              <span className="truncate text-text">{item.label}</span>
              {children.length > 0 && (
                <span className="ml-auto pr-2 text-[10px] text-text-muted">{children.length}</span>
              )}
            </>
          ) : (
            <>
              <span className="inline-block size-3.5 shrink-0" />
              <FileText size={12} strokeWidth={1.5} className="shrink-0 text-text-muted" />
              <span
                className="inline-block size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: statusHex(item.data?.status) }}
                aria-hidden
              />
              <span className="truncate text-text">{item.label}</span>
            </>
          )}
        </button>
      </li>
      {isFolder && isExpanded && children.length > 0 && (
        <ul role="group">
          {children.map((child) => (
            <TreeRow
              key={child.id}
              item={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </>
  )
}
