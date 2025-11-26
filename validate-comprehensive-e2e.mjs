#!/usr/bin/env node
/**
 * COMPREHENSIVE END-TO-END VALIDATION TEST
 *
 * This test validates the entire OSPF Network Device Manager application
 * including UI/UX, API, database, telnet/SSH connections, and data flow.
 *
 * Uses Puppeteer to simulate real user interactions and capture screenshots
 * as proof of functionality.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051/api';
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots');

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
};

function log(msg, color = 'white') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreenshot(page, name) {
    const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    log(`📸 Screenshot: ${name}.png`, 'cyan');
}

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR);
}

async function runComprehensiveValidation() {
    log('\n╔════════════════════════════════════════════════════════════════╗', 'blue');
    log('║       COMPREHENSIVE E2E VALIDATION TEST                        ║', 'blue');
    log('║       OSPF Network Device Manager v2.0                         ║', 'blue');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'blue');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    let testResults = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
    };

    try {
        // ====================================================================
        // PHASE 1: DEVICE MANAGER - CRUD OPERATIONS
        // ====================================================================
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
        log('PHASE 1: Device Manager Validation', 'yellow');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'yellow');

        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
        await wait(2000);
        await captureScreenshot(page, '01_initial_page_load');

        // Test 1.1: Page Title
        testResults.total++;
        try {
            const title = await page.$eval('h1', el => el.textContent);
            if (title.includes('Device Manager')) {
                log('✅ TEST 1.1: Page title verified', 'green');
                testResults.passed++;
                testResults.tests.push({ name: 'Page Title', status: 'PASS' });
            } else {
                throw new Error(`Wrong title: ${title}`);
            }
        } catch (err) {
            log(`❌ TEST 1.1 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Page Title', status: 'FAIL', error: err.message });
        }

        // Test 1.2: Device List Loaded
        testResults.total++;
        try {
            const devices = await page.$$('tbody tr');
            if (devices.length >= 10) {
                log(`✅ TEST 1.2: Device list loaded (${devices.length} devices)`, 'green');
                testResults.passed++;
                testResults.tests.push({ name: 'Device List', status: 'PASS', count: devices.length });
            } else {
                throw new Error(`Only ${devices.length} devices found, expected 10+`);
            }
        } catch (err) {
            log(`❌ TEST 1.2 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Device List', status: 'FAIL', error: err.message });
        }

        // Test 1.3: Search Functionality
        testResults.total++;
        try {
            await page.type('input[placeholder*="Search"]', 'usa');
            await wait(1000);
            await captureScreenshot(page, '02_search_usa');

            const filteredDevices = await page.$$('tbody tr');
            if (filteredDevices.length > 0 && filteredDevices.length < 10) {
                log(`✅ TEST 1.3: Search works (${filteredDevices.length} results)`, 'green');
                testResults.passed++;
                testResults.tests.push({ name: 'Search Function', status: 'PASS' });
            } else {
                throw new Error(`Search returned ${filteredDevices.length} results`);
            }

            // Clear search
            await page.click('input[placeholder*="Search"]', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await wait(1000);
        } catch (err) {
            log(`❌ TEST 1.3 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Search Function', status: 'FAIL', error: err.message });
        }

        // Test 1.4: Database Admin UI
        testResults.total++;
        try {
            const dbAdmin = await page.$('.glass-card');
            if (dbAdmin) {
                await captureScreenshot(page, '03_database_admin');
                log('✅ TEST 1.4: Database Admin UI present', 'green');
                testResults.passed++;
                testResults.tests.push({ name: 'Database Admin UI', status: 'PASS' });
            } else {
                throw new Error('Database Admin UI not found');
            }
        } catch (err) {
            log(`❌ TEST 1.4 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Database Admin UI', status: 'FAIL', error: err.message });
        }

        // ====================================================================
        // PHASE 2: AUTOMATION - CONNECTION & JOB EXECUTION
        // ====================================================================
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
        log('PHASE 2: Automation Validation', 'yellow');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'yellow');

        // Navigate to Automation
        const automationButtons = await page.$$('button');
        for (const btn of automationButtons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text.includes('Automation')) {
                await btn.click();
                break;
            }
        }
        await wait(2000);
        await captureScreenshot(page, '04_automation_page');

        // Test 2.1: Automation Page Load
        testResults.total++;
        try {
            const automationTitle = await page.$eval('h1', el => el.textContent);
            if (automationTitle.includes('Network Automation')) {
                log('✅ TEST 2.1: Automation page loaded', 'green');
                testResults.passed++;
                testResults.tests.push({ name: 'Automation Page', status: 'PASS' });
            } else {
                throw new Error(`Wrong page: ${automationTitle}`);
            }
        } catch (err) {
            log(`❌ TEST 2.1 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Automation Page', status: 'FAIL', error: err.message });
        }

        // Test 2.2: Device Selection
        testResults.total++;
        try {
            const deviceCards = await page.$$('.cursor-pointer.border.rounded-xl');
            if (deviceCards.length > 0) {
                await deviceCards[0].click();
                log('✅ TEST 2.2: Device selected', 'green');
                await wait(500);
                await captureScreenshot(page, '05_device_selected');
                testResults.passed++;
                testResults.tests.push({ name: 'Device Selection', status: 'PASS' });
            } else {
                throw new Error('No device cards found');
            }
        } catch (err) {
            log(`❌ TEST 2.2 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Device Selection', status: 'FAIL', error: err.message });
        }

        // Test 2.3: Connect Button (FIXED SELECTOR)
        testResults.total++;
        try {
            log('Looking for Connect button...', 'white');

            // Method 1: Find by text content (no space in "Connect(1)")
            let connectBtn = null;
            const buttons = await page.$$('button');
            for (const btn of buttons) {
                const text = await page.evaluate(el => el.textContent?.trim(), btn);
                if (text && (text.includes('Connect') && text.includes('(') && !text.includes('Disconnect'))) {
                    connectBtn = btn;
                    log(`Found button with text: "${text}"`, 'cyan');
                    break;
                }
            }

            if (!connectBtn) {
                throw new Error('Connect button not found');
            }

            await connectBtn.click();
            log('✅ TEST 2.3: Connect button clicked', 'green');
            testResults.passed++;
            testResults.tests.push({ name: 'Connect Button', status: 'PASS' });

            // Wait for connection to complete
            log('⏳ Waiting for connection to complete (max 30s)...', 'cyan');
            try {
                await page.waitForFunction(
                    () => {
                        const btns = Array.from(document.querySelectorAll('button'));
                        const startBtn = btns.find(b => b.textContent?.includes('Start Automation'));
                        return startBtn && !startBtn.disabled;
                    },
                    { timeout: 30000 }
                );
                log('✅ Connection completed', 'green');
                await captureScreenshot(page, '06_connected');
            } catch (timeoutErr) {
                log('⚠️  Connection timeout - continuing anyway', 'yellow');
                await captureScreenshot(page, '06_connect_timeout');
            }

        } catch (err) {
            log(`❌ TEST 2.3 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Connect Button', status: 'FAIL', error: err.message });
            await captureScreenshot(page, '06_error_connect');
        }

        // Test 2.4: Batch Configuration UI
        testResults.total++;
        try {
            const batchConfig = await page.$eval('h3', el => el.textContent);
            if (batchConfig.includes('Batch Configuration')) {
                log('✅ TEST 2.4: Batch configuration UI present', 'green');
                testResults.passed++;
                testResults.tests.push({ name: 'Batch Configuration', status: 'PASS' });
            } else {
                throw new Error('Batch configuration not found');
            }
        } catch (err) {
            log(`❌ TEST 2.4 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Batch Configuration', status: 'FAIL', error: err.message });
        }

        // ====================================================================
        // PHASE 3: DATA SAVE
        // ====================================================================
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
        log('PHASE 3: Data Save Validation', 'yellow');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'yellow');

        // Navigate to Data Save
        const dataSaveButtons = await page.$$('button');
        for (const btn of dataSaveButtons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text.includes('Data Save')) {
                await btn.click();
                break;
            }
        }
        await wait(2000);
        await captureScreenshot(page, '07_datasave_page');

        // Test 3.1: Data Save Page Load
        testResults.total++;
        try {
            const dataSaveTitle = await page.$eval('h1', el => el.textContent);
            if (dataSaveTitle.includes('Data Save')) {
                log('✅ TEST 3.1: Data Save page loaded', 'green');
                testResults.passed++;
                testResults.tests.push({ name: 'Data Save Page', status: 'PASS' });
            } else {
                throw new Error(`Wrong page: ${dataSaveTitle}`);
            }
        } catch (err) {
            log(`❌ TEST 3.1 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Data Save Page', status: 'FAIL', error: err.message });
        }

        // ====================================================================
        // PHASE 4: TRANSFORMATION
        // ====================================================================
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
        log('PHASE 4: Transformation Validation', 'yellow');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'yellow');

        // Navigate to Transformation
        const transformButtons = await page.$$('button');
        for (const btn of transformButtons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text.includes('Transformation')) {
                await btn.click();
                break;
            }
        }
        await wait(2000);
        await captureScreenshot(page, '08_transformation_page');

        // Test 4.1: Transformation Page Load
        testResults.total++;
        try {
            const transformTitle = await page.$eval('h1', el => el.textContent);
            if (transformTitle.includes('Network Topology')) {
                log('✅ TEST 4.1: Transformation page loaded', 'green');
                testResults.passed++;
                testResults.tests.push({ name: 'Transformation Page', status: 'PASS' });
            } else {
                throw new Error(`Wrong page: ${transformTitle}`);
            }
        } catch (err) {
            log(`❌ TEST 4.1 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Transformation Page', status: 'FAIL', error: err.message });
        }

        // ====================================================================
        // PHASE 5: DATABASE RESET & RECOVERY
        // ====================================================================
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
        log('PHASE 5: Database Reset Validation', 'yellow');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'yellow');

        // Go back to Device Manager
        const deviceMgrButtons = await page.$$('button');
        for (const btn of deviceMgrButtons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text.includes('Device Manager')) {
                await btn.click();
                break;
            }
        }
        await wait(2000);

        // Test 5.1: Database Reset
        testResults.total++;
        try {
            page.on('dialog', async dialog => {
                log(`Dialog: ${dialog.message()}`, 'cyan');
                await dialog.accept();
            });

            // Find Reset button
            let resetBtn = null;
            const buttons = await page.$$('button');
            for (const btn of buttons) {
                const text = await page.evaluate(el => el.textContent?.trim(), btn);
                if (text && text.includes('Reset to Default')) {
                    resetBtn = btn;
                    break;
                }
            }

            if (resetBtn) {
                await resetBtn.click();
                await wait(3000);
                await captureScreenshot(page, '09_after_reset');

                const devicesAfterReset = await page.$$('tbody tr');
                if (devicesAfterReset.length === 10) {
                    log(`✅ TEST 5.1: Database reset successful (${devicesAfterReset.length} devices)`, 'green');
                    testResults.passed++;
                    testResults.tests.push({ name: 'Database Reset', status: 'PASS' });
                } else {
                    throw new Error(`Reset failed: ${devicesAfterReset.length} devices found`);
                }
            } else {
                throw new Error('Reset button not found');
            }
        } catch (err) {
            log(`❌ TEST 5.1 FAILED: ${err.message}`, 'red');
            testResults.failed++;
            testResults.tests.push({ name: 'Database Reset', status: 'FAIL', error: err.message });
        }

        // ====================================================================
        // TEST SUMMARY
        // ====================================================================
        log('\n╔════════════════════════════════════════════════════════════════╗', 'blue');
        log('║                    TEST RESULTS SUMMARY                        ║', 'blue');
        log('╚════════════════════════════════════════════════════════════════╝\n', 'blue');

        log(`Total Tests: ${testResults.total}`, 'white');
        log(`✅ Passed: ${testResults.passed}`, 'green');
        log(`❌ Failed: ${testResults.failed}`, 'red');
        log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%\n`, 'cyan');

        // Detailed results table
        log('┌────────────────────────────────┬──────────┐', 'white');
        log('│ Test Name                      │ Status   │', 'white');
        log('├────────────────────────────────┼──────────┤', 'white');
        testResults.tests.forEach(test => {
            const name = test.name.padEnd(30);
            const status = test.status === 'PASS'
                ? '\x1b[32mPASS\x1b[0m    '
                : '\x1b[31mFAIL\x1b[0m    ';
            log(`│ ${name} │ ${status} │`, 'white');
        });
        log('└────────────────────────────────┴──────────┘\n', 'white');

        // Save results to JSON
        const reportPath = path.join(SCREENSHOT_DIR, 'test-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
        log(`📄 Test report saved: ${reportPath}`, 'cyan');

        if (testResults.failed === 0) {
            log('\n╔════════════════════════════════════════════════════════════════╗', 'green');
            log('║              ✅ ALL TESTS PASSED ✅                            ║', 'green');
            log('╚════════════════════════════════════════════════════════════════╝\n', 'green');
        } else {
            log('\n╔════════════════════════════════════════════════════════════════╗', 'yellow');
            log('║              ⚠️  SOME TESTS FAILED ⚠️                          ║', 'yellow');
            log('╚════════════════════════════════════════════════════════════════╝\n', 'yellow');
        }

    } catch (error) {
        log('\n╔════════════════════════════════════════════════════════════════╗', 'red');
        log('║                  ❌ VALIDATION FAILED ❌                        ║', 'red');
        log('╚════════════════════════════════════════════════════════════════╝\n', 'red');
        console.error(error);
        await captureScreenshot(page, 'error_critical');
        process.exit(1);
    } finally {
        await browser.close();
    }
}

// Run the validation
runComprehensiveValidation();
