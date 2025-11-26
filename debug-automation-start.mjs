#!/usr/bin/env node
/**
 * DEBUG: Why is Start Automation failing?
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function debugAutomationStart() {
    console.log('🔍 Debugging Start Automation button...\n');

    const browser = await puppeteer.launch({
        headless: false, // Show browser to see what's happening
        args: ['--no-sandbox', '--window-size=1920,1080'],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // Capture console logs
    page.on('console', msg => {
        console.log(`BROWSER LOG [${msg.type()}]:`, msg.text());
    });

    // Capture errors
    page.on('pageerror', error => {
        console.error('BROWSER ERROR:', error.message);
    });

    // Capture network failures
    page.on('requestfailed', request => {
        console.error('REQUEST FAILED:', request.url(), request.failure().errorText);
    });

    // Capture responses
    page.on('response', async response => {
        const url = response.url();
        if (url.includes('/automation/jobs')) {
            console.log(`\n📡 API Response: ${url}`);
            console.log(`   Status: ${response.status()}`);
            try {
                const body = await response.json();
                console.log(`   Body:`, JSON.stringify(body, null, 2));
            } catch (e) {
                console.log(`   Body: [non-JSON]`);
            }
        }
    });

    try {
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
        await wait(2000);

        // Go to Automation page
        console.log('\n1. Navigating to Automation page...');
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text && text.includes('Automation')) {
                await btn.click();
                break;
            }
        }
        await wait(2000);
        console.log('✅ On Automation page');

        // Select a device
        console.log('\n2. Selecting first device...');
        const deviceCards = await page.$$('.cursor-pointer.border.rounded-xl');
        if (deviceCards.length > 0) {
            await deviceCards[0].click();
            await wait(500);
            console.log('✅ Device selected');
        }

        // Find and click Start Automation
        console.log('\n3. Looking for Start Automation button...');
        const allButtons = await page.$$('button');
        let startBtn = null;
        let buttonText = '';
        for (const btn of allButtons) {
            const text = await page.evaluate(el => el.textContent?.trim(), btn);
            if (text && text.includes('Start Automation')) {
                startBtn = btn;
                buttonText = text;
                break;
            }
        }

        if (startBtn) {
            console.log(`✅ Found button: "${buttonText}"`);
            console.log('   Clicking now...\n');
            await startBtn.click();
            await wait(5000);
        } else {
            console.error('❌ Start Automation button not found!');
        }

        console.log('\n4. Waiting 10 seconds to see what happens...');
        await wait(10000);

        console.log('\n✅ Debug session complete.');
        console.log('   Check console logs above for errors.\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    } finally {
        await browser.close();
    }
}

debugAutomationStart();
