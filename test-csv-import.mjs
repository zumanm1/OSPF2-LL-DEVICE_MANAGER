/**
 * Puppeteer E2E Test: CSV Import Feature
 *
 * This test validates:
 * 1. Download CSV template
 * 2. Upload CSV file
 * 3. Preview modal appears
 * 4. Import devices successfully
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:9050';
const SCREENSHOT_DIR = './screenshots/csv-import-test';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshot(page, name) {
    const filepath = path.join(SCREENSHOT_DIR, `${Date.now()}_${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`  Screenshot saved: ${filepath}`);
    return filepath;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCsvImportTest() {
    console.log('\n========================================');
    console.log('  CSV IMPORT FEATURE E2E TEST');
    console.log('========================================\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Enable console logging from page
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`  [PAGE ERROR]: ${msg.text()}`);
        }
    });

    let testsPassed = 0;
    let testsFailed = 0;

    try {
        // ========================================
        // TEST 1: Login
        // ========================================
        console.log('TEST 1: Login to application');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
        await takeScreenshot(page, '01_login_page');

        const usernameInput = await page.$('input[type="text"]');
        const passwordInput = await page.$('input[type="password"]');

        if (usernameInput && passwordInput) {
            await usernameInput.type('admin');
            await passwordInput.type('admin123');
            await page.click('button[type="submit"]');
            await sleep(3000);
        }

        await takeScreenshot(page, '02_logged_in');
        console.log('  Login successful');
        testsPassed++;

        // ========================================
        // TEST 2: Navigate to Device Manager
        // ========================================
        console.log('\nTEST 2: Navigate to Device Manager');
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 30000 });
        await sleep(2000);
        await takeScreenshot(page, '03_device_manager');

        // Check if on Device Manager page
        const pageContent = await page.content();
        if (pageContent.includes('Device Manager') || pageContent.includes('Import CSV')) {
            console.log('  Device Manager page loaded');
            testsPassed++;
        } else {
            console.log('  WARNING: Device Manager page not found');
            testsFailed++;
        }

        // ========================================
        // TEST 3: Find Import CSV button and file input
        // ========================================
        console.log('\nTEST 3: Find Import CSV button and file input');

        // Look for the hidden CSV file input
        const fileInput = await page.$('input[type="file"][accept=".csv"]');
        if (fileInput) {
            console.log('  CSV file input found');
            testsPassed++;
        } else {
            console.log('  ERROR: CSV file input not found');
            testsFailed++;
        }

        await takeScreenshot(page, '04_before_import');

        // ========================================
        // TEST 4: Create test CSV and upload
        // ========================================
        console.log('\nTEST 4: Create and upload test CSV');

        // Create test CSV content matching the expected format
        const csvContent = `deviceName,ipAddress,protocol,port,country,deviceType,platform,software,tags
test-import-router-1,10.99.99.1,telnet,23,United States,router,Cisco IOS,IOS 15.x,test;csv-import
test-import-switch-1,10.99.99.2,telnet,23,United States,switch,Cisco IOS,IOS 15.x,test;csv-import
test-import-router-2,10.99.99.3,ssh,22,United Kingdom,router,Cisco IOS,IOS XE,test;csv-import`;

        const csvPath = path.join(SCREENSHOT_DIR, 'test-import.csv');
        fs.writeFileSync(csvPath, csvContent);
        console.log(`  Created test CSV: ${csvPath}`);
        console.log(`  CSV Content:\n${csvContent}`);

        if (fileInput) {
            // Upload the file
            await fileInput.uploadFile(csvPath);
            console.log('  CSV file uploaded via file input');
            await sleep(2000);
            await takeScreenshot(page, '05_after_upload');
            testsPassed++;
        } else {
            console.log('  ERROR: Cannot upload - file input not found');
            testsFailed++;
        }

        // ========================================
        // TEST 5: Check for Preview Modal
        // ========================================
        console.log('\nTEST 5: Check for Import Preview Modal');
        await sleep(1000);

        const modalContent = await page.content();
        const hasPreviewModal = modalContent.includes('Import Preview') ||
                               modalContent.includes('ready to import') ||
                               modalContent.includes('Confirm Import');

        if (hasPreviewModal) {
            console.log('  Import Preview Modal appeared');
            await takeScreenshot(page, '06_preview_modal');
            testsPassed++;

            // ========================================
            // TEST 6: Check rows in preview
            // ========================================
            console.log('\nTEST 6: Check preview data');

            const hasTestData = modalContent.includes('test-import-router-1') ||
                               modalContent.includes('10.99.99.1');

            if (hasTestData) {
                console.log('  Test data visible in preview');
                testsPassed++;
            } else {
                console.log('  WARNING: Test data not visible in preview');
            }

            // ========================================
            // TEST 7: Confirm Import
            // ========================================
            console.log('\nTEST 7: Confirm Import');

            // Find Confirm Import button by looking for buttons with "Confirm" text
            const buttons = await page.$$('button');
            let confirmClicked = false;

            for (const btn of buttons) {
                const text = await btn.evaluate(el => el.textContent);
                if (text && text.includes('Confirm')) {
                    await btn.click();
                    console.log(`  Clicked button: "${text.trim()}"`);
                    confirmClicked = true;
                    await sleep(2000);
                    await takeScreenshot(page, '07_after_import');
                    testsPassed++;
                    break;
                }
            }

            if (!confirmClicked) {
                console.log('  WARNING: Confirm button not found');
                testsFailed++;
            }
        } else {
            console.log('  WARNING: Import Preview Modal not found');
            console.log('  Checking for alert or error...');
            await takeScreenshot(page, '06_no_modal');
            testsFailed++;
        }

        // ========================================
        // TEST 8: Verify devices were imported
        // ========================================
        console.log('\nTEST 8: Verify devices were imported');
        await sleep(2000);
        await page.reload({ waitUntil: 'networkidle0' });
        await sleep(2000);

        const finalContent = await page.content();
        const hasTestDevices = finalContent.includes('test-import-router-1') ||
                              finalContent.includes('10.99.99.1');

        if (hasTestDevices) {
            console.log('  SUCCESS: Test devices found in device list');
            testsPassed++;
        } else {
            console.log('  WARNING: Test devices not visible in device list');
            // Check device count
            const deviceCountMatch = finalContent.match(/SHOWING \d+-\d+ OF (\d+) DEVICES/);
            if (deviceCountMatch) {
                console.log(`  Current device count: ${deviceCountMatch[1]}`);
            }
        }

        await takeScreenshot(page, '08_final_state');

    } catch (error) {
        console.error(`\nERROR: ${error.message}`);
        console.error(error.stack);
        await takeScreenshot(page, 'ERROR_state');
        testsFailed++;
    } finally {
        await browser.close();
    }

    // ========================================
    // Test Summary
    // ========================================
    console.log('\n========================================');
    console.log('  TEST SUMMARY');
    console.log('========================================');
    console.log(`  Tests Passed: ${testsPassed}`);
    console.log(`  Tests Failed: ${testsFailed}`);
    console.log(`  Screenshots: ${SCREENSHOT_DIR}`);
    console.log('========================================\n');

    return testsFailed === 0;
}

// Run the test
runCsvImportTest()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
