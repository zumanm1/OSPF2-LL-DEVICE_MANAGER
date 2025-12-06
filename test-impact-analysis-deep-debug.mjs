#!/usr/bin/env node
/**
 * Deep Debug: Impact Analysis Failure
 * Tests the complete flow from UI button click to API response
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:9050';
const API_BASE = 'http://localhost:9051';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DEEP DEBUG: IMPACT ANALYSIS FAILURE');
  console.log('='.repeat(80) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });
  
  // Capture network errors
  page.on('requestfailed', request => {
    console.log(`[NETWORK ERROR] ${request.url()} - ${request.failure().errorText}`);
  });
  
  try {
    // ========================================================================
    // STEP 1: Login
    // ========================================================================
    console.log('📝 Step 1: Login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    
    await page.type('input[type="text"]', 'netviz_admin');
    await page.type('input[type="password"]', 'V3ry$trongAdm1n!2025');
    await page.click('button[type="submit"]');
    
    await delay(2000);
    console.log('✅ Logged in\n');

    // ========================================================================
    // STEP 2: Navigate to OSPF Designer
    // ========================================================================
    console.log('📝 Step 2: Navigate to OSPF Designer...');
    await page.goto(`${BASE_URL}/ospf-designer`, { waitUntil: 'networkidle0' });
    await delay(2000);
    console.log('✅ On OSPF Designer page\n');

    // ========================================================================
    // STEP 3: Check Page State
    // ========================================================================
    console.log('📝 Step 3: Check page state...');
    
    const pageState = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return {
        hasRunImpactButton: body.includes('Run Impact') || body.includes('Impact Analysis'),
        hasDraftData: body.includes('Draft') || body.includes('Cost'),
        hasError: body.includes('Error') || body.includes('Failed'),
        visibleText: body.substring(0, 500)
      };
    });
    
    console.log('   Page State:', pageState);
    console.log();

    // ========================================================================
    // STEP 4: Check API - Get Draft
    // ========================================================================
    console.log('📝 Step 4: Test API - Get Draft...');
    
    const cookies = await page.cookies();
    const sessionToken = cookies.find(c => c.name === 'session_token')?.value;
    
    if (sessionToken) {
      const draftResponse = await page.evaluate(async (apiBase, token) => {
        try {
          const res = await fetch(`${apiBase}/api/ospf/design/draft`, {
            headers: { 'X-Session-Token': token }
          });
          const data = await res.json();
          return { success: true, status: res.status, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, API_BASE, sessionToken);
      
      console.log('   Draft API Response:', JSON.stringify(draftResponse, null, 2));
      console.log();
    }

    // ========================================================================
    // STEP 5: Click "Run Impact Analysis" Button
    // ========================================================================
    console.log('📝 Step 5: Click "Run Impact Analysis"...');
    
    const clicked = await page.evaluate(() => {
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
    
    if (clicked) {
      console.log('   ✅ Button clicked');
      await delay(3000); // Wait for API call
      
      // Check for error messages
      const errorMsg = await page.evaluate(() => {
        const alerts = Array.from(document.querySelectorAll('*'))
          .filter(el => el.textContent.includes('Failed') || el.textContent.includes('Error'));
        return alerts.map(el => el.textContent.trim()).slice(0, 3);
      });
      
      if (errorMsg.length > 0) {
        console.log('   ❌ Errors found:');
        errorMsg.forEach(msg => console.log(`      - ${msg}`));
      }
    } else {
      console.log('   ❌ Button not found');
    }
    console.log();

    // ========================================================================
    // STEP 6: Test API Directly - Impact Analysis
    // ========================================================================
    console.log('📝 Step 6: Test Impact Analysis API directly...');
    
    if (sessionToken) {
      const impactResponse = await page.evaluate(async (apiBase, token) => {
        try {
          const res = await fetch(`${apiBase}/api/ospf/analyze/impact`, {
            headers: { 'X-Session-Token': token }
          });
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          return { 
            success: res.ok, 
            status: res.status, 
            statusText: res.statusText,
            data 
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, API_BASE, sessionToken);
      
      console.log('   Impact API Response:');
      console.log(JSON.stringify(impactResponse, null, 2));
      console.log();
    }

    // ========================================================================
    // STEP 7: Check Backend Logs
    // ========================================================================
    console.log('📝 Step 7: Checking backend logs...');
    await page.screenshot({ path: '/tmp/ospf-designer-error.png', fullPage: true });
    console.log('   📸 Screenshot: /tmp/ospf-designer-error.png\n');

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log('='.repeat(80));
    console.log('📊 DEBUG SUMMARY');
    console.log('='.repeat(80));
    console.log('Check the output above for:');
    console.log('  1. Draft API response (does draft exist?)');
    console.log('  2. Impact API response (what error is returned?)');
    console.log('  3. Browser console errors');
    console.log('  4. Network errors');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);




