#!/usr/bin/env node

/**
 * DEEP AUDIT E2E TEST SUITE
 *
 * Comprehensive test covering all 7 pages:
 * 1. Login Page
 * 2. Device Manager (default after login)
 * 3. Automation
 * 4. Data Save
 * 5. Transformation
 * 6. Interface Costs
 * 7. OSPF Designer
 * 8. Traffic Analysis (Interface Traffic)
 *
 * Tests: UI, UX, API, DB, Navigation, Cross-page data flow
 */

import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';
const SCREENSHOT_DIR = './audit-screenshots';
const CREDENTIALS = { username: 'netviz_admin', password: 'V3ry$trongAdm1n!2025' };

// Test Results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  bugs: [],
  warnings: [],
  pageResults: {}
};

// Utility functions
async function screenshot(page, name) {
  if (!existsSync(SCREENSHOT_DIR)) {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${SCREENSHOT_DIR}/${ts}_${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${path}`);
  return path;
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function logBug(severity, page, description, details = '') {
  const bug = { severity, page, description, details, timestamp: new Date().toISOString() };
  results.bugs.push(bug);
  const emoji = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : '🟡';
  console.log(`  ${emoji} BUG [${severity}]: ${description}`);
  if (details) console.log(`      Details: ${details}`);
}

async function test(name, fn) {
  results.total++;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🧪 TEST ${results.total}: ${name}`);
  console.log('─'.repeat(70));

  try {
    await fn();
    results.passed++;
    console.log(`✅ PASSED`);
    return true;
  } catch (err) {
    results.failed++;
    console.log(`❌ FAILED: ${err.message}`);
    return false;
  }
}

// ============================================================================
// LOGIN TEST
// ============================================================================
async function testLogin(page) {
  console.log('\n🔐 Testing Login Flow...');

  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });
  await screenshot(page, '00_login_page');

  // Check for login form
  const loginFormExists = await page.evaluate(() => {
    return document.querySelector('input[type="text"], input[name="username"]') !== null;
  });

  if (!loginFormExists) {
    throw new Error('Login form not found');
  }

  // Fill credentials
  await page.type('input[type="text"], input[name="username"]', CREDENTIALS.username);
  await page.type('input[type="password"]', CREDENTIALS.password);

  // Click sign in button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const signIn = buttons.find(b => b.textContent.toLowerCase().includes('sign'));
    if (signIn) signIn.click();
  });

  await wait(2000);
  await screenshot(page, '01_after_login');

  // Verify we're past login
  const isLoggedIn = await page.evaluate(() => {
    const text = document.body.textContent || '';
    // Check we're NOT on login page anymore
    return !text.includes('Sign In') || text.includes('Device Manager') || text.includes('Logout');
  });

  if (!isLoggedIn) {
    const errorMsg = await page.evaluate(() => {
      const alerts = document.querySelectorAll('[role="alert"], .error, .alert');
      return alerts.length > 0 ? alerts[0].textContent : 'Unknown error';
    });
    throw new Error(`Login failed: ${errorMsg}`);
  }

  console.log('  ✅ Login successful');
  return true;
}

// ============================================================================
// DEVICE MANAGER PAGE TEST
// ============================================================================
async function testDeviceManagerPage(page) {
  console.log('\n🖥️  Testing Device Manager Page...');
  results.pageResults['Device Manager'] = { bugs: [], tests: [] };

  // Should already be on Device Manager after login
  await wait(1000);
  await screenshot(page, '02_device_manager');

  // Check for device table/cards
  const hasDevices = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const cards = document.querySelectorAll('[class*="card"], [class*="device"]');
    return tables.length > 0 || cards.length > 0;
  });

  if (!hasDevices) {
    logBug('HIGH', 'Device Manager', 'Device list not visible', 'No table or device cards found');
  }

  // Test Add Device button
  const addButtonWorks = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find(b =>
      b.textContent?.includes('Add') ||
      b.querySelector('svg[class*="plus"]') ||
      b.getAttribute('aria-label')?.includes('add')
    );
    if (addBtn) {
      addBtn.click();
      return true;
    }
    return false;
  });

  await wait(500);

  if (addButtonWorks) {
    await screenshot(page, '02b_add_device_modal');

    // Check if modal opened
    const modalOpened = await page.evaluate(() => {
      return document.querySelector('[role="dialog"], .modal, [class*="modal"]') !== null ||
             document.querySelector('input[name="deviceName"]') !== null;
    });

    if (!modalOpened) {
      logBug('MEDIUM', 'Device Manager', 'Add device modal did not open');
    } else {
      console.log('  ✅ Add device modal works');
      // Close modal
      await page.keyboard.press('Escape');
      await wait(300);
    }
  } else {
    logBug('HIGH', 'Device Manager', 'Add device button not found');
  }

  // Check country dropdown has new countries
  const countriesCheck = await page.evaluate(() => {
    // Try to open modal again
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find(b => b.textContent?.includes('Add'));
    if (addBtn) addBtn.click();
    return true;
  });

  await wait(500);

  const hasNewCountries = await page.evaluate(() => {
    const selects = document.querySelectorAll('select');
    for (const sel of selects) {
      const options = Array.from(sel.options).map(o => o.text);
      if (options.some(o => o.includes('South Africa') || o.includes('Kenya'))) {
        return true;
      }
    }
    return false;
  });

  if (hasNewCountries) {
    console.log('  ✅ New countries (South Africa, Kenya) present in dropdown');
  } else {
    logBug('LOW', 'Device Manager', 'New countries may not be in dropdown');
  }

  await page.keyboard.press('Escape');
  await wait(300);

  // Check device count against API
  const apiDevices = await fetch(`${BACKEND_URL}/api/devices`).then(r => r.json()).catch(() => []);
  console.log(`  API reports ${apiDevices.length} devices`);

  results.pageResults['Device Manager'].tests.push('Page load', 'Add button', 'Countries dropdown');
}

// ============================================================================
// AUTOMATION PAGE TEST
// ============================================================================
async function testAutomationPage(page) {
  console.log('\n⚙️  Testing Automation Page...');
  results.pageResults['Automation'] = { bugs: [], tests: [] };

  // Navigate to Automation
  await page.evaluate(() => {
    const navItems = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    const automationNav = navItems.find(el =>
      el.textContent?.toLowerCase().includes('automation')
    );
    if (automationNav) automationNav.click();
  });

  await wait(1500);
  await screenshot(page, '03_automation_page');

  // Verify page loaded
  const pageContent = await page.evaluate(() => document.body.textContent);

  if (!pageContent.includes('Automation') && !pageContent.includes('Connect') && !pageContent.includes('Execute')) {
    logBug('CRITICAL', 'Automation', 'Page did not load properly');
    return;
  }

  console.log('  ✅ Automation page loaded');

  // Check for Jumphost settings
  const hasJumphostSection = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('Jumphost') || text.includes('Jump Host') || text.includes('Bastion');
  });

  if (hasJumphostSection) {
    console.log('  ✅ Jumphost configuration section found');
  } else {
    logBug('MEDIUM', 'Automation', 'Jumphost configuration section not visible');
  }

  // Check for device selection
  const deviceCheckboxes = await page.evaluate(() => {
    return document.querySelectorAll('input[type="checkbox"]').length;
  });

  console.log(`  Found ${deviceCheckboxes} device checkboxes`);

  // Check for command selection
  const hasCommands = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('show') || text.includes('command') ||
           document.querySelectorAll('select, [role="listbox"]').length > 0;
  });

  if (hasCommands) {
    console.log('  ✅ Command selection available');
  } else {
    logBug('HIGH', 'Automation', 'Command selection not found');
  }

  // Check Connect/Execute buttons
  const actionButtons = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return {
      connect: buttons.some(b => b.textContent?.toLowerCase().includes('connect')),
      execute: buttons.some(b => b.textContent?.toLowerCase().includes('execute') ||
                                 b.textContent?.toLowerCase().includes('run'))
    };
  });

  if (actionButtons.connect) console.log('  ✅ Connect button found');
  else logBug('HIGH', 'Automation', 'Connect button not found');

  if (actionButtons.execute) console.log('  ✅ Execute button found');
  else logBug('HIGH', 'Automation', 'Execute/Run button not found');

  results.pageResults['Automation'].tests.push('Page load', 'Jumphost config', 'Device selection', 'Commands', 'Action buttons');
}

// ============================================================================
// DATA SAVE PAGE TEST
// ============================================================================
async function testDataSavePage(page) {
  console.log('\n💾 Testing Data Save Page...');
  results.pageResults['Data Save'] = { bugs: [], tests: [] };

  // Navigate to Data Save
  await page.evaluate(() => {
    const navItems = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    const dataSaveNav = navItems.find(el => {
      const text = el.textContent?.toLowerCase() || '';
      return text.includes('data') && text.includes('save');
    });
    if (dataSaveNav) dataSaveNav.click();
  });

  await wait(1500);
  await screenshot(page, '04_data_save_page');

  const pageContent = await page.evaluate(() => document.body.textContent);

  if (!pageContent.includes('Data') && !pageContent.includes('Save') && !pageContent.includes('File')) {
    logBug('CRITICAL', 'Data Save', 'Page did not load properly');
    return;
  }

  console.log('  ✅ Data Save page loaded');

  // Check for file type tabs (TEXT/JSON)
  const hasTabs = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="tab"]'));
    const hasText = buttons.some(b => b.textContent?.toUpperCase().includes('TEXT'));
    const hasJson = buttons.some(b => b.textContent?.toUpperCase().includes('JSON'));
    return { hasText, hasJson };
  });

  if (hasTabs.hasText && hasTabs.hasJson) {
    console.log('  ✅ TEXT/JSON tabs found');
  } else {
    logBug('MEDIUM', 'Data Save', `Missing tabs: TEXT=${hasTabs.hasText}, JSON=${hasTabs.hasJson}`);
  }

  results.pageResults['Data Save'].tests.push('Page load', 'File type tabs');
}

// ============================================================================
// TRANSFORMATION PAGE TEST
// ============================================================================
async function testTransformationPage(page) {
  console.log('\n🔄 Testing Transformation Page...');
  results.pageResults['Transformation'] = { bugs: [], tests: [] };

  // Navigate to Transformation
  await page.evaluate(() => {
    const navItems = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    const transformNav = navItems.find(el =>
      el.textContent?.toLowerCase().includes('transformation')
    );
    if (transformNav) transformNav.click();
  });

  await wait(1500);
  await screenshot(page, '05_transformation_page');

  const pageContent = await page.evaluate(() => document.body.textContent);

  if (!pageContent.toLowerCase().includes('transform')) {
    logBug('CRITICAL', 'Transformation', 'Page did not load properly');
    return;
  }

  console.log('  ✅ Transformation page loaded');

  // Check for CDP/topology related elements
  const hasTopologyFeatures = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('CDP') || text.includes('Topology') ||
           text.includes('Parse') || text.includes('Generate');
  });

  if (hasTopologyFeatures) {
    console.log('  ✅ Topology generation features found');
  } else {
    logBug('MEDIUM', 'Transformation', 'CDP/Topology features not visible');
  }

  results.pageResults['Transformation'].tests.push('Page load', 'Topology features');
}

// ============================================================================
// INTERFACE COSTS PAGE TEST
// ============================================================================
async function testInterfaceCostsPage(page) {
  console.log('\n💰 Testing Interface Costs Page...');
  results.pageResults['Interface Costs'] = { bugs: [], tests: [] };

  // Navigate to Interface Costs
  await page.evaluate(() => {
    const navItems = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    const costsNav = navItems.find(el => {
      const text = el.textContent?.toLowerCase() || '';
      return text.includes('interface') && text.includes('cost');
    });
    if (costsNav) costsNav.click();
  });

  await wait(1500);
  await screenshot(page, '06_interface_costs_page');

  const pageContent = await page.evaluate(() => document.body.textContent);

  if (!pageContent.toLowerCase().includes('cost') && !pageContent.toLowerCase().includes('interface')) {
    logBug('CRITICAL', 'Interface Costs', 'Page did not load properly');
    return;
  }

  console.log('  ✅ Interface Costs page loaded');

  // Check for OSPF cost calculator elements
  const hasCostFeatures = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="number"], input[type="text"]');
    const text = document.body.textContent || '';
    return inputs.length > 0 || text.includes('Bandwidth') || text.includes('OSPF');
  });

  if (hasCostFeatures) {
    console.log('  ✅ Cost calculation features found');
  } else {
    logBug('MEDIUM', 'Interface Costs', 'Cost calculation features not visible');
  }

  results.pageResults['Interface Costs'].tests.push('Page load', 'Cost features');
}

// ============================================================================
// OSPF DESIGNER PAGE TEST
// ============================================================================
async function testOSPFDesignerPage(page) {
  console.log('\n🗺️  Testing OSPF Designer Page...');
  results.pageResults['OSPF Designer'] = { bugs: [], tests: [] };

  // Navigate to OSPF Designer
  await page.evaluate(() => {
    const navItems = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    const designerNav = navItems.find(el => {
      const text = el.textContent?.toLowerCase() || '';
      return text.includes('ospf') && text.includes('designer');
    });
    if (designerNav) designerNav.click();
  });

  await wait(1500);
  await screenshot(page, '07_ospf_designer_page');

  const pageContent = await page.evaluate(() => document.body.textContent);

  if (!pageContent.toLowerCase().includes('ospf') && !pageContent.toLowerCase().includes('designer')) {
    logBug('CRITICAL', 'OSPF Designer', 'Page did not load properly');
    return;
  }

  console.log('  ✅ OSPF Designer page loaded');

  // Check for canvas/visualization
  const hasVisualization = await page.evaluate(() => {
    return document.querySelector('canvas, svg, [class*="graph"], [class*="network"]') !== null;
  });

  if (hasVisualization) {
    console.log('  ✅ Network visualization found');
  } else {
    logBug('MEDIUM', 'OSPF Designer', 'Network visualization not found');
  }

  results.pageResults['OSPF Designer'].tests.push('Page load', 'Visualization');
}

// ============================================================================
// TRAFFIC ANALYSIS PAGE TEST
// ============================================================================
async function testTrafficAnalysisPage(page) {
  console.log('\n📊 Testing Traffic Analysis Page...');
  results.pageResults['Traffic Analysis'] = { bugs: [], tests: [] };

  // Navigate to Traffic Analysis
  await page.evaluate(() => {
    const navItems = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    const trafficNav = navItems.find(el => {
      const text = el.textContent?.toLowerCase() || '';
      return text.includes('traffic') || (text.includes('interface') && !text.includes('cost'));
    });
    if (trafficNav) trafficNav.click();
  });

  await wait(1500);
  await screenshot(page, '08_traffic_analysis_page');

  const pageContent = await page.evaluate(() => document.body.textContent);

  if (!pageContent.toLowerCase().includes('traffic')) {
    logBug('CRITICAL', 'Traffic Analysis', 'Page did not load properly');
    return;
  }

  console.log('  ✅ Traffic Analysis page loaded');

  // Check for charts
  const hasCharts = await page.evaluate(() => {
    return document.querySelector('canvas, svg, [class*="chart"]') !== null;
  });

  if (hasCharts) {
    console.log('  ✅ Traffic charts found');
  } else {
    logBug('MEDIUM', 'Traffic Analysis', 'Traffic charts not found');
  }

  results.pageResults['Traffic Analysis'].tests.push('Page load', 'Charts');
}

// ============================================================================
// API TESTS
// ============================================================================
async function testAPIEndpoints() {
  console.log('\n🔌 Testing API Endpoints...');

  const endpoints = [
    { path: '/api/health', method: 'GET', needsAuth: false },
    { path: '/api/auth/status', method: 'GET', needsAuth: false },
    { path: '/api/devices', method: 'GET', needsAuth: true },
    { path: '/api/settings/jumphost', method: 'GET', needsAuth: true },
    { path: '/api/admin/databases', method: 'GET', needsAuth: true }
  ];

  // First login to get session
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS)
  });

  const cookies = loginRes.headers.get('set-cookie') || '';
  const sessionMatch = cookies.match(/session_id=([^;]+)/);
  const sessionId = sessionMatch ? sessionMatch[1] : '';

  for (const ep of endpoints) {
    try {
      const headers = ep.needsAuth ? { 'Cookie': `session_id=${sessionId}` } : {};
      const res = await fetch(`${BACKEND_URL}${ep.path}`, { headers });

      if (res.ok) {
        console.log(`  ✅ ${ep.method} ${ep.path} - ${res.status}`);
      } else {
        logBug('HIGH', 'API', `${ep.path} returned ${res.status}`);
      }
    } catch (err) {
      logBug('CRITICAL', 'API', `${ep.path} failed: ${err.message}`);
    }
  }
}

// ============================================================================
// CROSS-PAGE DATA FLOW TEST
// ============================================================================
async function testCrossPageDataFlow(page) {
  console.log('\n🔗 Testing Cross-Page Data Flow...');

  // Device Manager → Automation flow
  // Navigate to Device Manager
  await page.evaluate(() => {
    const navItems = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    const devNav = navItems.find(el => el.textContent?.toLowerCase().includes('device'));
    if (devNav) devNav.click();
  });
  await wait(1000);

  // Count devices
  const deviceCount = await page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr, [class*="device-card"]');
    return rows.length;
  });

  // Navigate to Automation
  await page.evaluate(() => {
    const navItems = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    const autoNav = navItems.find(el => el.textContent?.toLowerCase().includes('automation'));
    if (autoNav) autoNav.click();
  });
  await wait(1000);

  // Count devices in Automation
  const automationDeviceCount = await page.evaluate(() => {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    return checkboxes.length;
  });

  if (deviceCount > 0 && automationDeviceCount > 0) {
    console.log(`  ✅ Devices flow from Device Manager (${deviceCount}) to Automation (${automationDeviceCount})`);
  } else {
    logBug('HIGH', 'Data Flow', `Device count mismatch: DeviceManager=${deviceCount}, Automation=${automationDeviceCount}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 DEEP AUDIT E2E TEST SUITE');
  console.log('═'.repeat(70));
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log('═'.repeat(70));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Enable console logging from browser
  page.on('console', msg => {
    if (msg.type() === 'error') {
      logBug('LOW', 'Console', msg.text());
    }
  });

  try {
    // Login first
    await test('Login Flow', () => testLogin(page));

    // Test all pages
    await test('Device Manager Page', () => testDeviceManagerPage(page));
    await test('Automation Page', () => testAutomationPage(page));
    await test('Data Save Page', () => testDataSavePage(page));
    await test('Transformation Page', () => testTransformationPage(page));
    await test('Interface Costs Page', () => testInterfaceCostsPage(page));
    await test('OSPF Designer Page', () => testOSPFDesignerPage(page));
    await test('Traffic Analysis Page', () => testTrafficAnalysisPage(page));

    // API tests
    await test('API Endpoints', () => testAPIEndpoints());

    // Cross-page flow
    await test('Cross-Page Data Flow', () => testCrossPageDataFlow(page));

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await browser.close();
  }

  // Final Report
  console.log('\n' + '═'.repeat(70));
  console.log('📊 DEEP AUDIT RESULTS');
  console.log('═'.repeat(70));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`🐛 Bugs Found: ${results.bugs.length}`);
  console.log('═'.repeat(70));

  if (results.bugs.length > 0) {
    console.log('\n🐛 BUGS FOUND:');
    console.log('─'.repeat(70));

    const critical = results.bugs.filter(b => b.severity === 'CRITICAL');
    const high = results.bugs.filter(b => b.severity === 'HIGH');
    const medium = results.bugs.filter(b => b.severity === 'MEDIUM');
    const low = results.bugs.filter(b => b.severity === 'LOW');

    if (critical.length > 0) {
      console.log('\n🔴 CRITICAL:');
      critical.forEach((b, i) => console.log(`  ${i+1}. [${b.page}] ${b.description}`));
    }

    if (high.length > 0) {
      console.log('\n🟠 HIGH:');
      high.forEach((b, i) => console.log(`  ${i+1}. [${b.page}] ${b.description}`));
    }

    if (medium.length > 0) {
      console.log('\n🟡 MEDIUM:');
      medium.forEach((b, i) => console.log(`  ${i+1}. [${b.page}] ${b.description}`));
    }

    if (low.length > 0) {
      console.log('\n⚪ LOW:');
      low.forEach((b, i) => console.log(`  ${i+1}. [${b.page}] ${b.description}`));
    }
  }

  console.log('\n' + '═'.repeat(70));

  const exitCode = results.failed > 0 || results.bugs.filter(b => b.severity === 'CRITICAL').length > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
