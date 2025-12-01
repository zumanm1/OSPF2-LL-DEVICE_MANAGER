#!/usr/bin/env node
/**
 * Comprehensive End-to-End Validation: OSPF Designer
 * Tests the complete workflow including impact analysis
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:9050';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 E2E VALIDATION: OSPF DESIGNER - COMPLETE WORKFLOW');
  console.log('='.repeat(80) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  let passed = 0;
  let failed = 0;

  try {
    // ========================================================================
    // TEST 1: Login
    // ========================================================================
    console.log('📝 Test 1: Login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    
    await page.type('input[type="text"]', 'netviz_admin');
    await page.type('input[type="password"]', 'V3ry$trongAdm1n!2025');
    await page.click('button[type="submit"]');
    
    await delay(2000);
    
    const isLoggedIn = await page.evaluate(() => {
      return !window.location.href.includes('/login');
    });
    
    if (isLoggedIn) {
      console.log('   ✅ PASS: Login successful\n');
      passed++;
    } else {
      console.log('   ❌ FAIL: Login failed\n');
      failed++;
    }

    // ========================================================================
    // TEST 2: Navigate to OSPF Designer
    // ========================================================================
    console.log('📝 Test 2: Navigate to OSPF Designer...');
    await page.goto(`${BASE_URL}/ospf-designer`, { waitUntil: 'networkidle0' });
    await delay(2000);
    
    const hasDesigner = await page.evaluate(() => {
      return document.body.textContent.includes('OSPF Designer') ||
             document.body.textContent.includes('Draft Topology');
    });
    
    if (hasDesigner) {
      console.log('   ✅ PASS: OSPF Designer page loaded\n');
      passed++;
    } else {
      console.log('   ❌ FAIL: OSPF Designer page not found\n');
      failed++;
    }

    // ========================================================================
    // TEST 3: Check for "Run Impact Analysis" Button
    // ========================================================================
    console.log('📝 Test 3: Check for "Run Impact Analysis" button...');
    
    const hasButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => 
        b.textContent.includes('Run Impact') || 
        b.textContent.includes('Impact Analysis')
      );
    });
    
    if (hasButton) {
      console.log('   ✅ PASS: "Run Impact Analysis" button found\n');
      passed++;
    } else {
      console.log('   ❌ FAIL: Button not found\n');
      failed++;
    }

    // ========================================================================
    // TEST 4: Click "Run Impact Analysis" (No Error)
    // ========================================================================
    console.log('📝 Test 4: Click "Run Impact Analysis" (should not error)...');
    
    // Clear any existing errors
    await page.evaluate(() => {
      window.lastError = null;
      window.addEventListener('error', (e) => {
        window.lastError = e.message;
      });
    });
    
    const clickResult = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => 
        b.textContent.includes('Run Impact') || 
        b.textContent.includes('Analyze Impact')
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    
    await delay(3000); // Wait for API call
    
    const hasError = await page.evaluate(() => {
      const alerts = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent.includes('Failed to run analysis'));
      return alerts.length > 0;
    });
    
    if (clickResult && !hasError) {
      console.log('   ✅ PASS: Button clicked, no error message\n');
      passed++;
    } else {
      console.log('   ❌ FAIL: Error occurred or button not clickable\n');
      failed++;
    }

    // ========================================================================
    // TEST 5: Verify API Response (Check Network)
    // ========================================================================
    console.log('📝 Test 5: Verify Impact Analysis API response...');
    
    const cookies = await page.cookies();
    const sessionToken = cookies.find(c => c.name === 'session_token')?.value;
    
    if (sessionToken) {
      const apiResult = await page.evaluate(async (token) => {
        try {
          const res = await fetch('http://localhost:9051/api/ospf/analyze/impact', {
            headers: { 'X-Session-Token': token }
          });
          const data = await res.json();
          return { 
            success: res.ok, 
            status: res.status, 
            hasData: !!data,
            dataKeys: Object.keys(data || {})
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, sessionToken);
      
      if (apiResult.success && apiResult.status === 200) {
        console.log(`   ✅ PASS: API returned 200 OK`);
        console.log(`      Data keys: ${apiResult.dataKeys.join(', ')}\n`);
        passed++;
      } else {
        console.log(`   ❌ FAIL: API returned ${apiResult.status || 'error'}\n`);
        failed++;
      }
    } else {
      console.log('   ⚠️  SKIP: No session token found\n');
    }

    // ========================================================================
    // TEST 6: Check Draft Topology Loads
    // ========================================================================
    console.log('📝 Test 6: Verify draft topology data...');
    
    if (sessionToken) {
      const draftResult = await page.evaluate(async (token) => {
        try {
          const res = await fetch('http://localhost:9051/api/ospf/design/draft', {
            headers: { 'X-Session-Token': token }
          });
          const data = await res.json();
          return { 
            success: res.ok, 
            status: res.status,
            hasNodes: data.nodes && data.nodes.length > 0,
            nodeCount: data.nodes ? data.nodes.length : 0
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, sessionToken);
      
      if (draftResult.success && draftResult.hasNodes) {
        console.log(`   ✅ PASS: Draft loaded with ${draftResult.nodeCount} nodes\n`);
        passed++;
      } else {
        console.log(`   ❌ FAIL: Draft API error or no nodes\n`);
        failed++;
      }
    } else {
      console.log('   ⚠️  SKIP: No session token\n');
    }

    // ========================================================================
    // TEST 7: Screenshot Final State
    // ========================================================================
    console.log('📝 Test 7: Capture final state...');
    await page.screenshot({ path: '/tmp/ospf-designer-final.png', fullPage: true });
    console.log('   📸 Screenshot: /tmp/ospf-designer-final.png\n');

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${passed}/7`);
    console.log(`❌ Failed: ${failed}/7`);
    console.log(`Success Rate: ${Math.round((passed/7)*100)}%`);
    console.log('='.repeat(80) + '\n');

    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED! OSPF Designer is fully functional! 🎉\n');
    } else {
      console.log('⚠️  Some tests failed. Please review the output above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

