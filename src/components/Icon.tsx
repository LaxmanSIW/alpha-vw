/**
 * Sharp-edged icon set.
 *
 * Every path uses butt/square linecaps and miter joins. Icon libraries default
 * to round caps and joins, which quietly reintroduce the soft geometry this
 * design system exists to avoid -- at 14px a rounded stroke terminal reads as
 * a blur. Drawn on a 16x16 grid so strokes land on whole pixels.
 */

export type IconName =
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'edit'
  | 'refresh'
  | 'save'
  | 'expand-all'
  | 'collapse-all'
  | 'list-view'
  | 'grid-view'
  | 'search'
  | 'settings'
  | 'close'
  | 'plus'
  | 'folder'
  | 'node'
  | 'theme'
  | 'density'
  | 'arrange'
  | 'filter'
  | 'undo'
  | 'redo'
  | 'zoom-fit'
  | 'check'
  | 'x'
  | 'calendar'

const PATHS: Record<IconName, React.ReactNode> = {
  'chevron-left': <polyline points="10,3 5,8 10,13" />,
  'chevron-right': <polyline points="6,3 11,8 6,13" />,
  'chevron-down': <polyline points="3,6 8,11 13,6" />,
  edit: (
    <>
      <path d="M2 14v-3L11 2l3 3-9 9H2z" />
      <line x1="9" y1="4" x2="12" y2="7" />
    </>
  ),
  refresh: (
    <>
      <path d="M13 8a5 5 0 1 1-1.5-3.5" />
      <polyline points="13,2 13,5 10,5" />
    </>
  ),
  save: (
    <>
      <path d="M2 2h9l3 3v9H2V2z" />
      <rect x="5" y="2" width="5" height="4" />
      <rect x="5" y="9" width="6" height="5" />
    </>
  ),
  'expand-all': (
    <>
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="8" y1="2" x2="8" y2="14" />
      <rect x="2" y="2" width="12" height="12" />
    </>
  ),
  'collapse-all': (
    <>
      <line x1="2" y1="8" x2="14" y2="8" />
      <rect x="2" y="2" width="12" height="12" />
    </>
  ),
  'list-view': (
    <>
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="14" y2="12" />
    </>
  ),
  'grid-view': (
    <>
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15M3.1 3.1l1.8 1.8M11.1 11.1l1.8 1.8M12.9 3.1l-1.8 1.8M4.9 11.1l-1.8 1.8" />
    </>
  ),
  close: (
    <>
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </>
  ),
  x: (
    <>
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </>
  ),
  check: <polyline points="2,8 6,12 14,4" />,
  plus: (
    <>
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </>
  ),
  folder: <path d="M2 4h4l1.5 2H14v8H2V4z" />,
  node: <rect x="3" y="4" width="10" height="8" />,
  theme: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor" stroke="none" />
    </>
  ),
  density: (
    <>
      <line x1="2" y1="3" x2="14" y2="3" />
      <line x1="2" y1="6" x2="14" y2="6" />
      <line x1="2" y1="10" x2="14" y2="10" />
      <line x1="2" y1="13" x2="14" y2="13" />
    </>
  ),
  arrange: (
    <>
      <rect x="2" y="2" width="4" height="4" />
      <rect x="10" y="2" width="4" height="4" />
      <rect x="6" y="10" width="4" height="4" />
      <path d="M4 6v2h8V6M8 8v2" />
    </>
  ),
  filter: <polygon points="2,3 14,3 9.5,8.5 9.5,13 6.5,13 6.5,8.5" />,
  undo: (
    <>
      <polyline points="6,4 3,7 6,10" />
      <path d="M3 7h6a4 4 0 0 1 0 8H7" />
    </>
  ),
  redo: (
    <>
      <polyline points="10,4 13,7 10,10" />
      <path d="M13 7H7a4 4 0 0 0 0 8h2" />
    </>
  ),
  'zoom-fit': (
    <>
      <rect x="2" y="2" width="12" height="12" />
      <polyline points="5,7 5,5 7,5" />
      <polyline points="11,9 11,11 9,11" />
    </>
  ),
  calendar: (
    <>
      <rect x="2" y="3" width="12" height="11" />
      <line x1="2" y1="6" x2="14" y2="6" />
      <line x1="5" y1="1" x2="5" y2="4" />
      <line x1="11" y1="1" x2="11" y2="4" />
    </>
  ),
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

function Icon({ name, size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden="true"
      focusable="false"
      /* shape-rendering keeps 1px strokes from being antialiased into 2px grey
         smears at small sizes, which is the main thing that makes icons look
         soft next to sharp type. */
      shapeRendering="geometricPrecision"
    >
      {PATHS[name]}
    </svg>
  )
}

export default Icon
