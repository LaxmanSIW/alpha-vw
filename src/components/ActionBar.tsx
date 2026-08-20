import { useState } from 'react'
import IconButton from './ui/IconButton'

interface ActionBarProps {
  /** Which pane the structure toggle acts on, so the tooltip can say so
   * instead of leaving the user to guess what the button just did. */
  expandTarget: 'nav' | 'canvas'
  /** Current state of that target, which decides the toggle's icon. */
  structureExpanded: boolean
  onToggleStructure: () => void
  listView: boolean
  onListViewToggle: () => void
  onFitView: () => void
  searchOpen: boolean
  onSearchToggle: () => void
}

const TARGET_LABEL: Record<'nav' | 'canvas', string> = {
  nav: 'navigation tree',
  canvas: 'canvas nodes',
}

/**
 * Three action groups: left (document actions), middle (structure and view),
 * right (search and settings).
 *
 * White background so it forms one continuous surface with the active viewpoint
 * tab above it. Groups are separated by a 1px rule rather than whitespace alone
 * -- with no shadows or containers available, the rule is what tells you the
 * toolbar has regions instead of being one long row of glyphs.
 */
function ActionBar({
  expandTarget,
  structureExpanded,
  onToggleStructure,
  listView,
  onListViewToggle,
  onFitView,
  searchOpen,
  onSearchToggle,
}: ActionBarProps) {
  const [editing, setEditing] = useState(false)
  const target = TARGET_LABEL[expandTarget]

  return (
    <div className="flex h-actionbar shrink-0 items-center gap-0.5 border-b border-border bg-surface px-1.5">
      {/* left: document actions */}
      <IconButton
        icon="edit"
        title={editing ? 'Exit edit mode' : 'Edit'}
        active={editing}
        onClick={() => setEditing((v) => !v)}
      />
      <IconButton icon="save" title="Save" />
      <IconButton icon="refresh" title="Refresh" />

      <Separator />

      <IconButton icon="undo" title="Undo" disabled />
      <IconButton icon="redo" title="Redo" disabled />

      <div className="flex-1" />

      {/* One button that swaps between the two states rather than two buttons
          where one is always a no-op. The icon shows the action it performs. */}
      <IconButton
        icon={structureExpanded ? 'collapse-all' : 'expand-all'}
        title={`${structureExpanded ? 'Collapse' : 'Expand'} all ${target}`}
        onClick={onToggleStructure}
      />

      <Separator />

      <IconButton
        icon="list-view"
        title="List view"
        active={listView}
        onClick={onListViewToggle}
      />
      <IconButton
        icon="grid-view"
        title="Graph view"
        active={!listView}
        onClick={onListViewToggle}
      />
      <IconButton
        icon="zoom-fit"
        title="Fit to view"
        onClick={onFitView}
      />

      <div className="flex-1" />

      {/* right: search opens an overlay on the canvas rather than expanding
          inline, so the results list drops over the graph being filtered. */}
      <IconButton
        icon="search"
        title={searchOpen ? 'Close search' : 'Search nodes'}
        active={searchOpen}
        onClick={onSearchToggle}
      />
      <IconButton icon="filter" title="Filter" />

      <Separator />

      <IconButton icon="settings" title="Settings" />
    </div>
  )
}

function Separator() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
}

export default ActionBar
