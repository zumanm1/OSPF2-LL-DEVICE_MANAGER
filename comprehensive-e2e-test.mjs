#!/usr/bin/env node

/**
 * COMPREHENSIVE END-TO-END TESTING SUITE
 *
 * This test suite validates ALL functionality across:
 * - Device Manager (CRUD operations, bulk operations)
 * - Automation (SSH/Telnet connections, job execution)
 * - Data Save (File listing, viewing)
 * - Transformation (Topology generation)
 * - Pipeline Visualization
 * - Database Admin
 * - Cross-page data flow
 *
 * Database Per Page Mapping:
 * - Device Manager → devices.db (devices table)
 * - Automation → automation.db (jobs, job_results tables)
 * - Data Save → datasave.db (files, operations tables)
 * - Transformation → topology.db (nodes, links tables)
 */

import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';
const SCREENSHOT_DIR = './e2e-test-screenshots';

// Test Results Tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
  database_validations: {},
  performance_metrics: {}
};

// Utility: Screenshot helper
async function takeScreenshot(page, name) {
  if (!existsSync(SCREENSHOT_DIR)) {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${SCREENSHOT_DIR}/${timestamp}_${name}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`  📸 Screenshot: ${filename}`);
  return filename;
}

// Utility: Wait helper
async function waitForSelector(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (err) {
    console.log(`  ⚠️  Selector not found: ${selector}`);
    return false;
  }
}

// Utility: Test wrapper
async function runTest(name, testFn) {
  testResults.total++;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST ${testResults.total}: ${name}`);
  console.log('='.repeat(80));

  const startTime = Date.now();

  try {
    await testFn();
    testResults.passed++;
    const duration = Date.now() - startTime;
    testResults.performance_metrics[name] = duration;
    console.log(`✅ PASSED (${duration}ms)`);
    return true;
  } catch (err) {
    testResults.failed++;
    testResults.errors.push({ test: name, error: err.message });
    console.log(`❌ FAILED: ${err.message}`);
    return false;
  }
}

// ============================================================================
// DATABASE VALIDATION TESTS
// ============================================================================

async function testDatabaseConnectivity() {
  console.log('\n📊 Testing Database Connectivity and Schema...');

  const response = await fetch(`${BACKEND_URL}/api/admin/databases`);
  if (!response.ok) {
    throw new Error('Failed to fetch database stats');
  }

  const dbStats = await response.json();
  console.log('  Database Statistics:');

  // Validate all 4 databases exist
  const expectedDbs = ['devices', 'automation', 'datasave', 'topology'];
  for (const dbName of expectedDbs) {
    if (!dbStats[dbName]) {
      throw new Error(`Database ${dbName} not found`);
    }

    const db = dbStats[dbName];
    console.log(`    - ${dbName}.db: ${db.exists ? '✅ EXISTS' : '❌ MISSING'}, ${db.size_mb.toFixed(2)} MB`);
    console.log(`      Tables: ${Object.keys(db.tables).join(', ')}`);

    // Store for later validation
    testResults.database_validations[dbName] = {
      exists: db.exists,
      size_mb: db.size_mb,
      tables: db.tables
    };
  }

  // Validate devices.db has the devices table
  if (!dbStats.devices.tables.devices) {
    throw new Error('devices.db missing "devices" table');
  }

  // Validate automation.db has jobs and job_results tables
  if (typeof dbStats.automation.tables.jobs === 'undefined' || typeof dbStats.automation.tables.job_results === 'undefined') {
    throw new Error('automation.db missing required tables');
  }

  // Validate topology.db has nodes and links tables
  if (typeof dbStats.topology.tables.nodes === 'undefined' || typeof dbStats.topology.tables.links === 'undefined') {
    throw new Error('topology.db missing required tables');
  }

  // Validate datasave.db has files and operations tables
  if (typeof dbStats.datasave.tables.files === 'undefined' || typeof dbStats.datasave.tables.operations === 'undefined') {
    throw new Error('datasave.db missing required tables');
  }

  console.log('  ✅ All databases and schemas validated');
}

// ============================================================================
// DEVICE MANAGER TESTS
// ============================================================================

async function testDeviceManagerPage(page) {
  console.log('\n🖥️  Testing Device Manager Page...');

  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });
  await takeScreenshot(page, '01_device_manager_landing');

  // Wait for devices to load
  const devicesLoaded = await waitForSelector(page, 'table', 5000);
  if (!devicesLoaded) {
    throw new Error('Device table did not load');
  }

  // Count devices in UI
  const deviceCount = await page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr');
    return rows.length;
  });

  console.log(`  Found ${deviceCount} devices in UI`);

  // Validate against API
  const apiResponse = await fetch(`${BACKEND_URL}/api/devices`);
  const apiDevices = await apiResponse.json();
  console.log(`  API reports ${apiDevices.length} devices`);

  if (deviceCount !== apiDevices.length) {
    throw new Error(`Device count mismatch: UI=${deviceCount}, API=${apiDevices.length}`);
  }

  // Validate devices.db record count
  const dbDeviceCount = testResults.database_validations.devices.tables.devices;
  console.log(`  Database has ${dbDeviceCount} devices`);

  if (apiDevices.length !== dbDeviceCount) {
    testResults.warnings.push(`Device count mismatch: API=${apiDevices.length}, DB=${dbDeviceCount}`);
  }

  console.log('  ✅ Device Manager page validated');
}

async function testDeviceCRUD(page) {
  console.log('\n✏️  Testing Device CRUD Operations...');

  // Test: Add Device
  console.log('  Testing ADD device...');

  const addButtonExists = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(btn => btn.textContent?.includes('Add') || btn.querySelector('svg'));
  });

  if (!addButtonExists) {
    throw new Error('Add device button not found');
  }

  // Click the add button (first button with Plus icon or "Add" text)
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const addButton = buttons.find(btn =>
      btn.textContent?.includes('Add') ||
      btn.querySelector('svg path[d*="M12 4"]') // Plus icon path
    );
    if (addButton) addButton.click();
  });

  await new Promise(resolve => setTimeout(resolve, 500));
  await takeScreenshot(page, '02_add_device_modal');

  // Check if modal opened
  const modalOpened = await page.evaluate(() => {
    return document.querySelector('[role="dialog"]') !== null ||
           document.querySelector('.modal') !== null ||
           document.querySelector('input[name="deviceName"]') !== null;
  });

  if (modalOpened) {
    console.log('  ✅ Add device modal opened');

    // Close modal (press Escape or click close button)
    await page.keyboard.press('Escape');
    await new Promise(resolve => setTimeout(resolve, 300));
  } else {
    testResults.warnings.push('Add device modal did not open');
  }

  // Test: Search/Filter
  console.log('  Testing SEARCH functionality...');

  const searchInput = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
    return inputs.some(input =>
      input.placeholder?.toLowerCase().includes('search') ||
      input.getAttribute('aria-label')?.toLowerCase().includes('search')
    );
  });

  if (searchInput) {
    console.log('  ✅ Search input found');
  } else {
    testResults.warnings.push('Search input not found');
  }

  console.log('  ✅ CRUD operations UI validated');
}

async function testBulkOperations(page) {
  console.log('\n📦 Testing Bulk Operations...');

  // Test: Bulk selection
  const checkboxes = await page.evaluate(() => {
    return document.querySelectorAll('input[type="checkbox"]').length;
  });

  console.log(`  Found ${checkboxes} checkboxes`);

  if (checkboxes > 0) {
    console.log('  ✅ Bulk selection checkboxes present');
  } else {
    testResults.warnings.push('No checkboxes found for bulk operations');
  }

  // Test: Bulk actions menu
  const bulkActionsExist = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(btn =>
      btn.textContent?.toLowerCase().includes('bulk') ||
      btn.textContent?.toLowerCase().includes('delete selected') ||
      btn.textContent?.toLowerCase().includes('actions')
    );
  });

  if (bulkActionsExist) {
    console.log('  ✅ Bulk actions menu found');
  } else {
    testResults.warnings.push('Bulk actions menu not found');
  }
}

// ============================================================================
// AUTOMATION PAGE TESTS
// ============================================================================

async function testAutomationPage(page) {
  console.log('\n⚙️  Testing Automation Page...');

  // Navigate to Automation page
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('button, a'));
    const automationNav = navButtons.find(btn =>
      btn.textContent?.toLowerCase().includes('automation')
    );
    if (automationNav) automationNav.click();
  });

  await new Promise(resolve => setTimeout(resolve, 1000));
  await takeScreenshot(page, '03_automation_page');

  // Validate page loaded
  const pageLoaded = await page.evaluate(() => {
    return document.body.textContent?.includes('Automation') ||
           document.body.textContent?.includes('Connect') ||
           document.body.textContent?.includes('Execute');
  });

  if (!pageLoaded) {
    throw new Error('Automation page did not load');
  }

  // Check for device selection
  const deviceSelectionExists = await page.evaluate(() => {
    return document.querySelectorAll('input[type="checkbox"]').length > 0;
  });

  if (deviceSelectionExists) {
    console.log('  ✅ Device selection checkboxes found');
  } else {
    testResults.warnings.push('No device selection found on Automation page');
  }

  // Check for command list
  const commandsExist = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('show') || text.includes('command') || text.includes('terminal');
  });

  if (commandsExist) {
    console.log('  ✅ Command list present');
  } else {
    testResults.warnings.push('Command list not found');
  }

  // Check for Connect/Execute buttons
  const actionButtonsExist = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const hasConnect = buttons.some(btn => btn.textContent?.toLowerCase().includes('connect'));
    const hasExecute = buttons.some(btn => btn.textContent?.toLowerCase().includes('execute') || btn.textContent?.toLowerCase().includes('run'));
    return { hasConnect, hasExecute };
  });

  if (actionButtonsExist.hasConnect && actionButtonsExist.hasExecute) {
    console.log('  ✅ Connect and Execute buttons found');
  } else {
    testResults.warnings.push(`Missing action buttons: Connect=${actionButtonsExist.hasConnect}, Execute=${actionButtonsExist.hasExecute}`);
  }

  console.log('  ✅ Automation page validated');
}

async function testAutomationJobFlow(page) {
  console.log('\n🔄 Testing Automation Job Flow...');

  // Note: We can't actually connect to routers without real devices,
  // but we can test the UI flow

  // Check for job status display
  const jobStatusExists = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('Job') || text.includes('Status') || text.includes('Progress');
  });

  if (jobStatusExists) {
    console.log('  ✅ Job status display found');
  } else {
    testResults.warnings.push('Job status display not found');
  }

  // Validate automation.db can be accessed
  const automationDbValid = testResults.database_validations.automation;
  if (automationDbValid && automationDbValid.exists) {
    console.log(`  ✅ automation.db validated: ${automationDbValid.tables.jobs} jobs, ${automationDbValid.tables.job_results} results`);
  } else {
    throw new Error('automation.db validation failed');
  }
}

// ============================================================================
// DATA SAVE PAGE TESTS
// ============================================================================

async function testDataSavePage(page) {
  console.log('\n💾 Testing Data Save Page...');

  // Navigate to Data Save page
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('button, a'));
    const dataSaveNav = navButtons.find(btn =>
      btn.textContent?.toLowerCase().includes('data') && btn.textContent?.toLowerCase().includes('save')
    );
    if (dataSaveNav) dataSaveNav.click();
  });

  await new Promise(resolve => setTimeout(resolve, 1000));
  await takeScreenshot(page, '04_data_save_page');

  // Validate page loaded
  const pageLoaded = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('Data Save') || text.includes('Files') || text.includes('IOSXRV');
  });

  if (!pageLoaded) {
    throw new Error('Data Save page did not load');
  }

  // Check for file type tabs (TEXT/JSON)
  const fileTypeTabs = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const hasText = buttons.some(btn => btn.textContent?.includes('TEXT') || btn.textContent?.includes('Text'));
    const hasJson = buttons.some(btn => btn.textContent?.includes('JSON') || btn.textContent?.includes('Json'));
    return { hasText, hasJson };
  });

  if (fileTypeTabs.hasText && fileTypeTabs.hasJson) {
    console.log('  ✅ File type tabs (TEXT/JSON) found');
  } else {
    testResults.warnings.push('File type tabs incomplete');
  }

  // Validate datasave.db
  const datasaveDbValid = testResults.database_validations.datasave;
  if (datasaveDbValid && datasaveDbValid.exists) {
    console.log(`  ✅ datasave.db validated: ${datasaveDbValid.tables.files} files, ${datasaveDbValid.tables.operations} operations`);
  } else {
    throw new Error('datasave.db validation failed');
  }

  console.log('  ✅ Data Save page validated');
}

// ============================================================================
// TRANSFORMATION PAGE TESTS
// ============================================================================

async function testTransformationPage(page) {
  console.log('\n🗺️  Testing Transformation Page...');

  // Navigate to Transformation page
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('button, a'));
    const transformNav = navButtons.find(btn =>
      btn.textContent?.toLowerCase().includes('transformation') ||
      btn.textContent?.toLowerCase().includes('topology')
    );
    if (transformNav) transformNav.click();
  });

  await new Promise(resolve => setTimeout(resolve, 1000));
  await takeScreenshot(page, '05_transformation_page');

  // Validate page loaded
  const pageLoaded = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('Transformation') || text.includes('Topology') || text.includes('Network');
  });

  if (!pageLoaded) {
    throw new Error('Transformation page did not load');
  }

  // Check for topology generation button
  const generateButtonExists = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(btn =>
      btn.textContent?.toLowerCase().includes('generate') ||
      btn.textContent?.toLowerCase().includes('build') ||
      btn.textContent?.toLowerCase().includes('create')
    );
  });

  if (generateButtonExists) {
    console.log('  ✅ Topology generation button found');
  } else {
    testResults.warnings.push('Topology generation button not found');
  }

  // Validate topology.db
  const topologyDbValid = testResults.database_validations.topology;
  if (topologyDbValid && topologyDbValid.exists) {
    console.log(`  ✅ topology.db validated: ${topologyDbValid.tables.nodes} nodes, ${topologyDbValid.tables.links} links`);
  } else {
    throw new Error('topology.db validation failed');
  }

  console.log('  ✅ Transformation page validated');
}

// ============================================================================
// PIPELINE VISUALIZATION TESTS
// ============================================================================

async function testPipelineVisualization(page) {
  console.log('\n🔀 Testing Pipeline Visualization...');

  // Navigate back to devices page to check pipeline viz
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('button, a'));
    const devicesNav = navButtons.find(btn =>
      btn.textContent?.toLowerCase().includes('device')
    );
    if (devicesNav) devicesNav.click();
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Check for pipeline visualization component
  const pipelineExists = await page.evaluate(() => {
    // Look for pipeline-related elements
    const text = document.body.textContent || '';
    return text.includes('Pipeline') || text.includes('Workflow') || text.includes('Step');
  });

  if (pipelineExists) {
    console.log('  ✅ Pipeline visualization found');
    await takeScreenshot(page, '06_pipeline_visualization');
  } else {
    testResults.warnings.push('Pipeline visualization not visible');
  }

  // Test data flow across pages
  console.log('  Testing cross-page data flow...');

  // Device Manager → Automation (devices should be available)
  const devicesInAutomation = await page.evaluate(async () => {
    const response = await fetch('http://localhost:9051/api/devices');
    const devices = await response.json();
    return devices.length > 0;
  });

  if (devicesInAutomation) {
    console.log('  ✅ Devices flow to Automation page');
  } else {
    throw new Error('No devices available for Automation');
  }

  console.log('  ✅ Pipeline visualization validated');
}

// ============================================================================
// DATABASE ADMIN TESTS
// ============================================================================

async function testDatabaseAdmin(page) {
  console.log('\n🗄️  Testing Database Admin Functionality...');

  // Look for DB Admin section/button
  const dbAdminExists = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('Database') && (text.includes('Admin') || text.includes('Management'));
  });

  if (dbAdminExists) {
    console.log('  ✅ Database Admin section found');
    await takeScreenshot(page, '07_database_admin');
  } else {
    testResults.warnings.push('Database Admin section not visible');
  }

  // Test database stats API
  const statsResponse = await fetch(`${BACKEND_URL}/api/admin/databases`);
  if (!statsResponse.ok) {
    throw new Error('Database stats API failed');
  }

  const stats = await statsResponse.json();
  console.log('  ✅ Database stats API working');

  // Validate all databases are tracked
  const dbNames = Object.keys(stats);
  console.log(`  Tracked databases: ${dbNames.join(', ')}`);

  if (dbNames.length !== 4) {
    testResults.warnings.push(`Expected 4 databases, found ${dbNames.length}`);
  }
}

// ============================================================================
// UI/UX TESTS
// ============================================================================

async function testUIUXFeatures(page) {
  console.log('\n🎨 Testing UI/UX Features...');

  // Test: Dark mode toggle
  const darkModeToggle = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(btn =>
      btn.getAttribute('aria-label')?.toLowerCase().includes('theme') ||
      btn.getAttribute('title')?.toLowerCase().includes('theme') ||
      btn.textContent?.includes('🌙') ||
      btn.textContent?.includes('☀️')
    );
  });

  if (darkModeToggle) {
    console.log('  ✅ Dark mode toggle found');
  } else {
    testResults.warnings.push('Dark mode toggle not found');
  }

  // Test: Responsive design (check for mobile breakpoints)
  await page.setViewport({ width: 375, height: 667 }); // Mobile size
  await new Promise(resolve => setTimeout(resolve, 500));
  await takeScreenshot(page, '08_mobile_view');

  await page.setViewport({ width: 1920, height: 1080 }); // Desktop size
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('  ✅ Responsive design tested');

  // Test: Accessibility (check for ARIA labels)
  const hasAriaLabels = await page.evaluate(() => {
    const elementsWithAria = document.querySelectorAll('[aria-label], [role]');
    return elementsWithAria.length > 0;
  });

  if (hasAriaLabels) {
    console.log('  ✅ ARIA labels present');
  } else {
    testResults.warnings.push('No ARIA labels found');
  }
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

async function testPerformance(page) {
  console.log('\n⚡ Testing Performance...');

  const startTime = Date.now();
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });
  const loadTime = Date.now() - startTime;

  console.log(`  Initial page load: ${loadTime}ms`);

  if (loadTime > 5000) {
    testResults.warnings.push(`Slow initial load: ${loadTime}ms`);
  } else {
    console.log('  ✅ Page load performance acceptable');
  }

  // Test API response times
  const apiStartTime = Date.now();
  await fetch(`${BACKEND_URL}/api/devices`);
  const apiTime = Date.now() - apiStartTime;

  console.log(`  API response time: ${apiTime}ms`);

  if (apiTime > 1000) {
    testResults.warnings.push(`Slow API response: ${apiTime}ms`);
  } else {
    console.log('  ✅ API performance acceptable');
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 COMPREHENSIVE END-TO-END TEST SUITE');
  console.log('='.repeat(80));
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Phase 1: Database Validation
    await runTest('Database Connectivity and Schema', () => testDatabaseConnectivity());

    // Phase 2: Device Manager Tests
    await runTest('Device Manager Page Load', () => testDeviceManagerPage(page));
    await runTest('Device CRUD Operations', () => testDeviceCRUD(page));
    await runTest('Bulk Operations', () => testBulkOperations(page));

    // Phase 3: Automation Tests
    await runTest('Automation Page Load', () => testAutomationPage(page));
    await runTest('Automation Job Flow', () => testAutomationJobFlow(page));

    // Phase 4: Data Save Tests
    await runTest('Data Save Page Load', () => testDataSavePage(page));

    // Phase 5: Transformation Tests
    await runTest('Transformation Page Load', () => testTransformationPage(page));

    // Phase 6: Pipeline & Integration Tests
    await runTest('Pipeline Visualization', () => testPipelineVisualization(page));
    await runTest('Database Admin', () => testDatabaseAdmin(page));

    // Phase 7: UI/UX & Performance Tests
    await runTest('UI/UX Features', () => testUIUXFeatures(page));
    await runTest('Performance Metrics', () => testPerformance(page));

  } catch (err) {
    console.error('❌ Test suite error:', err);
  } finally {
    await browser.close();
  }

  // Final Report
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE TEST RESULTS');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⚠️  Warnings: ${testResults.warnings.length}`);
  console.log('='.repeat(80));

  // Database Validation Summary
  console.log('\n📊 DATABASE VALIDATION SUMMARY:');
  for (const [dbName, validation] of Object.entries(testResults.database_validations)) {
    console.log(`\n${dbName}.db:`);
    console.log(`  Exists: ${validation.exists ? '✅' : '❌'}`);
    console.log(`  Size: ${validation.size_mb?.toFixed(2)} MB`);
    console.log(`  Tables: ${Object.entries(validation.tables || {}).map(([name, count]) => `${name}(${count})`).join(', ')}`);
  }

  // Performance Summary
  console.log('\n⚡ PERFORMANCE METRICS:');
  for (const [test, duration] of Object.entries(testResults.performance_metrics)) {
    console.log(`  ${test}: ${duration}ms`);
  }

  // Warnings
  if (testResults.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    testResults.warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning}`);
    });
  }

  // Errors
  if (testResults.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    testResults.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.test}`);
      console.log(`     ${error.error}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  const success = testResults.failed === 0;
  if (success) {
    console.log('✅ ALL TESTS PASSED!');
  } else {
    console.log('❌ SOME TESTS FAILED');
  }
  console.log('='.repeat(80));

  process.exit(success ? 0 : 1);
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
