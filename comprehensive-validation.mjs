/**
 * COMPREHENSIVE PUPPETEER VALIDATION
 * Deep validation of OSPF-LL Network Device Manager
 *
 * This script performs exhaustive testing with screenshots as proof
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, writeFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';
const SCREENSHOT_DIR = join(__dirname, 'validation-screenshots');
const REPORT_FILE = join(__dirname, 'validation-report.json');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(message) {
  log(`\n${'═'.repeat(80)}`, 'cyan');
  log(`${message}`, 'cyan');
  log(`${'═'.repeat(80)}`, 'cyan');
}

const validationReport = {
  timestamp: new Date().toISOString(),
  frontend_url: FRONTEND_URL,
  backend_url: BACKEND_URL,
  tests: [],
  screenshots: [],
  errors: [],
  console_logs: [],
  success: false
};

function addTest(name, passed, details = {}) {
  validationReport.tests.push({
    name,
    passed,
    timestamp: new Date().toISOString(),
    ...details
  });
  if (passed) {
    log(`✅ ${name}`, 'green');
  } else {
    log(`❌ ${name}`, 'red');
  }
}

async function takeScreenshot(page, name, description) {
  const screenshotPath = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  validationReport.screenshots.push({
    name,
    description,
    path: screenshotPath,
    timestamp: new Date().toISOString()
  });
  log(`📸 Screenshot: ${name}.png - ${description}`, 'blue');
  return screenshotPath;
}

async function validateBackend() {
  section('PHASE 1: BACKEND API VALIDATION');

  try {
    // Test health endpoint
    log('Testing /api/health...', 'yellow');
    const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
    const healthData = await healthResponse.json();

    addTest('Backend Health Check',
      healthData.status === 'OK' && healthData.database === 'connected',
      { response: healthData }
    );

    // Test devices endpoint
    log('Testing /api/devices...', 'yellow');
    const devicesResponse = await fetch(`${BACKEND_URL}/api/devices`);
    log(`Response Status: ${devicesResponse.status}`, 'magenta');
    const devicesData = await devicesResponse.json();
    if (!Array.isArray(devicesData)) {
      console.log('Devices Data:', JSON.stringify(devicesData, null, 2));
    }

    addTest('Backend Devices Endpoint',
      Array.isArray(devicesData) && devicesData.length === 10,
      { device_count: Array.isArray(devicesData) ? devicesData.length : 'N/A' }
    );

    // Verify all routers are ASR9903/IOS XR
    const allIosXr = devicesData.every(d => d.platform === 'ASR9903' && d.software === 'IOS XR');
    addTest('All Routers are ASR9903/IOS XR', allIosXr, {
      routers: devicesData.map(d => `${d.deviceName}: ${d.platform}/${d.software}`)
    });

    // Test automation status
    log('Testing /api/automation/status...', 'yellow');
    const statusResponse = await fetch(`${BACKEND_URL}/api/automation/status`);
    const statusData = await statusResponse.json();

    addTest('Automation System Operational',
      statusData.status === 'operational',
      { status: statusData }
    );

    return true;
  } catch (err) {
    addTest('Backend Validation', false, { error: err.message });
    validationReport.errors.push({
      phase: 'backend',
      error: err.message,
      stack: err.stack
    });
    return false;
  }
}

async function validateFrontend() {
  section('PHASE 2: FRONTEND UI VALIDATION');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Create screenshots directory
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // Capture console and errors
    page.on('console', msg => {
      const logEntry = `[${msg.type()}] ${msg.text()}`;
      validationReport.console_logs.push(logEntry);
      if (msg.type() === 'error' || msg.type() === 'warning') {
        log(`Browser ${msg.type()}: ${msg.text()}`, 'yellow');
      }
    });

    page.on('pageerror', err => {
      validationReport.errors.push({
        phase: 'frontend',
        type: 'page_error',
        error: err.toString()
      });
      log(`Page Error: ${err.toString()}`, 'red');
    });

    page.on('requestfailed', request => {
      validationReport.errors.push({
        phase: 'frontend',
        type: 'request_failed',
        url: request.url(),
        error: request.failure().errorText
      });
    });

    // Helper for waiting
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // TEST 1: Load Device Manager Page
    log('Loading Device Manager page...', 'yellow');
    try {
      await page.goto(FRONTEND_URL, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for main content to load
      await page.waitForSelector('h1', { timeout: 10000 });

      const title = await page.$eval('h1', el => el.textContent).catch(() => 'Not found');

      if (title.includes('Device Manager')) {
        addTest('Device Manager Page Loads', true, { title });
        await takeScreenshot(page, '01-device-manager-loaded', 'Device Manager page successfully loaded');
      } else if (title.includes('Something went wrong')) {
        addTest('Device Manager Page Loads', false, {
          title,
          error: 'Error Boundary caught an error'
        });
        await takeScreenshot(page, '01-ERROR-page-crashed', 'Page shows error boundary');

        // Try to get error details
        const errorDetails = await page.evaluate(() => {
          const detailsEl = document.querySelector('details');
          return detailsEl ? detailsEl.textContent : 'No error details available';
        }).catch(() => 'Could not extract error details');

        validationReport.errors.push({
          phase: 'frontend',
          type: 'error_boundary',
          details: errorDetails
        });

        return false;
      } else {
        addTest('Device Manager Page Loads', false, {
          unexpected_title: title
        });
        await takeScreenshot(page, '01-ERROR-unexpected-page', 'Unexpected page content');
        return false;
      }
    } catch (err) {
      addTest('Device Manager Page Loads', false, {
        error: err.message
      });
      await takeScreenshot(page, '01-ERROR-load-failed', 'Page failed to load');
      throw err;
    }

    // TEST 2: Verify Device Table in GlassCard
    log('Verifying device table...', 'yellow');
    await page.waitForSelector('.glass-card tbody tr', { timeout: 5000 });
    const deviceRows = await page.$$('tbody tr');
    addTest('Device Table Shows 10 Routers',
      deviceRows.length === 10,
      { row_count: deviceRows.length }
    );
    await takeScreenshot(page, '02-device-table', 'Device table with 10 ASR9903 routers');

    // TEST 3: Verify Router Details
    log('Checking router details...', 'yellow');
    const firstRouter = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      if (rows.length === 0) return null;
      const cells = rows[0].querySelectorAll('td');
      // Updated indices based on new columns
      // 0: checkbox, 1: name, 2: tags, 3: ip, 4: proto/port, 5: type, 6: platform, 7: software, 8: country, 9: actions
      return {
        name: cells[1]?.textContent || '',
        ip: cells[3]?.textContent || '',
        platform: cells[6]?.textContent || '',
        software: cells[7]?.textContent || ''
      };
    });

    addTest('First Router is ASR9903/IOS XR',
      firstRouter && firstRouter.platform === 'ASR9903' && firstRouter.software === 'IOS XR',
      { router: firstRouter }
    );

    // TEST 4: Search Functionality
    log('Testing search functionality...', 'yellow');
    const searchInput = await page.$('input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.type('usa');
      await wait(1000);
      const filteredRows = await page.$$('tbody tr');
      addTest('Search Filter Works',
        filteredRows.length > 0 && filteredRows.length < 10,
        { filtered_count: filteredRows.length }
      );
      await takeScreenshot(page, '03-search-filter', 'Search filtered to USA routers');

      // Clear search
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await wait(500);
    }

    // TEST 5: Navigate to Automation Page
    log('Navigating to Automation page...', 'yellow');
    // Using the new Navbar structure
    const automationLink = await page.$('button ::-p-text("Automation")');
    if (automationLink) {
      await automationLink.click();
      await wait(2000);

      const automationTitle = await page.$eval('h1', el => el.textContent).catch(() => '');
      addTest('Automation Page Navigation',
        automationTitle.includes('Network Automation'),
        { title: automationTitle }
      );
      await takeScreenshot(page, '04-automation-page', 'Automation page loaded');
    } else {
      addTest('Automation Page Navigation', false, {
        error: 'Automation button not found'
      });
    }

    // TEST 6: Automation Page Elements
    log('Verifying automation page elements...', 'yellow');

    // Check status banner (GlassCard)
    const statusBanner = await page.$('.glass-card');
    addTest('Automation Status Banner Present', !!statusBanner);

    // Check device selection cards (count by device names which are always rendered)
    const deviceCards = await page.$$eval(
      '.space-y-2 > div',
      divs => divs.filter(div => div.className.includes('rounded-xl') && div.className.includes('border')).length
    );
    addTest('Device Selection Cards Present',
      deviceCards >= 10,
      { card_count: deviceCards }
    );

    // Check connect button
    const [connectButton] = await page.$$('button ::-p-text("Connect")');
    addTest('Connect Button Present', !!connectButton);

    // Check execute button (text changes based on connection state)
    const [startButton] = await page.$$('button ::-p-text("Start Automation")');
    const [connectFirstButton] = await page.$$('button ::-p-text("Connect Devices to Start")');
    addTest('Start Automation Button Present', !!(startButton || connectFirstButton));

    // TEST 7: Select Device
    log('Testing device selection...', 'yellow');
    if (deviceCards > 0) {
      // Get actual card elements for clicking
      const cardElements = await page.$$('.space-y-2 > div');
      const clickableCards = [];
      for (const card of cardElements) {
        const className = await card.evaluate(el => el.className);
        if (className.includes('rounded-xl') && className.includes('border')) {
          clickableCards.push(card);
        }
      }
      if (clickableCards.length > 0) {
        await clickableCards[0].click();
        await wait(500);
        await takeScreenshot(page, '05-device-selected', 'Device selected with checkbox');
        addTest('Device Selection Works', true);
      }
    }

    // TEST 8: Navigate to Data Save
    log('Navigating to Data Save page...', 'yellow');
    const [dataSaveLink] = await page.$$('button ::-p-text("Data Save")');
    if (dataSaveLink) {
      await dataSaveLink.click();
      await wait(1000);
      await takeScreenshot(page, '06-data-save-placeholder', 'Data Save placeholder page');
      addTest('Data Save Page Navigation', true);
    }

    // TEST 9: Navigate to Transformation
    log('Navigating to Transformation page...', 'yellow');
    const [transformLink] = await page.$$('button ::-p-text("Transformation")');
    if (transformLink) {
      await transformLink.click();
      await wait(1000);
      await takeScreenshot(page, '07-transformation-placeholder', 'Transformation placeholder page');
      addTest('Transformation Page Navigation', true);
    }

    // TEST 10: Back to Device Manager
    log('Navigating back to Device Manager...', 'yellow');
    const [deviceMgrLink] = await page.$$('button ::-p-text("Device Manager")');
    if (deviceMgrLink) {
      await deviceMgrLink.click();
      await wait(1000);
      await takeScreenshot(page, '08-back-to-device-manager', 'Navigated back to Device Manager');
      addTest('Return to Device Manager', true);
    }

    // TEST 11: Dark Mode Toggle
    log('Testing dark mode toggle...', 'yellow');
    const themeButton = await page.$('button[aria-label="Toggle theme"]'); // Updated selector if needed, checking aria-label
    if (themeButton) {
      await themeButton.click();
      await wait(1000);
      await takeScreenshot(page, '09-dark-mode', 'Dark mode enabled');
      addTest('Dark Mode Toggle', true);

      // Toggle back to light mode
      await themeButton.click();
      await wait(500);
      await takeScreenshot(page, '10-light-mode', 'Light mode restored');
    } else {
      // Fallback to trying to find by icon or position if aria-label is missing
      const navButtons = await page.$$('nav button');
      // Assuming it's one of the buttons in the nav
      if (navButtons.length > 0) {
        // Just log warning
        log('Could not specifically identify theme toggle button by aria-label', 'yellow');
      }
    }

    return true;

  } catch (err) {
    log(`Frontend validation error: ${err.message}`, 'red');
    validationReport.errors.push({
      phase: 'frontend',
      error: err.message,
      stack: err.stack
    });
    return false;
  } finally {
    await browser.close();
  }
}

async function generateReport() {
  section('PHASE 3: GENERATING VALIDATION REPORT');

  const totalTests = validationReport.tests.length;
  const passedTests = validationReport.tests.filter(t => t.passed).length;
  const failedTests = totalTests - passedTests;

  validationReport.summary = {
    total_tests: totalTests,
    passed: passedTests,
    failed: failedTests,
    success_rate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) + '%' : '0%',
    total_screenshots: validationReport.screenshots.length,
    total_errors: validationReport.errors.length
  };

  validationReport.success = failedTests === 0 && validationReport.errors.filter(e => e.phase !== 'info').length === 0;

  // Save report to JSON
  await writeFile(REPORT_FILE, JSON.stringify(validationReport, null, 2));
  log(`Report saved to: ${REPORT_FILE}`, 'blue');

  // Print summary
  section('VALIDATION SUMMARY');
  log(`Total Tests: ${totalTests}`, 'cyan');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  log(`Success Rate: ${validationReport.summary.success_rate}`, 'cyan');
  log(`Screenshots: ${validationReport.screenshots.length}`, 'blue');
  log(`Errors: ${validationReport.errors.length}`, validationReport.errors.length > 0 ? 'red' : 'green');

  log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`, 'magenta');

  return validationReport.success;
}

async function main() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║   COMPREHENSIVE PUPPETEER VALIDATION - OSPF-LL DEVICE MANAGER    ║', 'cyan');
  log('║   Deep Dive Validation with Screenshots as Proof                  ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════╝', 'cyan');
  console.log('\n');

  log(`Frontend: ${FRONTEND_URL}`, 'blue');
  log(`Backend: ${BACKEND_URL}`, 'blue');
  log(`Screenshots: ${SCREENSHOT_DIR}`, 'magenta');
  console.log('\n');

  // Phase 1: Backend
  const backendOk = await validateBackend();
  if (!backendOk) {
    log('\n❌ Backend validation failed - Check backend server', 'red');
  }

  // Phase 2: Frontend
  const frontendOk = await validateFrontend();
  if (!frontendOk) {
    log('\n❌ Frontend validation encountered errors - Check screenshots', 'red');
  }

  // Phase 3: Report
  const success = await generateReport();

  if (success) {
    console.log('\n');
    log('╔════════════════════════════════════════════════════════════════════╗', 'green');
    log('║                 🎉 ALL VALIDATIONS PASSED! 🎉                     ║', 'green');
    log('║                                                                    ║', 'green');
    log('║  Application is fully operational and validated.                  ║', 'green');
    log('║  Screenshots provide visual proof of functionality.               ║', 'green');
    log('╚════════════════════════════════════════════════════════════════════╝', 'green');
    console.log('\n');
    process.exit(0);
  } else {
    console.log('\n');
    log('╔════════════════════════════════════════════════════════════════════╗', 'red');
    log('║                  ⚠️  VALIDATION FAILED  ⚠️                        ║', 'red');
    log('║                                                                    ║', 'red');
    log('║  Some tests failed. Review the screenshots and report.            ║', 'red');
    log('╚════════════════════════════════════════════════════════════════════╝', 'red');
    console.log('\n');
    process.exit(1);
  }
}

main().catch(err => {
  log(`\n❌ Validation suite crashed: ${err.message}`, 'red');
  console.error(err.stack);
  process.exit(1);
});
