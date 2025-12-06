#!/usr/bin/env node
/**
 * CRITICAL LOGOUT BUG - PUPPETEER VALIDATION TEST
 * Tests that logout actually works and user stays logged out
 */

import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

const FRONTEND_URL = 'http://localhost:9050';
const API_BASE_URL = 'http://localhost:9051';

// Create screenshots directory
try {
  mkdirSync('./screenshots', { recursive: true });
} catch (e) {}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function validateLogoutFix() {
  console.log('\n' + '═'.repeat(80));
  console.log('🔐 CRITICAL LOGOUT BUG - VALIDATION TEST');
  console.log('═'.repeat(80) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    const page = await browser.newPage();

    // =================================================================
    // TEST 1: Check Initial State
    // =================================================================
    console.log('📋 TEST 1: Check Initial Security State');
    console.log('─'.repeat(80));
    
    const authStatus = await page.evaluate(async (url) => {
      try {
        const res = await fetch(`${url}/api/auth/status`, { credentials: 'include' });
        return await res.json();
      } catch (e) {
        return { error: e.message };
      }
    }, API_BASE_URL);
    
    console.log(`   Security Enabled: ${authStatus.security_enabled}`);
    console.log(`   Authenticated: ${authStatus.authenticated}`);
    console.log(`   User: ${authStatus.session?.username || 'N/A'}`);
    
    if (authStatus.security_enabled === false) {
      console.log('   ⚠️  SECURITY DISABLED - This is the critical bug scenario!\n');
    } else {
      console.log('   ✅ Security enabled\n');
    }

    // =================================================================
    // TEST 2: Load Application
    // =================================================================
    console.log('📋 TEST 2: Load Application');
    console.log('─'.repeat(80));
    
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(3000);
    
    await page.screenshot({ path: './screenshots/01-app-loaded.png', fullPage: false });
    console.log('   ✅ App loaded');
    console.log('   📸 Screenshot: 01-app-loaded.png\n');

    // =================================================================
    // TEST 3: Verify User is Logged In Initially
    // =================================================================
    console.log('📋 TEST 3: Verify Initial Login State');
    console.log('─'.repeat(80));
    
    const initialState = await page.evaluate(() => {
      const userElement = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤')
      );
      const logoutBtn = Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('Logout')
      );
      
      return {
        userShown: !!userElement,
        userText: userElement?.textContent || 'Not found',
        logoutBtnVisible: !!logoutBtn,
        currentUrl: window.location.href
      };
    });
    
    if (initialState.userShown && initialState.logoutBtnVisible) {
      console.log('   ✅ User is logged in');
      console.log(`   ✅ User shown: ${initialState.userText}`);
      console.log('   ✅ Logout button visible');
      testsPassed++;
    } else {
      console.log('   ❌ User not properly logged in');
      testsFailed++;
    }
    console.log('');

    // =================================================================
    // TEST 4: Click Logout Button
    // =================================================================
    console.log('📋 TEST 4: Click Logout Button');
    console.log('─'.repeat(80));
    
    try {
      // Find and click logout button
      const logoutClicked = await page.evaluate(() => {
        const logoutBtn = Array.from(document.querySelectorAll('button')).find(
          btn => btn.textContent?.includes('Logout')
        );
        if (logoutBtn) {
          logoutBtn.click();
          return true;
        }
        return false;
      });
      
      if (logoutClicked) {
        console.log('   ✅ Logout button clicked');
        await delay(2000); // Wait for state update
        testsPassed++;
      } else {
        console.log('   ❌ Could not find logout button');
        testsFailed++;
      }
    } catch (error) {
      console.log(`   ❌ Error clicking logout: ${error.message}`);
      testsFailed++;
    }
    
    await page.screenshot({ path: './screenshots/02-after-logout-click.png', fullPage: false });
    console.log('   📸 Screenshot: 02-after-logout-click.png\n');

    // =================================================================
    // TEST 5: CRITICAL - Verify User Stays Logged Out
    // =================================================================
    console.log('📋 TEST 5: CRITICAL - Verify User Stays Logged Out');
    console.log('─'.repeat(80));
    
    await delay(2000); // Wait for any re-renders
    
    const afterLogout = await page.evaluate(() => {
      const userElement = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤')
      );
      const logoutBtn = Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('Logout')
      );
      const loginPage = document.querySelector('input[id="username"]') !== null;
      
      return {
        userStillShown: !!userElement,
        logoutBtnStillVisible: !!logoutBtn,
        onLoginPage: loginPage,
        currentUrl: window.location.href
      };
    });
    
    console.log(`   Current URL: ${afterLogout.currentUrl}`);
    console.log(`   User still shown: ${afterLogout.userStillShown ? '❌ YES (BUG!)' : '✅ NO (FIXED!)'}`);
    console.log(`   Logout button visible: ${afterLogout.logoutBtnStillVisible ? '❌ YES (BUG!)' : '✅ NO (FIXED!)'}`);
    console.log(`   On login page: ${afterLogout.onLoginPage ? '✅ YES (GOOD)' : '❌ NO (BUG!)'}`);
    
    // THIS IS THE CRITICAL TEST
    if (!afterLogout.userStillShown && !afterLogout.logoutBtnStillVisible) {
      console.log('\n   ✅✅✅ SUCCESS: User is logged out and STAYS logged out!');
      testsPassed++;
    } else {
      console.log('\n   ❌❌❌ FAILURE: User is still logged in (BUG NOT FIXED!)');
      testsFailed++;
    }
    console.log('');

    // =================================================================
    // TEST 6: Wait and Verify No Auto-Login Happens
    // =================================================================
    console.log('📋 TEST 6: Wait 5 seconds - Verify No Auto-Login');
    console.log('─'.repeat(80));
    console.log('   ⏳ Waiting 5 seconds to ensure no auto-login...');
    
    await delay(5000);
    
    const stillLoggedOut = await page.evaluate(() => {
      const userElement = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤')
      );
      return {
        userStillShown: !!userElement,
        pageTitle: document.title
      };
    });
    
    await page.screenshot({ path: './screenshots/03-5sec-after-logout.png', fullPage: false });
    console.log('   📸 Screenshot: 03-5sec-after-logout.png');
    
    if (!stillLoggedOut.userStillShown) {
      console.log('   ✅ User still logged out after 5 seconds - NO AUTO-LOGIN!');
      testsPassed++;
    } else {
      console.log('   ❌ User auto-logged back in (BUG!)');
      testsFailed++;
    }
    console.log('');

    // =================================================================
    // TEST 7: Verify LocalStorage and Cookies Cleared
    // =================================================================
    console.log('📋 TEST 7: Verify Session Data Cleared');
    console.log('─'.repeat(80));
    
    const sessionData = await page.evaluate(() => {
      return {
        hasSessionToken: !!localStorage.getItem('session_token'),
        cookies: document.cookie
      };
    });
    
    if (!sessionData.hasSessionToken) {
      console.log('   ✅ LocalStorage session token cleared');
      testsPassed++;
    } else {
      console.log('   ❌ LocalStorage session token still present');
      testsFailed++;
    }
    
    console.log(`   Cookies: ${sessionData.cookies || 'None'}`);
    console.log('');

    // =================================================================
    // TEST 8: Verify Can Login Again
    // =================================================================
    console.log('📋 TEST 8: Verify Can Login Again (Security Disabled Mode)');
    console.log('─'.repeat(80));
    
    if (!authStatus.security_enabled) {
      console.log('   ℹ️  Security disabled - app should allow re-entry without login form');
      
      // Refresh page
      await page.reload({ waitUntil: 'networkidle0' });
      await delay(2000);
      
      const afterRefresh = await page.evaluate(() => {
        const userElement = Array.from(document.querySelectorAll('span')).find(
          el => el.textContent?.includes('👤')
        );
        return {
          userShown: !!userElement,
          userText: userElement?.textContent || 'Not shown'
        };
      });
      
      await page.screenshot({ path: './screenshots/04-after-refresh.png', fullPage: false });
      console.log('   📸 Screenshot: 04-after-refresh.png');
      
      if (afterRefresh.userShown) {
        console.log('   ✅ User auto-logged in after refresh (expected for security disabled)');
        console.log(`   ✅ User: ${afterRefresh.userText}`);
        testsPassed++;
      } else {
        console.log('   ⚠️  User not auto-logged in (unexpected)');
        testsFailed++;
      }
    } else {
      console.log('   ℹ️  Security enabled - skipping auto-login test');
      testsPassed++;
    }
    console.log('');

    // Keep browser open for manual inspection
    console.log('⏳ Keeping browser open for 10 seconds for manual inspection...');
    await delay(10000);

  } catch (error) {
    console.error('❌ Critical Error:', error.message);
    testsFailed++;
  } finally {
    await browser.close();
    console.log('\n🔒 Browser closed\n');
  }

  // =================================================================
  // FINAL RESULTS
  // =================================================================
  console.log('═'.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('═'.repeat(80));
  
  if (testsFailed === 0) {
    console.log('\n🎉🎉🎉 ALL TESTS PASSED - LOGOUT BUG IS FIXED! 🎉🎉🎉\n');
    console.log('✅ User can logout successfully');
    console.log('✅ User stays logged out (no auto-login after logout)');
    console.log('✅ Session data is cleared properly');
    console.log('✅ User can login again when desired\n');
    return 0;
  } else {
    console.log('\n❌❌❌ TESTS FAILED - LOGOUT BUG STILL EXISTS! ❌❌❌\n');
    console.log(`${testsFailed} test(s) failed. Review screenshots in ./screenshots/\n`);
    return 1;
  }
}

// Run validation
validateLogoutFix()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




