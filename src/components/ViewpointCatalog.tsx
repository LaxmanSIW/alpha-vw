import Icon from './Icon'
import type { Viewpoint } from '../types'

interface ViewpointCatalogProps {
  viewpoints: Viewpoint[]
  openIds: string[]
  onOpen: (id: string) => void
  onCreateViewpoint?: () => void
  onEditViewpoint?: (viewpoint: Viewpoint) => void
  onDeleteViewpoint?: (viewpoint: Viewpoint) => void
}

/**
 * Content of the first viewpoint tab: the list of viewpoints available in the
 * active module. Selecting one opens it as its own tab.
 *
 * A table rather than cards -- this is a pick-from-a-list task, and a table lets
 * you compare folder and job count down a column instead of hopping between
 * boxes. Already-open viewpoints stay listed but are marked, so the list is a
 * stable catalog rather than a shrinking queue.
 */
function ViewpointCatalog({
  viewpoints,
  openIds,
  onOpen,
  onCreateViewpoint,
  onEditViewpoint,
  onDeleteViewpoint,
}: ViewpointCatalogProps) {
  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="flex items-center justify-between border-b border-border-strong bg-surface-sunken px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-text">Available Viewpoints (Monitoring)</h2>
          <p className="text-xs text-text-muted">
            {viewpoints.length} in this module &middot; select one to open it as a monitoring tab
          </p>
        </div>
        {onCreateViewpoint && (
          <button
            type="button"
            onClick={onCreateViewpoint}
            className="inline-flex items-center gap-1.5 bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover shadow-xs border border-primary transition-colors"
          >
            <Icon name="check" size={13} />
            + Create Viewpoint
          </button>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-sunken">
          <tr>
            <Th>Name</Th>
            <Th>Scope</Th>
            <Th>Description</Th>
            <Th>Folder Scope</Th>
            <Th>Grouping / Hierarchy</Th>
            <Th>Sort By</Th>
            <Th align="right">Jobs</Th>
            <Th align="right">State</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {viewpoints.map((viewpoint) => {
            const isOpen = openIds.includes(viewpoint.id)
            const scope = viewpoint.scope ?? 'Public'
            return (
              <tr
                key={viewpoint.id}
                onClick={() => onOpen(viewpoint.id)}
                className="h-row cursor-pointer border-b border-border text-text-secondary transition-colors duration-75 hover:bg-surface-hover hover:text-text"
              >
                <Td>
                  <span className="flex items-center gap-1.5">
                    <span className="shrink-0 text-text-muted">
                      <Icon name="grid-view" size={12} />
                    </span>
                    <span className="font-medium text-text">{viewpoint.label}</span>
                  </span>
                </Td>
                <Td>
                  <span
                    className={`inline-block px-1.5 py-0.5 text-xs font-medium ${
                      scope === 'Private'
                        ? 'bg-warning-bg text-warning-fg'
                        : 'bg-accent/15 text-accent'
                    }`}
                  >
                    {scope}
                  </span>
                </Td>
                <Td>{viewpoint.description ?? '--'}</Td>
                <Td>{viewpoint.folder ?? '--'}</Td>
                <Td>
                  <span className="text-xs font-mono text-text-muted">
                    {viewpoint.grouping ?? 'Folder'}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs font-mono text-text-muted">
                    {viewpoint.sortBy ?? 'label'}
                  </span>
                </Td>
                <Td align="right">{viewpoint.jobCount ?? '--'}</Td>
                <Td align="right">
                  {isOpen ? (
                    <span className="bg-info-bg px-1.5 py-0.5 text-xs font-medium text-info-fg">
                      Open
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">Closed</span>
                  )}
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {onEditViewpoint && (
                      <button
                        type="button"
                        onClick={() => onEditViewpoint(viewpoint)}
                        className="p-1 text-text-secondary hover:text-primary hover:bg-surface-sunken rounded"
                        title="Edit Viewpoint Properties"
                      >
                        <Icon name="edit" size={14} />
                      </button>
                    )}
                    {onDeleteViewpoint && (
                      <button
                        type="button"
                        onClick={() => onDeleteViewpoint(viewpoint)}
                        className="p-1 text-text-secondary hover:text-danger-fg hover:bg-surface-sunken rounded"
                        title="Delete Viewpoint"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            )
          })}
          {viewpoints.length === 0 && (
            <tr>
              <td colSpan={9} className="px-2.5 py-3 text-text-muted">
                No viewpoints defined for this module.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      scope="col"
      className={`label-caps border-b border-border-strong px-2.5 py-1 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <td className={`px-2.5 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  )
}

export default ViewpointCatalog
