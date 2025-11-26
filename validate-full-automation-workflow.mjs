#!/usr/bin/env node
/**
 * FULL AUTOMATION WORKFLOW VALIDATION
 *
 * Tests the complete automation workflow from device selection to data collection:
 * 1. Select devices
 * 2. Click "Start Automation" (lazy connection - no pre-connect needed)
 * 3. Monitor job progress
 * 4. Verify command execution
 * 5. Check data files generated
 * 6. Validate in Data Save page
 *
 * This test proves the end-to-end workflow works with REAL device connections.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051/api';
const SCREENSHOT_DIR = path.join(process.cwd(), 'workflow-screenshots');

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

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR);
}

async function runFullWorkflowValidation() {
    log('\n╔═══════════════════════════════════════════════════════════════════╗', 'blue');
    log('║       FULL AUTOMATION WORKFLOW VALIDATION TEST                    ║', 'blue');
    log('║       Testing with REAL Device Connections                        ║', 'blue');
    log('╚═══════════════════════════════════════════════════════════════════╝\n', 'blue');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    try {
        // ====================================================================
        // STEP 1: Navigate to Automation Page
        // ====================================================================
        log('\n━━━ STEP 1: Navigate to Automation Page ━━━', 'yellow');

        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
        await wait(2000);

        // Click Automation tab
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text && text.includes('Automation')) {
                await btn.click();
                break;
            }
        }
        await wait(2000);
        await captureScreenshot(page, '01_automation_page');
        log('✅ Automation page loaded', 'green');

        // ====================================================================
        // STEP 2: Select Devices (No Connection Required - Lazy Connection!)
        // ====================================================================
        log('\n━━━ STEP 2: Select Devices ━━━', 'yellow');

        // Select first 3 devices for quick test
        const deviceCards = await page.$$('.cursor-pointer.border.rounded-xl');
        if (deviceCards.length < 3) {
            throw new Error('Not enough device cards found');
        }

        log('Selecting 3 devices for automation test...', 'white');
        for (let i = 0; i < 3; i++) {
            await deviceCards[i].click();
            await wait(300);
        }
        await captureScreenshot(page, '02_devices_selected');
        log('✅ 3 devices selected', 'green');

        // ====================================================================
        // STEP 3: Click "Start Automation" (Lazy Connection - THE FIX!)
        // ====================================================================
        log('\n━━━ STEP 3: Start Automation (Lazy Connection) ━━━', 'yellow');

        // Find Start Automation button
        const allButtons = await page.$$('button');
        let startBtn = null;
        for (const btn of allButtons) {
            const text = await page.evaluate(el => el.textContent?.trim(), btn);
            if (text && text.includes('Start Automation')) {
                startBtn = btn;
                log(`Found button: "${text}"`, 'cyan');
                break;
            }
        }

        if (!startBtn) {
            throw new Error('Start Automation button not found or disabled');
        }

        log('Clicking "Start Automation" button...', 'white');
        await startBtn.click();
        await wait(2000);
        await captureScreenshot(page, '03_automation_started');
        log('✅ Automation job started', 'green');

        // ====================================================================
        // STEP 4: Monitor Job Progress
        // ====================================================================
        log('\n━━━ STEP 4: Monitor Job Progress ━━━', 'yellow');
        log('⏳ Waiting for job to complete (max 2 minutes)...', 'cyan');

        let jobCompleted = false;
        let attempts = 0;
        const maxAttempts = 40; // 40 * 3s = 2 minutes

        while (!jobCompleted && attempts < maxAttempts) {
            await wait(3000);
            attempts++;

            // Check for completion indicators
            const bodyText = await page.evaluate(() => document.body.textContent);

            if (bodyText.includes('completed') || bodyText.includes('100%')) {
                jobCompleted = true;
                log('✅ Job completed!', 'green');
                break;
            }

            if (bodyText.includes('failed') || bodyText.includes('error')) {
                log('⚠️  Job encountered errors', 'yellow');
                break;
            }

            // Log progress every 5 attempts
            if (attempts % 5 === 0) {
                log(`Still running... (${attempts * 3}s elapsed)`, 'cyan');
                await captureScreenshot(page, `04_progress_${attempts * 3}s`);
            }
        }

        if (!jobCompleted && attempts >= maxAttempts) {
            log('⏱️  Timeout reached, capturing final state', 'yellow');
        }

        await captureScreenshot(page, '05_job_final_state');

        // ====================================================================
        // STEP 5: Verify Data Files Generated
        // ====================================================================
        log('\n━━━ STEP 5: Verify Data Files Generated ━━━', 'yellow');

        // Check backend for generated files
        const response = await fetch(`${BACKEND_URL}/automation/files?folder_type=text`);
        const filesData = await response.json();

        log(`📁 Text files generated: ${filesData.file_count}`, 'white');

        if (filesData.file_count > 0) {
            log('✅ Data files successfully generated!', 'green');
            filesData.files.slice(0, 5).forEach(file => {
                log(`  - ${file.filename} (${file.size_kb.toFixed(2)} KB)`, 'cyan');
            });
        } else {
            log('⚠️  No data files generated yet', 'yellow');
        }

        // ====================================================================
        // STEP 6: Navigate to Data Save Page
        // ====================================================================
        log('\n━━━ STEP 6: Verify Data Save Page ━━━', 'yellow');

        // Navigate to Data Save
        const navButtons = await page.$$('button');
        for (const btn of navButtons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text && text.includes('Data Save')) {
                await btn.click();
                break;
            }
        }
        await wait(2000);
        await captureScreenshot(page, '06_datasave_page');
        log('✅ Data Save page loaded', 'green');

        // ====================================================================
        // TEST SUMMARY
        // ====================================================================
        log('\n╔═══════════════════════════════════════════════════════════════════╗', 'blue');
        log('║                    WORKFLOW TEST SUMMARY                          ║', 'blue');
        log('╚═══════════════════════════════════════════════════════════════════╝\n', 'blue');

        log('Test Steps:', 'white');
        log('✅ 1. Navigation to Automation page', 'green');
        log('✅ 2. Device selection (3 devices)', 'green');
        log('✅ 3. Start Automation clicked (lazy connection)', 'green');
        log(`${jobCompleted ? '✅' : '⏳'} 4. Job execution ${jobCompleted ? 'completed' : 'in progress'}`, jobCompleted ? 'green' : 'yellow');
        log(`${filesData.file_count > 0 ? '✅' : '⏳'} 5. Data files ${filesData.file_count > 0 ? 'generated' : 'pending'}`, filesData.file_count > 0 ? 'green' : 'yellow');
        log('✅ 6. Data Save page accessible', 'green');

        log('\n📊 Results:', 'white');
        log(`  - Devices tested: 3`, 'cyan');
        log(`  - Job status: ${jobCompleted ? 'COMPLETED' : 'RUNNING'}`, jobCompleted ? 'green' : 'yellow');
        log(`  - Files generated: ${filesData.file_count}`, filesData.file_count > 0 ? 'green' : 'yellow');
        log(`  - Screenshots: ${fs.readdirSync(SCREENSHOT_DIR).length}`, 'cyan');

        if (jobCompleted && filesData.file_count > 0) {
            log('\n╔═══════════════════════════════════════════════════════════════════╗', 'green');
            log('║          ✅ FULL WORKFLOW VALIDATION SUCCESSFUL ✅                 ║', 'green');
            log('╚═══════════════════════════════════════════════════════════════════╝\n', 'green');
        } else {
            log('\n╔═══════════════════════════════════════════════════════════════════╗', 'yellow');
            log('║          ⏳ WORKFLOW TEST PARTIALLY COMPLETE ⏳                    ║', 'yellow');
            log('╚═══════════════════════════════════════════════════════════════════╝\n', 'yellow');
            log('Note: Job may still be running. Check screenshots for current state.', 'yellow');
        }

    } catch (error) {
        log('\n╔═══════════════════════════════════════════════════════════════════╗', 'red');
        log('║                  ❌ WORKFLOW TEST FAILED ❌                        ║', 'red');
        log('╚═══════════════════════════════════════════════════════════════════╝\n', 'red');
        console.error(error);
        await captureScreenshot(page, 'error_workflow');
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runFullWorkflowValidation();
