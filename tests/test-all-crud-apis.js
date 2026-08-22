/**
 * Comprehensive API Integration Test Suite for Alpha VW CRUD APIs.
 *
 * Tests ALL 10 tables across ALL CRUD operations:
 *  1. GET    /api/crud/[table]          (Fetch all rows)
 *  2. POST   /api/crud/[table]          (Create single record)
 *  3. PUT    /api/crud/[table]/[id]     (Update single record)
 *  4. POST   /api/crud/bulk/[table]     (Bulk upload / upsert rows)
 *  5. DELETE /api/crud/[table]/[id]     (Delete single record)
 *
 * Run with: node tests/test-all-crud-apis.js
 */

const BASE_URL = 'http://localhost:3000/api/crud'

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${options.method || 'GET'} ${path}: ${JSON.stringify(data)}`)
  }
  return data
}

async function runTestSuite() {
  console.log('====================================================')
  console.log('🚀 STARTING COMPREHENSIVE CRUD API INTEGRATION TESTS')
  console.log('====================================================\n')

  let totalTests = 0
  let passedTests = 0
  let failedTests = 0

  function assert(condition, message) {
    totalTests++
    if (condition) {
      passedTests++
      console.log(`  ✓ ${message}`)
    } else {
      failedTests++
      console.error(`  ❌ FAILED: ${message}`)
    }
  }

  // Define test cases for all 10 tables
  const testCases = [
    {
      table: 'modules',
      pkField: 'id',
      createData: { id: 'm-test-suite', label: 'Integration Test Module' },
      updateData: { label: 'Updated Test Module' },
      bulkData: [
        { id: 'm-bulk-1', label: 'Bulk Module 1' },
        { id: 'm-bulk-2', label: 'Bulk Module 2' },
      ],
      cleanUpIds: ['m-test-suite', 'm-bulk-1', 'm-bulk-2'],
    },
    {
      table: 'viewpoints',
      pkField: 'id',
      createData: {
        id: 'vp-test-suite',
        moduleId: 'architecture',
        label: 'Integration Test Viewpoint',
        description: 'Testing CRUD',
        folder: 'Test Folder',
        jobCount: '12',
        scope: 'Public',
        filterStatus: 'All',
        grouping: 'Folder',
        sortBy: 'label',
      },
      updateData: {
        label: 'Updated Viewpoint Label',
        jobCount: '15',
        filterStatus: 'Completed',
      },
      bulkData: [
        { id: 'vp-bulk-1', moduleId: 'architecture', label: 'Bulk VP 1', jobCount: '5' },
        { id: 'vp-bulk-2', moduleId: 'architecture', label: 'Bulk VP 2', jobCount: '10' },
      ],
      cleanUpIds: ['vp-test-suite', 'vp-bulk-1', 'vp-bulk-2'],
    },
    {
      table: 'field_definitions',
      pkField: 'key',
      getId: (d) => d.key,
      createData: {
        key: 'field_test_suite',
        label: 'Integration Test Field',
        sectionTitle: 'Testing',
        role: 'detail',
        format: 'text',
        sortOrder: '99.5',
        isProtected: '0',
        showOnCard: 'Y',
        showInDetails: 'Y',
        isActive: '1',
      },
      updateData: {
        label: 'Updated Test Field',
        sortOrder: '100.0',
        isActive: '0',
      },
      bulkData: [
        { key: 'field_bulk_1', label: 'Bulk Field 1', sortOrder: '101' },
        { key: 'field_bulk_2', label: 'Bulk Field 2', sortOrder: '102' },
      ],
      cleanUpIds: ['field_test_suite', 'field_bulk_1', 'field_bulk_2'],
    },
    {
      table: 'nav_nodes',
      pkField: 'id',
      createData: {
        id: 'N-test-suite',
        label: 'Integration Test Node',
        kind: 'item',
        parentId: null,
        nodeKind: 'Process',
        status: 'Completed',
        host: 'server-test',
        runs: '42',
        sortOrder: '5',
      },
      updateData: {
        label: 'Updated Test Node',
        status: 'Executing',
        runs: '43',
      },
      bulkData: [
        { id: 'N-bulk-1', label: 'Bulk Node 1', kind: 'folder', sortOrder: '1' },
        { id: 'N-bulk-2', label: 'Bulk Node 2', kind: 'item', parentId: 'N-bulk-1', sortOrder: '2' },
      ],
      cleanUpIds: ['N-test-suite', 'N-bulk-2', 'N-bulk-1'], // child N-bulk-2 deleted before parent N-bulk-1
    },
    {
      table: 'edges',
      pkField: 'id',
      createData: { id: 'E-test-suite', source: 'N-test-suite', target: 'N-test-suite' },
      updateData: { source: 'N-test-suite', target: 'N-test-suite' },
      bulkData: [
        { id: 'E-bulk-1', source: 'N-test-suite', target: 'N-test-suite' },
        { id: 'E-bulk-2', source: 'N-test-suite', target: 'N-test-suite' },
      ],
      cleanUpIds: ['E-test-suite', 'E-bulk-1', 'E-bulk-2'],
    },
    {
      table: 'node_field_values',
      pkField: 'composite',
      getId: (d) => `${d.nodeId}__${d.fieldKey}`,
      createData: { nodeId: 'n-job-001', fieldKey: 'label', fieldValue: 'Test Value Initial' },
      updateData: { fieldValue: 'Test Value Updated' },
      bulkData: [
        { nodeId: 'n-job-001', fieldKey: 'status', fieldValue: 'Bulk Status' },
        { nodeId: 'n-job-001', fieldKey: 'host', fieldValue: 'Bulk Host' },
      ],
      cleanUpIds: ['n-job-001__status', 'n-job-001__host'],
    },
    {
      table: 'node_logs',
      pkField: 'id',
      isAutoInc: true,
      createData: { nodeId: 'n-job-001', timestamp: new Date().toISOString(), level: 'INFO', message: 'Test log entry' },
      updateData: { message: 'Updated test log entry' },
      bulkData: [
        { nodeId: 'n-job-001', timestamp: new Date().toISOString(), level: 'WARN', message: 'Bulk log 1' },
        { nodeId: 'n-job-001', timestamp: new Date().toISOString(), level: 'ERROR', message: 'Bulk log 2' },
      ],
      cleanUpIds: [],
    },
    {
      table: 'calendars',
      pkField: 'id',
      createData: { id: 'cal-test-suite', name: 'TEST_CALENDAR', workdays: '[1,2,3,4,5]', holidays: '[]' },
      updateData: { name: 'TEST_CALENDAR_UPDATED', workdays: '[1,2,3,4,5,6]' },
      bulkData: [
        { id: 'cal-bulk-1', name: 'BULK_CAL_1', workdays: '[1,2,3]' },
        { id: 'cal-bulk-2', name: 'BULK_CAL_2', workdays: '[1,2,3,4,5]' },
      ],
      cleanUpIds: ['cal-test-suite', 'cal-bulk-1', 'cal-bulk-2'],
    },
    {
      table: 'schedule_configs',
      pkField: 'id',
      createData: {
        id: 'sched-test-suite',
        name: 'TEST_SCHED',
        configData: JSON.stringify({ WEEKDAYS: ['1', '2'] }),
        lastEvaluatedDate: '2026-08-22',
        isScheduledToday: 'Yes',
      },
      updateData: {
        name: 'TEST_SCHED_UPDATED',
        isScheduledToday: 'No',
      },
      bulkData: [
        { id: 'sched-bulk-1', name: 'BULK_SCHED_1', configData: JSON.stringify({ MONTHS: ['ALL'] }) },
        { id: 'sched-bulk-2', name: 'BULK_SCHED_2', configData: JSON.stringify({ MONTHS: ['ALL'] }) },
      ],
      cleanUpIds: ['sched-test-suite', 'sched-bulk-1', 'sched-bulk-2'],
    },
    {
      table: 'app_config',
      pkField: 'key',
      getId: (d) => d.key,
      createData: { key: 'test.app.config', category: 'testing', label: 'Test Config', value: 'Val1', sortOrder: '10' },
      updateData: { value: 'Val2Updated', sortOrder: '11' },
      bulkData: [
        { key: 'test.bulk.1', category: 'testing', label: 'Bulk App Config 1', value: '1', sortOrder: '12' },
        { key: 'test.bulk.2', category: 'testing', label: 'Bulk App Config 2', value: '2', sortOrder: '13' },
      ],
      cleanUpIds: ['test.app.config', 'test.bulk.1', 'test.bulk.2'],
    },
  ]

  for (const tc of testCases) {
    console.log(`\n----------------------------------------------------`)
    console.log(`📌 TESTING TABLE: [ ${tc.table.toUpperCase()} ]`)
    console.log(`----------------------------------------------------`)

    let createdId = null

    // 1. GET (Fetch All)
    try {
      const rows = await request(`/${tc.table}`)
      assert(Array.isArray(rows), `GET /${tc.table} returned ${rows.length} rows array`)
    } catch (err) {
      assert(false, `GET /${tc.table} failed: ${err.message}`)
    }

    // 2. POST (Single Create)
    try {
      const res = await request(`/${tc.table}`, {
        method: 'POST',
        body: JSON.stringify(tc.createData),
      })
      createdId = String(tc.getId?.(tc.createData) || res.id || tc.createData.id || tc.createData.key || '')
      assert(res.success === true, `POST /${tc.table} created record (ID: ${createdId})`)
      if (tc.isAutoInc && res.id) tc.cleanUpIds.push(String(res.id))
      else if (!tc.cleanUpIds.includes(createdId)) tc.cleanUpIds.push(createdId)
    } catch (err) {
      assert(false, `POST /${tc.table} failed: ${err.message}`)
    }

    // 3. PUT (Single Edit)
    if (createdId) {
      try {
        const res = await request(`/${tc.table}/${encodeURIComponent(createdId)}`, {
          method: 'PUT',
          body: JSON.stringify(tc.updateData),
        })
        assert(res.success === true, `PUT /${tc.table}/${createdId} updated record`)
      } catch (err) {
        assert(false, `PUT /${tc.table}/${createdId} failed: ${err.message}`)
      }
    }

    // 4. POST /bulk (Bulk Upload / Upsert)
    try {
      const res = await request(`/bulk/${tc.table}`, {
        method: 'POST',
        body: JSON.stringify({ rows: tc.bulkData }),
      })
      assert(res.success === true && res.count === tc.bulkData.length, `POST /bulk/${tc.table} inserted ${res.count} rows`)
    } catch (err) {
      assert(false, `POST /bulk/${tc.table} failed: ${err.message}`)
    }

    // 5. DELETE (Cleanup records)
    for (const deleteId of tc.cleanUpIds) {
      try {
        const res = await request(`/${tc.table}/${encodeURIComponent(deleteId)}`, {
          method: 'DELETE',
        })
        assert(res.success === true, `DELETE /${tc.table}/${deleteId} removed record`)
      } catch (err) {
        assert(false, `DELETE /${tc.table}/${deleteId} failed: ${err.message}`)
      }
    }
  }

  console.log('\n====================================================')
  console.log(`📊 TEST RESULTS SUMMARY:`)
  console.log(`   Total Test Steps : ${totalTests}`)
  console.log(`   Passed           : ${passedTests}`)
  console.log(`   Failed           : ${failedTests}`)
  console.log('====================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Unhandled Test Suite Error:', err)
  process.exit(1)
})
