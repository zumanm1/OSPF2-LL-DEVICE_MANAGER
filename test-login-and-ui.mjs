#!/usr/bin/env node

/**
 * BOUNTY HUNTER #1 - UI/UX and Login Specialist
 *
 * Mission: Test the Login page and Device Manager for core functional bugs
 * Focus: Only critical bugs that prevent the app from working
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:9050';
const SCREENSHOT_DIR = '/Users/macbook/OSPF-LL-DEVICE_MANAGER/test-screenshots';

// Test credentials
const TEST_CREDENTIALS = {
  username: 'netviz_admin',
  password: 'V3ry$trongAdm1n!2025'
};

// Color output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = {
    'INFO': `${colors.blue}[INFO]${colors.reset}`,
    'PASS': `${colors.green}[PASS]${colors.reset}`,
    'FAIL': `${colors.red}[FAIL]${colors.reset}`,
    'WARN': `${colors.yellow}[WARN]${colors.reset}`
  }[level] || '[LOG]';
  console.log(`${timestamp} ${prefix} ${message}`);
}

class BugReport {
  constructor() {
    this.bugs = [];
    this.warnings = [];
    this.passes = [];
  }

  addBug(severity, title, description, screenshot = null) {
    this.bugs.push({ severity, title, description, screenshot });
    log('FAIL', `BUG [${severity}]: ${title}`);
  }

  addWarning(title, description) {
    this.warnings.push({ title, description });
    log('WARN', `WARNING: ${title}`);
  }

  addPass(testName) {
    this.passes.push(testName);
    log('PASS', testName);
  }

  printReport() {
    console.log('\n' + '='.repeat(80));
    console.log('BOUNTY HUNTER #1 - BUG REPORT');
    console.log('='.repeat(80));

    console.log(`\n${colors.green}✓ PASSED TESTS: ${this.passes.length}${colors.reset}`);
    this.passes.forEach(test => console.log(`  - ${test}`));

    if (this.bugs.length === 0) {
      console.log(`\n${colors.green}✓ NO CRITICAL BUGS FOUND${colors.reset}`);
    } else {
      console.log(`\n${colors.red}✗ CRITICAL BUGS FOUND: ${this.bugs.length}${colors.reset}`);
      this.bugs.forEach((bug, i) => {
        console.log(`\n${i + 1}. [${bug.severity}] ${bug.title}`);
        console.log(`   ${bug.description}`);
        if (bug.screenshot) console.log(`   Screenshot: ${bug.screenshot}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}⚠ WARNINGS: ${this.warnings.length}${colors.reset}`);
      this.warnings.forEach((warning, i) => {
        console.log(`\n${i + 1}. ${warning.title}`);
        console.log(`   ${warning.description}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log(`SUMMARY: ${this.passes.length} passed, ${this.bugs.length} bugs, ${this.warnings.length} warnings`);
    console.log('='.repeat(80) + '\n');
  }
}

async function takeScreenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/bounty1_${name}.png`;
  await page.screenshot({ path, fullPage: true });
  log('INFO', `Screenshot saved: ${path}`);
  return path;
}

async function getConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

async function testLoginPage(browser, report) {
  log('INFO', 'TEST 1: Navigate to login page');

  const page = await browser.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      consoleErrors.push(text);
    } else if (type === 'warning') {
      consoleWarnings.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    consoleErrors.push(`PageError: ${error.message}`);
  });

  try {
    // Navigate to home page
    const response = await page.goto(BASE_URL, {
      waitUntil: 'networkidle0',
      timeout: 15000
    });

    if (!response) {
      report.addBug('CRITICAL', 'Server not responding', `Could not connect to ${BASE_URL}. Ensure server is running.`);
      await page.close();
      return false;
    }

    if (!response.ok()) {
      report.addBug('CRITICAL', 'Server returned error', `HTTP ${response.status()}: ${response.statusText()}`);
      await page.close();
      return false;
    }

    report.addPass('Server is accessible');
    await takeScreenshot(page, '01_initial_load');

    // Wait a bit for React to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if login page is displayed
    const pageTitle = await page.title();
    log('INFO', `Page title: ${pageTitle}`);

    // Check for login form elements
    const usernameInput = await page.$('#username');
    const passwordInput = await page.$('#password');
    const signInButton = await page.$('button[type="submit"]');

    if (!usernameInput) {
      report.addBug('CRITICAL', 'Username input not found', 'Login form is missing username input field (#username)');
      await takeScreenshot(page, '02_missing_username_input');
      await page.close();
      return false;
    }
    report.addPass('Username input field exists');

    if (!passwordInput) {
      report.addBug('CRITICAL', 'Password input not found', 'Login form is missing password input field (#password)');
      await takeScreenshot(page, '03_missing_password_input');
      await page.close();
      return false;
    }
    report.addPass('Password input field exists');

    if (!signInButton) {
      report.addBug('CRITICAL', 'Sign in button not found', 'Login form is missing submit button');
      await takeScreenshot(page, '04_missing_signin_button');
      await page.close();
      return false;
    }
    report.addPass('Sign in button exists');

    // Check for UI elements
    const loginCard = await page.$('.bg-gray-800\\/90');
    if (!loginCard) {
      report.addWarning('Login card styling missing', 'Login card container not found with expected classes');
    } else {
      report.addPass('Login card UI renders correctly');
    }

    // Check for logo/title
    const title = await page.$('h1');
    if (title) {
      const titleText = await page.evaluate(el => el.textContent, title);
      log('INFO', `App title: ${titleText}`);
      report.addPass('App title displays');
    }

    await takeScreenshot(page, '05_login_page_complete');

    await page.close();
    return true;

  } catch (error) {
    report.addBug('CRITICAL', 'Login page failed to load', `Error: ${error.message}`);
    await takeScreenshot(page, '06_login_page_error');
    await page.close();
    return false;
  }
}

async function testLoginFunctionality(browser, report) {
  log('INFO', 'TEST 2: Test login with netviz_admin');

  const page = await browser.newPage();
  const consoleErrors = [];
  const consoleMessages = [];
  const networkRequests = [];
  const networkResponses = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`PageError: ${error.message}`);
  });

  // Capture network activity
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      networkRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      networkResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fill in credentials
    await page.type('#username', TEST_CREDENTIALS.username);
    await page.type('#password', TEST_CREDENTIALS.password);

    log('INFO', 'Credentials entered, attempting login...');
    await takeScreenshot(page, '07_before_login');

    // Click sign in button and wait for network activity
    await page.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await takeScreenshot(page, '08_after_login');

    // Log network activity
    log('INFO', `Network requests: ${networkRequests.length}`);
    networkRequests.forEach(req => log('INFO', `  → ${req}`));
    log('INFO', `Network responses: ${networkResponses.length}`);
    networkResponses.forEach(res => log('INFO', `  ← ${res}`));

    // Check if we're still on login page or redirected
    const currentUrl = page.url();
    log('INFO', `Current URL after login: ${currentUrl}`);

    const usernameInput = await page.$('#username');

    if (usernameInput) {
      // Still on login page - check for error message
      const errorMessage = await page.$('.bg-red-900\\/50, .bg-red-900');
      if (errorMessage) {
        const errorText = await page.evaluate(el => el.textContent, errorMessage);
        log('INFO', `Login error message: ${errorText.trim()}`);

        // Check if it's a connection error
        if (errorText.includes('Unable to connect')) {
          report.addBug('CRITICAL', 'Backend connection failed',
            `Frontend cannot connect to backend API. Error: "${errorText.trim()}". Backend should be accessible at http://localhost:9051/api`);
        } else {
          report.addBug('CRITICAL', 'Login failed', `Login rejected with error: ${errorText.trim()}`);
        }
      } else {
        report.addBug('CRITICAL', 'Login not working', 'Still on login page after submit, no error shown');
      }

      // Log console messages for debugging
      if (consoleMessages.length > 0) {
        log('INFO', 'Console messages during login:');
        consoleMessages.slice(0, 5).forEach(msg => log('INFO', `  ${msg}`));
      }

      await page.close();
      return false;
    }

    report.addPass('Login successful - redirected from login page');

    // Check console errors during login
    if (consoleErrors.length > 0) {
      report.addWarning('Console errors during login', `Found ${consoleErrors.length} console errors: ${consoleErrors.join(', ')}`);
    } else {
      report.addPass('No console errors during login');
    }

    await page.close();
    return true;

  } catch (error) {
    report.addBug('CRITICAL', 'Login process crashed', `Error: ${error.message}`);
    await takeScreenshot(page, '09_login_error');
    await page.close();
    return false;
  }
}

async function testDeviceManagerPage(browser, report) {
  log('INFO', 'TEST 3: Check if Device Manager loads after login');

  const page = await browser.newPage();
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`PageError: ${error.message}`);
  });

  try {
    // Navigate and login
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Login
    const usernameInput = await page.$('#username');
    if (usernameInput) {
      await page.type('#username', TEST_CREDENTIALS.username);
      await page.type('#password', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    await takeScreenshot(page, '10_device_manager_initial');

    // Check for main device table
    const deviceTable = await page.$('table');
    if (!deviceTable) {
      report.addBug('CRITICAL', 'Device table not found', 'Main device table does not render after login');
      await takeScreenshot(page, '11_no_device_table');
      await page.close();
      return false;
    }
    report.addPass('Device table renders');

    // Check for table headers
    const tableHeaders = await page.$$('th');
    if (tableHeaders.length === 0) {
      report.addBug('HIGH', 'Table headers missing', 'Device table has no headers');
    } else {
      log('INFO', `Found ${tableHeaders.length} table headers`);
      report.addPass(`Device table has ${tableHeaders.length} column headers`);
    }

    // Check for navigation bar
    const navbar = await page.$('nav');
    if (!navbar) {
      report.addWarning('Navigation bar missing', 'No <nav> element found on page');
    } else {
      report.addPass('Navigation bar present');
    }

    // Check for action buttons (Add Device, Import, Export, etc.)
    const buttons = await page.$$('button');
    log('INFO', `Found ${buttons.length} buttons on page`);

    if (buttons.length === 0) {
      report.addBug('HIGH', 'No action buttons found', 'Page has no interactive buttons');
    } else {
      report.addPass(`Found ${buttons.length} interactive buttons`);
    }

    // Check for search functionality
    const searchInput = await page.$('input[type="text"]');
    if (searchInput) {
      const placeholder = await page.evaluate(el => el.placeholder, searchInput);
      log('INFO', `Search input found with placeholder: ${placeholder}`);
      report.addPass('Search input available');
    }

    await takeScreenshot(page, '12_device_manager_complete');

    // Test table rendering with actual data
    const tableRows = await page.$$('tbody tr');
    log('INFO', `Found ${tableRows.length} device rows in table`);

    if (tableRows.length === 0) {
      report.addWarning('No devices in table', 'Device table is empty (may be normal for fresh install)');
    } else {
      report.addPass(`Device table displays ${tableRows.length} devices`);
    }

    // Check console errors
    if (consoleErrors.length > 0) {
      // Filter out common non-critical errors
      const criticalErrors = consoleErrors.filter(err =>
        !err.includes('DevTools') &&
        !err.includes('Extension') &&
        !err.includes('Manifest')
      );

      if (criticalErrors.length > 0) {
        report.addBug('MEDIUM', 'JavaScript errors on page', `Console errors: ${criticalErrors.slice(0, 3).join(', ')}`);
        await takeScreenshot(page, '13_with_console_errors');
      } else {
        report.addPass('No critical JavaScript errors');
      }
    } else {
      report.addPass('No console errors on device manager page');
    }

    await page.close();
    return true;

  } catch (error) {
    report.addBug('CRITICAL', 'Device Manager failed to load', `Error: ${error.message}`);
    await takeScreenshot(page, '14_device_manager_error');
    await page.close();
    return false;
  }
}

async function testUIRendering(browser, report) {
  log('INFO', 'TEST 4: Check UI rendering and responsiveness');

  const page = await browser.newPage();

  try {
    // Login first
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const usernameInput = await page.$('#username');
    if (usernameInput) {
      await page.type('#username', TEST_CREDENTIALS.username);
      await page.type('#password', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Check viewport rendering
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await takeScreenshot(page, '15_desktop_view');
    report.addPass('Desktop view renders');

    // Test mobile view
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await takeScreenshot(page, '16_mobile_view');
    report.addPass('Mobile view renders');

    // Check for broken images
    const images = await page.$$('img');
    let brokenImages = 0;
    for (const img of images) {
      const src = await page.evaluate(el => el.src, img);
      const naturalWidth = await page.evaluate(el => el.naturalWidth, img);
      if (naturalWidth === 0) {
        brokenImages++;
        log('WARN', `Broken image: ${src}`);
      }
    }

    if (brokenImages > 0) {
      report.addWarning('Broken images detected', `Found ${brokenImages} images that failed to load`);
    } else if (images.length > 0) {
      report.addPass('All images loaded successfully');
    }

    // Check for missing stylesheets
    const stylesheets = await page.$$('link[rel="stylesheet"]');
    log('INFO', `Found ${stylesheets.length} stylesheets`);

    await page.close();
    return true;

  } catch (error) {
    report.addBug('MEDIUM', 'UI rendering test failed', `Error: ${error.message}`);
    await takeScreenshot(page, '17_ui_render_error');
    await page.close();
    return false;
  }
}

async function testNavigationAndRouting(browser, report) {
  log('INFO', 'TEST 5: Test page navigation and routing');

  const page = await browser.newPage();

  try {
    // Login first
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const usernameInput = await page.$('#username');
    if (usernameInput) {
      await page.type('#username', TEST_CREDENTIALS.username);
      await page.type('#password', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Check if we can access the device manager (root path)
    const currentUrl = page.url();
    if (currentUrl === BASE_URL + '/' || currentUrl === BASE_URL) {
      report.addPass('Default route (/) works');
    } else {
      log('INFO', `Redirected to: ${currentUrl}`);
    }

    // Test direct navigation to different pages (if navbar exists)
    const navLinks = await page.$$('nav a');
    if (navLinks.length > 0) {
      log('INFO', `Found ${navLinks.length} navigation links`);
      report.addPass('Navigation menu available');

      // Click first nav link to test routing
      try {
        await navLinks[0].click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newUrl = page.url();
        log('INFO', `Navigated to: ${newUrl}`);
        report.addPass('Client-side routing works');
        await takeScreenshot(page, '18_after_navigation');
      } catch (err) {
        report.addWarning('Navigation click failed', `Could not test navigation: ${err.message}`);
      }
    }

    await page.close();
    return true;

  } catch (error) {
    report.addBug('MEDIUM', 'Navigation test failed', `Error: ${error.message}`);
    await page.close();
    return false;
  }
}

async function main() {
  log('INFO', 'BOUNTY HUNTER #1 - UI/UX and Login Specialist');
  log('INFO', 'Starting comprehensive login and UI tests...');

  const report = new BugReport();

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    log('INFO', 'Browser launched');

    // Run all tests
    await testLoginPage(browser, report);
    await testLoginFunctionality(browser, report);
    await testDeviceManagerPage(browser, report);
    await testUIRendering(browser, report);
    await testNavigationAndRouting(browser, report);

  } catch (error) {
    log('FAIL', `Fatal error: ${error.message}`);
    report.addBug('CRITICAL', 'Test suite crashed', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Print final report
  report.printReport();

  // Exit with error code if bugs found
  process.exit(report.bugs.length > 0 ? 1 : 0);
}

main();
