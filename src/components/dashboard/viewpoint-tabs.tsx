'use client'

import { X } from 'lucide-react'
import type { Viewpoint } from '@/lib/types'
import { VIEWPOINT_CATALOG_TAB_ID } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ViewpointTabsProps {
  openViewpoints: Viewpoint[]
  activeTabId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export default function ViewpointTabs({ openViewpoints, activeTabId, onSelect, onClose }: ViewpointTabsProps) {
  return (
    <div role="tablist" aria-label="Viewpoints" className="flex h-[var(--viewtabs-h)] shrink-0 items-stretch border-b border-border bg-surface-sunken overflow-x-auto no-scrollbar">
      <button
        type="button"
        role="tab"
        aria-selected={activeTabId === VIEWPOINT_CATALOG_TAB_ID}
        onClick={() => onSelect(VIEWPOINT_CATALOG_TAB_ID)}
        className={cn(
          'flex items-center gap-1.5 px-3 text-xs font-medium border-r border-border transition-colors',
          activeTabId === VIEWPOINT_CATALOG_TAB_ID
            ? 'bg-surface text-text border-b-2 border-b-primary -mb-px'
            : 'text-text-muted hover:text-text hover:bg-surface-hover',
        )}
      >
        Catalog
      </button>
      {openViewpoints.map((vp) => {
        const isActive = activeTabId === vp.id
        return (
          <div
            key={vp.id}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'group flex items-center gap-1.5 px-3 text-xs font-medium border-r border-border cursor-pointer transition-colors',
              isActive
                ? 'bg-surface text-text border-b-2 border-b-primary -mb-px'
                : 'text-text-muted hover:text-text hover:bg-surface-hover',
            )}
            onClick={() => onSelect(vp.id)}
          >
            <span className="truncate max-w-40">{vp.label}</span>
            <button
              type="button"
              aria-label={`Close ${vp.label}`}
              onClick={(e) => {
                e.stopPropagation()
                onClose(vp.id)
              }}
              className="inline-flex items-center justify-center size-3.5 text-text-muted hover:bg-surface-hover hover:text-text"
            >
              <X size={10} strokeWidth={1.5} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
