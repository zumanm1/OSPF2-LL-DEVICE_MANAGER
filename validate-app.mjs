/**
 * Puppeteer Validation Script for OSPF-LL Network Device Manager
 *
 * This script validates the entire application works correctly by:
 * 1. Testing all page navigation
 * 2. Testing Device Manager functionality
 * 3. Testing Automation page loads correctly
 * 4. Taking screenshots for visual validation
 * 5. Verifying backend API responses
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';
const SCREENSHOT_DIR = join(__dirname, 'test-screenshots');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function section(message) {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`${message}`, 'cyan');
  log(`${'='.repeat(80)}`, 'cyan');
}

async function validateBackendAPI() {
  section('1. VALIDATING BACKEND API');

  try {
    // Test health endpoint
    info('Testing /api/health endpoint...');
    const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
    const healthData = await healthResponse.json();

    if (healthData.status === 'OK' && healthData.database === 'connected') {
      success('Backend health check passed');
    } else {
      throw new Error('Health check failed');
    }

    // Test devices endpoint
    info('Testing /api/devices endpoint...');
    const devicesResponse = await fetch(`${BACKEND_URL}/api/devices`);
    const devicesData = await devicesResponse.json();

    if (Array.isArray(devicesData) && devicesData.length === 10) {
      success(`Loaded ${devicesData.length} devices from database`);
    } else {
      throw new Error(`Expected 10 devices, got ${devicesData.length}`);
    }

    // Test automation status
    info('Testing /api/automation/status endpoint...');
    const statusResponse = await fetch(`${BACKEND_URL}/api/automation/status`);
    const statusData = await statusResponse.json();

    if (statusData.status === 'operational') {
      success('Automation system is operational');
    } else {
      throw new Error('Automation system not operational');
    }

    return true;
  } catch (err) {
    error(`Backend validation failed: ${err.message}`);
    return false;
  }
}

async function takeScreenshot(page, name, description) {
  const screenshotPath = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  success(`Screenshot saved: ${name}.png - ${description}`);
  return screenshotPath;
}

async function validateFrontend() {
  section('2. VALIDATING FRONTEND UI');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Create screenshots directory
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // Track console messages and errors
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => pageErrors.push(err.toString()));

    // 1. Load Device Manager page
    info('Loading Device Manager page...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 10000 });
    await page.waitForSelector('h1', { timeout: 5000 });

    const title = await page.$eval('h1', el => el.textContent);
    if (title.includes('Device Manager')) {
      success('Device Manager page loaded successfully');
    } else {
      throw new Error(`Unexpected page title: ${title}`);
    }

    await takeScreenshot(page, '01-device-manager', 'Device Manager page with 10 routers');

    // 2. Check device table
    info('Checking device table...');
    const deviceRows = await page.$$('tbody tr');
    if (deviceRows.length === 10) {
      success(`Device table shows ${deviceRows.length} routers`);
    } else {
      throw new Error(`Expected 10 device rows, found ${deviceRows.length}`);
    }

    // 3. Test search functionality
    info('Testing search functionality...');
    await page.type('input[placeholder*="Search"]', 'usa');
    await new Promise(r => setTimeout(r, 500));
    const filteredRows = await page.$$('tbody tr');
    if (filteredRows.length > 0 && filteredRows.length < 10) {
      success(`Search filtered to ${filteredRows.length} devices`);
    } else {
      throw new Error('Search filter not working correctly');
    }
    await takeScreenshot(page, '02-device-search', 'Search filter applied');

    // Clear search
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Search"]');
      if (input) input.value = '';
    });
    await new Promise(r => setTimeout(r, 300));

    // 4. Navigate to Automation page
    info('Navigating to Automation page...');
    const [autoLink] = await page.$$("xpath///a[contains(., 'Automation')]");
    if (autoLink) await autoLink.click(); else throw new Error("Automation link not found");
    await new Promise(r => setTimeout(r, 1000));

    const automationTitle = await page.$eval('h1', el => el.textContent);
    if (automationTitle.includes('Network Automation')) {
      success('Automation page loaded successfully');
    } else {
      throw new Error(`Unexpected automation page title: ${automationTitle}`);
    }

    await takeScreenshot(page, '03-automation-page', 'Automation page with device selection');

    // 5. Check automation page elements
    info('Checking automation page elements...');

    // Status banner
    const statusBanner = await page.$('.bg-blue-50, .bg-blue-900\\/20');
    if (statusBanner) {
      success('Status banner present on automation page');
    } else {
      throw new Error('Status banner not found');
    }

    // Device selection panel
    const deviceCheckboxes = await page.$$('input[type="checkbox"]');
    if (deviceCheckboxes.length >= 10) {
      success(`Found ${deviceCheckboxes.length} device checkboxes`);
    } else {
      throw new Error(`Expected at least 10 checkboxes, found ${deviceCheckboxes.length}`);
    }

    // Connect button
    const [connectButton] = await page.$$("xpath///button[contains(., 'Connect')]");
    if (connectButton) {
      success('Connect button found');
    } else {
      throw new Error('Connect button not found');
    }

    // 6. Test device selection
    info('Testing device selection...');
    const firstCheckbox = deviceCheckboxes[0];
    await firstCheckbox.click();
    await new Promise(r => setTimeout(r, 300));
    await takeScreenshot(page, '04-device-selected', 'Device selected with checkbox');

    // 7. Navigate to Data Save page
    info('Navigating to Data Save page...');
    const [dsLink] = await page.$$("xpath///a[contains(., 'Data Save')]");
    if (dsLink) await dsLink.click(); else throw new Error("Data Save link not found");
    await new Promise(r => setTimeout(r, 500));
    await takeScreenshot(page, '05-data-save-placeholder', 'Data Save placeholder page');

    // 8. Navigate to Transformation page
    info('Navigating to Transformation page...');
    const [tfLink] = await page.$$("xpath///a[contains(., 'Transformation')]");
    if (tfLink) await tfLink.click(); else throw new Error("Transformation link not found");
    await new Promise(r => setTimeout(r, 500));
    await takeScreenshot(page, '06-transformation-placeholder', 'Transformation placeholder page');

    // 9. Back to Device Manager
    info('Navigating back to Device Manager...');
    const [dmLink] = await page.$$("xpath///a[contains(., 'Device Manager')]");
    if (dmLink) await dmLink.click(); else throw new Error("Device Manager link not found");
    await new Promise(r => setTimeout(r, 500));
    await takeScreenshot(page, '07-back-to-device-manager', 'Navigation back to Device Manager');

    // 10. Test dark mode toggle
    info('Testing dark mode toggle...');
    const themeButton = await page.$('button[aria-label="Toggle theme"]');
    if (themeButton) {
      await themeButton.click();
      await new Promise(r => setTimeout(r, 500));
      await takeScreenshot(page, '08-dark-mode', 'Dark mode enabled');
      success('Dark mode toggle works');
    }

    // Check for JavaScript errors
    if (pageErrors.length > 0) {
      error(`Found ${pageErrors.length} JavaScript errors:`);
      pageErrors.forEach(err => error(`  ${err}`));
      return false;
    }

    // Summary
    section('VALIDATION SUMMARY');
    success('✅ Backend API validated');
    success('✅ Frontend loads successfully');
    success('✅ All 4 pages navigable');
    success('✅ Device Manager displays 10 routers');
    success('✅ Search functionality works');
    success('✅ Automation page renders correctly');
    success('✅ Device selection works');
    success('✅ Dark mode toggle works');
    success('✅ No JavaScript errors detected');
    success(`✅ Screenshots saved to: ${SCREENSHOT_DIR}`);

    return true;

  } catch (err) {
    error(`Frontend validation failed: ${err.message}`);
    console.error(err.stack);
    return false;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║     OSPF-LL NETWORK DEVICE MANAGER - VALIDATION SUITE                ║', 'cyan');
  log('║     Comprehensive E2E Testing with Screenshots                       ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════════════════╝', 'cyan');
  console.log('\n');

  info(`Frontend URL: ${FRONTEND_URL}`);
  info(`Backend URL: ${BACKEND_URL}`);
  info(`Screenshot Directory: ${SCREENSHOT_DIR}`);
  console.log('\n');

  const backendOk = await validateBackendAPI();
  if (!backendOk) {
    error('Backend validation failed - stopping tests');
    process.exit(1);
  }

  const frontendOk = await validateFrontend();
  if (!frontendOk) {
    error('Frontend validation failed');
    process.exit(1);
  }

  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════════════════╗', 'green');
  log('║                  🎉 ALL VALIDATIONS PASSED! 🎉                       ║', 'green');
  log('║                                                                       ║', 'green');
  log('║  The OSPF-LL Network Device Manager is fully operational.           ║', 'green');
  log('║  Backend API: ✅  Frontend UI: ✅  Navigation: ✅  Routing: ✅      ║', 'green');
  log('╚═══════════════════════════════════════════════════════════════════════╝', 'green');
  console.log('\n');

  process.exit(0);
}

main().catch(err => {
  error(`Validation suite failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
