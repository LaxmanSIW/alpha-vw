import Icon from './Icon'
import type { NavItem } from '../types'
import { statusColorClass } from '../fields'

interface NavigationTreeProps {
  items: NavItem[]
  expandedIds: Set<string>
  onToggle: (id: string) => void
  selectedId: string | null
  /** Selecting a leaf that maps to a canvas node also centres it -- the shell
   * owns that behaviour so search and the tree stay consistent. */
  onSelect: (id: string) => void
}

function NavigationTree({
  items,
  expandedIds,
  onToggle,
  selectedId,
  onSelect,
}: NavigationTreeProps) {
  return (
    <ul role="tree" aria-label="Navigation" className="py-0.5">
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

function TreeRow({
  item,
  depth,
  expandedIds,
  onToggle,
  selectedId,
  onSelect,
}: TreeRowProps) {
  const isFolder = item.kind === 'folder'
  const isExpanded = expandedIds.has(item.id)
  const isSelected = item.id === selectedId
  const children = item.children ?? []

  return (
    <li
      role="treeitem"
      aria-expanded={isFolder ? isExpanded : undefined}
      aria-selected={isSelected}
    >
      <div
        className={[
          'flex h-row cursor-default items-center gap-1 pr-2 text-sm',
          'transition-colors duration-75',
          isSelected
            ? 'bg-surface-selected font-medium text-text'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text',
        ].join(' ')}
        // Indent scales with --gap so nesting stays legible at both densities
        // instead of being a fixed pixel ladder.
        style={{ paddingLeft: `calc(${depth} * var(--gap) * 1.5 + 2px)` }}
        onClick={() => onSelect(item.id)}
      >
        {isFolder ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(item.id)
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
            aria-label={
              isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`
            }
            className="flex size-4 shrink-0 items-center justify-center text-text-muted hover:text-text"
          >
            <Icon
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={11}
            />
          </button>
        ) : (
          <>
            {/* Spacer matching the folder chevron width so status square aligns under the folder label */}
            <span aria-hidden="true" className="size-4 shrink-0" />
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 ${statusColorClass(item.data?.status)}`}
            />
          </>
        )}

        <span className="truncate">{item.label}</span>

        {isFolder && children.length > 0 && (
          <span className="ml-auto shrink-0 pl-2 text-xs text-text-muted">
            {children.length}
          </span>
        )}
      </div>

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
    </li>
  )
}

export default NavigationTree
