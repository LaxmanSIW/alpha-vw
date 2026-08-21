# App Configuration System — Full Plan

Centralise all hardcoded visual constants into a single `app_config` SQLite table. A **Settings modal** (opened by the ⚙ button in `ActionBar`) lets users view and edit everything live. Every component reads from a shared runtime config object so changes propagate everywhere — no component-level hardcoding.

---

## What Goes Into Config

### 1. Status Definitions
Each status tone has:
- **Display label** — what the UI shows (`Completed`, `Wait for Event`, …)
- **Hex color** — used for the node stripe, dot, badge background everywhere
- **Aliases** — comma-separated raw values that map to this tone (`ok, ended ok, success, completed`)

Applied everywhere:
| Location | What changes |
|---|---|
| `FlatNode` stripe (left colored bar) | inline `style={{ backgroundColor: hex }}` |
| Navigation Panel dot | inline `style={{ backgroundColor: hex }}` |
| NodeListView badge | inline style for bg + text |
| DetailsPanel status row | inline style |
| ContextPopup pred/succ list dots | inline style |

Unknown statuses fall back gracefully to a neutral grey — **no errors, no crashes**.

### 2. Canvas Layout
| Key | Current default |
|---|---|
| `layout.vGap` | `50` |
| `layout.hGap` | `40` |
| `layout.nodeWidth` | `190` |
| `layout.nodeHeight` | `130` |
| `layout.nodeCollapsedHeight` | `48` |

### 3. Node Relation Highlight Colors + Outline Width
| Key | Current value | Where used |
|---|---|---|
| `relation.selectedColor` | `var(--primary)` → now a real hex | `FlatNode` border + outline, canvas edge |
| `relation.predColor` | `var(--chart-3)` → now a real hex | upstream nodes border + outline, canvas edge |
| `relation.succColor` | `var(--chart-2)` → now a real hex | downstream nodes border + outline, canvas edge |
| `relation.outlineWidth` | `1` (px) | the outline `1px solid` on all three |

Applied in:
- `FlatNode` — `borderColor` + `outline` inline style
- `FlowCanvas` — edge stroke color
- `ContextPopup` — color dots next to pred/succ node entries

---

## Proposed Changes

### Database — `api/db.js`

#### [MODIFY] [db.js](file:///c:/Development/Alpha%20VW/api/db.js)
Add `app_config` table and seed defaults:

```sql
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  label      TEXT NOT NULL,
  value      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
)
```

Seeded rows (only inserted if not already present — safe for existing DBs):

**Status rows** (`category = 'status'`, `value` = JSON):
```json
{ "hex": "#22c55e", "aliases": ["ok","completed","ended ok","success"] }
{ "hex": "#f97316", "aliases": ["executing","execution","running"] }
{ "hex": "#94a3b8", "aliases": ["wait for event","wait event","waiting","warning","hold"] }
{ "hex": "#f43f5e", "aliases": ["failed","danger","error","ended notok","notok"] }
```

**Layout rows** (`category = 'layout'`, `value` = number as string):
`vGap=50`, `hGap=40`, `nodeWidth=190`, `nodeHeight=130`, `nodeCollapsedHeight=48`

**Relation rows** (`category = 'relation'`, `value` = hex or number):
`selectedColor=#6366f1`, `predColor=#f97316`, `succColor=#22d3ee`, `outlineWidth=1`

---

### Backend — `api/server.js`

#### [MODIFY] [server.js](file:///c:/Development/Alpha%20VW/api/server.js)
- Add `app_config` to `ALLOWED_TABLES`
- Include `appConfig: await all('SELECT * FROM app_config')` in the `/api/data` response

---

### Frontend — Config Layer

#### [NEW] `src/config/appConfig.ts`
```ts
export interface StatusDef {
  key: string        // e.g. 'status.completed'
  label: string      // e.g. 'Completed'
  hex: string        // e.g. '#22c55e'
  aliases: string[]  // e.g. ['ok','completed','ended ok']
}

export interface AppConfig {
  statuses: StatusDef[]           // ordered list — supports any number
  layout: { vGap; hGap; nodeWidth; nodeHeight; nodeCollapsedHeight }
  relation: { selectedColor; predColor; succColor; outlineWidth }
}

export const DEFAULT_APP_CONFIG: AppConfig = { /* mirrors current hardcoded values */ }

// Module-level mutable ref — no prop drilling needed
let _active: AppConfig = DEFAULT_APP_CONFIG
export const getAppConfig = () => _active
export const setAppConfig = (cfg: AppConfig) => { _active = cfg }

// Resolve raw status value → StatusDef (or grey fallback — never throws)
export function resolveStatus(rawValue: unknown): StatusDef { ... }

// Parse raw DB rows into AppConfig
export function parseAppConfig(rows: { key: string; category: string; label: string; value: string }[]): AppConfig { ... }
```

#### [MODIFY] [viewConfig.ts](file:///c:/Development/Alpha%20VW/src/config/viewConfig.ts)
- Remove `LAYOUT` const → replace with `export const getLayout = () => getAppConfig().layout`
- `layout.ts` and anything that uses `LAYOUT` switches to `getLayout()`

#### [MODIFY] [fields.ts](file:///c:/Development/Alpha%20VW/src/fields.ts)
- **Remove** all hardcoded `STATUS_LABELS`, `statusToneClass`, `statusColorClass`, `statusBadgeClass`
- Replace with config-driven functions that call `resolveStatus()`:
  ```ts
  export function statusLabel(value: unknown): string
  export function statusHex(value: unknown): string        // returns hex string
  export function statusBadgeStyle(value: unknown): CSSProperties  // { backgroundColor, color, border }
  ```
- All callers updated to use inline `style={}` instead of class names

#### [MODIFY] [graph.ts](file:///c:/Development/Alpha%W/src/graph.ts)
- Remove hardcoded `RELATION_COLOR` const
- Replace with `export const getRelationColor = (kind) => { ... getAppConfig().relation ... }`

---

### Frontend — Components (applying inline styles)

#### [MODIFY] [FlatNode.tsx](file:///c:/Development/Alpha%20VW/src/components/FlatNode.tsx)
- Status stripe: `<span style={{ backgroundColor: statusHex(node[STATUS_KEY]) }} />`
- Relation border/outline: `style={{ borderColor: getRelationColor(relation), outline: \`${outlineWidth}px solid ${color}\` }}`

#### [MODIFY] [NavigationTree.tsx](file:///c:/Development/Alpha%20VW/src/components/NavigationTree.tsx)
- Status dot: `<span style={{ backgroundColor: statusHex(item.data?.status) }} />`

#### [MODIFY] [NodeListView.tsx](file:///c:/Development/Alpha%20VW/src/components/NodeListView.tsx)
- `StatusCell`: replace Tailwind badge class with inline styles from `statusBadgeStyle()`

#### [MODIFY] [ContextPopup.tsx](file:///c:/Development/Alpha%20VW/src/components/ContextPopup.tsx)
- Pred/succ list: status dots → inline `style={{ backgroundColor: statusHex(item.status) }}`
- Relation color passed to popup borders → `getRelationColor()`

#### [MODIFY] [FlowCanvas.tsx](file:///c:/Development/Alpha%20VW/src/components/FlowCanvas.tsx)
- Edge stroke color → `getRelationColor('upstream')` / `getRelationColor('downstream')`

#### [MODIFY] [DetailsPanel.tsx](file:///c:/Development/Alpha%20VW/src/components/DetailsPanel.tsx)
- Status field value: inline style from `statusBadgeStyle()`

---

### Frontend — DashboardShell wiring

#### [MODIFY] [DashboardShell.tsx](file:///c:/Development/Alpha%20VW/src/components/DashboardShell.tsx)
- On `loadData()`: parse `data.appConfig` with `parseAppConfig()` → `setAppConfig(parsed)`
- New state: `const [isSettingsOpen, setIsSettingsOpen] = useState(false)`
- Pass `onOpenSettings={() => setIsSettingsOpen(true)}` to `ActionBar`
- Mount `<SettingsModal isOpen={isSettingsOpen} onClose={...} onSaved={() => loadData(true)} />`

#### [MODIFY] [client.ts](file:///c:/Development/Alpha%20VW/src/api/client.ts)
- Add `appConfig?: RawConfigRow[]` to `DashboardData` interface

---

### Frontend — Settings UI

#### [NEW] `src/components/SettingsModal.tsx`

Three tabs:

**Tab 1 — Status Colors**
- Table: one row per status def (from DB)
- Editable per row: Label, Hex color (native `<input type="color">`), Aliases (text, comma-separated)
- **Add new status** button — adds a row, saves new key to `app_config`
- **Delete** button per row (non-built-in ones)
- Save → `updateTableRow('app_config', key, { value: JSON.stringify({hex, aliases}), label })`

**Tab 2 — Canvas Layout**
- Five labeled number inputs
- Save → batch `updateTableRow` calls
- Shows note: *"Takes effect after the next Refresh"*

**Tab 3 — Node Highlight Colors**
- Color pickers for Selected, Predecessor, Successor colors
- Number input for Outline Width (px)
- Save → batch `updateTableRow` calls

#### [MODIFY] [ActionBar.tsx](file:///c:/Development/Alpha%20VW/src/components/ActionBar.tsx)
- Add `onOpenSettings?: () => void` prop
- Wire dead `⚙ Settings` button to `onOpenSettings`

---

## Verification Plan

### Manual checks
1. **Fresh DB**: `app_config` created and seeded; dashboard loads with correct colors
2. **Existing DB**: table is added (`IF NOT EXISTS`) — no data loss
3. **Status colors**: change green → orange for "Completed" → refresh → node stripes, nav dots, list badges, detail panel all show orange
4. **Custom status**: add a new status "On Hold" with purple hex → assign that status value to a node → purple appears everywhere
5. **Unknown status**: node with status `"xyz"` → renders as grey — no console errors
6. **Relation colors**: change Selected to red, Predecessor to yellow → select a node → highlighted nodes show correct colors in canvas, pred/succ popup dots
7. **Outline width**: change to `3` → selection outline is visibly thicker
8. **Layout**: change `nodeWidth` to `220` → refresh → all node boxes are wider
