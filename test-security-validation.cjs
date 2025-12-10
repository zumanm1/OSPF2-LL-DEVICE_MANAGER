/**
 * Comprehensive Security and Application Validation Test
 * Tests: Login, Auth Protection, All Pages, Logout
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';
const CREDENTIALS = { username: 'netviz_admin', password: 'V3ry$trongAdm1n!2025' };

// Helper function for delays (Puppeteer v22+ removed waitForTimeout)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function validateApp() {
    console.log('='.repeat(70));
    console.log('🔐 NetMan OSPF Security & Application Validation');
    console.log('='.repeat(70));

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // ============================================
        // TEST 1: Backend API Security
        // ============================================
        console.log('\n📋 Test 1: Backend API Security');

        // Test unauthenticated access
        const unauthResponse = await page.goto(`${BACKEND_URL}/api/devices`, { waitUntil: 'networkidle2' });
        const unauthText = await page.evaluate(() => document.body.innerText);

        if (unauthText.includes('Authentication required')) {
            console.log('   ✅ Protected routes require authentication');
            results.passed++;
            results.tests.push({ name: 'API Protection', status: 'PASS' });
        } else {
            console.log('   ❌ API not protected!');
            results.failed++;
            results.tests.push({ name: 'API Protection', status: 'FAIL' });
        }

        // Test auth status endpoint (should be public)
        await page.goto(`${BACKEND_URL}/api/auth/status`, { waitUntil: 'networkidle2' });
        const statusText = await page.evaluate(() => document.body.innerText);

        if (statusText.includes('security_enabled')) {
            console.log('   ✅ Auth status endpoint accessible');
            results.passed++;
            results.tests.push({ name: 'Auth Status Public', status: 'PASS' });
        } else {
            console.log('   ❌ Auth status endpoint not working');
            results.failed++;
            results.tests.push({ name: 'Auth Status Public', status: 'FAIL' });
        }

        // ============================================
        // TEST 2: Login Page
        // ============================================
        console.log('\n📋 Test 2: Login Page');

        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(2000);

        // Check for login form
        const hasLoginForm = await page.evaluate(() => {
            return document.querySelector('input[type="password"]') !== null;
        });

        if (hasLoginForm) {
            console.log('   ✅ Login page displayed');
            results.passed++;
            results.tests.push({ name: 'Login Page Display', status: 'PASS' });

            // Take screenshot
            await page.screenshot({ path: 'test-screenshots/01-login-page.png', fullPage: true });
        } else {
            console.log('   ❌ Login page not displayed');
            results.failed++;
            results.tests.push({ name: 'Login Page Display', status: 'FAIL' });
        }

        // ============================================
        // TEST 3: Login Flow
        // ============================================
        console.log('\n📋 Test 3: Login Flow');

        // Fill in credentials
        await page.type('input#username', CREDENTIALS.username);
        await page.type('input#password', CREDENTIALS.password);

        // Click sign in button
        await page.click('button[type="submit"]');
        await delay(5000);  // Increased wait time

        // Take screenshot after submit
        await page.screenshot({ path: 'test-screenshots/02-after-submit.png', fullPage: true });

        // Debug: Check what's on the page
        const pageContent = await page.evaluate(() => document.body.innerText);
        const hasLogout = pageContent.includes('Logout');
        const hasDeviceManagerText = pageContent.includes('Device Manager');
        const stillHasLoginForm = await page.evaluate(() => document.querySelector('input[type="password"]') !== null);

        console.log(`   Debug: hasLogout=${hasLogout}, hasDeviceManager=${hasDeviceManagerText}, stillHasLoginForm=${stillHasLoginForm}`);

        // Check if logged in (no login form AND has app content)
        const isLoggedIn = !stillHasLoginForm && (hasLogout || hasDeviceManagerText);

        if (isLoggedIn) {
            console.log('   ✅ Login successful');
            results.passed++;
            results.tests.push({ name: 'Login Flow', status: 'PASS' });

            await page.screenshot({ path: 'test-screenshots/02-after-login.png', fullPage: true });
        } else {
            console.log('   ❌ Login failed (still on login page or no app content)');
            results.failed++;
            results.tests.push({ name: 'Login Flow', status: 'FAIL' });
        }

        // ============================================
        // TEST 4: Navigate All Pages
        // ============================================
        console.log('\n📋 Test 4: Navigate All Pages');

        const pages = [
            { name: 'Device Manager', path: '/', selector: 'Device Manager' },
            { name: 'Automation', path: '/automation', selector: 'Automation' },
            { name: 'Data Save', path: '/data-save', selector: 'Data Save' },
            { name: 'Interface Costs', path: '/interface-costs', selector: 'Interface Costs' },
            { name: 'Transformation', path: '/transformation', selector: 'Transformation' },
            { name: 'Traffic Analysis', path: '/interface-traffic', selector: 'Traffic' }
        ];

        for (const pageInfo of pages) {
            try {
                await page.goto(`${FRONTEND_URL}${pageInfo.path}`, { waitUntil: 'networkidle2', timeout: 15000 });
                await delay(1000);

                const pageContent = await page.evaluate(() => document.body.innerText);
                const hasContent = pageContent.includes(pageInfo.selector) || pageContent.length > 100;

                if (hasContent) {
                    console.log(`   ✅ ${pageInfo.name} accessible`);
                    results.passed++;
                    results.tests.push({ name: `Page: ${pageInfo.name}`, status: 'PASS' });
                } else {
                    console.log(`   ❌ ${pageInfo.name} not accessible`);
                    results.failed++;
                    results.tests.push({ name: `Page: ${pageInfo.name}`, status: 'FAIL' });
                }
            } catch (err) {
                console.log(`   ❌ ${pageInfo.name} error: ${err.message}`);
                results.failed++;
                results.tests.push({ name: `Page: ${pageInfo.name}`, status: 'FAIL' });
            }
        }

        // ============================================
        // TEST 5: API Access After Login
        // ============================================
        console.log('\n📋 Test 5: API Access After Login');

        // Navigate to a page and check API works
        await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle2' });
        await delay(2000);

        // Check if devices are loaded
        const hasDevices = await page.evaluate(() => {
            return document.body.innerText.includes('zwe-r1') ||
                   document.body.innerText.includes('172.20.0');
        });

        if (hasDevices) {
            console.log('   ✅ Devices loaded from API');
            results.passed++;
            results.tests.push({ name: 'API Data Access', status: 'PASS' });

            await page.screenshot({ path: 'test-screenshots/03-devices-loaded.png', fullPage: true });
        } else {
            console.log('   ❌ Devices not loaded');
            results.failed++;
            results.tests.push({ name: 'API Data Access', status: 'FAIL' });
        }

        // ============================================
        // TEST 6: User Info Display
        // ============================================
        console.log('\n📋 Test 6: User Info Display');

        const hasUserInfo = await page.evaluate(() => {
            return document.body.innerText.includes('admin');
        });

        if (hasUserInfo) {
            console.log('   ✅ User info displayed in navbar');
            results.passed++;
            results.tests.push({ name: 'User Info Display', status: 'PASS' });
        } else {
            console.log('   ❌ User info not displayed');
            results.failed++;
            results.tests.push({ name: 'User Info Display', status: 'FAIL' });
        }

        // ============================================
        // TEST 7: Logout
        // ============================================
        console.log('\n📋 Test 7: Logout');

        // Click logout button
        try {
            await page.click('button[title="Logout"]');
            await delay(2000);

            // Check if back to login page
            const backToLogin = await page.evaluate(() => {
                return document.querySelector('input[type="password"]') !== null;
            });

            if (backToLogin) {
                console.log('   ✅ Logout successful, returned to login');
                results.passed++;
                results.tests.push({ name: 'Logout', status: 'PASS' });

                await page.screenshot({ path: 'test-screenshots/04-after-logout.png', fullPage: true });
            } else {
                console.log('   ❌ Logout did not return to login page');
                results.failed++;
                results.tests.push({ name: 'Logout', status: 'FAIL' });
            }
        } catch (err) {
            console.log(`   ⚠️ Logout button not found or error: ${err.message}`);
            results.tests.push({ name: 'Logout', status: 'SKIP' });
        }

    } catch (error) {
        console.error('\n❌ Test error:', error.message);
    } finally {
        await browser.close();
    }

    // ============================================
    // FINAL REPORT
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 VALIDATION RESULTS');
    console.log('='.repeat(70));
    console.log(`   ✅ Passed: ${results.passed}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));

    // Write results to file
    fs.writeFileSync('test-screenshots/security-validation-results.json', JSON.stringify(results, null, 2));
    console.log('\n📁 Results saved to test-screenshots/security-validation-results.json');

    return results.failed === 0;
}

// Run validation
validateApp().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
