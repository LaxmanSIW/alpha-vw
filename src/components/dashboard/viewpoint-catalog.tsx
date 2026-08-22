'use client'

import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Viewpoint } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ViewpointCatalogProps {
  viewpoints: Viewpoint[]
  openIds: string[]
  onOpen: (id: string) => void
  onCreateViewpoint: () => void
  onEditViewpoint: (vp: Viewpoint) => void
  onDeleteViewpoint: (vp: Viewpoint) => void
}

export default function ViewpointCatalog({
  viewpoints,
  openIds,
  onOpen,
  onCreateViewpoint,
  onEditViewpoint,
  onDeleteViewpoint,
}: ViewpointCatalogProps) {
  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex h-[var(--actionbar-h)] shrink-0 items-center justify-between border-b border-border bg-surface px-3">
        <span className="label-caps">Viewpoint Catalog</span>
        <button
          type="button"
          onClick={onCreateViewpoint}
          className="inline-flex items-center gap-1.5 h-[var(--control-h)] px-2 text-xs font-medium border border-border-strong bg-surface hover:bg-surface-hover text-text"
        >
          <Plus size={12} strokeWidth={1.5} />
          New Viewpoint
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-sunken sticky top-0 z-10">
            <tr className="text-text-muted">
              <Th className="text-left w-10" />
              <Th className="text-left">Label</Th>
              <Th className="text-left">Description</Th>
              <Th className="text-left">Scope</Th>
              <Th className="text-left">Folder</Th>
              <Th className="text-right">Jobs</Th>
              <Th className="text-left">Status Filter</Th>
              <Th className="text-left">Grouping</Th>
              <Th className="text-left">Sort</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {viewpoints.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-text-muted">
                  No viewpoints. Click <strong className="text-text">New Viewpoint</strong> to create one.
                </td>
              </tr>
            ) : (
              viewpoints.map((vp) => {
                const isOpen = openIds.includes(vp.id)
                return (
                  <tr
                    key={vp.id}
                    className={cn(
                      'border-b border-border hover:bg-surface-hover transition-colors',
                      isOpen && 'bg-primary/5',
                    )}
                  >
                    <Td className="text-center">
                      <button
                        type="button"
                        onClick={() => onOpen(vp.id)}
                        title="Open viewpoint"
                        className="inline-flex items-center justify-center size-5 text-text-muted hover:text-primary hover:bg-primary/10"
                      >
                        ▶
                      </button>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => onOpen(vp.id)}
                        className="font-medium text-text hover:text-primary text-left"
                      >
                        {vp.label}
                      </button>
                    </Td>
                    <Td className="text-text-secondary max-w-48 truncate">{vp.description ?? '--'}</Td>
                    <Td>
                      <span
                        className={cn(
                          'px-1.5 py-0.2 text-[10px] uppercase font-medium',
                          vp.scope === 'Private'
                            ? 'bg-warning-bg text-warning-fg'
                            : 'bg-accent/15 text-accent',
                        )}
                      >
                        {vp.scope ?? 'Public'}
                      </span>
                    </Td>
                    <Td className="text-text-secondary">{vp.folder ?? '--'}</Td>
                    <Td className="text-right tabular-nums">{vp.jobCount ?? 0}</Td>
                    <Td className="text-text-secondary">{vp.filterStatus ?? 'All'}</Td>
                    <Td className="text-text-secondary">{vp.grouping ?? 'Folder'}</Td>
                    <Td className="text-text-secondary">{vp.sortBy ?? 'label'}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => onEditViewpoint(vp)}
                          title="Edit viewpoint"
                          className="inline-flex items-center justify-center size-5 text-text-muted hover:text-primary hover:bg-primary/10"
                        >
                          <Pencil size={11} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteViewpoint(vp)}
                          title="Delete viewpoint"
                          className="inline-flex items-center justify-center size-5 text-text-muted hover:text-danger-fg hover:bg-danger-bg"
                        >
                          <Trash2 size={11} strokeWidth={1.5} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ className, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-[var(--row-h)] px-2 font-medium', className)} {...rest} />
}
function Td({ className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('h-[var(--row-h)] px-2', className)} {...rest} />
}
