import type { Edge } from '@xyflow/react'
import type { ModuleTab, NavItem, Viewpoint } from '../types'

/**
 * Placeholder content. Every list here is meant to be replaced by a tRPC query
 * later -- the shapes match what the components consume, so swapping the source
 * should not require touching the components.
 */

export const MODULES: ModuleTab[] = [
  { id: 'architecture', label: 'Architecture' }
]

/**
 * The catalog of viewpoints a user can open. There is deliberately no
 * "Viewpoints" entry here -- that tab is synthetic, always present, and lists
 * this catalog. See VIEWPOINT_CATALOG_TAB_ID.
 */

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: 'default',
    moduleId: 'architecture',
    label: 'Default',
    description: 'Default topology viewpoint',
    folder: 'Alpha VW',
    jobCount: 0,
  },
]

export const ARRANGE_OPTIONS = [
  { id: 'layout-hier', label: 'Hierarchical' },
]

/**
 * The hierarchy. Folders become nested container boxes on the canvas and folder
 * rows in the navigation panel; items become job boxes inside their container.
 * Node ids are these ids, so the tree and the canvas cannot disagree.
 */

export const NAV_TREE: NavItem[] = [
  {
    id: 'n-shared',
    label: 'Shared',
    kind: 'folder',
    children: [
      {
        id: 'n-7',
        label: 'Identity',
        kind: 'item',
        data: { kind: 'Service', status: 'ok', host: 'ctm-idp-01', runs: 1204 },
      },
      {
        id: 'n-8',
        label: 'Audit Log',
        kind: 'item',
        data: { kind: 'Service', status: 'ok', host: 'ctm-idp-01', runs: 1204 },
      },
    ],
  },
  {
    id: 'n-alpha',
    label: 'Alpha VW',
    kind: 'folder',
    children: [
      {
        id: 'n-domain-a',
        label: 'Domain A',
        kind: 'folder',
        children: [
          {
            id: 'n-1',
            label: 'Ingest Gateway',
            kind: 'item',
            data: { kind: 'Source', status: 'ok', host: 'ctm-ingest-01', runs: 852 },
          },
          {
            id: 'n-2',
            label: 'Validator',
            kind: 'item',
            data: { kind: 'Process', status: 'ok', host: 'ctm-app-01', runs: 850 },
          },
          {
            id: 'n-3',
            label: 'Aggregator',
            kind: 'item',
            data: { kind: 'Process', status: 'ok', host: 'ctm-app-01', runs: 848 },
          },
        ],
      },
      {
        id: 'n-domain-b',
        label: 'Domain B',
        kind: 'folder',
        children: [
          {
            id: 'n-4',
            label: 'Ledger Store',
            kind: 'item',
            data: { kind: 'Store', status: 'ok', host: 'ctm-db-01', runs: 410 },
          },
          {
            id: 'n-5',
            label: 'Reconciler',
            kind: 'item',
            data: { kind: 'Process', status: 'ok', host: 'ctm-app-02', runs: 411 },
          },
        ],
      },
      {
        id: 'n-domain-c',
        label: 'Domain C',
        kind: 'folder',
        children: [
          {
            id: 'n-6',
            label: 'Export Gateway',
            kind: 'item',
            data: { kind: 'Sink', status: 'danger', host: 'ctm-edge-01', runs: 398 },
          },
        ],
      },
    ],
  },
]

/**
 * Job-to-job dependencies. Edges deliberately cross container boundaries --
 * n-7 -> n-1 runs from Shared into Alpha VW, and n-2 -> n-5 from Domain A into
 * Domain B, which is what makes the nesting worth drawing rather than just a
 * prettier tree.
 */

export const INITIAL_EDGES: Edge[] = [
  { id: 'e7-3', source: 'n-7', target: 'n-3' },
  { id: 'e1-2', source: 'n-1', target: 'n-2' },
  { id: 'e2-3', source: 'n-2', target: 'n-3' },
  { id: 'e2-5', source: 'n-2', target: 'n-5' },
  { id: 'e4-5', source: 'n-4', target: 'n-5' },
  { id: 'e3-6', source: 'n-3', target: 'n-6' },
  { id: 'e5-6', source: 'n-5', target: 'n-6' },
]
