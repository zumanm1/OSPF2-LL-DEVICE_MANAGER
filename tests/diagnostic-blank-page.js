/**
 * Diagnostic Test for Blank Page Issue
 * Purpose: Identify why the page at http://172.16.39.172:9050 is blank
 * Run: node tests/diagnostic-blank-page.js
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TEST_URL = process.env.TEST_URL || 'http://172.16.39.172:9050';
const BACKEND_URL = process.env.BACKEND_URL || 'http://172.16.39.172:9051';
const SCREENSHOT_DIR = path.join(__dirname, '../diagnostic-screenshots');
const TIMEOUT = 30000; // 30 seconds

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function log(color, symbol, message) {
    console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function runDiagnostics() {
    log(colors.cyan, '🔍', '='.repeat(80));
    log(colors.cyan, '🔍', 'BLANK PAGE DIAGNOSTIC TEST');
    log(colors.cyan, '🔍', '='.repeat(80));
    log(colors.blue, 'ℹ️', `Test URL: ${TEST_URL}`);
    log(colors.blue, 'ℹ️', `Backend URL: ${BACKEND_URL}`);
    log(colors.blue, 'ℹ️', `Screenshot Directory: ${SCREENSHOT_DIR}`);
    console.log('');

    const diagnostics = {
        timestamp,
        testUrl: TEST_URL,
        backendUrl: BACKEND_URL,
        tests: [],
        errors: [],
        warnings: [],
        consoleLogs: [],
        networkRequests: [],
        conclusion: '',
    };

    let browser;
    
    try {
        // ====================================================================
        // TEST 1: Backend Health Check
        // ====================================================================
        log(colors.yellow, '📋', 'TEST 1: Backend Health Check');
        
        try {
            const fetch = (await import('node-fetch')).default;
            const healthResponse = await fetch(`${BACKEND_URL}/api/health`, {
                timeout: 5000
            });
            
            const healthData = await healthResponse.json();
            
            if (healthResponse.ok) {
                log(colors.green, '✅', `Backend is healthy: ${JSON.stringify(healthData)}`);
                diagnostics.tests.push({
                    name: 'Backend Health',
                    status: 'PASS',
                    details: healthData
                });
            } else {
                log(colors.red, '❌', `Backend returned error: ${healthResponse.status}`);
                diagnostics.tests.push({
                    name: 'Backend Health',
                    status: 'FAIL',
                    details: { status: healthResponse.status, data: healthData }
                });
            }
        } catch (error) {
            log(colors.red, '❌', `Backend health check failed: ${error.message}`);
            diagnostics.tests.push({
                name: 'Backend Health',
                status: 'FAIL',
                error: error.message
            });
            diagnostics.errors.push(`Backend unreachable: ${error.message}`);
        }
        
        console.log('');

        // ====================================================================
        // TEST 2: Launch Browser and Capture Console
        // ====================================================================
        log(colors.yellow, '📋', 'TEST 2: Launch Browser & Capture Console');
        
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security', // For CORS testing
            ],
        });
        
        const page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Capture console messages
        page.on('console', (msg) => {
            const text = msg.text();
            const type = msg.type();
            
            diagnostics.consoleLogs.push({ type, text, timestamp: new Date().toISOString() });
            
            if (type === 'error') {
                log(colors.red, '🔴', `Console Error: ${text}`);
                diagnostics.errors.push(`Console: ${text}`);
            } else if (type === 'warning') {
                log(colors.yellow, '⚠️', `Console Warning: ${text}`);
                diagnostics.warnings.push(`Console: ${text}`);
            } else {
                log(colors.blue, '📝', `Console ${type}: ${text}`);
            }
        });
        
        // Capture page errors
        page.on('pageerror', (error) => {
            log(colors.red, '💥', `Page Error: ${error.message}`);
            diagnostics.errors.push(`Page Error: ${error.message}`);
        });
        
        // Capture failed requests
        page.on('requestfailed', (request) => {
            const failure = request.failure();
            log(colors.red, '🚫', `Request Failed: ${request.url()} - ${failure ? failure.errorText : 'Unknown'}`);
            diagnostics.errors.push(`Request Failed: ${request.url()}`);
        });
        
        // Capture network requests
        page.on('request', (request) => {
            diagnostics.networkRequests.push({
                type: 'request',
                method: request.method(),
                url: request.url(),
                resourceType: request.resourceType(),
            });
        });
        
        page.on('response', (response) => {
            const request = response.request();
            diagnostics.networkRequests.push({
                type: 'response',
                status: response.status(),
                url: response.url(),
                contentType: response.headers()['content-type'],
            });
            
            if (!response.ok()) {
                log(colors.red, '❌', `HTTP ${response.status()}: ${response.url()}`);
            }
        });
        
        log(colors.green, '✅', 'Browser launched and listeners attached');
        console.log('');

        // ====================================================================
        // TEST 3: Navigate to Page
        // ====================================================================
        log(colors.yellow, '📋', 'TEST 3: Navigate to Page');
        
        try {
            const navigationResult = await page.goto(TEST_URL, {
                waitUntil: 'networkidle2',
                timeout: TIMEOUT,
            });
            
            log(colors.green, '✅', `Page loaded with status: ${navigationResult.status()}`);
            
            // Take screenshot of initial state
            const screenshotPath = path.join(SCREENSHOT_DIR, `${timestamp}_01_initial_load.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            log(colors.green, '📸', `Screenshot saved: ${screenshotPath}`);
            
            diagnostics.tests.push({
                name: 'Page Navigation',
                status: 'PASS',
                details: { status: navigationResult.status() }
            });
        } catch (error) {
            log(colors.red, '❌', `Navigation failed: ${error.message}`);
            diagnostics.tests.push({
                name: 'Page Navigation',
                status: 'FAIL',
                error: error.message
            });
            diagnostics.errors.push(`Navigation error: ${error.message}`);
        }
        
        console.log('');

        // ====================================================================
        // TEST 4: Check Page Content
        // ====================================================================
        log(colors.yellow, '📋', 'TEST 4: Check Page Content');
        
        const htmlContent = await page.content();
        const bodyText = await page.evaluate(() => document.body.textContent);
        const bodyHTML = await page.evaluate(() => document.body.innerHTML);
        
        log(colors.blue, '📄', `HTML length: ${htmlContent.length} characters`);
        log(colors.blue, '📄', `Body text length: ${bodyText.trim().length} characters`);
        log(colors.blue, '📄', `Body HTML length: ${bodyHTML.length} characters`);
        
        if (bodyText.trim().length === 0) {
            log(colors.red, '❌', 'Body is EMPTY - This is the blank page issue!');
            diagnostics.tests.push({
                name: 'Page Content',
                status: 'FAIL',
                details: { bodyTextLength: 0, message: 'Body is empty' }
            });
        } else {
            log(colors.green, '✅', `Body contains ${bodyText.trim().length} characters`);
            diagnostics.tests.push({
                name: 'Page Content',
                status: 'PASS',
                details: { bodyTextLength: bodyText.trim().length }
            });
        }
        
        // Save HTML content
        const htmlPath = path.join(SCREENSHOT_DIR, `${timestamp}_page_content.html`);
        fs.writeFileSync(htmlPath, htmlContent);
        log(colors.green, '💾', `HTML saved: ${htmlPath}`);
        
        console.log('');

        // ====================================================================
        // TEST 5: Check for React Root
        // ====================================================================
        log(colors.yellow, '📋', 'TEST 5: Check for React Root');
        
        const rootElement = await page.$('#root');
        if (rootElement) {
            const rootHTML = await page.evaluate(el => el.innerHTML, rootElement);
            log(colors.green, '✅', `React root (#root) found with ${rootHTML.length} characters`);
            
            if (rootHTML.length === 0) {
                log(colors.red, '❌', 'React root is EMPTY - React may not be mounting!');
                diagnostics.errors.push('React root element is empty');
            }
            
            diagnostics.tests.push({
                name: 'React Root',
                status: rootHTML.length > 0 ? 'PASS' : 'FAIL',
                details: { found: true, contentLength: rootHTML.length }
            });
        } else {
            log(colors.red, '❌', 'React root (#root) NOT FOUND!');
            diagnostics.tests.push({
                name: 'React Root',
                status: 'FAIL',
                details: { found: false }
            });
            diagnostics.errors.push('React root element not found');
        }
        
        console.log('');

        // ====================================================================
        // TEST 6: Check JavaScript Errors
        // ====================================================================
        log(colors.yellow, '📋', 'TEST 6: JavaScript Errors Summary');
        
        const jsErrors = diagnostics.consoleLogs.filter(log => log.type === 'error');
        if (jsErrors.length === 0) {
            log(colors.green, '✅', 'No JavaScript errors detected');
            diagnostics.tests.push({
                name: 'JavaScript Errors',
                status: 'PASS',
                details: { errorCount: 0 }
            });
        } else {
            log(colors.red, '❌', `Found ${jsErrors.length} JavaScript errors:`);
            jsErrors.forEach((err, i) => {
                log(colors.red, '  ', `${i + 1}. ${err.text}`);
            });
            diagnostics.tests.push({
                name: 'JavaScript Errors',
                status: 'FAIL',
                details: { errorCount: jsErrors.length, errors: jsErrors }
            });
        }
        
        console.log('');

        // ====================================================================
        // TEST 7: Check Network Requests
        // ====================================================================
        log(colors.yellow, '📋', 'TEST 7: Network Requests Analysis');
        
        const failedRequests = diagnostics.networkRequests.filter(
            req => req.type === 'response' && req.status >= 400
        );
        
        log(colors.blue, '📡', `Total requests: ${diagnostics.networkRequests.filter(r => r.type === 'request').length}`);
        log(colors.blue, '📡', `Total responses: ${diagnostics.networkRequests.filter(r => r.type === 'response').length}`);
        
        if (failedRequests.length > 0) {
            log(colors.red, '❌', `Found ${failedRequests.length} failed requests:`);
            failedRequests.forEach((req, i) => {
                log(colors.red, '  ', `${i + 1}. [${req.status}] ${req.url}`);
            });
            diagnostics.tests.push({
                name: 'Network Requests',
                status: 'FAIL',
                details: { failedCount: failedRequests.length, failed: failedRequests }
            });
        } else {
            log(colors.green, '✅', 'All network requests successful');
            diagnostics.tests.push({
                name: 'Network Requests',
                status: 'PASS',
                details: { failedCount: 0 }
            });
        }
        
        console.log('');

        // ====================================================================
        // TEST 8: Check for Common Issues
        // ====================================================================
        log(colors.yellow, '📋', 'TEST 8: Common Issues Check');
        
        // Check for CORS errors
        const corsErrors = diagnostics.consoleLogs.filter(log => 
            log.text.toLowerCase().includes('cors') || 
            log.text.toLowerCase().includes('cross-origin')
        );
        
        if (corsErrors.length > 0) {
            log(colors.red, '❌', `CORS issues detected (${corsErrors.length})`);
            diagnostics.warnings.push('CORS configuration may be incorrect');
        }
        
        // Check for WebSocket errors
        const wsErrors = diagnostics.consoleLogs.filter(log => 
            log.text.toLowerCase().includes('websocket') || 
            log.text.toLowerCase().includes('ws://')
        );
        
        if (wsErrors.length > 0) {
            log(colors.yellow, '⚠️', `WebSocket issues detected (${wsErrors.length})`);
            diagnostics.warnings.push('WebSocket connection issues');
        }
        
        // Check for bundle loading issues
        const bundleErrors = diagnostics.networkRequests.filter(req => 
            req.type === 'response' && 
            req.url.includes('.js') && 
            req.status >= 400
        );
        
        if (bundleErrors.length > 0) {
            log(colors.red, '❌', `JavaScript bundle loading failed (${bundleErrors.length} files)`);
            diagnostics.errors.push('JavaScript bundles failed to load');
        }
        
        console.log('');

        // ====================================================================
        // CONCLUSION
        // ====================================================================
        log(colors.cyan, '📊', '='.repeat(80));
        log(colors.cyan, '📊', 'DIAGNOSTIC SUMMARY');
        log(colors.cyan, '📊', '='.repeat(80));
        
        const passedTests = diagnostics.tests.filter(t => t.status === 'PASS').length;
        const failedTests = diagnostics.tests.filter(t => t.status === 'FAIL').length;
        
        log(colors.green, '✅', `Tests Passed: ${passedTests}`);
        log(colors.red, '❌', `Tests Failed: ${failedTests}`);
        log(colors.yellow, '⚠️', `Warnings: ${diagnostics.warnings.length}`);
        log(colors.red, '🚨', `Errors: ${diagnostics.errors.length}`);
        
        console.log('');
        
        // Determine conclusion
        if (diagnostics.errors.length === 0 && failedTests === 0) {
            diagnostics.conclusion = 'All tests passed - page should be working correctly';
            log(colors.green, '🎉', diagnostics.conclusion);
        } else {
            const topIssues = [];
            
            if (diagnostics.errors.some(e => e.includes('Backend unreachable'))) {
                topIssues.push('Backend server is not running or unreachable');
            }
            if (diagnostics.errors.some(e => e.includes('React root element'))) {
                topIssues.push('React is not mounting - check index.html and main bundle');
            }
            if (diagnostics.errors.some(e => e.includes('bundles failed to load'))) {
                topIssues.push('JavaScript bundles are not loading - check build output');
            }
            if (corsErrors.length > 0) {
                topIssues.push('CORS configuration issues');
            }
            
            diagnostics.conclusion = topIssues.length > 0 
                ? `Primary issues: ${topIssues.join('; ')}`
                : 'Multiple issues detected - review detailed logs';
            
            log(colors.red, '🔴', diagnostics.conclusion);
        }
        
        console.log('');
        
        // Save diagnostic report
        const reportPath = path.join(SCREENSHOT_DIR, `${timestamp}_diagnostic_report.json`);
        fs.writeFileSync(reportPath, JSON.stringify(diagnostics, null, 2));
        log(colors.green, '💾', `Diagnostic report saved: ${reportPath}`);
        
        log(colors.cyan, '📊', '='.repeat(80));
        
    } catch (error) {
        log(colors.red, '💥', `Fatal error: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            await browser.close();
            log(colors.blue, 'ℹ️', 'Browser closed');
        }
    }
}

// Run diagnostics
runDiagnostics()
    .then(() => {
        log(colors.green, '✅', 'Diagnostic test completed');
        process.exit(0);
    })
    .catch((error) => {
        log(colors.red, '❌', `Test failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    });
