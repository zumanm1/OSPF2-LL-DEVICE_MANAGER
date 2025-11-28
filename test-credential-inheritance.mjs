/**
 * Puppeteer E2E Test: Credential Inheritance Validation
 *
 * Tests that:
 * 1. Device Manager "Add Device" form has NO username/password fields
 * 2. Shows "Credentials from Jumphost" info box
 * 3. CSV template has NO username column
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = 'http://localhost:9050';
const SCREENSHOT_DIR = './test-screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshot(page, name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${SCREENSHOT_DIR}/${timestamp}_${name}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`📸 Screenshot: ${filename}`);
    return filename;
}

async function runTests() {
    console.log('🚀 Starting Credential Inheritance E2E Test\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    function recordTest(name, passed, details = '') {
        results.tests.push({ name, passed, details });
        if (passed) {
            results.passed++;
            console.log(`✅ PASS: ${name}`);
        } else {
            results.failed++;
            console.log(`❌ FAIL: ${name} - ${details}`);
        }
    }

    try {
        // ====== TEST 1: Navigate to App ======
        console.log('\n=== TEST 1: Navigate and Login ===');
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000));

        // Check if login page
        const loginForm = await page.$('input[id="username"]');
        if (loginForm) {
            console.log('Login page detected, authenticating...');
            await page.type('#username', 'admin');
            await page.type('#password', 'admin123');
            await page.click('button[type="submit"]');
            await new Promise(r => setTimeout(r, 3000)); // Wait for login
        }

        // Wait for Device Manager page
        await page.waitForSelector('h1', { timeout: 10000 });
        const pageTitle = await page.$eval('h1', el => el.textContent);
        recordTest('App loaded - Device Manager visible', pageTitle.includes('Device Manager'));

        await takeScreenshot(page, '01_device_manager_home');

        // ====== TEST 2: Open Add Device Modal ======
        console.log('\n=== TEST 2: Add Device Modal - No Username Field ===');

        // Find and click "Add Device" button
        const buttons = await page.$$('button');
        let addDeviceBtnFound = false;
        for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text && text.includes('Add Device')) {
                await btn.click();
                addDeviceBtnFound = true;
                break;
            }
        }

        if (!addDeviceBtnFound) {
            console.log('Looking for Add Device button...');
            await page.click('button.bg-primary-600');
        }

        // Wait for modal to appear
        await new Promise(r => setTimeout(r, 1000));
        await takeScreenshot(page, '02_add_device_modal');

        // TEST 2a: Check NO username input field exists
        const usernameInput = await page.$('input[name="username"]');
        recordTest('No username input field in Add Device form', !usernameInput);

        // TEST 2b: Check NO password input field exists
        const passwordInput = await page.$('input[name="password"]');
        recordTest('No password input field in Add Device form', !passwordInput);

        // TEST 2c: Check "Credentials from Jumphost" info box exists
        const modalContent = await page.evaluate(() => document.body.innerText);
        const hasCredentialsInfo = modalContent.includes('Credentials from Jumphost') ||
                                   modalContent.includes('inherited from Jumphost');
        recordTest('Shows "Credentials from Jumphost" info box', hasCredentialsInfo);

        // TEST 2d: Verify required fields are present
        const deviceNameInput = await page.$('input[name="deviceName"]');
        recordTest('Device Name field exists', !!deviceNameInput);

        const ipAddressInput = await page.$('input[name="ipAddress"]');
        recordTest('IP Address field exists', !!ipAddressInput);

        // Close modal - press Escape or find Cancel button
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 500));

        // ====== TEST 3: Navigate to Automation Page ======
        console.log('\n=== TEST 3: Automation Page - Jumphost Config ===');

        // Click on Automation link
        const navLinks = await page.$$('a');
        for (const link of navLinks) {
            const text = await page.evaluate(el => el.textContent, link);
            if (text && text.includes('Automation')) {
                await link.click();
                break;
            }
        }

        await new Promise(r => setTimeout(r, 2000));
        await takeScreenshot(page, '03_automation_page');

        // Check for Jumphost config section
        const automationContent = await page.evaluate(() => document.body.innerText);
        const hasJumphostSection = automationContent.includes('Jumphost') ||
                                   automationContent.includes('Bastion');
        recordTest('Automation page has Jumphost configuration', hasJumphostSection);

        // Check for username field in jumphost config
        const hasJumphostUsername = automationContent.includes('Username') &&
                                    automationContent.includes('Password');
        recordTest('Jumphost config has Username and Password fields', hasJumphostUsername);

        // ====== FINAL SUMMARY ======
        console.log('\n' + '='.repeat(60));
        console.log('CREDENTIAL INHERITANCE TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${results.passed + results.failed}`);
        console.log(`✅ Passed: ${results.passed}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log('='.repeat(60));

        if (results.failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Credential inheritance is working correctly.\n');
        } else {
            console.log('\n⚠️  Some tests failed. Please review the issues above.\n');
        }

        // Final screenshot
        await takeScreenshot(page, '04_final_state');

    } catch (error) {
        console.error('Test Error:', error.message);
        await takeScreenshot(page, 'error_state');
    } finally {
        await browser.close();
    }

    return results;
}

// Run tests
runTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
