#!/usr/bin/env node
/**
 * TEST NETVIZ_ADMIN LOGIN - AFTER FIXING PASSWORD EXPIRY
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function testLogin() {
  console.log('\n🔐 TESTING NETVIZ_ADMIN LOGIN\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  try {
    const page = await browser.newPage();
    
    console.log('1️⃣ Loading login page...\n');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
    await delay(2000);
    
    // Check for password expired warning
    const hasExpiredWarning = await page.evaluate(() => {
      return document.body.textContent?.includes('Password Expired');
    });
    
    if (hasExpiredWarning) {
      console.log('   ❌ Password expired warning still showing!\n');
    } else {
      console.log('   ✅ No password expired warning\n');
    }
    
    console.log('2️⃣ Entering credentials...\n');
    console.log('   Username: netviz_admin');
    console.log('   Password: V3ry$trongAdm1n!2025\n');
    
    await page.type('input[id="username"]', 'netviz_admin');
    await page.type('input[id="password"]', 'V3ry$trongAdm1n!2025');
    
    await page.screenshot({ path: './screenshots/before-login.png' });
    console.log('   📸 Screenshot: before-login.png\n');
    
    console.log('3️⃣ Clicking Sign In button...\n');
    await page.click('button[type="submit"]');
    await delay(3000);
    
    await page.screenshot({ path: './screenshots/after-login.png' });
    console.log('   📸 Screenshot: after-login.png\n');
    
    console.log('4️⃣ Checking if login successful...\n');
    const result = await page.evaluate(() => {
      const user = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤')
      );
      const hasDeviceManager = document.body.textContent?.includes('Device Manager');
      const hasLoginPage = document.body.textContent?.includes('Sign In');
      
      return {
        loggedIn: !!user,
        userText: user?.textContent,
        hasDeviceManager,
        hasLoginPage
      };
    });
    
    console.log(`   Logged in: ${result.loggedIn}`);
    console.log(`   User shown: ${result.userText}`);
    console.log(`   Has Device Manager: ${result.hasDeviceManager}`);
    console.log(`   Still on login page: ${result.hasLoginPage}\n`);
    
    if (result.loggedIn && result.userText?.includes('netviz_admin')) {
      console.log('✅✅✅ SUCCESS! Logged in as netviz_admin!\n');
      console.log('🎉 The netviz_admin account is working perfectly!\n');
      
      // Test permissions
      console.log('5️⃣ Verifying admin permissions...\n');
      const hasAdminFeatures = await page.evaluate(() => {
        return {
          hasAutomation: document.body.textContent?.includes('Automation'),
          hasOSPF: document.body.textContent?.includes('OSPF'),
          hasUserMenu: !!document.querySelector('[data-testid="user-menu"]') || 
                       Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Logout'))
        };
      });
      
      console.log(`   Has Automation menu: ${hasAdminFeatures.hasAutomation}`);
      console.log(`   Has OSPF menu: ${hasAdminFeatures.hasOSPF}`);
      console.log(`   Has user menu: ${hasAdminFeatures.hasUserMenu}\n`);
      
      if (hasAdminFeatures.hasAutomation && hasAdminFeatures.hasOSPF) {
        console.log('✅ Admin permissions confirmed!\n');
      }
      
      await delay(10000);
      await browser.close();
      return 0;
    } else {
      console.log('❌ Login FAILED!\n');
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

testLogin()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });

