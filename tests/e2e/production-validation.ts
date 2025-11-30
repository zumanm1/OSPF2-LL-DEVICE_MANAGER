/**
 * E2E Production Validation Test Suite
 * Comprehensive tests for all critical application workflows
 * 
 * Run with: npx ts-node tests/e2e/production-validation.ts
 */

import { Browser, Page } from 'puppeteer';
import * as helpers from './utils/test-helpers';

// ============================================================================
// TEST RESULTS TRACKING
// ============================================================================

interface TestResult {
  name: string;
  suite: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  screenshot?: string;
}

const testResults: TestResult[] = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

// ============================================================================
// TEST EXECUTION WRAPPER
// ============================================================================

async function runTest(
  suite: string,
  name: string,
  testFn: (page: Page) => Promise<void>,
  page: Page
): Promise<void> {
  totalTests++;
  const startTime = Date.now();
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${suite}] ${name}`);
  console.log(`${'='.repeat(80)}`);
  
  try {
    await testFn(page);
    const duration = Date.now() - startTime;
    
    testResults.push({ name, suite, status: 'PASS', duration });
    passedTests++;
    
    console.log(`✅ PASS (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    await helpers.screenshotOnFailure(page, `${suite}_${name}`, error);
    
    testResults.push({
      name,
      suite,
      status: 'FAIL',
      duration,
      error: error.message,
    });
    failedTests++;
    
    console.log(`❌ FAIL (${duration}ms)`);
    console.error(`Error: ${error.message}`);
  }
}

// ============================================================================
// SUITE 1: AUTHENTICATION & SECURITY TESTS
// ============================================================================

async function suite1_AuthenticationTests(browser: Browser): Promise<void> {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' SUITE 1: AUTHENTICATION & SECURITY TESTS'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  const page = await helpers.createPage(browser);
  
  // Test 1.1: Successful Login
  await runTest('Authentication', 'Successful Login', async (page) => {
    await helpers.navigateToHome(page);
    const success = await helpers.loginAsAdmin(page);
    
    if (!success) {
      throw new Error('Login failed');
    }
    
    await helpers.assertCookieExists(page, 'session_token');
    console.log('  ✓ Session cookie created');
    
    await helpers.wait(1000);
    await helpers.takeScreenshot(page, 'auth_login_success');
  }, page);
  
  // Test 1.2: Failed Login with Invalid Credentials
  await runTest('Authentication', 'Failed Login - Invalid Credentials', async (page) => {
    // Logout first
    await helpers.logout(page);
    await helpers.wait(500);
    
    // Try invalid login
    await helpers.navigateToHome(page);
    await helpers.login(page, 'admin', 'wrongpassword');
    
    await helpers.wait(2000);
    
    // Should NOT have session cookie
    const isAuth = await helpers.isAuthenticated(page);
    if (isAuth) {
      throw new Error('Login should have failed but session cookie exists');
    }
    
    console.log('  ✓ Login correctly rejected invalid credentials');
  }, page);
  
  // Test 1.3: Rate Limiting - Login Brute Force Protection
  await runTest('Authentication', 'Rate Limiting - Login (5/minute)', async (page) => {
    await helpers.logout(page);
    await helpers.wait(500);
    
    let rateLimitedCount = 0;
    
    // Make 7 rapid login attempts
    for (let i = 1; i <= 7; i++) {
      const response = await helpers.apiRequest(page, '/auth/login', {
        method: 'POST',
        body: { username: 'test-user', password: 'wrong' },
      });
      
      console.log(`  Attempt ${i}: HTTP ${response.status}`);
      
      if (response.status === 429) {
        rateLimitedCount++;
      }
      
      await helpers.wait(200);
    }
    
    if (rateLimitedCount < 2) {
      throw new Error(`Expected at least 2 rate-limited requests, got ${rateLimitedCount}`);
    }
    
    console.log(`  ✓ Rate limiting working (${rateLimitedCount} requests blocked)`);
  }, page);
  
  // Test 1.4: Session Persistence
  await runTest('Authentication', 'Session Persistence', async (page) => {
    // Login
    await helpers.loginAsAdmin(page);
    await helpers.wait(500);
    
    // Refresh page
    await page.reload({ waitUntil: 'networkidle2' });
    await helpers.wait(1000);
    
    // Check still authenticated
    const isAuth = await helpers.isAuthenticated(page);
    if (!isAuth) {
      throw new Error('Session did not persist after page refresh');
    }
    
    console.log('  ✓ Session persisted across page refresh');
  }, page);
  
  await page.close();
}

// ============================================================================
// SUITE 2: DEVICE MANAGEMENT TESTS
// ============================================================================

async function suite2_DeviceManagementTests(browser: Browser): Promise<void> {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' SUITE 2: DEVICE MANAGEMENT TESTS'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  const page = await helpers.createPage(browser);
  await helpers.loginAsAdmin(page);
  
  // Cleanup before tests
  await helpers.cleanupTestDevices(page);
  
  // Test 2.1: Load Device List
  await runTest('Device Management', 'Load Device List', async (page) => {
    await helpers.navigateToHome(page);
    await helpers.wait(2000);
    
    const devices = await helpers.getDevices(page);
    
    if (devices.length < 1) {
      throw new Error('No devices found in database');
    }
    
    console.log(`  ✓ Loaded ${devices.length} devices`);
    await helpers.takeScreenshot(page, 'devices_list');
  }, page);
  
  // Test 2.2: Create New Device via API
  await runTest('Device Management', 'Create New Device', async (page) => {
    const testDevice = helpers.generateTestDevice(1);
    
    const response = await helpers.apiRequest(page, '/devices', {
      method: 'POST',
      body: testDevice,
    });
    
    helpers.assertHttpStatus(response, 201);
    
    console.log(`  ✓ Device created: ${testDevice.deviceName}`);
    
    // Verify it appears in list
    const devices = await helpers.getDevices(page);
    const found = devices.find((d: any) => d.id === testDevice.id);
    
    if (!found) {
      throw new Error('Device not found in list after creation');
    }
    
    console.log(`  ✓ Device verified in list`);
  }, page);
  
  // Test 2.3: Update Device
  await runTest('Device Management', 'Update Device', async (page) => {
    const deviceId = 'test-001';
    
    const response = await helpers.apiRequest(page, `/devices/${deviceId}`, {
      method: 'PUT',
      body: {
        ...helpers.generateTestDevice(1),
        country: 'Germany',
      },
    });
    
    helpers.assertHttpStatus(response, 200);
    
    // Verify update
    const devices = await helpers.getDevices(page);
    const updated = devices.find((d: any) => d.id === deviceId);
    
    if (updated?.country !== 'Germany') {
      throw new Error('Device country not updated');
    }
    
    console.log(`  ✓ Device updated successfully`);
  }, page);
  
  // Test 2.4: Delete Device
  await runTest('Device Management', 'Delete Single Device', async (page) => {
    const deviceId = 'test-001';
    
    const response = await helpers.apiRequest(page, `/devices/${deviceId}`, {
      method: 'DELETE',
    });
    
    helpers.assertHttpStatus(response, 200);
    
    // Verify deletion
    await helpers.wait(500);
    const devices = await helpers.getDevices(page);
    const found = devices.find((d: any) => d.id === deviceId);
    
    if (found) {
      throw new Error('Device still exists after deletion');
    }
    
    console.log(`  ✓ Device deleted successfully`);
  }, page);
  
  // Test 2.5: Bulk Delete Devices
  await runTest('Device Management', 'Bulk Delete Devices', async (page) => {
    // Create 5 test devices
    const testDevices = helpers.generateTestDevices(5);
    
    for (const device of testDevices) {
      await helpers.createDevice(page, device);
    }
    
    console.log(`  Created ${testDevices.length} test devices`);
    
    // Bulk delete
    const deviceIds = testDevices.map(d => d.id);
    const response = await helpers.apiRequest(page, '/devices/bulk-delete', {
      method: 'POST',
      body: { ids: deviceIds },
    });
    
    helpers.assertHttpStatus(response, 200);
    
    // Verify all deleted
    await helpers.wait(500);
    const devices = await helpers.getDevices(page);
    const remaining = devices.filter((d: any) => deviceIds.includes(d.id));
    
    if (remaining.length > 0) {
      throw new Error(`${remaining.length} devices not deleted`);
    }
    
    console.log(`  ✓ All ${testDevices.length} devices bulk deleted`);
  }, page);
  
  await page.close();
}

// ============================================================================
// SUITE 3: RATE LIMITING TESTS
// ============================================================================

async function suite3_RateLimitingTests(browser: Browser): Promise<void> {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' SUITE 3: RATE LIMITING TESTS (CRITICAL)'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  const page = await helpers.createPage(browser);
  await helpers.loginAsAdmin(page);
  
  // Test 3.1: Bulk Delete Rate Limiting (10/minute)
  await runTest('Rate Limiting', 'Bulk Delete Rate Limiting (10/minute)', async (page) => {
    // Create 15 test devices
    const testDevices = helpers.generateTestDevices(15);
    for (const device of testDevices) {
      await helpers.createDevice(page, device);
    }
    
    console.log(`  Created 15 test devices`);
    
    let successCount = 0;
    let rateLimitedCount = 0;
    
    // Try 12 bulk delete operations rapidly
    for (let i = 1; i <= 12; i++) {
      const deviceId = `test-${String(i).padStart(3, '0')}`;
      
      const response = await helpers.apiRequest(page, '/devices/bulk-delete', {
        method: 'POST',
        body: { ids: [deviceId] },
      });
      
      console.log(`  Bulk delete ${i}/12: HTTP ${response.status}`);
      
      if (response.status === 429) {
        rateLimitedCount++;
      } else if (response.status === 200) {
        successCount++;
      }
      
      await helpers.wait(100);
    }
    
    console.log(`  Results: ${successCount} succeeded, ${rateLimitedCount} rate-limited`);
    
    if (rateLimitedCount < 2) {
      throw new Error(`Expected at least 2 rate-limited requests, got ${rateLimitedCount}`);
    }
    
    if (successCount > 10) {
      throw new Error(`Too many requests succeeded (${successCount}), rate limit not working`);
    }
    
    console.log(`  ✓ Bulk delete rate limiting working correctly`);
    
    // Cleanup remaining
    await helpers.cleanupTestDevices(page);
  }, page);
  
  // Test 3.2: Job Creation Rate Limiting (30/minute)
  await runTest('Rate Limiting', 'Automation Job Rate Limiting (30/minute)', async (page) => {
    // Get some devices
    const devices = await helpers.getDevices(page);
    
    if (devices.length < 2) {
      console.log('  ⚠️  Skipping: Need at least 2 devices for automation test');
      return;
    }
    
    const deviceIds = devices.slice(0, 2).map((d: any) => d.id);
    
    let successCount = 0;
    let rateLimitedCount = 0;
    
    // Try 35 job creations rapidly
    for (let i = 1; i <= 35; i++) {
      const response = await helpers.apiRequest(page, '/automation/jobs', {
        method: 'POST',
        body: {
          device_ids: deviceIds,
          commands: ['show version'],
          batch_size: 1,
        },
      });
      
      if (i % 5 === 0 || response.status === 429) {
        console.log(`  Job creation ${i}/35: HTTP ${response.status}`);
      }
      
      if (response.status === 429) {
        rateLimitedCount++;
      } else if (response.status === 200) {
        successCount++;
      }
      
      await helpers.wait(50);
    }
    
    console.log(`  Results: ${successCount} succeeded, ${rateLimitedCount} rate-limited`);
    
    if (rateLimitedCount < 5) {
      throw new Error(`Expected at least 5 rate-limited requests, got ${rateLimitedCount}`);
    }
    
    if (successCount > 30) {
      console.log(`  ⚠️  Warning: ${successCount} jobs succeeded (expected ~30)`);
    }
    
    console.log(`  ✓ Job creation rate limiting working`);
  }, page);
  
  await page.close();
}

// ============================================================================
// SUITE 4: SECURITY TESTS
// ============================================================================

async function suite4_SecurityTests(browser: Browser): Promise<void> {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' SUITE 4: SECURITY CONFIGURATION TESTS'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  const page = await helpers.createPage(browser);
  await helpers.loginAsAdmin(page);
  
  // Test 4.1: CORS Configuration Validation
  await runTest('Security', 'CORS Configuration (No Wildcard)', async (page) => {
    const response = await helpers.apiRequest(page, '/health');
    
    const corsHeader = response.headers['access-control-allow-origin'];
    
    console.log(`  CORS Header: ${corsHeader}`);
    
    if (corsHeader === '*') {
      throw new Error('CRITICAL: Wildcard CORS detected! This is a security vulnerability!');
    }
    
    if (!corsHeader || (!corsHeader.includes('localhost') && !corsHeader.includes('127.0.0.1'))) {
      throw new Error(`Invalid CORS origin: ${corsHeader}`);
    }
    
    console.log(`  ✓ CORS properly configured (no wildcard)`);
  }, page);
  
  // Test 4.2: Unauthenticated Access Prevention
  await runTest('Security', 'Unauthenticated Access Prevention', async (page) => {
    // Logout
    await helpers.logout(page);
    await helpers.wait(500);
    
    // Try to access protected endpoint
    const response = await helpers.apiRequest(page, '/devices');
    
    // Should return 401 or redirect
    if (response.status === 200) {
      throw new Error('Protected endpoint accessible without authentication!');
    }
    
    console.log(`  ✓ Protected endpoint returns HTTP ${response.status} (expected 401)`);
  }, page);
  
  await page.close();
}

// ============================================================================
// SUITE 5: DATA INTEGRITY TESTS
// ============================================================================

async function suite5_DataIntegrityTests(browser: Browser): Promise<void> {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' SUITE 5: DATA INTEGRITY TESTS'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  const page = await helpers.createPage(browser);
  await helpers.loginAsAdmin(page);
  
  // Test 5.1: IP Address Validation
  await runTest('Data Integrity', 'Invalid IP Address Rejection', async (page) => {
    const invalidDevice = {
      ...helpers.generateTestDevice(999),
      ipAddress: '999.999.999.999',
    };
    
    const response = await helpers.apiRequest(page, '/devices', {
      method: 'POST',
      body: invalidDevice,
    });
    
    // Should be rejected (400 or validation error)
    if (response.status === 201 || response.status === 200) {
      throw new Error('Invalid IP address was accepted!');
    }
    
    console.log(`  ✓ Invalid IP rejected (HTTP ${response.status})`);
  }, page);
  
  // Test 5.2: Required Fields Validation
  await runTest('Data Integrity', 'Required Fields Validation', async (page) => {
    const incompleteDevice = {
      id: 'test-incomplete',
      // Missing deviceName (required)
      ipAddress: '172.20.0.200',
    };
    
    const response = await helpers.apiRequest(page, '/devices', {
      method: 'POST',
      body: incompleteDevice,
    });
    
    // Should be rejected
    if (response.status === 201 || response.status === 200) {
      throw new Error('Incomplete device data was accepted!');
    }
    
    console.log(`  ✓ Incomplete device rejected (HTTP ${response.status})`);
  }, page);
  
  await page.close();
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main(): Promise<void> {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' E2E PRODUCTION VALIDATION TEST SUITE'.padEnd(78) + '║');
  console.log('║' + ' Network Device Manager - OSPF Edition'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log(`\n📅 Date: ${new Date().toLocaleString()}`);
  console.log(`🌐 Frontend: ${helpers.TEST_CONFIG.frontendUrl}`);
  console.log(`🔌 Backend: ${helpers.TEST_CONFIG.backendUrl}`);
  
  const startTime = Date.now();
  
  let browser: Browser | null = null;
  
  try {
    // Launch browser
    console.log('\n🚀 Launching browser...');
    browser = await helpers.launchBrowser();
    console.log('✅ Browser launched successfully\n');
    
    // Run test suites
    await suite1_AuthenticationTests(browser);
    await suite2_DeviceManagementTests(browser);
    await suite3_RateLimitingTests(browser);
    await suite4_SecurityTests(browser);
    await suite5_DataIntegrityTests(browser);
    
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n✅ Browser closed');
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  // ============================================================================
  // GENERATE TEST REPORT
  // ============================================================================
  
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' TEST REPORT'.padEnd(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  console.log(`\n📊 SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Total Tests:     ${totalTests}`);
  console.log(`✅ Passed:        ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed:        ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`⏭️  Skipped:       ${skippedTests}`);
  console.log(`⏱️  Duration:      ${(totalDuration / 1000).toFixed(2)}s`);
  
  // Group by suite
  const suites: Record<string, TestResult[]> = {};
  testResults.forEach(result => {
    if (!suites[result.suite]) {
      suites[result.suite] = [];
    }
    suites[result.suite].push(result);
  });
  
  console.log(`\n📋 BY SUITE`);
  console.log(`${'='.repeat(80)}`);
  
  Object.keys(suites).forEach(suiteName => {
    const suiteResults = suites[suiteName];
    const passed = suiteResults.filter(r => r.status === 'PASS').length;
    const failed = suiteResults.filter(r => r.status === 'FAIL').length;
    const total = suiteResults.length;
    
    const icon = failed === 0 ? '✅' : '⚠️';
    console.log(`${icon} ${suiteName}: ${passed}/${total} passed`);
  });
  
  // Failed tests details
  const failedTestsList = testResults.filter(r => r.status === 'FAIL');
  if (failedTestsList.length > 0) {
    console.log(`\n❌ FAILED TESTS`);
    console.log(`${'='.repeat(80)}`);
    
    failedTestsList.forEach((test, index) => {
      console.log(`\n${index + 1}. [${test.suite}] ${test.name}`);
      console.log(`   Duration: ${test.duration}ms`);
      console.log(`   Error: ${test.error}`);
    });
  }
  
  // Critical tests status
  const criticalSuites = ['Authentication', 'Rate Limiting', 'Security'];
  const criticalTests = testResults.filter(r => criticalSuites.includes(r.suite));
  const criticalPassed = criticalTests.filter(r => r.status === 'PASS').length;
  const criticalTotal = criticalTests.length;
  
  console.log(`\n🔒 CRITICAL TESTS`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Status: ${criticalPassed}/${criticalTotal} passed`);
  
  if (criticalPassed === criticalTotal) {
    console.log(`✅ ALL CRITICAL TESTS PASSED`);
  } else {
    console.log(`❌ CRITICAL TESTS FAILED - FIX BEFORE PRODUCTION!`);
  }
  
  // Final verdict
  console.log(`\n🎯 FINAL VERDICT`);
  console.log(`${'='.repeat(80)}`);
  
  if (failedTests === 0) {
    console.log(`✅ 🎉 ALL TESTS PASSED! Application is production ready.`);
    process.exit(0);
  } else if (criticalPassed < criticalTotal) {
    console.log(`❌ CRITICAL FAILURES DETECTED! Do NOT deploy to production.`);
    process.exit(1);
  } else {
    console.log(`⚠️  Some tests failed, but all critical tests passed.`);
    console.log(`   Review failures before production deployment.`);
    process.exit(1);
  }
}

// Run the test suite
main().catch((error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
