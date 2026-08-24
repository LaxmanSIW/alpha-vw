/**
 * Test Data Cleanup / Revert Script
 * 
 * Removes all test data created by seed-test-data.ts:
 * 1. Test edges (E-TEST-*)
 * 2. Test node field values (nodeId starting with J-TEST- or test fieldKeys)
 * 3. Test job nodes (J-TEST-*) and PACE Events folder (F-PACE)
 * 4. Test field definitions (s-name, pattern, start time, endtime, startdaytime, enablerjob, stream name)
 * 
 * Restores the database back to its exact state prior to running seed-test-data.ts.
 */

import { db } from '../src/lib/db'

const TEST_FIELD_KEYS = [
  's-name',
  'pattern',
  'start time',
  'endtime',
  'startdaytime',
  'enablerjob',
  'stream name',
]

async function main() {
  console.log('🧹 Starting Test Data Cleanup / Revert Script...')

  // 1. Delete test edges
  console.log('1. Deleting test edges (E-TEST-*)...')
  const deletedEdges = await db.edge.deleteMany({
    where: {
      id: { startsWith: 'E-TEST-' },
    },
  })
  console.log(`   Deleted ${deletedEdges.count} test edges.`)

  // 2. Delete test node field values
  console.log('2. Deleting test node field values...')
  const deletedFieldValues = await db.nodeFieldValue.deleteMany({
    where: {
      OR: [
        { nodeId: { startsWith: 'J-TEST-' } },
        { nodeId: 'F-PACE' },
        { fieldKey: { in: TEST_FIELD_KEYS } },
      ],
    },
  })
  console.log(`   Deleted ${deletedFieldValues.count} test node field values.`)

  // 3. Delete test nodes (jobs + PACE folder)
  console.log('3. Deleting test job nodes (J-TEST-*) and PACE Events folder (F-PACE)...')
  const deletedNodes = await db.navNode.deleteMany({
    where: {
      OR: [
        { id: { startsWith: 'J-TEST-' } },
        { id: 'F-PACE' },
      ],
    },
  })
  console.log(`   Deleted ${deletedNodes.count} test nodes.`)

  // 4. Delete test field definitions
  console.log('4. Deleting test field definitions...')
  const deletedFieldDefs = await db.fieldDefinition.deleteMany({
    where: {
      key: { in: TEST_FIELD_KEYS },
    },
  })
  console.log(`   Deleted ${deletedFieldDefs.count} test field definitions.`)

  console.log('✨ Cleanup Complete! Database has been restored to its previous state.')
}

main()
  .catch((e) => {
    console.error('❌ Error cleaning up test data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
