import Icon from './Icon'
import { VIEWPOINT_CATALOG_TAB_ID, type Viewpoint } from '../types'

interface ViewpointTabsProps {
  /** Viewpoints currently open as tabs, in tab order. */
  openViewpoints: Viewpoint[]
  activeTabId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

/**
 * Inner navigation level: the viewpoints open within the active module.
 *
 * The first tab is the catalog and has no close button -- it is the way back to
 * the list of available viewpoints, so closing it would strand the user with no
 * route to open another. Every other tab closes.
 *
 * No bottom border: the active tab's white fill runs straight into the white
 * action bar below, so the tab reads as continuous with its own content.
 */
function ViewpointTabs({
  openViewpoints,
  activeTabId,
  onSelect,
  onClose,
}: ViewpointTabsProps) {
  return (
    <div className="flex h-viewtabs shrink-0 items-stretch bg-surface-sunken">
      <div role="tablist" aria-label="Viewpoints" className="flex min-w-0 items-stretch">
        <Tab
          id={VIEWPOINT_CATALOG_TAB_ID}
          label="Viewpoints"
          isActive={activeTabId === VIEWPOINT_CATALOG_TAB_ID}
          onSelect={onSelect}
        />

        {openViewpoints.map((viewpoint) => (
          <Tab
            key={viewpoint.id}
            id={viewpoint.id}
            label={viewpoint.label}
            isActive={activeTabId === viewpoint.id}
            onSelect={onSelect}
            onClose={onClose}
          />
        ))}
      </div>

      <div className="flex-1" />
    </div>
  )
}

interface TabProps {
  id: string
  label: string
  isActive: boolean
  onSelect: (id: string) => void
  /** Omitted for the catalog tab, which cannot be closed. */
  onClose?: (id: string) => void
}

function Tab({ id, label, isActive, onSelect, onClose }: TabProps) {
  return (
    // The row is a div rather than a button so the close control can be a real
    // nested button -- a button inside a button is invalid and Firefox drops the
    // inner one's clicks.
    <div
      className={[
        'flex max-w-44 min-w-0 items-stretch border-r border-border',
        isActive ? 'bg-surface' : '',
      ].join(' ')}
    >
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => onSelect(id)}
        className={[
          'min-w-0 truncate pl-3 text-sm transition-colors duration-75',
          onClose ? 'pr-1' : 'pr-3',
          isActive ? 'font-medium text-primary' : 'text-text-secondary hover:text-text',
        ].join(' ')}
      >
        {label}
      </button>

      {onClose && (
        <button
          type="button"
          onClick={(event) => {
            // Otherwise the tab's own click handler also fires and selects the
            // tab we are in the middle of removing.
            event.stopPropagation()
            onClose(id)
          }}
          title={`Close ${label}`}
          aria-label={`Close ${label}`}
          className="flex w-5 shrink-0 items-center justify-center text-text-muted hover:text-text"
        >
          <Icon name="close" size={10} />
        </button>
      )}
    </div>
  )
}

export default ViewpointTabs
