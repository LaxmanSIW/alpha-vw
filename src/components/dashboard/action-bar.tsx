'use client'

import {
  RefreshCw,
  Maximize2,
  Search,
  ChevronsDownUp,
  ChevronsUpDown,
  List,
  Columns3,
  Database,
  Settings,
} from 'lucide-react'
import IconButton from '@/components/ui-custom/icon-button'

interface ActionBarProps {
  expandTarget: 'nav' | 'canvas'
  structureExpanded: boolean
  onToggleStructure: () => void
  listView: boolean
  onListViewToggle: () => void
  onFitView: () => void
  searchOpen: boolean
  onSearchToggle: () => void
  onRefresh: () => void
  isRefreshing: boolean
  onOpenSettings: () => void
  onOpenAdmin: () => void
}

export default function ActionBar({
  expandTarget,
  structureExpanded,
  onToggleStructure,
  listView,
  onListViewToggle,
  onFitView,
  searchOpen,
  onSearchToggle,
  onRefresh,
  isRefreshing,
  onOpenSettings,
  onOpenAdmin,
}: ActionBarProps) {
  return (
    <div className="flex h-[var(--actionbar-h)] shrink-0 items-center justify-between border-b border-border bg-surface px-2">
      <div className="flex items-center gap-1">
        <IconButton
          icon={structureExpanded ? ChevronsDownUp : ChevronsUpDown}
          title={structureExpanded ? 'Collapse all' : 'Expand all'}
          onClick={onToggleStructure}
        />
        <span className="text-[10px] text-text-muted ml-1">
          {expandTarget === 'nav' ? 'Tree' : 'Canvas'}
        </span>

        <div className="w-px h-5 bg-border mx-2" aria-hidden />

        <IconButton
          icon={listView ? Columns3 : List}
          title={listView ? 'Switch to Canvas view' : 'Switch to List view'}
          active={listView}
          onClick={onListViewToggle}
        />
        <IconButton icon={Maximize2} title="Fit canvas to view" onClick={onFitView} />
        <IconButton icon={Search} title="Search canvas" active={searchOpen} onClick={onSearchToggle} />
      </div>

      <div className="flex items-center gap-1">
        <IconButton icon={Database} title="Database Admin" onClick={onOpenAdmin} />
        <IconButton icon={Settings} title="Settings" onClick={onOpenSettings} />
        <div className="w-px h-5 bg-border mx-2" aria-hidden />
        <IconButton
          icon={RefreshCw}
          title="Refresh data"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={isRefreshing ? 'animate-spin' : ''}
        />
      </div>
    </div>
  )
}
