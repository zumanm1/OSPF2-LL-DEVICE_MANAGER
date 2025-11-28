#!/usr/bin/env node
/**
 * CRITICAL VALIDATION: Automation Flow End-to-End Test
 * 
 * This script validates the complete automation workflow:
 * 1. Login authentication
 * 2. Device selection
 * 3. Connection establishment (without jumphost)
 * 4. Automation job execution
 * 5. Real-time progress monitoring
 * 6. Job completion verification
 * 
 * Exit codes:
 * 0 = All tests passed
 * 1 = Test failed
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';
const SCREENSHOT_DIR = join(__dirname, 'validation-screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const error = (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`);
const success = (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`);

async function screenshot(page, name) {
    const path = join(SCREENSHOT_DIR, `${name}-${Date.now()}.png`);
    await page.screenshot({ path, fullPage: true });
    log(`Screenshot saved: ${path}`);
    return path;
}

async function waitForNetworkIdle(page, timeout = 5000) {
    try {
        await page.waitForNetworkIdle({ timeout, idleTime: 500 });
    } catch (e) {
        log('Network idle timeout (continuing anyway)');
    }
}

async function main() {
    let browser;
    let exitCode = 0;

    try {
        log('🚀 Starting Automation Flow Validation');
        log('=======================================');

        // Launch browser
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1920, height: 1080 }
        });

        const page = await browser.newPage();

        // Enable console logging
        page.on('console', msg => log(`[BROWSER] ${msg.text()}`));
        page.on('pageerror', err => error(`[PAGE ERROR] ${err.message}`));

        // ============================================
        // PHASE 1: Authentication
        // ============================================
        log('\n📝 PHASE 1: Authentication');
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 10000 });
        await screenshot(page, '01-login-page');

        // Check if already logged in or need to login
        const isLoginPage = await page.$('input[type="password"]');

        if (isLoginPage) {
            log('Login required - entering credentials');
            await page.type('input[type="text"]', 'admin');
            await page.type('input[type="password"]', 'admin123');
            await screenshot(page, '02-credentials-entered');

            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
            success('Login successful');
        } else {
            success('Already authenticated');
        }

        await screenshot(page, '03-dashboard');

        // ============================================
        // PHASE 2: Navigate to Automation Page
        // ============================================
        log('\n🔧 PHASE 2: Navigate to Automation');
        await page.goto(`${FRONTEND_URL}/automation`, { waitUntil: 'networkidle0', timeout: 10000 });
        await waitForNetworkIdle(page);
        await screenshot(page, '04-automation-page');
        success('Automation page loaded');

        // ============================================
        // PHASE 3: Verify Jumphost is Disabled
        // ============================================
        log('\n🔌 PHASE 3: Verify Jumphost Configuration');

        const jumphostSection = await page.$('text/SSH Jumphost');
        if (jumphostSection) {
            const jumphostText = await page.evaluate(() => document.body.innerText);
            if (jumphostText.includes('ENABLED')) {
                error('Jumphost is still ENABLED - this will cause connection failures!');
                await screenshot(page, '05-jumphost-enabled-ERROR');
                throw new Error('Jumphost must be disabled for local device connections');
            } else {
                success('Jumphost is disabled (correct configuration)');
            }
        }

        // ============================================
        // PHASE 4: Select All Devices
        // ============================================
        log('\n📋 PHASE 4: Select Devices');

        // Click "Select All" button
        const selectAllButton = await page.$x("//button[contains(text(), 'Select All')]");
        if (selectAllButton.length > 0) {
            await selectAllButton[0].click();
            await page.waitForTimeout(1000);
            success('All devices selected');
        } else {
            error('Select All button not found');
            await screenshot(page, '06-select-all-ERROR');
            throw new Error('Cannot find Select All button');
        }

        await screenshot(page, '07-devices-selected');

        // ============================================
        // PHASE 5: Start Automation (Skip Connect)
        // ============================================
        log('\n⚡ PHASE 5: Start Automation Job');
        log('Note: Using lazy connection - devices will connect on-demand');

        // Find and click "Start Automation" button
        const startButton = await page.$x("//button[contains(text(), 'Start Automation')]");
        if (startButton.length > 0) {
            await startButton[0].click();
            success('Start Automation clicked');
            await page.waitForTimeout(2000);
        } else {
            error('Start Automation button not found');
            await screenshot(page, '08-start-button-ERROR');
            throw new Error('Cannot find Start Automation button');
        }

        await screenshot(page, '09-automation-started');

        // ============================================
        // PHASE 6: Monitor Progress
        // ============================================
        log('\n📊 PHASE 6: Monitor Job Progress');

        let progressChecks = 0;
        const maxChecks = 60; // 60 seconds max
        let jobCompleted = false;

        while (progressChecks < maxChecks && !jobCompleted) {
            await page.waitForTimeout(1000);
            progressChecks++;

            const pageText = await page.evaluate(() => document.body.innerText);

            // Check for errors
            if (pageText.includes('Jumphost connection failed') ||
                pageText.includes('Network is unreachable')) {
                error('Jumphost error detected - configuration issue!');
                await screenshot(page, '10-jumphost-error-CRITICAL');
                throw new Error('Jumphost is interfering with connections');
            }

            // Check for connection status
            if (pageText.includes('connecting') || pageText.includes('Connecting')) {
                log(`Progress check ${progressChecks}: Devices connecting...`);
            }

            // Check for completion
            if (pageText.includes('completed') || pageText.includes('100%')) {
                jobCompleted = true;
                success('Job completed!');
                break;
            }

            // Log progress every 5 seconds
            if (progressChecks % 5 === 0) {
                log(`Progress check ${progressChecks}/${maxChecks}`);
                await screenshot(page, `11-progress-${progressChecks}`);
            }
        }

        if (!jobCompleted) {
            error('Job did not complete within timeout');
            await screenshot(page, '12-timeout-ERROR');
            throw new Error('Automation job timeout');
        }

        await screenshot(page, '13-job-completed');

        // ============================================
        // PHASE 7: Verify Results
        // ============================================
        log('\n✅ PHASE 7: Verify Results');

        const finalText = await page.evaluate(() => document.body.innerText);

        // Check for execution results
        if (finalText.includes('Execution Results')) {
            success('Execution results section found');
        }

        // Check for device results
        const deviceNames = [
            'deu-ber-bes-p06',
            'deu-ber-bes-pe10',
            'gbr-ldn-wst-p07',
            'gbr-ldn-wst-pe09',
            'usa-nyc-dc1-pe05',
            'usa-nyc-dc1-rr08',
            'zwe-bul-pop-p03',
            'zwe-bul-pop-p04',
            'zwe-hra-pop-p01',
            'zwe-hra-pop-p02'
        ];

        let devicesFound = 0;
        for (const deviceName of deviceNames) {
            if (finalText.includes(deviceName)) {
                devicesFound++;
            }
        }

        success(`Found ${devicesFound}/${deviceNames.length} devices in results`);

        if (devicesFound < deviceNames.length / 2) {
            error('Too few devices in results - possible execution issue');
            exitCode = 1;
        }

        await screenshot(page, '14-final-results');

        // ============================================
        // VALIDATION COMPLETE
        // ============================================
        log('\n' + '='.repeat(50));
        success('🎉 AUTOMATION FLOW VALIDATION COMPLETE');
        log('='.repeat(50));
        log(`Screenshots saved to: ${SCREENSHOT_DIR}`);

    } catch (err) {
        error(`Validation failed: ${err.message}`);
        error(err.stack);
        exitCode = 1;
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    process.exit(exitCode);
}

main();
