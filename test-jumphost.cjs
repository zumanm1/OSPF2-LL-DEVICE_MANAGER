const puppeteer = require('puppeteer');

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';

async function testJumphostFeature() {
    console.log('=== Jumphost Feature Test ===\n');

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const results = {
        apiGet: false,
        apiSave: false,
        apiTest: false,
        uiRender: false,
        uiExpand: false,
        uiFields: false
    };

    try {
        // Test 1: API - Get jumphost config
        console.log('1. Testing API - Get jumphost config...');
        const getResponse = await page.evaluate(async (url) => {
            const res = await fetch(`${url}/api/settings/jumphost`);
            return res.json();
        }, BACKEND_URL);
        console.log(`   Config: enabled=${getResponse.enabled}, host=${getResponse.host}`);
        results.apiGet = getResponse.host === '172.16.39.173';
        console.log(`   ${results.apiGet ? '✓' : '✗'} API Get works\n`);

        // Test 2: API - Save jumphost config
        console.log('2. Testing API - Save jumphost config...');
        const saveResponse = await page.evaluate(async (url) => {
            const res = await fetch(`${url}/api/settings/jumphost`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: true,
                    host: '172.16.39.173',
                    port: 22,
                    username: 'vmuser',
                    password: 'simple123'
                })
            });
            return res.json();
        }, BACKEND_URL);
        console.log(`   Status: ${saveResponse.status}`);
        results.apiSave = saveResponse.status === 'saved';
        console.log(`   ${results.apiSave ? '✓' : '✗'} API Save works\n`);

        // Test 3: API - Test jumphost connection
        console.log('3. Testing API - Test jumphost connection...');
        const testResponse = await page.evaluate(async (url) => {
            const res = await fetch(`${url}/api/settings/jumphost/test`, {
                method: 'POST'
            });
            return res.json();
        }, BACKEND_URL);
        console.log(`   Status: ${testResponse.status}, Message: ${testResponse.message}`);
        results.apiTest = testResponse.status === 'success';
        console.log(`   ${results.apiTest ? '✓' : '✗'} API Test works\n`);

        // Test 4: UI - Render Automation page
        console.log('4. Testing UI - Navigate to Automation page...');
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 30000 });

        // Find and click on Automation link
        await page.evaluate(() => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
                if (link.textContent.includes('Automation')) {
                    link.click();
                    break;
                }
            }
        });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if jumphost section exists
        const jumphostSection = await page.evaluate(() => {
            const headings = document.querySelectorAll('h2');
            for (const h of headings) {
                if (h.textContent.includes('SSH Jumphost')) {
                    return true;
                }
            }
            return false;
        });
        results.uiRender = jumphostSection;
        console.log(`   ${results.uiRender ? '✓' : '✗'} Jumphost section rendered\n`);

        // Test 5: UI - Expand jumphost panel
        console.log('5. Testing UI - Expand jumphost panel...');
        const expandSuccess = await page.evaluate(() => {
            const headings = document.querySelectorAll('h2');
            for (const h of headings) {
                if (h.textContent.includes('SSH Jumphost')) {
                    const parent = h.closest('.cursor-pointer');
                    if (parent) {
                        parent.click();
                        return true;
                    }
                }
            }
            return false;
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        results.uiExpand = expandSuccess;
        console.log(`   ${results.uiExpand ? '✓' : '✗'} Panel expanded\n`);

        // Test 6: UI - Check fields are visible
        console.log('6. Testing UI - Check configuration fields...');
        const fieldsVisible = await page.evaluate(() => {
            const labels = document.querySelectorAll('label');
            let hasHost = false, hasPort = false, hasUser = false, hasPass = false;
            for (const label of labels) {
                if (label.textContent.includes('Jumphost IP')) hasHost = true;
                if (label.textContent.includes('SSH Port')) hasPort = true;
                if (label.textContent.includes('Username')) hasUser = true;
                if (label.textContent.includes('Password')) hasPass = true;
            }
            return hasHost && hasPort && hasUser && hasPass;
        });
        results.uiFields = fieldsVisible;
        console.log(`   ${results.uiFields ? '✓' : '✗'} All fields visible\n`);

        // Take screenshot
        await page.screenshot({ path: 'test-screenshots/jumphost-test.png', fullPage: true });
        console.log('   Screenshot saved to test-screenshots/jumphost-test.png\n');

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Summary
    console.log('=== Test Summary ===');
    const passed = Object.values(results).filter(v => v).length;
    const total = Object.keys(results).length;
    console.log(`Passed: ${passed}/${total}`);

    Object.entries(results).forEach(([key, value]) => {
        console.log(`  ${value ? '✓' : '✗'} ${key}`);
    });

    return passed === total;
}

// Ensure screenshot directory exists
const fs = require('fs');
if (!fs.existsSync('test-screenshots')) {
    fs.mkdirSync('test-screenshots');
}

testJumphostFeature()
    .then(success => {
        console.log(`\n${success ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Test error:', err);
        process.exit(1);
    });
