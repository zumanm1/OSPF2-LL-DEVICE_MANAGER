const puppeteer = require('puppeteer');

const FRONTEND_URL = 'http://localhost:19050';
const BACKEND_URL = 'http://localhost:19051';

async function validateDeployment() {
    console.log('=== Remote Deployment Validation ===\n');

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const results = {
        frontend: false,
        backend: false,
        navigation: false,
        devices: false
    };

    try {
        // Test 1: Frontend loads
        console.log('1. Testing Frontend...');
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        const title = await page.title();
        console.log(`   Title: ${title}`);
        results.frontend = title.length > 0;
        console.log(`   ✓ Frontend loaded\n`);

        // Test 2: Backend API
        console.log('2. Testing Backend API...');
        const apiResponse = await page.evaluate(async (url) => {
            const res = await fetch(`${url}/api/devices`);
            return res.json();
        }, BACKEND_URL);
        console.log(`   Devices found: ${apiResponse.length}`);
        results.backend = apiResponse.length > 0;
        console.log(`   ✓ Backend API responding\n`);

        // Test 3: Navigation works
        console.log('3. Testing Navigation...');
        const navLinks = await page.$$eval('nav a', links => links.map(l => l.textContent));
        console.log(`   Nav items: ${navLinks.join(', ')}`);
        results.navigation = navLinks.length >= 5;
        console.log(`   ✓ Navigation rendered\n`);

        // Test 4: Device table populated
        console.log('4. Testing Device Table...');
        await page.waitForSelector('table', { timeout: 10000 });
        const rows = await page.$$eval('tbody tr', rows => rows.length);
        console.log(`   Table rows: ${rows}`);
        results.devices = rows >= 5;
        console.log(`   ✓ Device table populated\n`);

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Summary
    console.log('=== Validation Summary ===');
    const passed = Object.values(results).filter(v => v).length;
    const total = Object.keys(results).length;
    console.log(`Passed: ${passed}/${total}`);

    Object.entries(results).forEach(([key, value]) => {
        console.log(`  ${value ? '✓' : '✗'} ${key}`);
    });

    return passed === total;
}

validateDeployment()
    .then(success => {
        console.log(`\n${success ? '✓ DEPLOYMENT VALIDATED' : '✗ VALIDATION FAILED'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Validation error:', err);
        process.exit(1);
    });
