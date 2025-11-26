/**
 * Comprehensive Workflow Validation Script
 * Tests Steps 0-3 and new Traffic Analysis feature (Step 2.7c)
 *
 * Tests:
 * - Step 0: Device Manager (devices loaded)
 * - Step 1: Automation (data collection files)
 * - Step 2: Data Collection (JSON files with parsed data)
 * - Step 3: Transformation (OSPF topology)
 * - Step 2.7c: Interface Traffic (CDP neighbors, physical topology)
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';

const tests = [];
let passCount = 0;
let failCount = 0;

function log(msg, type = 'info') {
    const colors = {
        pass: '\x1b[32m[PASS]\x1b[0m',
        fail: '\x1b[31m[FAIL]\x1b[0m',
        test: '\x1b[34m[TEST]\x1b[0m',
        step: '\x1b[35m[STEP]\x1b[0m',
        info: '\x1b[36m[INFO]\x1b[0m'
    };
    console.log(`${colors[type] || colors.info} ${msg}`);
}

function addResult(step, name, passed, details = '') {
    tests.push({ step, name, passed, details });
    if (passed) passCount++;
    else failCount++;
    log(`${name} ${details ? `- ${details}` : ''}`, passed ? 'pass' : 'fail');
}

async function testStep0_DeviceManager() {
    log('Step 0: Device Manager', 'step');

    try {
        const res = await fetch(`${BACKEND_URL}/api/devices`);
        const devices = await res.json();

        addResult('Step 0', 'Devices API responds', res.ok, `Status: ${res.status}`);
        addResult('Step 0', 'Devices loaded', devices.length >= 10, `Count: ${devices.length}`);

        // Check device structure
        if (devices.length > 0) {
            const device = devices[0];
            const hasRequiredFields = device.deviceName && device.ipAddress && device.country;
            addResult('Step 0', 'Device structure valid', hasRequiredFields,
                `Sample: ${device.deviceName} (${device.ipAddress})`);
        }

        // Check countries
        const countries = [...new Set(devices.map(d => d.country))];
        addResult('Step 0', 'Multiple countries', countries.length >= 3,
            `Countries: ${countries.join(', ')}`);

    } catch (e) {
        addResult('Step 0', 'Device Manager API', false, e.message);
    }
}

async function testStep1_Automation() {
    log('Step 1: Automation', 'step');

    try {
        // Check TEXT files
        const textRes = await fetch(`${BACKEND_URL}/api/automation/files?folder_type=text`);
        const textData = await textRes.json();
        addResult('Step 1', 'TEXT files exist', textData.file_count > 0,
            `Count: ${textData.file_count}`);

        // Check JSON files
        const jsonRes = await fetch(`${BACKEND_URL}/api/automation/files?folder_type=json`);
        const jsonData = await jsonRes.json();
        addResult('Step 1', 'JSON files exist', jsonData.file_count > 0,
            `Count: ${jsonData.file_count}`);

        // Check automation status
        const statusRes = await fetch(`${BACKEND_URL}/api/automation/status`);
        const status = await statusRes.json();
        addResult('Step 1', 'Automation status API', statusRes.ok,
            `Status: ${status.status || 'idle'}`);

    } catch (e) {
        addResult('Step 1', 'Automation API', false, e.message);
    }
}

async function testStep2_DataCollection() {
    log('Step 2: Data Collection', 'step');

    try {
        // Check for OSPF data files
        const jsonRes = await fetch(`${BACKEND_URL}/api/automation/files?folder_type=json`);
        const jsonData = await jsonRes.json();

        const ospfFiles = jsonData.files.filter(f =>
            f.filename.includes('ospf') || f.filename.includes('route')
        );
        addResult('Step 2', 'OSPF data files', ospfFiles.length > 0,
            `Count: ${ospfFiles.length}`);

        const cdpFiles = jsonData.files.filter(f => f.filename.includes('cdp'));
        addResult('Step 2', 'CDP data files', cdpFiles.length > 0,
            `Count: ${cdpFiles.length}`);

        // Check a sample file content
        if (jsonData.files.length > 0) {
            const sampleFile = jsonData.files[0].filename;
            const fileRes = await fetch(`${BACKEND_URL}/api/automation/files/${sampleFile}?folder_type=json`);
            const fileData = await fileRes.json();

            // The API returns content as a JSON string, parse it
            let content = fileData.content;
            if (typeof content === 'string') {
                try { content = JSON.parse(content); } catch (e) { content = null; }
            }
            const hasParsedData = content &&
                (content.parsed_data || content.raw_output);
            addResult('Step 2', 'Files have parsed data', hasParsedData,
                `Sample: ${sampleFile}`);
        }

    } catch (e) {
        addResult('Step 2', 'Data Collection API', false, e.message);
    }
}

async function testStep3_Transformation() {
    log('Step 3: Transformation', 'step');

    try {
        // Get latest topology
        const topoRes = await fetch(`${BACKEND_URL}/api/transform/topology/latest`);
        const topology = await topoRes.json();

        addResult('Step 3', 'Topology API responds', topoRes.ok, `Status: ${topoRes.status}`);

        const nodeCount = topology.metadata?.node_count || 0;
        const linkCount = topology.metadata?.link_count || 0;

        addResult('Step 3', 'Nodes generated', nodeCount >= 10, `Count: ${nodeCount}`);
        addResult('Step 3', 'Links generated', linkCount > 0, `Count: ${linkCount}`);

        // Check interface costs
        const costsRes = await fetch(`${BACKEND_URL}/api/ospf/interface-costs`);
        const costsData = await costsRes.json();

        addResult('Step 3', 'Interface costs API', costsRes.ok,
            `Interfaces: ${costsData.interfaces?.length || 0}`);

    } catch (e) {
        addResult('Step 3', 'Transformation API', false, e.message);
    }
}

async function testStep27c_InterfaceTraffic() {
    log('Step 2.7c: Interface Traffic Analysis', 'step');

    try {
        // Interface capacity summary
        const summaryRes = await fetch(`${BACKEND_URL}/api/interface-capacity/summary`);
        const summary = await summaryRes.json();

        addResult('Step 2.7c', 'Interface capacity API', summaryRes.ok,
            `Status: ${summaryRes.status}`);

        // CDP neighbors
        const cdpRes = await fetch(`${BACKEND_URL}/api/cdp-neighbors`);
        const cdpData = await cdpRes.json();

        addResult('Step 2.7c', 'CDP neighbors loaded', cdpData.neighbors?.length > 0,
            `Count: ${cdpData.neighbors?.length || 0}`);

        // Physical topology
        const physRes = await fetch(`${BACKEND_URL}/api/physical-topology`);
        const physData = await physRes.json();

        addResult('Step 2.7c', 'Physical topology nodes', physData.nodes?.length > 0,
            `Count: ${physData.nodes?.length || 0}`);
        addResult('Step 2.7c', 'Physical topology links', physData.links?.length > 0,
            `Count: ${physData.links?.length || 0}`);

        // Traffic matrix
        const trafficRes = await fetch(`${BACKEND_URL}/api/interface-capacity/traffic-matrix`);
        const trafficData = await trafficRes.json();

        addResult('Step 2.7c', 'Traffic matrix API', trafficRes.ok,
            `Links: ${trafficData.links?.length || 0}`);

    } catch (e) {
        addResult('Step 2.7c', 'Interface Traffic API', false, e.message);
    }
}

async function testFrontendPages() {
    log('Frontend Pages', 'step');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Test Device Manager page
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        addResult('Frontend', 'Device Manager loads', true, `URL: ${page.url()}`);

        // Test Automation page
        await page.goto(`${FRONTEND_URL}/automation`, { waitUntil: 'networkidle0', timeout: 30000 });
        addResult('Frontend', 'Automation page loads', page.url().includes('automation'));

        // Test Transformation page
        await page.goto(`${FRONTEND_URL}/transformation`, { waitUntil: 'networkidle0', timeout: 30000 });
        addResult('Frontend', 'Transformation page loads', page.url().includes('transformation'));

        // Test Interface Traffic page
        await page.goto(`${FRONTEND_URL}/interface-traffic`, { waitUntil: 'networkidle0', timeout: 30000 });
        const trafficUrl = page.url();
        addResult('Frontend', 'Traffic Analysis page loads', trafficUrl.includes('interface-traffic'),
            `URL: ${trafficUrl}`);

        // Check for page header
        await new Promise(r => setTimeout(r, 1000));
        const h1 = await page.$eval('h1', el => el.textContent).catch(() => null);
        addResult('Frontend', 'Traffic Analysis header', !!h1, `Header: ${h1 || 'Not found'}`);

        // Check navbar has all links
        const navLinks = await page.$$eval('nav a', links => links.map(l => l.getAttribute('href')));
        const hasTrafficLink = navLinks.includes('/interface-traffic');
        addResult('Frontend', 'Navbar has Traffic Analysis link', hasTrafficLink);

        // Take screenshot
        await page.screenshot({ path: '/Users/macbook/OSPF-LL-DEVICE_MANAGER/workflow-validation-screenshot.png', fullPage: true });
        log('Screenshot saved: workflow-validation-screenshot.png', 'info');

    } catch (e) {
        addResult('Frontend', 'Frontend pages', false, e.message);
    } finally {
        await browser.close();
    }
}

async function main() {
    console.log('\n' + '='.repeat(60));
    log('COMPREHENSIVE WORKFLOW VALIDATION', 'info');
    console.log('='.repeat(60) + '\n');

    // Run all tests
    await testStep0_DeviceManager();
    console.log();

    await testStep1_Automation();
    console.log();

    await testStep2_DataCollection();
    console.log();

    await testStep3_Transformation();
    console.log();

    await testStep27c_InterfaceTraffic();
    console.log();

    await testFrontendPages();

    // Summary
    console.log('\n' + '='.repeat(60));
    log('TEST RESULTS SUMMARY', 'info');
    console.log('='.repeat(60) + '\n');

    // Group by step
    const steps = [...new Set(tests.map(t => t.step))];
    for (const step of steps) {
        const stepTests = tests.filter(t => t.step === step);
        const stepPassed = stepTests.filter(t => t.passed).length;
        const stepTotal = stepTests.length;
        const status = stepPassed === stepTotal ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
        console.log(`  ${step}: ${stepPassed}/${stepTotal} [${status}]`);
    }

    console.log('\n' + '-'.repeat(60));
    const overall = passCount === tests.length ? '\x1b[32mALL TESTS PASSED\x1b[0m' : '\x1b[31mSOME TESTS FAILED\x1b[0m';
    console.log(`  TOTAL: ${passCount}/${tests.length} [${overall}]`);
    console.log('='.repeat(60) + '\n');

    process.exit(failCount > 0 ? 1 : 0);
}

main();
