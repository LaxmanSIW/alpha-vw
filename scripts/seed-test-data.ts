/**
 * Test Data Generator Script
 * 
 * Creates:
 * 1. Custom field definitions (s-name, pattern, start time, endtime, startdaytime, enablerjob, stream name)
 *    all set to showOnCard = 'N' (hidden on card) and showInDetails = 'Y' (shown in details panel).
 * 2. 1 Pace Events folder (F-PACE) + 100 test job nodes (J-TEST-001 .. J-TEST-100) referencing F-PACE as parent.
 * 3. EAV node field values for all 100 nodes across all custom fields.
 * 4. Dependency edges linking the jobs in a workflow pipeline.
 */

import { db } from '../src/lib/db'

// ─── Custom Field Definitions ──────────────────────────────────────────────────

const TEST_FIELD_DEFS = [
  { key: 's-name', label: 'Short Name', sectionTitle: 'Stream & Schedule Info', role: 'detail', format: 'mono', sortOrder: 20, isProtected: 0, showOnCard: 'N', showInDetails: 'Y', isActive: 1 },
  { key: 'pattern', label: 'Execution Pattern', sectionTitle: 'Stream & Schedule Info', role: 'detail', format: 'text', sortOrder: 21, isProtected: 0, showOnCard: 'N', showInDetails: 'Y', isActive: 1 },
  { key: 'start time', label: 'Start Time', sectionTitle: 'Stream & Schedule Info', role: 'detail', format: 'mono', sortOrder: 22, isProtected: 0, showOnCard: 'N', showInDetails: 'Y', isActive: 1 },
  { key: 'endtime', label: 'End Time', sectionTitle: 'Stream & Schedule Info', role: 'detail', format: 'mono', sortOrder: 23, isProtected: 0, showOnCard: 'N', showInDetails: 'Y', isActive: 1 },
  { key: 'startdaytime', label: 'Start Day Time', sectionTitle: 'Stream & Schedule Info', role: 'detail', format: 'mono', sortOrder: 24, isProtected: 0, showOnCard: 'N', showInDetails: 'Y', isActive: 1 },
  { key: 'enablerjob', label: 'Enabler Job', sectionTitle: 'Stream & Schedule Info', role: 'detail', format: 'text', sortOrder: 25, isProtected: 0, showOnCard: 'N', showInDetails: 'Y', isActive: 1 },
  { key: 'stream name', label: 'Stream Name', sectionTitle: 'Stream & Schedule Info', role: 'detail', format: 'text', sortOrder: 26, isProtected: 0, showOnCard: 'N', showInDetails: 'Y', isActive: 1 },
]

const JOB_SUBJECTS = [
  'ISO Country Code Sync',
  'Roll Forward Ledger',
  'Validate Daily Transactions',
  'Process SWIFT Payments',
  'EOD Account Balance Audit',
  'FX Rates Spot Feed',
  'Customer Risk Scoring',
  'SEPA Clearing Settlement',
  'Fraud Detection Analytics',
  'GL Posting Verification',
]

const NODE_KINDS = ['Source', 'Process', 'Reporter', 'ETL', 'Service', 'Database']
const STATUSES = ['ok', 'executing', 'wait', 'fail']
const HOSTS = ['srv-prod-01', 'srv-prod-02', 'srv-etl-09', 'srv-cloud-east']
const PATTERNS = ['DAILY_PROD_RUN', 'END_OF_MONTH_RUN', 'HOURLY_SYNC', 'BATCH_STREAM_PACE']

async function main() {
  console.log('🚀 Starting Test Data Generator Script...')

  // 1. Create or upsert field definitions
  console.log('1. Creating 7 custom field definitions (hidden on card, visible in details)...')
  for (const fd of TEST_FIELD_DEFS) {
    await db.fieldDefinition.upsert({
      where: { key: fd.key },
      create: fd,
      update: fd,
    })
  }

  // 2. Create the Pace Events folder
  console.log('2. Creating Pace Events folder (F-PACE)...')
  await db.navNode.upsert({
    where: { id: 'F-PACE' },
    create: {
      id: 'F-PACE',
      label: 'PACE Events',
      kind: 'folder',
      parentId: null,
      nodeKind: 'Container',
      status: 'ok',
      sortOrder: 100,
    },
    update: {
      label: 'PACE Events',
      kind: 'folder',
      parentId: null,
      status: 'ok',
    },
  })

  // Prepare batch arrays
  const nodesToCreate: Array<{
    id: string
    label: string
    kind: string
    parentId: string
    nodeKind: string
    status: string
    host: string
    runs: number
    sortOrder: number
    data: string
  }> = []

  const fieldValuesToCreate: Array<{
    nodeId: string
    fieldKey: string
    fieldValue: string
  }> = []

  const edgesToCreate: Array<{
    id: string
    source: string
    target: string
  }> = []

  for (let i = 1; i <= 100; i++) {
    const padId = String(i).padStart(3, '0')
    const nodeId = `J-TEST-${padId}`

    const subject = JOB_SUBJECTS[(i - 1) % JOB_SUBJECTS.length]
    const label = `${subject} #${i}`
    const nodeKind = NODE_KINDS[i % NODE_KINDS.length]
    const status = STATUSES[i % STATUSES.length]
    const host = HOSTS[i % HOSTS.length]
    const runs = Math.floor(Math.random() * 500) + 10

    const sName = `STRM-${padId}`
    const pattern = PATTERNS[i % PATTERNS.length]
    const startTime = `${String((i * 2) % 24).padStart(2, '0')}:15:00`
    const endTime = `${String((i * 2 + 1) % 24).padStart(2, '0')}:45:00`
    const startDayTime = `2026-08-24 ${startTime}`
    const enablerJob = i === 1 ? 'F-PACE' : `J-TEST-${String(i - 1).padStart(3, '0')}`
    const streamName = `Stream-PACE-${subject.replace(/\s+/g, '-')}`

    const extraData = {
      's-name': sName,
      pattern,
      'start time': startTime,
      endtime: endTime,
      startdaytime: startDayTime,
      enablerjob: enablerJob,
      'stream name': streamName,
    }

    nodesToCreate.push({
      id: nodeId,
      label,
      kind: 'item',
      parentId: 'F-PACE',
      nodeKind,
      status,
      host,
      runs,
      sortOrder: i,
      data: JSON.stringify(extraData),
    })

    const fieldMap: Record<string, string> = {
      's-name': sName,
      pattern,
      'start time': startTime,
      endtime: endTime,
      startdaytime: startDayTime,
      enablerjob: enablerJob,
      'stream name': streamName,
    }

    for (const [key, val] of Object.entries(fieldMap)) {
      fieldValuesToCreate.push({
        nodeId,
        fieldKey: key,
        fieldValue: val,
      })
    }

    if (i < 100) {
      edgesToCreate.push({
        id: `E-TEST-${padId}`,
        source: nodeId,
        target: `J-TEST-${String(i + 1).padStart(3, '0')}`,
      })
    }
  }

  // Clear any existing test batch first
  console.log('3. Cleaning previous test batch if any...')
  await db.edge.deleteMany({ where: { id: { startsWith: 'E-TEST-' } } })
  await db.nodeFieldValue.deleteMany({ where: { nodeId: { startsWith: 'J-TEST-' } } })
  await db.navNode.deleteMany({ where: { id: { startsWith: 'J-TEST-' } } })

  console.log('4. Performing fast batch insert (100 nodes, 700 field values, 99 edges)...')
  await db.$transaction([
    db.navNode.createMany({ data: nodesToCreate }),
    db.nodeFieldValue.createMany({ data: fieldValuesToCreate }),
    db.edge.createMany({ data: edgesToCreate }),
  ])

  console.log('✅ Test Data Generation Complete!')
  console.log(`   - Created 7 Field Definitions: s-name, pattern, start time, endtime, startdaytime, enablerjob, stream name`)
  console.log(`   - Created 1 Folder: F-PACE (PACE Events)`)
  console.log(`   - Created 100 Jobs: J-TEST-001 .. J-TEST-100 under F-PACE`)
  console.log(`   - Created 99 Dependency Edges: E-TEST-001 .. E-TEST-099`)
  console.log(`   - Created 700 NodeFieldValues (EAV records)`)
}

main()
  .catch((e) => {
    console.error('❌ Error generating test data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
