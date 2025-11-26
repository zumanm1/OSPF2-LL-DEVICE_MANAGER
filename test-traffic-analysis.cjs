/**
 * Puppeteer Test: Traffic Analysis Summary Dashboard Validation
 *
 * This test validates that the interface deduplication fix works correctly.
 * It checks that interface names are normalized (e.g., GigabitEthernet0/0/0/0 → Gi0/0/0/0)
 * to prevent duplicate entries in the Summary Dashboard.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';
const SCREENSHOTS_DIR = path.join(__dirname, 'test-screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
    const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot saved: ${filepath}`);
    return filepath;
}

async function runTest() {
    console.log('🚀 Starting Traffic Analysis Validation Test\n');

    const browser = await puppeteer.launch({
        headless: false, // Show browser for visual validation
        defaultViewport: { width: 1920, height: 1080 },
        args: ['--window-size=1920,1080']
    });

    const page = await browser.newPage();

    try {
        // Step 1: Check backend is running
        console.log('1️⃣ Checking backend availability...');
        try {
            const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
            const health = await healthResponse.json();
            console.log(`   ✅ Backend is ${health.status}`);
        } catch (e) {
            console.error('   ❌ Backend is not running!');
            throw new Error('Backend not available');
        }

        // Step 2: Navigate to Traffic Analysis page
        console.log('\n2️⃣ Navigating to Traffic Analysis page...');
        await page.goto(`${FRONTEND_URL}/interface-traffic`, { waitUntil: 'networkidle2' });
        await delay(2000);
        await takeScreenshot(page, '01-traffic-analysis-initial');

        // Step 3: Click "Transform Interface Data" button to refresh data with the fix
        console.log('\n3️⃣ Clicking "Transform Interface Data" button...');
        let transformClicked = false;
        const allButtons = await page.$$('button');
        for (const btn of allButtons) {
            const text = await btn.evaluate(el => el.textContent);
            if (text && text.includes('Transform Interface Data')) {
                await btn.click();
                console.log('   ✅ Transform button clicked');
                transformClicked = true;
                await delay(3000); // Wait for transformation to complete
                break;
            }
        }
        if (!transformClicked) {
            console.log('   ⚠️  Transform button not found, continuing...');
        }
        await takeScreenshot(page, '02-after-transform');

        // Step 4: Click on "Summary Dashboard" tab to ensure we're viewing it
        console.log('\n4️⃣ Ensuring Summary Dashboard tab is active...');
        const tabs = await page.$$('button');
        for (const tab of tabs) {
            const text = await tab.evaluate(el => el.textContent);
            if (text && text.includes('Summary Dashboard')) {
                await tab.click();
                await delay(1000);
                console.log('   ✅ Summary Dashboard tab clicked');
                break;
            }
        }
        await takeScreenshot(page, '03-summary-dashboard');

        // Step 5: Extract the summary statistics
        console.log('\n5️⃣ Extracting Summary Dashboard statistics...');

        const stats = await page.evaluate(() => {
            const cards = document.querySelectorAll('.bg-white, .dark\\:bg-gray-800');
            const result = {};

            // Find cards with statistics
            cards.forEach(card => {
                const text = card.textContent || '';
                if (text.includes('Total Interfaces')) {
                    const match = text.match(/(\d+)\s*Total Interfaces/);
                    if (match) result.totalInterfaces = parseInt(match[1]);
                }
                if (text.includes('Physical Interfaces')) {
                    const match = text.match(/(\d+)\s*Physical Interfaces/);
                    if (match) result.physicalInterfaces = parseInt(match[1]);
                }
                if (text.includes('Logical')) {
                    const match = text.match(/(\d+)\s*Logical/);
                    if (match) result.logicalInterfaces = parseInt(match[1]);
                }
            });

            // Also try to find from the page text
            const pageText = document.body.innerText;

            // Look for numbers followed by labels
            const totalMatch = pageText.match(/(\d+)\s*\n\s*Total Interfaces/);
            const physicalMatch = pageText.match(/(\d+)\s*\n\s*Physical Interfaces/);
            const logicalMatch = pageText.match(/(\d+)\s*\n\s*Logical/);

            if (totalMatch) result.totalInterfaces = parseInt(totalMatch[1]);
            if (physicalMatch) result.physicalInterfaces = parseInt(physicalMatch[1]);
            if (logicalMatch) result.logicalInterfaces = parseInt(logicalMatch[1]);

            return result;
        });

        console.log('   📊 Summary Statistics:');
        console.log(`      Total Interfaces: ${stats.totalInterfaces || 'N/A'}`);
        console.log(`      Physical Interfaces: ${stats.physicalInterfaces || 'N/A'}`);
        console.log(`      Logical Interfaces: ${stats.logicalInterfaces || 'N/A'}`);

        // Step 6: Click on "Interface Details" tab
        console.log('\n6️⃣ Checking Interface Details tab...');
        for (const tab of await page.$$('button')) {
            const text = await tab.evaluate(el => el.textContent);
            if (text && text.includes('Interface Details')) {
                await tab.click();
                await delay(1500);
                console.log('   ✅ Interface Details tab clicked');
                break;
            }
        }
        await takeScreenshot(page, '04-interface-details');

        // Step 7: Check for duplicate interfaces in the table
        console.log('\n7️⃣ Checking for duplicate interfaces...');

        const duplicateCheck = await page.evaluate(() => {
            const rows = document.querySelectorAll('tbody tr');
            const interfaces = new Map(); // Map of "router|interface" -> count
            const duplicates = [];

            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const router = cells[0]?.textContent?.trim() || '';
                    const intf = cells[1]?.textContent?.trim() || '';
                    const key = `${router}|${intf}`;

                    if (interfaces.has(key)) {
                        duplicates.push(key);
                    }
                    interfaces.set(key, (interfaces.get(key) || 0) + 1);
                }
            });

            // Check for similar interfaces (e.g., Gi0/0/0/0 vs GigabitEthernet0/0/0/0)
            const potentialDuplicates = [];
            const routerInterfaces = {};

            interfaces.forEach((count, key) => {
                const [router, intf] = key.split('|');
                if (!routerInterfaces[router]) routerInterfaces[router] = [];
                routerInterfaces[router].push(intf);
            });

            // Check for both short and long forms
            Object.entries(routerInterfaces).forEach(([router, intfs]) => {
                intfs.forEach(intf => {
                    // Check if both Gi and GigabitEthernet exist
                    if (intf.startsWith('Gi') && intfs.some(i => i.startsWith('GigabitEthernet') && i.includes(intf.slice(2)))) {
                        potentialDuplicates.push(`${router}: ${intf} <-> GigabitEthernet${intf.slice(2)}`);
                    }
                    if (intf.startsWith('Lo') && intfs.some(i => i.startsWith('Loopback') && i.includes(intf.slice(2)))) {
                        potentialDuplicates.push(`${router}: ${intf} <-> Loopback${intf.slice(2)}`);
                    }
                });
            });

            return {
                totalRows: rows.length,
                uniqueInterfaces: interfaces.size,
                exactDuplicates: duplicates,
                potentialDuplicates: potentialDuplicates
            };
        });

        console.log(`   📋 Table Analysis:`);
        console.log(`      Total rows: ${duplicateCheck.totalRows}`);
        console.log(`      Unique interfaces: ${duplicateCheck.uniqueInterfaces}`);
        console.log(`      Exact duplicates: ${duplicateCheck.exactDuplicates.length}`);
        console.log(`      Potential naming duplicates: ${duplicateCheck.potentialDuplicates.length}`);

        if (duplicateCheck.potentialDuplicates.length > 0) {
            console.log('   ⚠️  Potential duplicates found:');
            duplicateCheck.potentialDuplicates.slice(0, 5).forEach(d => console.log(`      - ${d}`));
        }

        // Step 8: Click on "Traffic Flow" tab
        console.log('\n8️⃣ Checking Traffic Flow tab...');
        for (const tab of await page.$$('button')) {
            const text = await tab.evaluate(el => el.textContent);
            if (text && text.includes('Traffic Flow')) {
                await tab.click();
                await delay(1500);
                console.log('   ✅ Traffic Flow tab clicked');
                break;
            }
        }
        await takeScreenshot(page, '05-traffic-flow');

        // Step 9: Validate against backend API
        console.log('\n9️⃣ Validating against backend API...');

        const apiSummary = await fetch(`${BACKEND_URL}/api/interface-capacity/summary`).then(r => r.json());
        console.log('   📡 Backend API Response:');
        console.log(`      Total Interfaces: ${apiSummary.total_interfaces}`);
        console.log(`      Physical Interfaces: ${apiSummary.physical_interfaces}`);
        console.log(`      Logical Interfaces: ${apiSummary.logical_interfaces}`);
        console.log(`      Capacity Distribution: ${JSON.stringify(apiSummary.by_capacity_class)}`);

        // Step 10: Final validation
        console.log('\n🔟 Final Validation Results:');

        const validationResults = {
            noDuplicates: duplicateCheck.potentialDuplicates.length === 0,
            countsMatch: stats.totalInterfaces === apiSummary.total_interfaces,
            physicalMatch: stats.physicalInterfaces === apiSummary.physical_interfaces,
            logicalMatch: stats.logicalInterfaces === apiSummary.logical_interfaces,
            mathCorrect: apiSummary.total_interfaces === (apiSummary.physical_interfaces + apiSummary.logical_interfaces)
        };

        console.log(`   ✅ No duplicate interfaces: ${validationResults.noDuplicates ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Total count matches API: ${validationResults.countsMatch ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Physical count matches: ${validationResults.physicalMatch ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Logical count matches: ${validationResults.logicalMatch ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Math is correct (Total = Physical + Logical): ${validationResults.mathCorrect ? 'PASS' : 'FAIL'}`);

        const allPassed = Object.values(validationResults).every(v => v);

        await takeScreenshot(page, '06-final-state');

        console.log('\n' + '='.repeat(60));
        if (allPassed) {
            console.log('✅ ALL VALIDATIONS PASSED - Interface deduplication fix is working!');
        } else {
            console.log('⚠️  SOME VALIDATIONS FAILED - Review the results above');
        }
        console.log('='.repeat(60));

        // Save test results to JSON
        const testResults = {
            timestamp: new Date().toISOString(),
            summary: stats,
            apiResponse: apiSummary,
            duplicateCheck,
            validationResults,
            allPassed,
            screenshots: [
                '01-traffic-analysis-initial.png',
                '02-after-transform.png',
                '03-summary-dashboard.png',
                '04-interface-details.png',
                '05-traffic-flow.png',
                '06-final-state.png'
            ]
        };

        fs.writeFileSync(
            path.join(SCREENSHOTS_DIR, 'test-results.json'),
            JSON.stringify(testResults, null, 2)
        );
        console.log(`\n📄 Test results saved to: ${path.join(SCREENSHOTS_DIR, 'test-results.json')}`);

        await delay(3000); // Keep browser open briefly for visual inspection

    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        await takeScreenshot(page, 'error-state');
        throw error;
    } finally {
        await browser.close();
        console.log('\n🏁 Test completed. Browser closed.');
    }
}

// Run the test
runTest().catch(console.error);
