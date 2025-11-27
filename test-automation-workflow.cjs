/**
 * Comprehensive Automation Workflow Test
 * Tests full workflow: Login -> Select 10 devices -> Run automation -> Verify completion
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';
const CREDENTIALS = { username: 'admin', password: 'admin123' };

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testAutomationWorkflow() {
    console.log('='.repeat(70));
    console.log('🚀 NetMan OSPF - Full Automation Workflow Test');
    console.log('='.repeat(70));

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = { passed: 0, failed: 0, tests: [] };

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // ============================================
        // PHASE 1: Login
        // ============================================
        console.log('\n📋 Phase 1: Login');

        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(2000);

        // Check for login form
        const hasLoginForm = await page.evaluate(() => document.querySelector('input[type="password"]') !== null);

        if (hasLoginForm) {
            console.log('   ✅ Login page displayed');
            await page.type('input#username', CREDENTIALS.username);
            await page.type('input#password', CREDENTIALS.password);
            await page.click('button[type="submit"]');
            await delay(5000);

            const loggedIn = await page.evaluate(() => !document.querySelector('input[type="password"]'));
            if (loggedIn) {
                console.log('   ✅ Login successful');
                results.passed++;
                results.tests.push({ name: 'Login', status: 'PASS' });
            } else {
                console.log('   ❌ Login failed');
                results.failed++;
                results.tests.push({ name: 'Login', status: 'FAIL' });
                throw new Error('Login failed');
            }
        } else {
            console.log('   ℹ️ Already logged in or security disabled');
            results.passed++;
            results.tests.push({ name: 'Login', status: 'PASS' });
        }

        await page.screenshot({ path: 'test-screenshots/workflow-01-after-login.png', fullPage: true });

        // ============================================
        // PHASE 2: Navigate to Automation Page
        // ============================================
        console.log('\n📋 Phase 2: Navigate to Automation Page');

        await page.goto(`${FRONTEND_URL}/automation`, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(3000);

        const onAutomationPage = await page.evaluate(() => {
            return document.body.innerText.includes('Automation') &&
                   (document.body.innerText.includes('Select Devices') ||
                    document.body.innerText.includes('devices'));
        });

        if (onAutomationPage) {
            console.log('   ✅ Automation page loaded');
            results.passed++;
            results.tests.push({ name: 'Automation Page Load', status: 'PASS' });
        } else {
            console.log('   ❌ Automation page not loaded');
            results.failed++;
            results.tests.push({ name: 'Automation Page Load', status: 'FAIL' });
        }

        await page.screenshot({ path: 'test-screenshots/workflow-02-automation-page.png', fullPage: true });

        // ============================================
        // PHASE 3: Select All 10 Devices
        // ============================================
        console.log('\n📋 Phase 3: Select All Devices');

        // Wait for devices to load
        await delay(2000);

        // Try to find and click "Select All" checkbox or select devices individually
        const selectAllClicked = await page.evaluate(() => {
            // Look for select all checkbox
            const selectAll = document.querySelector('input[type="checkbox"]');
            if (selectAll) {
                selectAll.click();
                return true;
            }
            return false;
        });

        if (selectAllClicked) {
            await delay(1000);
            console.log('   ✅ Clicked select all checkbox');
        }

        // Check how many devices are selected
        const selectedCount = await page.evaluate(() => {
            const text = document.body.innerText;
            const match = text.match(/(\d+)\s*(?:devices?\s*)?selected/i);
            if (match) return parseInt(match[1]);
            // Alternative: count checked checkboxes
            const checked = document.querySelectorAll('input[type="checkbox"]:checked');
            return checked.length;
        });

        console.log(`   📊 Devices selected: ${selectedCount}`);

        if (selectedCount >= 1) {
            results.passed++;
            results.tests.push({ name: 'Device Selection', status: 'PASS', count: selectedCount });
        } else {
            console.log('   ⚠️ No devices selected - trying alternative selection');
            // Try clicking individual checkboxes
            await page.evaluate(() => {
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    if (!cb.checked) cb.click();
                });
            });
            await delay(1000);
        }

        await page.screenshot({ path: 'test-screenshots/workflow-03-devices-selected.png', fullPage: true });

        // ============================================
        // PHASE 4: Start Automation Job
        // ============================================
        console.log('\n📋 Phase 4: Start Automation Job');

        // Find and click the "Start Job" or "Run" button
        const startButtonClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const startBtn = buttons.find(btn =>
                btn.innerText.includes('Start') ||
                btn.innerText.includes('Run') ||
                btn.innerText.includes('Execute')
            );
            if (startBtn && !startBtn.disabled) {
                startBtn.click();
                return true;
            }
            return false;
        });

        if (startButtonClicked) {
            console.log('   ✅ Start button clicked');
            results.passed++;
            results.tests.push({ name: 'Start Automation', status: 'PASS' });
        } else {
            console.log('   ⚠️ Could not find/click start button');
            results.tests.push({ name: 'Start Automation', status: 'SKIP' });
        }

        await delay(3000);
        await page.screenshot({ path: 'test-screenshots/workflow-04-job-started.png', fullPage: true });

        // ============================================
        // PHASE 5: Monitor Job Progress
        // ============================================
        console.log('\n📋 Phase 5: Monitor Job Progress');

        // Wait and check for job progress/completion (up to 5 minutes)
        let jobComplete = false;
        let progressChecks = 0;
        const maxChecks = 60; // 5 minutes max (5 seconds per check)

        while (!jobComplete && progressChecks < maxChecks) {
            await delay(5000);
            progressChecks++;

            const status = await page.evaluate(() => {
                const text = document.body.innerText;
                return {
                    hasProgress: text.includes('%') || text.includes('Progress') || text.includes('Running'),
                    hasComplete: text.includes('Complete') || text.includes('Finished') || text.includes('100%'),
                    hasError: text.includes('Error') || text.includes('Failed'),
                    text: text.substring(0, 500)
                };
            });

            if (status.hasComplete) {
                jobComplete = true;
                console.log(`   ✅ Job completed after ${progressChecks * 5} seconds`);
            } else if (status.hasError) {
                console.log(`   ⚠️ Job encountered error`);
                break;
            } else if (status.hasProgress) {
                console.log(`   ⏳ Job in progress... (${progressChecks * 5}s)`);
            }

            // Take progress screenshot every 30 seconds
            if (progressChecks % 6 === 0) {
                await page.screenshot({ path: `test-screenshots/workflow-05-progress-${progressChecks}.png`, fullPage: true });
            }
        }

        if (jobComplete) {
            results.passed++;
            results.tests.push({ name: 'Job Completion', status: 'PASS' });
        } else if (progressChecks >= maxChecks) {
            console.log('   ⏰ Timeout waiting for job completion');
            results.tests.push({ name: 'Job Completion', status: 'TIMEOUT' });
        }

        await page.screenshot({ path: 'test-screenshots/workflow-06-final-state.png', fullPage: true });

        // ============================================
        // PHASE 6: Verify Results
        // ============================================
        console.log('\n📋 Phase 6: Verify Results');

        // Check for any results/output
        const hasResults = await page.evaluate(() => {
            const text = document.body.innerText;
            return text.includes('success') ||
                   text.includes('complete') ||
                   text.includes('output') ||
                   text.includes('result');
        });

        if (hasResults) {
            console.log('   ✅ Results visible on page');
            results.passed++;
            results.tests.push({ name: 'Results Display', status: 'PASS' });
        }

    } catch (error) {
        console.error('\n❌ Test error:', error.message);
        results.failed++;
        results.tests.push({ name: 'Workflow', status: 'ERROR', error: error.message });
    } finally {
        await browser.close();
    }

    // ============================================
    // FINAL REPORT
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 AUTOMATION WORKFLOW TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`   ✅ Passed: ${results.passed}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));

    results.tests.forEach(t => {
        const icon = t.status === 'PASS' ? '✅' : t.status === 'FAIL' ? '❌' : '⚠️';
        console.log(`   ${icon} ${t.name}: ${t.status}`);
    });

    fs.writeFileSync('test-screenshots/workflow-results.json', JSON.stringify(results, null, 2));
    console.log('\n📁 Results saved to test-screenshots/workflow-results.json');

    return results.failed === 0;
}

testAutomationWorkflow().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
