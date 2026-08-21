import IconButton from './ui/IconButton'

interface ActionBarProps {
  expandTarget: 'nav' | 'canvas'
  structureExpanded: boolean
  onToggleStructure: () => void
  listView: boolean
  onListViewToggle: () => void
  onFitView: () => void
  searchOpen: boolean
  onSearchToggle: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
  isEditMode?: boolean
  onToggleEditMode?: () => void
  onSave?: () => void
  isSaving?: boolean
  onOpenSettings?: () => void
}

const TARGET_LABEL: Record<'nav' | 'canvas', string> = {
  nav: 'navigation tree',
  canvas: 'canvas nodes',
}

function ActionBar({
  expandTarget,
  structureExpanded,
  onToggleStructure,
  listView,
  onListViewToggle,
  onFitView,
  searchOpen,
  onSearchToggle,
  onRefresh,
  isRefreshing = false,
  isEditMode = false,
  onToggleEditMode,
  onSave,
  isSaving = false,
  onOpenSettings,
}: ActionBarProps) {
  const target = TARGET_LABEL[expandTarget]

  return (
    <div className="flex h-actionbar shrink-0 items-center gap-0.5 border-b border-border bg-surface px-1.5">
      {/* left: document actions */}
      <IconButton
        icon="edit"
        title={isEditMode ? 'Exit Canvas Edit Mode' : 'Enter Canvas Edit Mode'}
        active={isEditMode}
        onClick={onToggleEditMode}
      />
      <IconButton
        icon="save"
        title={isSaving ? 'Saving Changes to Database...' : 'Save Workspace Changes to Database'}
        onClick={onSave}
        disabled={isSaving}
      />
      <IconButton
        icon="refresh"
        title={isRefreshing ? 'Refreshing data from DB...' : 'Refresh data from DB'}
        onClick={onRefresh}
        disabled={isRefreshing}
      />

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

      <IconButton icon="settings" title="Settings" onClick={onOpenSettings} />
    </div>
  )
}

function Separator() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
}

export default ActionBar
