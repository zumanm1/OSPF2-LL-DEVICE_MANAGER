#!/usr/bin/env node
/**
 * Test Logout Functionality - Debug the stuck login issue
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const API_BASE_URL = 'http://localhost:9051';

async function testLogout() {
  console.log('🔍 Testing Logout Functionality\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Step 1: Check security status
    console.log('1️⃣ Checking security status...');
    const authStatus = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/auth/status`, { credentials: 'include' });
      return res.json();
    }, API_BASE_URL);
    
    console.log('   Security Enabled:', authStatus.security_enabled);
    console.log('   Authenticated:', authStatus.authenticated);
    console.log('   User:', authStatus.session?.username || 'N/A');
    console.log('');

    // Step 2: Navigate to app
    console.log('2️⃣ Navigating to app...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✓ Page loaded');
    
    // Take initial screenshot
    await page.screenshot({ path: './screenshots/before-logout.png' });
    console.log('   📸 Screenshot: before-logout.png\n');

    // Step 3: Check if user is shown in navbar
    const userInfo = await page.evaluate(() => {
      const userSpan = document.querySelector('span:has-text("👤")');
      const logoutBtn = document.querySelector('button:has-text("Logout")');
      return {
        userFound: !!userSpan,
        userText: userSpan?.textContent || 'Not found',
        logoutBtnFound: !!logoutBtn
      };
    });
    
    console.log('3️⃣ User info in navbar:');
    console.log('   User shown:', userInfo.userText);
    console.log('   Logout button:', userInfo.logoutBtnFound ? '✓ Found' : '✗ Not found');
    console.log('');

    // Step 4: Try to click logout
    console.log('4️⃣ Attempting logout...');
    try {
      // Wait for logout button
      await page.waitForSelector('button:has-text("Logout")', { timeout: 3000 });
      console.log('   ✓ Logout button found');
      
      // Click it
      await page.click('button:has-text("Logout")');
      console.log('   ✓ Logout button clicked');
      
      // Wait for navigation or state change
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log('   ✗ Could not find/click logout button:', error.message);
    }

    // Step 5: Check if still logged in
    console.log('\n5️⃣ Checking state after logout attempt...');
    
    const afterLogout = await page.evaluate(() => {
      const userSpan = document.querySelector('span:has-text("👤")');
      const url = window.location.href;
      return {
        currentUrl: url,
        userStillShown: !!userSpan,
        userText: userSpan?.textContent || 'Not shown'
      };
    });
    
    console.log('   Current URL:', afterLogout.currentUrl);
    console.log('   User still shown:', afterLogout.userStillShown ? '✓ YES (BUG!)' : '✗ NO (good)');
    console.log('   User text:', afterLogout.userText);
    
    // Take after screenshot
    await page.screenshot({ path: './screenshots/after-logout.png' });
    console.log('   📸 Screenshot: after-logout.png\n');

    // Step 6: Check localStorage and cookies
    const sessionData = await page.evaluate(() => {
      return {
        localStorage_token: localStorage.getItem('session_token'),
        cookies: document.cookie
      };
    });
    
    console.log('6️⃣ Session data after logout:');
    console.log('   localStorage token:', sessionData.localStorage_token || 'None');
    console.log('   Cookies:', sessionData.cookies || 'None');
    console.log('');

    // Step 7: Check API auth status again
    const authStatusAfter = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/auth/status`, { credentials: 'include' });
      return res.json();
    }, API_BASE_URL);
    
    console.log('7️⃣ API auth status after logout:');
    console.log('   Authenticated:', authStatusAfter.authenticated);
    console.log('   Session:', authStatusAfter.session || 'None');
    console.log('');

    // Diagnosis
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 DIAGNOSIS:');
    console.log('═══════════════════════════════════════════════════════');
    
    if (afterLogout.userStillShown) {
      console.log('❌ BUG CONFIRMED: User stays logged in after logout');
      console.log('');
      console.log('LIKELY CAUSE:');
      if (!authStatus.security_enabled) {
        console.log('  • Security is DISABLED (SECURITY_ENABLED=false)');
        console.log('  • App auto-logs in user on every page load');
        console.log('  • Logout clears session but checkAuthStatus() re-authenticates');
        console.log('');
        console.log('SOLUTION NEEDED:');
        console.log('  1. When security is disabled, hide logout button');
        console.log('  2. OR: Add logout flag to prevent auto-login after logout');
        console.log('  3. OR: Enable security mode for proper authentication');
      } else {
        console.log('  • Logout handler may not be properly clearing state');
        console.log('  • Check App.tsx handleLogout() function');
      }
    } else {
      console.log('✅ Logout working correctly - user was logged out');
    }
    
    console.log('═══════════════════════════════════════════════════════\n');

    // Keep browser open for inspection
    console.log('⏳ Browser will stay open for 10 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
    console.log('🔒 Browser closed\n');
  }
}

// Create screenshots directory
import { mkdirSync } from 'fs';
try {
  mkdirSync('./screenshots', { recursive: true });
} catch (e) {}

// Run test
testLogout()
  .then(() => {
    console.log('✅ TEST COMPLETE');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ TEST FAILED:', error);
    process.exit(1);
  });

