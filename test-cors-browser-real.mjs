#!/usr/bin/env node

/**
 * Real browser test - does wildcard CORS + credentials actually break?
 */

import puppeteer from 'puppeteer';

const BACKEND_URL = 'http://localhost:9051';

async function test() {
  console.log('Testing CORS with wildcard + credentials in real browser...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });

  // Listen for failed requests
  let corsError = false;
  page.on('requestfailed', request => {
    const failure = request.failure();
    if (failure && failure.errorText.includes('CORS')) {
      console.log('❌ CORS request failed:', failure.errorText);
      corsError = true;
    }
  });

  // Navigate to a local page simulating frontend
  await page.goto(`http://localhost:9050`);

  // Test 1: Simple fetch with credentials
  console.log('Test 1: fetch() with credentials="include"...');
  const test1 = await page.evaluate(async (backendUrl) => {
    try {
      const response = await fetch(`${backendUrl}/api/health`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return {
        success: true,
        status: response.status,
        corsOrigin: response.headers.get('access-control-allow-origin')
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isCorsError: error.message.includes('CORS') || error.message.includes('cors')
      };
    }
  }, BACKEND_URL);

  if (test1.success) {
    console.log(`  ✓ Request succeeded (status: ${test1.status})`);
    console.log(`    CORS Origin header: ${test1.corsOrigin || 'N/A'}`);
  } else {
    console.log(`  ✗ Request failed: ${test1.error}`);
    if (test1.isCorsError) {
      console.log('    🚨 This is a CORS error!');
    }
  }

  // Test 2: POST with credentials (requires preflight)
  console.log('\nTest 2: POST with credentials (triggers OPTIONS preflight)...');
  const test2 = await page.evaluate(async (backendUrl) => {
    try {
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: 'test', password: 'test' })
      });
      return {
        success: true,
        status: response.status
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isCorsError: error.message.includes('CORS') || error.message.includes('cors')
      };
    }
  }, BACKEND_URL);

  if (test2.success) {
    console.log(`  ✓ POST request succeeded (status: ${test2.status})`);
  } else {
    console.log(`  ✗ POST request failed: ${test2.error}`);
    if (test2.isCorsError) {
      console.log('    🚨 This is a CORS error!');
    }
  }

  // Check browser console for CORS warnings
  console.log('\nTest 3: Checking browser console for CORS warnings...');
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('CORS') || text.includes('wildcard') || text.includes('credentials')) {
      logs.push(text);
    }
  });

  await page.reload();
  await page.waitForTimeout(1000);

  if (logs.length > 0) {
    console.log('  ⚠️  Browser logged CORS warnings:');
    logs.forEach(log => console.log(`    ${log}`));
  } else {
    console.log('  ✓ No CORS warnings in console');
  }

  await browser.close();

  // Verdict
  console.log('\n' + '='.repeat(70));
  console.log('VERDICT:');
  console.log('='.repeat(70));

  if (!test1.success && test1.isCorsError) {
    console.log('❌ CRITICAL: Browser BLOCKED requests due to wildcard + credentials CORS issue!');
    console.log('\nThis confirms the bug prevents frontend-backend communication.');
    process.exit(1);
  } else if (!test2.success && test2.isCorsError) {
    console.log('❌ CRITICAL: POST requests blocked by CORS preflight issue!');
    process.exit(1);
  } else {
    console.log('✓ Browser accepts requests despite wildcard CORS (for now)');
    console.log('\n⚠️  However, this is still a SECURITY RISK:');
    console.log('  - Using "*" with credentials=true is against CORS spec');
    console.log('  - May break in future browser versions');
    console.log('  - Allows ANY website to make authenticated requests');
    console.log('\nRecommendation: Fix by using specific allowed origins');
    process.exit(0);
  }
}

test().catch(error => {
  console.error('Test error:', error.message);
  process.exit(1);
});
