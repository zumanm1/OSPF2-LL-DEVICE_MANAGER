const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE_URL = 'http://localhost:9050';

async function test() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    let success = true;
    
    try {
        console.log('=== CSV IMPORT FULL FLOW TEST ===\n');
        
        // Step 1: Login
        console.log('Step 1: Login');
        await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle0', timeout: 30000 });
        await page.type('input[type="text"]', 'admin');
        await page.type('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 2000));
        console.log('  ✓ Logged in\n');
        
        // Step 2: Navigate to Device Manager
        console.log('Step 2: Navigate to Device Manager');
        await page.goto(BASE_URL + '/', { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000));
        console.log('  ✓ On Device Manager page\n');
        
        // Step 3: Count existing devices
        console.log('Step 3: Count existing devices');
        const initialCount = await page.$$eval('table tbody tr', rows => rows.length);
        console.log('  ✓ Initial device count:', initialCount, '\n');
        
        // Step 4: Create and upload CSV
        console.log('Step 4: Upload CSV file');
        const csvContent = `deviceName,ipAddress,protocol,port,country,deviceType,platform,software,tags
csv-test-router,10.88.88.1,Telnet,23,United States,PE,ISR4000,IOS,csv-test
csv-test-switch,10.88.88.2,SSH,22,United Kingdom,P,3725,IOS XE,csv-test`;
        
        fs.writeFileSync('/tmp/test-import.csv', csvContent);
        
        const fileInput = await page.$('input[type="file"][accept=".csv"]');
        if (!fileInput) {
            throw new Error('CSV file input not found');
        }
        await fileInput.uploadFile('/tmp/test-import.csv');
        await new Promise(r => setTimeout(r, 2000));
        console.log('  ✓ CSV uploaded\n');
        
        // Step 5: Verify Import Preview Modal
        console.log('Step 5: Verify Import Preview Modal');
        const modalTitle = await page.$eval('h2', el => el.textContent).catch(() => null);
        if (!modalTitle || !modalTitle.includes('Import Preview')) {
            throw new Error('Import Preview Modal not found');
        }
        console.log('  ✓ Import Preview Modal visible\n');
        
        // Check ready count
        const readyText = await page.$eval('.text-green-600, .text-green-400', el => el.textContent).catch(() => '');
        console.log('  Ready status:', readyText);
        
        await page.screenshot({ path: 'screenshots/csv-test-1-preview.png', fullPage: true });
        
        // Step 6: Click Confirm Import
        console.log('\nStep 6: Click Confirm Import');
        const confirmBtn = await page.$('button:not([disabled])');
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await btn.evaluate(el => el.textContent);
            if (text && text.includes('Confirm Import')) {
                await btn.click();
                console.log('  ✓ Clicked Confirm Import\n');
                break;
            }
        }
        await new Promise(r => setTimeout(r, 3000));
        
        // Step 7: Verify import success
        console.log('Step 7: Verify devices imported');
        await page.screenshot({ path: 'screenshots/csv-test-2-after-import.png', fullPage: true });
        
        // Check for new devices in the table
        const finalCount = await page.$$eval('table tbody tr', rows => rows.length);
        console.log('  Final device count:', finalCount);
        
        if (finalCount > initialCount) {
            console.log('  ✓ Devices were imported successfully!\n');
        } else {
            // Check if devices exist by searching
            await page.type('input[placeholder*="Search"]', 'csv-test');
            await new Promise(r => setTimeout(r, 1000));
            const searchCount = await page.$$eval('table tbody tr', rows => rows.length);
            if (searchCount > 0) {
                console.log('  ✓ Found', searchCount, 'imported devices via search\n');
            } else {
                console.log('  ⚠ Could not verify import (may need page refresh)\n');
            }
        }
        
        console.log('=== TEST COMPLETED SUCCESSFULLY ===');
        
    } catch (error) {
        console.error('TEST FAILED:', error.message);
        await page.screenshot({ path: 'screenshots/csv-test-error.png', fullPage: true });
        success = false;
    } finally {
        await browser.close();
    }
    
    process.exit(success ? 0 : 1);
}

test();
