import type { Node } from '@xyflow/react'
import type { FlatNodeData } from './FlatNode'

interface NodeListViewProps {
  nodes: Node[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const STATUS_LABEL: Record<FlatNodeData['status'], string> = {
  ok: 'Healthy',
  warning: 'Degraded',
  danger: 'Unreachable',
}

/**
 * Tabular alternative to the graph, toggled from the action bar.
 *
 * Sticky header on the sunken tone, hairline row rules, and right-aligned
 * numerics. This is the table pattern the design system expects: no outer card,
 * no zebra striping (striping fights the hairlines and doubles the visual
 * noise), separation by 1px rules alone.
 */
function NodeListView({ nodes, selectedId, onSelect }: NodeListViewProps) {
  const rows = nodes

  return (
    <div className="h-full overflow-auto bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-sunken">
            <Th>Name</Th>
            <Th>Folder</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th align="right">Runs</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((node) => {
            const data = node.data as FlatNodeData
            const isSelected = node.id === selectedId
            return (
              <tr
                key={node.id}
                onClick={() => onSelect(node.id)}
                className={[
                  'h-row cursor-default border-b border-border transition-colors duration-75',
                  isSelected
                    ? 'bg-surface-selected font-medium text-text'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                ].join(' ')}
              >
                <Td>{data.label}</Td>
                {/* Folder rather than coordinates: node positions are relative
                    to their container now, so raw x/y would be meaningless. */}
                <Td>{(data.folder as string) ?? '--'}</Td>
                <Td>{data.kind}</Td>
                <Td>
                  <StatusCell status={data.status} />
                </Td>
                <Td align="right">{(data.runs as number) ?? '--'}</Td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-2.5 py-3 text-text-muted">
                No nodes in this viewpoint.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function StatusCell({ status }: { status: FlatNodeData['status'] }) {
  const tone =
    status === 'danger'
      ? 'bg-danger-bg text-danger-fg'
      : status === 'warning'
      ? 'bg-warning-bg text-warning-fg'
      : 'bg-success-bg text-success-fg'

  // Square badge with a text label, not a bare colored dot: the word is what
  // makes this readable in greyscale or with a color vision deficiency.
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
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

export default NodeListView
