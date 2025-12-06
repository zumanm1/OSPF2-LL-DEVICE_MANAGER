#!/usr/bin/env node
/**
 * DEEP DEBUG - Check browser console and React state
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';

async function deepDebug() {
  console.log('\n🔍 DEEP DEBUG - Logout Issue Analysis\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`  🖥️  Console: [${msg.type()}] ${msg.text()}`);
  });

  console.log('1️⃣ Loading app...\n');
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n2️⃣ Checking React state BEFORE logout...\n');
  const stateBefore = await page.evaluate(() => {
    // Try to access React internals (dev mode only)
    const rootElement = document.querySelector('#root');
    return {
      hasRoot: !!rootElement,
      html: document.body.innerHTML.substring(0, 200)
    };
  });
  console.log('   Root element exists:', stateBefore.hasRoot);

  console.log('\n3️⃣ Clicking logout...\n');
  await page.evaluate(() => {
    const logoutBtn = Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('Logout')
    );
    if (logoutBtn) {
      console.log('🔴 LOGOUT BUTTON CLICKED');
      logoutBtn.click();
    }
  });

  await new Promise(r => setTimeout(r, 3000));

  console.log('\n4️⃣ Checking state AFTER logout...\n');
  const stateAfter = await page.evaluate(() => {
    const userElement = Array.from(document.querySelectorAll('span')).find(
      el => el.textContent?.includes('👤')
    );
    const loginInput = document.querySelector('input[id="username"]');
    
    return {
      userStillVisible: !!userElement,
      userText: userElement?.textContent,
      loginPageShown: !!loginInput,
      bodyHasLogin: document.body.innerHTML.includes('Sign In'),
      bodyHasDeviceManager: document.body.innerHTML.includes('Device Manager')
    };
  });
  
  console.log('   User still visible:', stateAfter.userStillVisible);
  console.log('   User text:', stateAfter.userText);
  console.log('   Login page shown:', stateAfter.loginPageShown);
  console.log('   Body has "Sign In":', stateAfter.bodyHasLogin);
  console.log('   Body has "Device Manager":', stateAfter.bodyHasDeviceManager);

  console.log('\n5️⃣ Console logs captured:\n');
  consoleLogs.forEach(log => console.log('   ', log));

  console.log('\n⏳ Keeping browser open for 10 seconds...\n');
  await new Promise(r => setTimeout(r, 10000));

  await browser.close();
}

deepDebug().catch(console.error);




