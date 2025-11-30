/**
 * ============================================================================
 * E2E Tests for Real Network Environment
 * ============================================================================
 * 
 * Tests automation workflow with real Cisco IOS-XR routers via jumphost
 * 
 * Network Topology:
 *   MacBook/VM172 → Jumphost (172.16.39.173) → 10 Routers (172.20.0.11-20)
 * 
 * Credentials: cisco/cisco (shared for jumphost + all routers)
 * 
 * Prerequisites:
 *   - Application running on localhost:9050 or 172.16.39.172:9050
 *   - Jumphost (172.16.39.173) accessible
 *   - 10 Cisco routers (172.20.0.11-20) reachable via jumphost
 *   - Credentials configured: cisco/cisco
 * 
 * ============================================================================
 */

import { test, expect, Page } from '@playwright/test';

// Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:9050';
const TEST_TIMEOUT = 300000; // 5 minutes for real network operations
const LONG_TIMEOUT = 600000; // 10 minutes for full automation

// Jumphost Configuration
const JUMPHOST_CONFIG = {
  host: '172.16.39.173',
  port: 22,
  username: 'cisco',
  password: 'cisco',
};

// Real Router Inventory (172.20.0.11-20)
const REAL_ROUTERS = [
  { id: 'r1', name: 'zwe-hra-pop-p01', ip: '172.20.0.11', deviceType: 'P' },
  { id: 'r2', name: 'router-02', ip: '172.20.0.12', deviceType: 'P' },
  { id: 'r3', name: 'router-03', ip: '172.20.0.13', deviceType: 'P' },
  { id: 'r4', name: 'router-04', ip: '172.20.0.14', deviceType: 'P' },
  { id: 'r5', name: 'router-05', ip: '172.20.0.15', deviceType: 'PE' },
  { id: 'r6', name: 'router-06', ip: '172.20.0.16', deviceType: 'P' },
  { id: 'r7', name: 'router-07', ip: '172.20.0.17', deviceType: 'P' },
  { id: 'r8', name: 'router-08', ip: '172.20.0.18', deviceType: 'RR' },
  { id: 'r9', name: 'router-09', ip: '172.20.0.19', deviceType: 'PE' },
  { id: 'r10', name: 'deu-ber-bes-pe10', ip: '172.20.0.20', deviceType: 'PE' },
];

// Test Commands for IOS-XR
const TEST_COMMANDS = [
  'show version',
  'show running-config',
  'show ip interface brief',
  'show ospf neighbor',
  'show mpls ldp neighbor',
];

/**
 * Helper: Login to application
 */
async function login(page: Page) {
  await page.goto(`${APP_URL}/`);
  await page.waitForLoadState('networkidle');

  // Check if already logged in
  const isLoggedIn = await page.locator('text=Device Manager').isVisible().catch(() => false);
  if (isLoggedIn) {
    return; // Already logged in
  }

  // Perform login
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin');
  await page.click('button:has-text("Login")');

  // Wait for dashboard
  await expect(page.locator('text=Device Manager')).toBeVisible({ timeout: 10000 });
}

/**
 * Helper: Configure Jumphost
 */
async function configureJumphost(page: Page) {
  await page.goto(`${APP_URL}/automation`);
  await page.waitForLoadState('networkidle');

  // Find jumphost section
  await expect(page.locator('text=SSH Jumphost')).toBeVisible({ timeout: 10000 });

  // Enable jumphost
  const enableCheckbox = page.locator('input[type="checkbox"]').first();
  const isEnabled = await enableCheckbox.isChecked();
  if (!isEnabled) {
    await enableCheckbox.check();
  }

  // Fill jumphost configuration
  await page.fill('input[placeholder*="host"]', JUMPHOST_CONFIG.host);
  await page.fill('input[placeholder*="port"]', String(JUMPHOST_CONFIG.port));
  await page.fill('input[placeholder*="username"]', JUMPHOST_CONFIG.username);
  await page.fill('input[placeholder*="password"]', JUMPHOST_CONFIG.password);

  // Save configuration
  await page.click('button:has-text("Save")');
  
  // Wait for success message
  await expect(page.locator('text=saved successfully')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper: Test Jumphost Connection
 */
async function testJumphostConnection(page: Page) {
  await page.goto(`${APP_URL}/automation`);
  await page.waitForLoadState('networkidle');

  // Click test connection button
  await page.click('button:has-text("Test Connection")');

  // Wait for result (up to 30 seconds for real SSH)
  await expect(
    page.locator('text=Connection successful')
  ).toBeVisible({ timeout: 30000 });
}

/**
 * Helper: Add Real Router
 */
async function addRouter(page: Page, router: typeof REAL_ROUTERS[0]) {
  await page.goto(`${APP_URL}/devices`);
  await page.waitForLoadState('networkidle');

  // Click Add Device button
  await page.click('button:has-text("Add Device")');

  // Fill device form
  await page.fill('input[name="deviceName"]', router.name);
  await page.fill('input[name="ipAddress"]', router.ip);
  await page.selectOption('select[name="protocol"]', 'SSH');
  await page.fill('input[name="port"]', '22');
  
  // Leave username/password empty (inherit from jumphost)
  await page.fill('input[name="username"]', '');
  await page.fill('input[name="password"]', '');
  
  await page.selectOption('select[name="software"]', 'IOS XR');
  await page.selectOption('select[name="platform"]', 'ASR9903');
  await page.selectOption('select[name="deviceType"]', router.deviceType);
  await page.selectOption('select[name="country"]', 'Zimbabwe');

  // Save device
  await page.click('button:has-text("Save")');

  // Wait for device to appear in list
  await expect(page.locator(`text=${router.name}`)).toBeVisible({ timeout: 5000 });
}

/**
 * Test Suite: Real Network Environment
 */
test.describe('Real Network - Jumphost + 10 Routers', () => {
  test.setTimeout(LONG_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('01 - Should configure jumphost successfully', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    await configureJumphost(page);
    
    // Verify configuration persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const hostInput = await page.inputValue('input[placeholder*="host"]');
    expect(hostInput).toBe(JUMPHOST_CONFIG.host);
  });

  test('02 - Should test jumphost connection', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    await testJumphostConnection(page);
  });

  test('03 - Should add 2 test routers', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    // Add first 2 routers for quick test
    await addRouter(page, REAL_ROUTERS[0]);
    await addRouter(page, REAL_ROUTERS[9]); // First and last
  });

  test('04 - Should connect to 2 routers via jumphost', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    await page.goto(`${APP_URL}/automation`);
    await page.waitForLoadState('networkidle');

    // Select first 2 routers
    await page.click(`input[type="checkbox"][value="${REAL_ROUTERS[0].id}"]`);
    await page.click(`input[type="checkbox"][value="${REAL_ROUTERS[9].id}"]`);

    // Click Connect Devices
    await page.click('button:has-text("Connect Devices")');

    // Wait for connections (real SSH takes time)
    await expect(
      page.locator('text=2 devices connected')
    ).toBeVisible({ timeout: 60000 });
  });

  test('05 - Should run automation on 2 routers', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    await page.goto(`${APP_URL}/automation`);
    await page.waitForLoadState('networkidle');

    // Ensure routers are connected
    await page.click(`input[type="checkbox"][value="${REAL_ROUTERS[0].id}"]`);
    await page.click(`input[type="checkbox"][value="${REAL_ROUTERS[9].id}"]`);
    await page.click('button:has-text("Connect Devices")');
    await page.waitForTimeout(30000); // Wait for connections

    // Select test commands
    await page.click('text=show version');
    await page.click('text=show ip interface brief');

    // Start automation
    await page.click('button:has-text("Start Automation")');

    // Watch real-time progress
    await expect(
      page.locator('text=Job started')
    ).toBeVisible({ timeout: 10000 });

    // Wait for completion (real commands take time)
    await expect(
      page.locator('text=Completed').or(page.locator('text=100%'))
    ).toBeVisible({ timeout: 180000 }); // 3 minutes
  });

  test('06 - Should verify collected data files', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    await page.goto(`${APP_URL}/datasave`);
    await page.waitForLoadState('networkidle');

    // Check for files from both routers
    await expect(
      page.locator(`text=${REAL_ROUTERS[0].name}`)
    ).toBeVisible({ timeout: 5000 });
    
    await expect(
      page.locator(`text=${REAL_ROUTERS[9].name}`)
    ).toBeVisible({ timeout: 5000 });

    // Verify file content contains real IOS-XR output
    await page.click(`text=${REAL_ROUTERS[0].name}`).first();
    
    // Should see real command output
    await expect(
      page.locator('text=Cisco IOS XR').or(page.locator('text=ASR9903'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('07 - Should disconnect from routers', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    await page.goto(`${APP_URL}/automation`);
    await page.waitForLoadState('networkidle');

    // Click Disconnect All
    await page.click('button:has-text("Disconnect All")');

    // Verify disconnection
    await expect(
      page.locator('text=0 devices connected')
    ).toBeVisible({ timeout: 10000 });
  });
});

/**
 * Test Suite: Full Network (All 10 Routers)
 */
test.describe('Real Network - Full Automation (10 Routers)', () => {
  test.setTimeout(LONG_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('08 - Should add all 10 routers', async ({ page }) => {
    test.setTimeout(LONG_TIMEOUT);
    
    for (const router of REAL_ROUTERS) {
      await addRouter(page, router);
      await page.waitForTimeout(1000); // Pace requests
    }

    // Verify all routers added
    await page.goto(`${APP_URL}/devices`);
    await page.waitForLoadState('networkidle');
    
    for (const router of REAL_ROUTERS) {
      await expect(page.locator(`text=${router.name}`)).toBeVisible();
    }
  });

  test('09 - Should run full automation on all 10 routers', async ({ page }) => {
    test.setTimeout(LONG_TIMEOUT);
    
    await page.goto(`${APP_URL}/automation`);
    await page.waitForLoadState('networkidle');

    // Select all routers
    await page.click('button:has-text("Select All")');

    // Click Connect Devices
    await page.click('button:has-text("Connect Devices")');

    // Wait for all connections (parallel, ~30-60s)
    await expect(
      page.locator('text=10 devices connected')
    ).toBeVisible({ timeout: 120000 });

    // Select all OSPF commands
    for (const cmd of TEST_COMMANDS) {
      await page.click(`text=${cmd}`);
    }

    // Start automation with batch processing
    await page.click('button:has-text("Start Automation")');

    // Watch progress
    await expect(
      page.locator('text=Job started')
    ).toBeVisible({ timeout: 10000 });

    // Wait for completion (10 routers * 5 commands = ~5-10 minutes)
    await expect(
      page.locator('text=Completed').or(page.locator('text=100%'))
    ).toBeVisible({ timeout: LONG_TIMEOUT });
  });

  test('10 - Should verify all router data collected', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    
    await page.goto(`${APP_URL}/datasave`);
    await page.waitForLoadState('networkidle');

    // Check files exist for all routers
    for (const router of REAL_ROUTERS) {
      await expect(page.locator(`text=${router.name}`)).toBeVisible();
    }

    // Check file count (10 routers * 5 commands = 50 files minimum)
    const fileCount = await page.locator('.file-item').count();
    expect(fileCount).toBeGreaterThanOrEqual(50);
  });
});

/**
 * Test Suite: Error Handling
 */
test.describe('Real Network - Error Scenarios', () => {
  test.setTimeout(TEST_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('11 - Should handle invalid jumphost configuration', async ({ page }) => {
    await page.goto(`${APP_URL}/automation`);
    await page.waitForLoadState('networkidle');

    // Configure invalid jumphost
    await page.fill('input[placeholder*="host"]', '192.168.99.99'); // Non-existent
    await page.fill('input[placeholder*="port"]', '22');
    await page.fill('input[placeholder*="username"]', 'cisco');
    await page.fill('input[placeholder*="password"]', 'cisco');

    // Test connection
    await page.click('button:has-text("Test Connection")');

    // Should show error
    await expect(
      page.locator('text=Connection failed').or(page.locator('text=timeout'))
    ).toBeVisible({ timeout: 60000 });
  });

  test('12 - Should handle invalid router credentials', async ({ page }) => {
    await page.goto(`${APP_URL}/automation`);
    await page.waitForLoadState('networkidle');

    // Add router with wrong credentials
    await page.goto(`${APP_URL}/devices`);
    await page.click('button:has-text("Add Device")');
    
    await page.fill('input[name="deviceName"]', 'test-invalid');
    await page.fill('input[name="ipAddress"]', REAL_ROUTERS[0].ip);
    await page.fill('input[name="username"]', 'wronguser');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button:has-text("Save")');

    // Try to connect
    await page.goto(`${APP_URL}/automation`);
    await page.click('input[type="checkbox"][value="test-invalid"]');
    await page.click('button:has-text("Connect Devices")');

    // Should show authentication error
    await expect(
      page.locator('text=Authentication failed').or(page.locator('text=Connection failed'))
    ).toBeVisible({ timeout: 60000 });
  });
});

/**
 * Test Suite: Performance & Scalability
 */
test.describe('Real Network - Performance Tests', () => {
  test.setTimeout(LONG_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('13 - Should handle batch processing efficiently', async ({ page }) => {
    await page.goto(`${APP_URL}/automation`);
    await page.waitForLoadState('networkidle');

    // Select all 10 routers
    await page.click('button:has-text("Select All")');

    // Set batch size to 5
    await page.fill('input[name="batch_size"]', '5');

    // Start automation
    await page.click('button:has-text("Connect Devices")');
    await page.waitForTimeout(60000); // Wait for connections
    
    await page.click('text=show version');
    await page.click('button:has-text("Start Automation")');

    // Monitor batch progress (should see 2 batches)
    await expect(page.locator('text=Batch 1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Batch 2')).toBeVisible({ timeout: 120000 });
  });

  test('14 - Should handle WebSocket real-time updates', async ({ page }) => {
    await page.goto(`${APP_URL}/automation`);
    await page.waitForLoadState('networkidle');

    // Listen for WebSocket messages
    const wsMessages: any[] = [];
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        wsMessages.push(event.payload);
      });
    });

    // Start automation
    await page.click(`input[type="checkbox"][value="${REAL_ROUTERS[0].id}"]`);
    await page.click('button:has-text("Connect Devices")');
    await page.waitForTimeout(30000);
    
    await page.click('text=show version');
    await page.click('button:has-text("Start Automation")');

    // Wait for completion
    await page.waitForTimeout(60000);

    // Verify WebSocket messages received
    expect(wsMessages.length).toBeGreaterThan(0);
  });
});

/**
 * Test Suite: Data Integrity
 */
test.describe('Real Network - Data Validation', () => {
  test.setTimeout(TEST_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('15 - Should save correct file format (TEXT + JSON)', async ({ page }) => {
    await page.goto(`${APP_URL}/datasave`);
    await page.waitForLoadState('networkidle');

    // Check TEXT files
    await page.click('button:has-text("TEXT")');
    const textFiles = await page.locator('.file-item').count();
    expect(textFiles).toBeGreaterThan(0);

    // Check JSON files
    await page.click('button:has-text("JSON")');
    const jsonFiles = await page.locator('.file-item').count();
    expect(jsonFiles).toBeGreaterThan(0);
  });

  test('16 - Should contain valid IOS-XR output in files', async ({ page }) => {
    await page.goto(`${APP_URL}/datasave`);
    await page.waitForLoadState('networkidle');

    // Open first router file
    await page.click(`text=${REAL_ROUTERS[0].name}`).first();

    // Verify real IOS-XR markers
    const content = await page.textContent('pre, code, .output');
    
    // Check for IOS-XR signatures
    const hasIOSXR = content?.includes('Cisco IOS XR') || 
                     content?.includes('ASR9') ||
                     content?.includes('RP/0/RP0/CPU0');
    
    expect(hasIOSXR).toBeTruthy();
  });
});

/**
 * Summary Test: Full End-to-End Workflow
 */
test('99 - FULL E2E: Setup → Connect → Automate → Verify → Cleanup', async ({ page }) => {
  test.setTimeout(LONG_TIMEOUT);

  await login(page);

  // 1. Configure Jumphost
  await configureJumphost(page);
  await testJumphostConnection(page);

  // 2. Add 3 test routers
  await addRouter(page, REAL_ROUTERS[0]);
  await addRouter(page, REAL_ROUTERS[4]);
  await addRouter(page, REAL_ROUTERS[9]);

  // 3. Connect to routers
  await page.goto(`${APP_URL}/automation`);
  await page.click('button:has-text("Select All")');
  await page.click('button:has-text("Connect Devices")');
  await page.waitForTimeout(60000); // Wait for connections

  // 4. Run automation
  await page.click('text=show version');
  await page.click('text=show ip interface brief');
  await page.click('button:has-text("Start Automation")');
  
  await expect(
    page.locator('text=Completed').or(page.locator('text=100%'))
  ).toBeVisible({ timeout: 180000 });

  // 5. Verify data
  await page.goto(`${APP_URL}/datasave`);
  await expect(page.locator(`text=${REAL_ROUTERS[0].name}`)).toBeVisible();
  await expect(page.locator(`text=${REAL_ROUTERS[4].name}`)).toBeVisible();
  await expect(page.locator(`text=${REAL_ROUTERS[9].name}`)).toBeVisible();

  // 6. Cleanup - Disconnect
  await page.goto(`${APP_URL}/automation`);
  await page.click('button:has-text("Disconnect All")');
  await expect(page.locator('text=0 devices connected')).toBeVisible({ timeout: 10000 });

  console.log('✅ FULL E2E TEST PASSED!');
});
