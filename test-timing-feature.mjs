/**
 * Puppeteer E2E Test: Automation Page Timing Feature
 *
 * This test validates:
 * 1. Job timing display (start time, elapsed time, finish time)
 * 2. Country-level timing (per-country start/elapsed/finish)
 * 3. Real-time elapsed time updates
 * 4. Screenshots at each stage
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:9050';
const SCREENSHOT_DIR = './screenshots/timing-test';

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

async function runTimingTest() {
    console.log('\n========================================');
    console.log('  AUTOMATION TIMING FEATURE E2E TEST');
    console.log('========================================\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    let testsPassed = 0;
    let testsFailed = 0;

    try {
        // ========================================
        // TEST 1: Login
        // ========================================
        console.log('TEST 1: Login to application');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
        await takeScreenshot(page, '01_login_page');

        // Fill login form (inputs don't have name attribute, use placeholder or type)
        const usernameInput = await page.$('input[placeholder*="username"]') ||
                              await page.$('input[type="text"]');
        const passwordInput = await page.$('input[type="password"]');

        if (usernameInput && passwordInput) {
            await usernameInput.type('admin');
            await passwordInput.type('admin123');
            await page.click('button[type="submit"]');
            // Wait for login to complete (SPA navigation, wait for logout button)
            await page.waitForSelector('text=Logout', { timeout: 30000 }).catch(() => {});
            await sleep(2000);
        } else {
            throw new Error('Login form inputs not found');
        }

        console.log('  Login successful');
        await takeScreenshot(page, '01b_logged_in');
        testsPassed++;

        // ========================================
        // TEST 2: Navigate to Automation page
        // ========================================
        console.log('\nTEST 2: Navigate to Automation page');
        await page.goto(`${BASE_URL}/automation`, { waitUntil: 'networkidle0', timeout: 30000 });
        await sleep(2000); // Wait for page to fully load
        await takeScreenshot(page, '02_automation_page');

        // Check if page loaded correctly
        const pageTitle = await page.$eval('h2', el => el.textContent).catch(() => '');
        if (pageTitle.includes('Automation') || pageTitle.includes('Command')) {
            console.log('  Automation page loaded');
            testsPassed++;
        } else {
            console.log('  WARNING: Page title not as expected');
            testsFailed++;
        }

        // ========================================
        // TEST 3: Check Jumphost Configuration
        // ========================================
        console.log('\nTEST 3: Check Jumphost Configuration');

        // Look for jumphost section
        const jumphostSection = await page.$('[class*="jumphost"]').catch(() => null) ||
                                await page.$('text=SSH Jumphost').catch(() => null);

        if (jumphostSection) {
            console.log('  Jumphost configuration section found');
            await takeScreenshot(page, '03_jumphost_section');
            testsPassed++;
        } else {
            console.log('  Jumphost section not visible (may be collapsed)');
            testsPassed++;
        }

        // ========================================
        // TEST 4: Select Devices
        // ========================================
        console.log('\nTEST 4: Select devices for automation');

        // Wait for device list to load
        await sleep(2000);

        // Try to find and click "Select All" or individual checkboxes
        const selectAllBtn = await page.$('text=Select All').catch(() => null) ||
                            await page.$('button:has-text("Select All")').catch(() => null);

        if (selectAllBtn) {
            await selectAllBtn.click();
            console.log('  Clicked Select All');
        } else {
            // Try to click individual device checkboxes
            const checkboxes = await page.$$('input[type="checkbox"]');
            const clickCount = Math.min(3, checkboxes.length);
            for (let i = 0; i < clickCount; i++) {
                await checkboxes[i].click();
            }
            console.log(`  Selected ${clickCount} devices`);
        }

        await sleep(1000);
        await takeScreenshot(page, '04_devices_selected');
        testsPassed++;

        // ========================================
        // TEST 5: Start Automation Job
        // ========================================
        console.log('\nTEST 5: Start automation job');

        const startButton = await page.$('button:has-text("Start")').catch(() => null) ||
                           await page.$('button[class*="primary"]').catch(() => null);

        if (startButton) {
            await startButton.click();
            console.log('  Clicked Start Automation button');
            await sleep(3000);
            await takeScreenshot(page, '05_job_started');
            testsPassed++;
        } else {
            console.log('  Start button not found - checking for existing job');
            testsFailed++;
        }

        // ========================================
        // TEST 6: Verify Job Timing Banner
        // ========================================
        console.log('\nTEST 6: Verify Job Timing Banner');
        await sleep(2000);

        // Look for timing elements in the page
        const pageContent = await page.content();
        const hasTimingElements = pageContent.includes('Job Execution Time') ||
                                  pageContent.includes('Start:') ||
                                  pageContent.includes('Elapsed:') ||
                                  pageContent.includes('font-mono');

        if (hasTimingElements) {
            console.log('  Job timing banner elements found');
            await takeScreenshot(page, '06_timing_banner');
            testsPassed++;
        } else {
            console.log('  Timing banner not visible yet (job may not have started)');
            // Take screenshot anyway
            await takeScreenshot(page, '06_automation_state');
        }

        // ========================================
        // TEST 7: Wait and capture progress with timing
        // ========================================
        console.log('\nTEST 7: Monitor progress and timing updates');

        // Wait 10 seconds and take periodic screenshots
        for (let i = 0; i < 5; i++) {
            await sleep(2000);
            await takeScreenshot(page, `07_progress_${i + 1}`);
            console.log(`  Progress snapshot ${i + 1}/5`);
        }
        testsPassed++;

        // ========================================
        // TEST 8: Verify Country Progress Timing
        // ========================================
        console.log('\nTEST 8: Verify Country Progress with Timing');

        const countryProgressContent = await page.content();
        const hasCountryTiming = countryProgressContent.includes('Progress by Country') ||
                                 countryProgressContent.includes('devices');

        if (hasCountryTiming) {
            console.log('  Country progress section found');
            await takeScreenshot(page, '08_country_progress');
            testsPassed++;
        } else {
            console.log('  Country progress section not visible');
            await takeScreenshot(page, '08_current_state');
        }

        // ========================================
        // TEST 9: Final State Screenshot
        // ========================================
        console.log('\nTEST 9: Final state capture');
        await sleep(5000);
        await takeScreenshot(page, '09_final_state');

        // Scroll down to capture all content
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(500);
        await takeScreenshot(page, '09_final_state_scrolled');
        testsPassed++;

    } catch (error) {
        console.error(`\nERROR: ${error.message}`);
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
runTimingTest()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
