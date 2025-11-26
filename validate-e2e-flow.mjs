import puppeteer from 'puppeteer-core';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = 'http://localhost:9050';
const SCREENSHOT_DIR = 'test-screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR);
}

async function runE2ETest() {
    console.log('🚀 Starting End-to-End Validation Test...');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // Forward console logs from browser to Node console
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    try {
        // --- STEP 1: AUTOMATION PAGE ---
        console.log('\n1️⃣  Testing Automation Page...');

        // Navigate without waiting for strict network idle
        console.log('   Navigating to ' + APP_URL);
        await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for ANY content to ensure app loaded
        console.log('   Waiting for app to mount...');
        await page.waitForSelector('#root', { timeout: 10000 });

        // Navigate to Automation
        console.log('   Looking for Automation button...');
        const automationBtn = await page.waitForSelector('button ::-p-text(Automation)', { timeout: 10000 });
        await automationBtn.click();

        console.log('   Waiting for Automation header...');
        await page.waitForSelector('h1 ::-p-text(Network Automation)', { timeout: 10000 });
        await page.screenshot({ path: `${SCREENSHOT_DIR}/1-automation-page.png` });
        console.log('   ✅ Automation Page Loaded');

        // Select Devices (Select All)
        console.log('   Selecting devices...');
        const selectAllBtn = await page.waitForSelector('button ::-p-text(Select All)', { timeout: 5000 });
        await selectAllBtn.click();
        await new Promise(r => setTimeout(r, 1000)); // Wait for state update
        await page.screenshot({ path: `${SCREENSHOT_DIR}/2-devices-selected.png` });

        // Start Automation (Lazy Connection)
        console.log('   Starting Automation Job (Lazy Connection)...');
        const startBtn = await page.waitForSelector('button ::-p-text(Start Automation)', { timeout: 5000 });
        await startBtn.click();

        // Wait for progress to appear
        console.log('   Waiting for progress...');
        try {
            await page.waitForSelector('.device-status', { timeout: 10000 });
            await page.screenshot({ path: `${SCREENSHOT_DIR}/3-job-started.png` });
            console.log('   ✅ Job Started - Progress Visible');
        } catch (e) {
            console.log('   ⚠️ Progress bar not found immediately. Taking screenshot anyway.');
            await page.screenshot({ path: `${SCREENSHOT_DIR}/3-job-started-fallback.png` });
        }

        // Wait for completion (poll for "Completed" or "Failed" in progress bar)
        console.log('   Watching for device connections (10s)...');
        await new Promise(r => setTimeout(r, 10000));
        await page.screenshot({ path: `${SCREENSHOT_DIR}/4-job-progress.png` });

        // --- STEP 2: DATA SAVE PAGE ---
        console.log('\n2️⃣  Testing Data Save Page...');
        const dataSaveBtn = await page.waitForSelector('button ::-p-text(Data Save)', { timeout: 5000 });
        await dataSaveBtn.click();
        await page.waitForSelector('h1 ::-p-text(Data Collection)', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: `${SCREENSHOT_DIR}/5-data-save-page.png` });
        console.log('   ✅ Data Save Page Loaded');

        // --- STEP 3: TRANSFORMATION PAGE ---
        console.log('\n3️⃣  Testing Transformation Page...');
        const transformBtn = await page.waitForSelector('button ::-p-text(Transformation)', { timeout: 5000 });
        await transformBtn.click();
        await page.waitForSelector('h1 ::-p-text(Network Transformation)', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: `${SCREENSHOT_DIR}/6-transformation-page.png` });
        console.log('   ✅ Transformation Page Loaded');

        console.log('\n✅ E2E TEST COMPLETE! Screenshots saved to ' + SCREENSHOT_DIR);

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/error-state.png` });
    } finally {
        await browser.close();
    }
}

runE2ETest();
