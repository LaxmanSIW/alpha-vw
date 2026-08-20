import Icon from './Icon'
import type { Viewpoint } from '../types'

interface ViewpointCatalogProps {
  viewpoints: Viewpoint[]
  openIds: string[]
  onOpen: (id: string) => void
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
function ViewpointCatalog({ viewpoints, openIds, onOpen }: ViewpointCatalogProps) {
  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="border-b border-border-strong bg-surface-sunken px-2.5 py-1.5">
        <h2 className="text-sm font-semibold text-text">Available viewpoints</h2>
        <p className="text-xs text-text-muted">
          {viewpoints.length} in this module &middot; select one to open it as a tab
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-sunken">
          <tr>
            <Th>Name</Th>
            <Th>Description</Th>
            <Th>Folder</Th>
            <Th align="right">Jobs</Th>
            <Th align="right">State</Th>
          </tr>
        </thead>
        <tbody>
          {viewpoints.map((viewpoint) => {
            const isOpen = openIds.includes(viewpoint.id)
            return (
              <tr
                key={viewpoint.id}
                onClick={() => onOpen(viewpoint.id)}
                onDoubleClick={() => onOpen(viewpoint.id)}
                className="h-row cursor-default border-b border-border text-text-secondary transition-colors duration-75 hover:bg-surface-hover hover:text-text"
              >
                <Td>
                  <span className="flex items-center gap-1.5">
                    <span className="shrink-0 text-text-muted">
                      <Icon name="grid-view" size={12} />
                    </span>
                    <span className="font-medium text-text">{viewpoint.label}</span>
                  </span>
                </Td>
                <Td>{viewpoint.description ?? '--'}</Td>
                <Td>{viewpoint.folder ?? '--'}</Td>
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
              </tr>
            )
          })}
          {viewpoints.length === 0 && (
            <tr>
              <td colSpan={5} className="px-2.5 py-3 text-text-muted">
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
