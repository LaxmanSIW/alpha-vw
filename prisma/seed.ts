/**
 * Database seed script for Alpha VW.
 *
 * Seeds:
 *   - app_config defaults (statuses, layout, relation, business date)
 *   - field_definitions (the EAV schema for nodes)
 *   - calendars (REGULAR, MFD9H)
 *   - schedule_configs (DAILY_PROD_RUN, END_OF_MONTH_RUN)
 *   - modules (Architecture)
 *   - viewpoints (Default)
 *   - Sample banking nodes (12 folders + 100 jobs) from sample_nodes.csv
 *   - Sample banking edges (95 dependencies) from sample_edges.csv
 *
 * Idempotent: uses upserts, safe to run multiple times.
 */

import { db } from '../src/lib/db'

declare const process: { exit: (code?: number) => void }

// ─── Default app config rows ────────────────────────────────────────────────

const APP_CONFIG_SEED = [
  // Statuses (value is JSON {hex, aliases})
  { key: 'status.completed', category: 'status', label: 'Completed', sortOrder: 1, value: JSON.stringify({ hex: '#22c55e', aliases: ['ok', 'completed', 'ended ok', 'success'] }) },
  { key: 'status.executing', category: 'status', label: 'Executing', sortOrder: 2, value: JSON.stringify({ hex: '#f97316', aliases: ['executing', 'execution', 'running'] }) },
  { key: 'status.wait', category: 'status', label: 'Wait for Event', sortOrder: 3, value: JSON.stringify({ hex: '#94a3b8', aliases: ['wait for event', 'wait event', 'waiting', 'warning', 'hold'] }) },
  { key: 'status.failed', category: 'status', label: 'Failed', sortOrder: 4, value: JSON.stringify({ hex: '#f43f5e', aliases: ['failed', 'danger', 'error', 'ended notok', 'notok'] }) },

  // Layout
  { key: 'layout.vGap', category: 'layout', label: 'Vertical Gap', sortOrder: 1, value: '50' },
  { key: 'layout.hGap', category: 'layout', label: 'Horizontal Gap', sortOrder: 2, value: '40' },
  { key: 'layout.nodeWidth', category: 'layout', label: 'Node Width', sortOrder: 3, value: '190' },
  { key: 'layout.nodeHeight', category: 'layout', label: 'Node Height', sortOrder: 4, value: '130' },
  { key: 'layout.nodeCollapsedHeight', category: 'layout', label: 'Node Collapsed Height', sortOrder: 5, value: '48' },

  // Relation highlight colors
  { key: 'relation.selectedColor', category: 'relation', label: 'Selected Node Color', sortOrder: 1, value: '#4f46e5' },
  { key: 'relation.predColor', category: 'relation', label: 'Predecessor Node Color', sortOrder: 2, value: '#f97316' },
  { key: 'relation.succColor', category: 'relation', label: 'Successor Node Color', sortOrder: 3, value: '#0891b2' },
  { key: 'relation.outlineWidth', category: 'relation', label: 'Highlight Outline Width', sortOrder: 4, value: '1' },

  // Business date
  { key: 'business.dayStartHour', category: 'business', label: 'Day Start Hour', sortOrder: 1, value: '0' },
  { key: 'business.dayStartMinute', category: 'business', label: 'Day Start Minute', sortOrder: 2, value: '0' },
]

// ─── Default field definitions ────────────────────────────────────────────

const FIELD_DEFINITIONS_SEED = [
  { key: 'id', label: 'Node ID', sectionTitle: 'Identity', role: 'detail', format: 'mono', sortOrder: 1, isProtected: 1, showOnCard: 'Y', showInDetails: 'Y' },
  { key: 'label', label: 'Node Label', sectionTitle: 'Identity', role: 'title', format: 'text', sortOrder: 2, isProtected: 1, showOnCard: 'Y', showInDetails: 'Y' },
  { key: 'kind', label: 'Kind', sectionTitle: 'Identity', role: 'subtitle', format: 'text', sortOrder: 3, isProtected: 1, showOnCard: 'Y', showInDetails: 'Y' },
  { key: 'parentId', label: 'Parent Node', sectionTitle: 'Identity', role: 'none', format: 'text', sortOrder: 4, isProtected: 1, showOnCard: 'N', showInDetails: 'N' },
  { key: 'nodeKind', label: 'Type', sectionTitle: 'Identity', role: 'subtitle', format: 'text', sortOrder: 5, isProtected: 1, showOnCard: 'Y', showInDetails: 'Y' },
  { key: 'status', label: 'Status', sectionTitle: 'State', role: 'detail', format: 'status', sortOrder: 6, isProtected: 1, showOnCard: 'Y', showInDetails: 'Y' },
  { key: 'host', label: 'Host', sectionTitle: 'Execution', role: 'detail', format: 'mono', sortOrder: 7, isProtected: 0, showOnCard: 'Y', showInDetails: 'Y' },
  { key: 'runs', label: 'Runs', sectionTitle: 'Execution', role: 'detail', format: 'text', sortOrder: 8, isProtected: 0, showOnCard: 'Y', showInDetails: 'Y' },
  { key: 'scheduled', label: 'Scheduled', sectionTitle: 'Execution', role: 'detail', format: 'text', sortOrder: 8.5, isProtected: 1, showOnCard: 'Y', showInDetails: 'Y' },
  { key: 'schedule', label: 'Schedule Config', sectionTitle: 'Scheduling', role: 'detail', format: 'text', sortOrder: 9, isProtected: 1, showOnCard: 'N', showInDetails: 'Y' },
]

// ─── Default calendars ────────────────────────────────────────────────────

const CALENDARS_SEED = [
  { id: 'cal-regular', name: 'REGULAR', workdays: JSON.stringify([1, 2, 3, 4, 5]), holidays: JSON.stringify(['2026-01-01', '2026-12-25']) },
  { id: 'cal-mfd9h', name: 'MFD9H', workdays: JSON.stringify([1, 2, 3, 4, 5, 6]), holidays: JSON.stringify(['2026-01-01', '2026-12-25']) },
]

// ─── Default schedule configs ─────────────────────────────────────────────

const SCHEDULE_CONFIGS_SEED = [
  {
    id: 'sched-daily',
    name: 'DAILY_PROD_RUN',
    configData: JSON.stringify({
      CALENDARS: { REGULAR: { WORKDAYS: [1, 2, 3, 4, 5], HOLIDAYS: ['2026-01-01', '2026-12-25'] } },
      WEEKDAYS_CALENDAR: 'REGULAR',
      MONTH_CALENDAR: 'REGULAR',
      WEEKDAYS: ['1', '2', '3', '4', '5'],
      MONTHDAYS: ['WORKDAYS'],
      MONTHS: ['ALL'],
      WEEK_MONTH_RELATION: 'OR',
      CONFIRMATION: { CALENDAR: 'REGULAR', EXCEPTION_POLICY: 'SHIFT_AND_RUN_ON_NEXT_CONFIRMED_DAY', SHIFT_BY: 0 },
      ACTIVITY_PERIOD: { MODE: 'ALWAYS' },
    }),
  },
  {
    id: 'sched-monthend',
    name: 'END_OF_MONTH_RUN',
    configData: JSON.stringify({
      CALENDARS: { MFD9H: { WORKDAYS: [1, 2, 3, 4, 5, 6], HOLIDAYS: ['2026-01-01', '2026-12-25'] } },
      WEEKDAYS_CALENDAR: 'MFD9H',
      MONTH_CALENDAR: 'MFD9H',
      WEEKDAYS: [],
      MONTHDAYS: ['L1', 'L2'],
      MONTHS: ['ALL'],
      WEEK_MONTH_RELATION: 'OR',
      CONFIRMATION: { CALENDAR: 'MFD9H', EXCEPTION_POLICY: 'RUN_ON_NEXT_CONFIRMED_DAY_AND_SHIFT', SHIFT_BY: 0 },
      ACTIVITY_PERIOD: { MODE: 'ALWAYS' },
    }),
  },
]

async function main() {
  console.log('Seeding Alpha VW database...')

  // 1. App config
  for (const row of APP_CONFIG_SEED) {
    await db.appConfig.upsert({
      where: { key: row.key },
      create: row,
      update: {},
    })
  }
  console.log(`Seeded ${APP_CONFIG_SEED.length} app_config rows`)

  // 2. Field definitions
  for (const f of FIELD_DEFINITIONS_SEED) {
    await db.fieldDefinition.upsert({
      where: { key: f.key },
      create: f,
      update: {},
    })
  }
  console.log(`Seeded ${FIELD_DEFINITIONS_SEED.length} field_definitions`)

  // 3. Calendars
  for (const c of CALENDARS_SEED) {
    await db.calendar.upsert({
      where: { name: c.name },
      create: c,
      update: {},
    })
  }
  console.log(`Seeded ${CALENDARS_SEED.length} calendars`)

  // 4. Schedule configs
  for (const s of SCHEDULE_CONFIGS_SEED) {
    await db.scheduleConfig.upsert({
      where: { name: s.name },
      create: s,
      update: {},
    })
  }
  console.log(`Seeded ${SCHEDULE_CONFIGS_SEED.length} schedule_configs`)

  // 5. Module + Default viewpoint
  await db.module.upsert({
    where: { id: 'architecture' },
    create: { id: 'architecture', label: 'Architecture' },
    update: {},
  })

  await db.viewpoint.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      moduleId: 'architecture',
      label: 'Default',
      description: 'Default topology viewpoint — all jobs across all folders.',
      folder: null,
      jobCount: 0,
      scope: 'Public',
      filterStatus: 'All',
      grouping: 'Folder',
      sortBy: 'label',
    },
    update: {},
  })
  console.log('Seeded module + default viewpoint')

  console.log('Seed complete!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
