#!/usr/bin/env node
/**
 * ULTIMATE FINAL TEST - With Security Enabled
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function ultimateTest() {
  console.log('\n🔥🔥🔥 ULTIMATE LOGOUT TEST - SECURITY ENABLED 🔥🔥🔥\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);

    console.log('1️⃣ Loading app...\n');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
    await delay(2000);

    const onLoginPage = await page.evaluate(() => {
      return !!document.querySelector('input[id="username"]');
    });

    if (onLoginPage) {
      console.log('   ✅ Login page shown (security enabled)\n');
      
      console.log('2️⃣ Logging in with netviz_admin...\n');
      await page.type('input[id="username"]', 'netviz_admin');
      await page.type('input[id="password"]', 'V3ry$trongAdm1n!2025');
      await page.click('button[type="submit"]');
      await delay(3000);
    } else {
      console.log('   ⚠️  Auto-logged in (security might still be disabled)\n');
    }

    const loggedIn = await page.evaluate(() => {
      const user = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤')
      );
      return {has: !!user, text: user?.textContent};
    });

    if (loggedIn.has) {
      console.log(`   ✅ User logged in: ${loggedIn.text}\n`);
    } else {
      console.log('   ❌ User NOT logged in\n');
      await browser.close();
      return 1;
    }

    console.log('3️⃣ Clicking LOGOUT...\n');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('Logout')
      );
      if (btn) btn.click();
    });

    await delay(3000);

    console.log('4️⃣ *** CRITICAL TEST *** Verifying logout...\n');
    const result = await page.evaluate(() => {
      const user = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤')
      );
      const loginInput = document.querySelector('input[id="username"]');
      
      return {
        userStillShown: !!user,
        loginPageShown: !!loginInput,
        url: window.location.href
      };
    });

    console.log(`   URL: ${result.url}`);
    console.log(`   User still shown: ${result.userStillShown}`);
    console.log(`   Login page shown: ${result.loginPageShown}\n`);

    if (!result.userStillShown && result.loginPageShown) {
      console.log('   ✅✅✅ SUCCESS: User is LOGGED OUT and CANNOT ACCESS APP!\n');
      console.log('🎉🎉🎉 LOGOUT BUG IS FIXED! 🎉🎉🎉\n');
      console.log('🔒 App resources are PROTECTED - cannot access when logged out!\n');
      
      await delay(10000);
      await browser.close();
      return 0;
    } else {
      console.log('   ❌ FAILURE: User still has access\n');
      await delay(15000);
      await browser.close();
      return 1;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    return 1;
  }
}

ultimateTest()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });




