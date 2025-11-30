/**
 * E2E Test Helpers - Utility functions for Puppeteer tests
 * Provides reusable functions for common testing operations
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const TEST_CONFIG = {
  frontendUrl: 'http://localhost:9051',
  backendUrl: 'http://localhost:9050',
  apiUrl: 'http://localhost:9050/api',
  wsUrl: 'ws://localhost:9050/ws',
  
  defaultTimeout: 30000,
  navigationTimeout: 30000,
  elementTimeout: 10000,
  
  screenshots: {
    enabled: true,
    dir: path.join(__dirname, '../../../test-screenshots'),
  },
  
  testData: {
    admin: { username: 'admin', password: 'admin123' },
    testUser: { username: 'test-user', password: 'test-pass' },
  }
};

// ============================================================================
// BROWSER MANAGEMENT
// ============================================================================

/**
 * Launch a new browser instance with standard configuration
 */
export async function launchBrowser(): Promise<Browser> {
  return await puppeteer.launch({
    headless: true, // Set to false for debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    slowMo: 50, // Slow down by 50ms for stability
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });
}

/**
 * Create a new page with default timeouts
 */
export async function createPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  
  // Set default timeouts
  page.setDefaultTimeout(TEST_CONFIG.defaultTimeout);
  page.setDefaultNavigationTimeout(TEST_CONFIG.navigationTimeout);
  
  // Enable request interception for debugging
  await page.setRequestInterception(false);
  
  // Console log capture
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[Browser ${type}]:`, msg.text());
    }
  });
  
  // Page error capture
  page.on('pageerror', (error) => {
    console.error('[Page Error]:', error.message);
  });
  
  return page;
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Navigate to a URL and wait for network idle
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  const url = `${TEST_CONFIG.frontendUrl}${path}`;
  console.log(`Navigating to: ${url}`);
  
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: TEST_CONFIG.navigationTimeout,
  });
}

/**
 * Navigate to frontend home page
 */
export async function navigateToHome(page: Page): Promise<void> {
  await navigateTo(page, '/');
}

// ============================================================================
// WAIT HELPERS
// ============================================================================

/**
 * Wait for an element to be visible
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = TEST_CONFIG.elementTimeout
): Promise<void> {
  await page.waitForSelector(selector, {
    visible: true,
    timeout,
  });
}

/**
 * Wait for text content to appear on the page
 */
export async function waitForText(
  page: Page,
  text: string,
  timeout: number = TEST_CONFIG.elementTimeout
): Promise<void> {
  await page.waitForFunction(
    (searchText) => document.body.innerText.includes(searchText),
    { timeout },
    text
  );
}

/**
 * Wait for element to disappear
 */
export async function waitForElementToDisappear(
  page: Page,
  selector: string,
  timeout: number = TEST_CONFIG.elementTimeout
): Promise<void> {
  await page.waitForSelector(selector, {
    hidden: true,
    timeout,
  });
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page): Promise<void> {
  await page.waitForNetworkIdle({ timeout: 5000 });
}

/**
 * Custom wait with milliseconds
 */
export async function wait(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// INPUT HELPERS
// ============================================================================

/**
 * Type text into an input field (clears first)
 */
export async function typeIntoInput(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector, { clickCount: 3 }); // Select all
  await page.keyboard.press('Backspace');
  await page.type(selector, text, { delay: 50 });
}

/**
 * Click an element and wait for navigation if needed
 */
export async function clickAndWait(
  page: Page,
  selector: string,
  waitForNav: boolean = false
): Promise<void> {
  await page.waitForSelector(selector, { visible: true });
  
  if (waitForNav) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click(selector),
    ]);
  } else {
    await page.click(selector);
  }
}

/**
 * Select an option from a dropdown
 */
export async function selectOption(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  await page.waitForSelector(selector, { visible: true });
  await page.select(selector, value);
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Login with username and password
 */
export async function login(
  page: Page,
  username: string,
  password: string
): Promise<boolean> {
  console.log(`Logging in as: ${username}`);
  
  // Navigate to home page (should redirect to login if not authenticated)
  await navigateToHome(page);
  
  // Wait for login form
  try {
    await waitForElement(page, 'input[type="text"], input[name="username"]', 5000);
  } catch (error) {
    // Might already be logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('login')) {
      console.log('Already logged in');
      return true;
    }
    throw error;
  }
  
  // Fill login form
  const usernameSelector = 'input[type="text"], input[name="username"]';
  const passwordSelector = 'input[type="password"], input[name="password"]';
  const loginButtonSelector = 'button[type="submit"], button:has-text("Login"), button:has-text("Sign In")';
  
  await typeIntoInput(page, usernameSelector, username);
  await typeIntoInput(page, passwordSelector, password);
  
  // Click login and wait
  await clickAndWait(page, loginButtonSelector, false);
  
  // Wait for navigation or error
  await wait(2000);
  
  // Check if login was successful (URL should change or error message appears)
  const cookies = await page.cookies();
  const sessionCookie = cookies.find(c => c.name === 'session_token');
  
  if (sessionCookie) {
    console.log('Login successful');
    return true;
  }
  
  console.log('Login failed or pending');
  return false;
}

/**
 * Login as admin user
 */
export async function loginAsAdmin(page: Page): Promise<boolean> {
  return await login(
    page,
    TEST_CONFIG.testData.admin.username,
    TEST_CONFIG.testData.admin.password
  );
}

/**
 * Logout current user
 */
export async function logout(page: Page): Promise<void> {
  console.log('Logging out');
  
  // Try to find and click logout button
  const logoutSelectors = [
    'button:has-text("Logout")',
    'button:has-text("Sign Out")',
    'a:has-text("Logout")',
    '[data-testid="logout"]',
  ];
  
  for (const selector of logoutSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      await clickAndWait(page, selector, false);
      await wait(1000);
      return;
    } catch (error) {
      // Try next selector
    }
  }
  
  // Fallback: call API directly
  await page.evaluate(async () => {
    await fetch('http://localhost:9050/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.cookies();
  return cookies.some(c => c.name === 'session_token');
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Make an API request from the page context
 */
export async function apiRequest(
  page: Page,
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<any> {
  const url = `${TEST_CONFIG.apiUrl}${endpoint}`;
  
  const response = await page.evaluate(
    async ({ url, method, body, headers }) => {
      const res = await fetch(url, {
        method: method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });
      
      return {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: await res.text(),
      };
    },
    { url, method: options.method, body: options.body, headers: options.headers }
  );
  
  // Parse JSON if possible
  try {
    response.body = JSON.parse(response.body);
  } catch (error) {
    // Keep as string
  }
  
  return response;
}

/**
 * Get all devices via API
 */
export async function getDevices(page: Page): Promise<any[]> {
  const response = await apiRequest(page, '/devices');
  return response.body || [];
}

/**
 * Create a device via API
 */
export async function createDevice(page: Page, device: any): Promise<any> {
  const response = await apiRequest(page, '/devices', {
    method: 'POST',
    body: device,
  });
  return response.body;
}

/**
 * Delete a device via API
 */
export async function deleteDevice(page: Page, deviceId: string): Promise<void> {
  await apiRequest(page, `/devices/${deviceId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// SCREENSHOT HELPERS
// ============================================================================

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(
  page: Page,
  name: string
): Promise<void> {
  if (!TEST_CONFIG.screenshots.enabled) return;
  
  // Create screenshots directory if it doesn't exist
  if (!fs.existsSync(TEST_CONFIG.screenshots.dir)) {
    fs.mkdirSync(TEST_CONFIG.screenshots.dir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}_${timestamp}.png`;
  const filepath = path.join(TEST_CONFIG.screenshots.dir, filename);
  
  await page.screenshot({
    path: filepath,
    fullPage: true,
  });
  
  console.log(`Screenshot saved: ${filename}`);
}

/**
 * Take screenshot on test failure
 */
export async function screenshotOnFailure(
  page: Page,
  testName: string,
  error: Error
): Promise<void> {
  console.error(`Test failed: ${testName}`, error.message);
  await takeScreenshot(page, `FAILED_${testName}`);
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert element exists on page
 */
export async function assertElementExists(
  page: Page,
  selector: string,
  message?: string
): Promise<void> {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(message || `Element not found: ${selector}`);
  }
}

/**
 * Assert text content is present
 */
export async function assertTextPresent(
  page: Page,
  text: string,
  message?: string
): Promise<void> {
  const content = await page.content();
  if (!content.includes(text)) {
    throw new Error(message || `Text not found: ${text}`);
  }
}

/**
 * Assert URL matches pattern
 */
export async function assertUrlMatches(
  page: Page,
  pattern: string | RegExp,
  message?: string
): Promise<void> {
  const url = page.url();
  const matches = typeof pattern === 'string' 
    ? url.includes(pattern)
    : pattern.test(url);
  
  if (!matches) {
    throw new Error(message || `URL does not match pattern. Current: ${url}, Expected: ${pattern}`);
  }
}

/**
 * Assert cookie exists
 */
export async function assertCookieExists(
  page: Page,
  cookieName: string,
  message?: string
): Promise<void> {
  const cookies = await page.cookies();
  const cookie = cookies.find(c => c.name === cookieName);
  
  if (!cookie) {
    throw new Error(message || `Cookie not found: ${cookieName}`);
  }
}

/**
 * Assert HTTP response status
 */
export function assertHttpStatus(
  response: any,
  expectedStatus: number,
  message?: string
): void {
  if (response.status !== expectedStatus) {
    throw new Error(
      message || `Expected HTTP ${expectedStatus}, got ${response.status}: ${response.statusText}`
    );
  }
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

/**
 * Generate a random device for testing
 */
export function generateTestDevice(index: number = 1): any {
  const id = `test-${String(index).padStart(3, '0')}`;
  
  return {
    id,
    deviceName: `test-device-${index}`,
    ipAddress: `172.20.0.${100 + index}`,
    protocol: 'SSH',
    port: 22,
    username: 'cisco',
    password: 'cisco',
    country: 'United States',
    deviceType: 'PE',
    platform: 'ASR9905',
    software: 'IOS XR',
    tags: ['test', 'e2e'],
  };
}

/**
 * Generate multiple test devices
 */
export function generateTestDevices(count: number): any[] {
  return Array.from({ length: count }, (_, i) => generateTestDevice(i + 1));
}

// ============================================================================
// CLEANUP HELPERS
// ============================================================================

/**
 * Clean up test data (delete test devices)
 */
export async function cleanupTestDevices(page: Page): Promise<void> {
  console.log('Cleaning up test devices...');
  
  const devices = await getDevices(page);
  const testDevices = devices.filter((d: any) => 
    d.id?.startsWith('test-') || d.deviceName?.startsWith('test-')
  );
  
  for (const device of testDevices) {
    try {
      await deleteDevice(page, device.id);
      console.log(`Deleted test device: ${device.id}`);
    } catch (error) {
      console.error(`Failed to delete device ${device.id}:`, error);
    }
  }
  
  console.log(`Cleaned up ${testDevices.length} test devices`);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  TEST_CONFIG,
  launchBrowser,
  createPage,
  navigateTo,
  navigateToHome,
  waitForElement,
  waitForText,
  waitForElementToDisappear,
  waitForNetworkIdle,
  wait,
  typeIntoInput,
  clickAndWait,
  selectOption,
  login,
  loginAsAdmin,
  logout,
  isAuthenticated,
  apiRequest,
  getDevices,
  createDevice,
  deleteDevice,
  takeScreenshot,
  screenshotOnFailure,
  assertElementExists,
  assertTextPresent,
  assertUrlMatches,
  assertCookieExists,
  assertHttpStatus,
  generateTestDevice,
  generateTestDevices,
  cleanupTestDevices,
};
