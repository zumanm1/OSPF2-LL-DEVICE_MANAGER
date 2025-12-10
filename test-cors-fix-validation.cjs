/**
 * CORS Fix Validation Test
 * Validates that the CORS wildcard bug is fixed
 */

const puppeteer = require('puppeteer');

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';

async function validateCorsFix() {
    console.log('='.repeat(70));
    console.log('🔒 CORS Fix Validation Test');
    console.log('='.repeat(70));

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = { passed: 0, failed: 0 };

    try {
        const page = await browser.newPage();

        // Collect console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error' && msg.text().includes('CORS')) {
                consoleErrors.push(msg.text());
            }
        });

        // Test 1: Load frontend
        console.log('\n📋 Test 1: Load frontend page');
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('   ✅ Frontend loaded');
        results.passed++;

        // Test 2: Check for CORS errors
        console.log('\n📋 Test 2: Check for CORS errors in console');
        await new Promise(r => setTimeout(r, 3000));

        if (consoleErrors.length === 0) {
            console.log('   ✅ No CORS errors detected');
            results.passed++;
        } else {
            console.log('   ❌ CORS errors found:', consoleErrors.length);
            consoleErrors.forEach(e => console.log('      ', e.substring(0, 100)));
            results.failed++;
        }

        // Test 3: API call from browser context
        console.log('\n📋 Test 3: API call from browser context');
        const apiResult = await page.evaluate(async () => {
            try {
                const resp = await fetch('http://localhost:9051/api/health', {
                    credentials: 'include'
                });
                const data = await resp.json();
                return { success: true, data };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        if (apiResult.success && apiResult.data.status === 'OK') {
            console.log('   ✅ API call successful:', JSON.stringify(apiResult.data));
            results.passed++;
        } else {
            console.log('   ❌ API call failed:', apiResult.error);
            results.failed++;
        }

        // Test 4: Login test
        console.log('\n📋 Test 4: Login functionality');

        // Check if login form exists
        const hasLoginForm = await page.evaluate(() =>
            document.querySelector('input[type="password"]') !== null
        );

        if (hasLoginForm) {
            // Fill login form
            await page.type('input[type="text"], input[name="username"]', 'netviz_admin');
            await page.type('input[type="password"]', 'V3ry$trongAdm1n!2025');
            await page.click('button[type="submit"]');
            await new Promise(r => setTimeout(r, 3000));

            // Check if login succeeded (no more password field)
            const loginSuccess = await page.evaluate(() =>
                !document.querySelector('input[type="password"]') ||
                document.body.innerText.includes('Device') ||
                document.body.innerText.includes('Automation')
            );

            if (loginSuccess) {
                console.log('   ✅ Login successful');
                results.passed++;
            } else {
                console.log('   ❌ Login failed');
                results.failed++;
            }
        } else {
            console.log('   ℹ️ No login form (security disabled)');
            results.passed++;
        }

        // Test 5: Check devices load
        console.log('\n📋 Test 5: Devices API call');
        const devicesResult = await page.evaluate(async () => {
            try {
                const resp = await fetch('http://localhost:9051/api/devices', {
                    credentials: 'include'
                });
                if (resp.status === 401) return { success: true, auth: false };
                const data = await resp.json();
                return { success: true, count: Array.isArray(data) ? data.length : 0 };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        if (devicesResult.success) {
            if (devicesResult.auth === false) {
                console.log('   ✅ Devices API responded (auth required)');
            } else {
                console.log(`   ✅ Devices API returned ${devicesResult.count} devices`);
            }
            results.passed++;
        } else {
            console.log('   ❌ Devices API failed:', devicesResult.error);
            results.failed++;
        }

        await page.screenshot({ path: 'test-screenshots/cors-fix-validation.png', fullPage: true });

    } catch (error) {
        console.error('\n❌ Test error:', error.message);
        results.failed++;
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 CORS FIX VALIDATION RESULTS');
    console.log('='.repeat(70));
    console.log(`   ✅ Passed: ${results.passed}`);
    console.log(`   ❌ Failed: ${results.failed}`);

    if (results.failed === 0) {
        console.log('\n🎉 CORS BUG IS FIXED! All tests passed.');
    } else {
        console.log('\n⚠️ Some tests failed. CORS may still have issues.');
    }

    console.log('='.repeat(70));

    process.exit(results.failed > 0 ? 1 : 0);
}

validateCorsFix().catch(console.error);
