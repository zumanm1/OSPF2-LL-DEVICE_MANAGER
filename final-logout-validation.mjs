#!/usr/bin/env node
/**
 * FINAL LOGOUT VALIDATION - WITH HARD REFRESH
 */

import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

const FRONTEND_URL = 'http://localhost:9050';

try {
  mkdirSync('./screenshots', { recursive: true });
} catch (e) {}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function finalValidation() {
  console.log('\n🔥 FINAL LOGOUT VALIDATION - WITH CACHE BYPASS 🔥\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-cache'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  let passed = 0, failed = 0;

  try {
    const page = await browser.newPage();
    
    // FORCE CACHE BYPASS
    await page.setCacheEnabled(false);
    
    // Monitor console for our logout log
    let logoutLogSeen = false;
    page.on('console', msg => {
      const text = msg.text();
      console.log(`   [Console] ${text}`);
      if (text.includes('User logged out')) {
        logoutLogSeen = true;
      }
    });

    console.log('1️⃣ Loading app with CACHE DISABLED...\n');
    await page.goto(FRONTEND_URL, { 
      waitUntil: 'networkidle0',
      timeout: 15000
    });
    await delay(3000);

    console.log('2️⃣ User should be auto-logged in (security disabled)...\n');
    const beforeLogout = await page.evaluate(() => {
      const user = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤')
      );
      return { userShown: !!user, userText: user?.textContent };
    });
    
    if (beforeLogout.userShown) {
      console.log(`   ✅ User logged in: ${beforeLogout.userText}\n`);
      passed++;
    } else {
      console.log('   ❌ User NOT logged in\n');
      failed++;
    }

    console.log('3️⃣ Clicking LOGOUT button...\n');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('Logout')
      );
      if (btn) btn.click();
    });
    
    await delay(3000);

    console.log('4️⃣ *** CRITICAL TEST *** - User should be LOGGED OUT...\n');
    const afterLogout = await page.evaluate(() => {
      const user = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤')
      );
      const loginInput = document.querySelector('input[id="username"]');
      const hasDeviceManager = document.body.innerHTML.includes('Device Manager');
      const hasSignIn = document.body.innerHTML.includes('Sign In');
      
      return {
        userStillShown: !!user,
        loginPageShown: !!loginInput,
        hasDeviceManager,
        hasSignIn
      };
    });

    await page.screenshot({ path: './screenshots/FINAL-after-logout.png' });
    console.log('   📸 Screenshot saved: FINAL-after-logout.png\n');

    console.log('   Results:');
    console.log(`     User still shown: ${afterLogout.userStillShown}`);
    console.log(`     Login page shown: ${afterLogout.loginPageShown}`);
    console.log(`     Has "Device Manager": ${afterLogout.hasDeviceManager}`);
    console.log(`     Has "Sign In": ${afterLogout.hasSignIn}`);
    console.log(`     Logout log seen in console: ${logoutLogSeen}\n`);

    if (!afterLogout.userStillShown) {
      console.log('   ✅✅✅ SUCCESS: User is LOGGED OUT!\n');
      passed++;
    } else {
      console.log('   ❌❌❌ FAILURE: User STILL LOGGED IN!\n');
      failed++;
    }

    console.log('⏳ Keeping browser open for 15 seconds for inspection...\n');
    await delay(15000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    failed++;
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉🎉🎉 LOGOUT BUG IS FIXED! 🎉🎉🎉\n');
    return 0;
  } else {
    console.log('\n❌ LOGOUT BUG STILL EXISTS ❌\n');
    return 1;
  }
}

finalValidation()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });




