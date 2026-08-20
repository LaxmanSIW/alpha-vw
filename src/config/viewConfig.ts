/**
 * Presentation configuration.
 *
 * What a node box shows, which tabs the details pane has, and which fields sit
 * under each heading are all declared here rather than hardcoded in components.
 * The point is that adding a field is a one-line edit in this file, and the
 * components render whatever they are given -- so this is the only place to look
 * when the answer to "why is that column there" comes up.
 *
 * Every `key` is looked up on a node's `data` object, except the reserved keys
 * below which are derived from the node itself rather than its data.
 */

/** Keys resolved from the node rather than node.data. */
export const RESERVED_KEYS = {
  id: '__id',
  position: '__position',
} as const

export type FieldFormat = 'text' | 'mono' | 'status'

export interface FieldDef {
  key: string
  label: string
  format?: FieldFormat
}

/**
 * How a field appears on a node box in the canvas.
 *   title    -- the one prominent line
 *   subtitle -- the small uppercase line under the title
 *   detail   -- key/value rows revealed by the expand toggle
 */
export type NodeFieldRole = 'title' | 'subtitle' | 'detail'

export interface NodeFieldDef extends FieldDef {
  role: NodeFieldRole
}

export const NODE_FIELDS: NodeFieldDef[] = [
  { key: 'label', label: 'Name', role: 'title' },
  { key: 'kind', label: 'Type', role: 'subtitle' },
  { key: RESERVED_KEYS.id, label: 'ID', role: 'detail', format: 'mono' },
  { key: 'status', label: 'Status', role: 'detail', format: 'status' },
  { key: 'host', label: 'Host', role: 'detail', format: 'mono' },
  { key: 'runs', label: 'Runs', role: 'detail' },
]

/** Which node field carries the status stripe. Kept separate from NODE_FIELDS
 * because the stripe is a visual channel, not a row. */
export const STATUS_KEY = 'status'

export interface DetailsSectionDef {
  title: string
  fields: FieldDef[]
}

export interface DetailsTabDef {
  id: string
  label: string
  /** 'fields' renders sections from node data; the others are bespoke panels. */
  kind: 'fields' | 'log' | 'placeholder'
  sections?: DetailsSectionDef[]
}

export const DETAILS_TABS: DetailsTabDef[] = [
  {
    id: 'details',
    label: 'Details',
    kind: 'fields',
    sections: [
      {
        title: 'Identity',
        fields: [
          { key: 'label', label: 'Name' },
          { key: RESERVED_KEYS.id, label: 'ID', format: 'mono' },
          { key: 'kind', label: 'Type' },
          { key: 'folder', label: 'Folder' },
        ],
      },
      {
        title: 'Execution',
        fields: [
          { key: 'host', label: 'Host', format: 'mono' },
          { key: 'runs', label: 'Runs' },
        ],
      },
      {
        title: 'State',
        fields: [{ key: 'status', label: 'Status', format: 'status' }],
      },
    ],
  },
  { id: 'log', label: 'Log', kind: 'log' },
  { id: 'props', label: 'Properties', kind: 'placeholder' },
]

/**
 * Canvas layout. The vertical gap is what keeps spacing constant when a node
 * expands: positions are recomputed from measured heights so the GAP stays
 * fixed, rather than the node growing into whatever slack happens to be there.
 */
export const LAYOUT = {
  vGap: 50,
  hGap: 40,

  nodeWidth: 190,
  nodeHeight: 130,
} as const
