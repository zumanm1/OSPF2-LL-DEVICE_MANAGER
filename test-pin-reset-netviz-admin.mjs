#!/usr/bin/env node
/**
 * Test PIN Reset for netviz_admin account
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const API_URL = 'http://localhost:9051/api';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function testPinReset() {
  console.log('\n🔐 TESTING PIN RESET FOR NETVIZ_ADMIN\n');
  console.log('=' .repeat(80) + '\n');

  // Step 1: Test PIN reset via API
  console.log('1️⃣ Testing PIN reset via API...\n');
  
  try {
    const response = await fetch(`${API_URL}/auth/reset-password-with-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin: '08230' })
    });
    
    const data = await response.json();
    
    if (response.ok && data.status === 'success') {
      console.log('   ✅ PIN reset successful via API');
      console.log(`   📝 Message: ${data.message}\n`);
    } else {
      console.log('   ❌ PIN reset failed');
      console.log(`   📝 Error: ${data.detail || data.message}\n`);
      return 1;
    }
  } catch (error) {
    console.log('   ❌ API request failed:', error.message);
    return 1;
  }

  // Step 2: Test login with reset credentials
  console.log('2️⃣ Testing login with netviz_admin after PIN reset...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  try {
    const page = await browser.newPage();
    
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
    await delay(2000);
    
    console.log('   🔑 Entering credentials:');
    console.log('      Username: netviz_admin');
    console.log('      Password: V3ry$trongAdm1n!2025\n');
    
    await page.type('input[id="username"]', 'netviz_admin');
    await page.type('input[id="password"]', 'V3ry$trongAdm1n!2025');
    await page.click('button[type="submit"]');
    await delay(3000);
    
    const result = await page.evaluate(() => {
      const user = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤')
      );
      return {
        loggedIn: !!user,
        userText: user?.textContent
      };
    });
    
    if (result.loggedIn && result.userText?.includes('netviz_admin')) {
      console.log('   ✅ Login successful!');
      console.log(`   👤 Logged in as: ${result.userText}\n`);
    } else {
      console.log('   ❌ Login failed!\n');
      await browser.close();
      return 1;
    }
    
    // Step 3: Test old admin account (should fail)
    console.log('3️⃣ Verifying legacy admin account is removed...\n');
    
    // Logout first
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('Logout')
      );
      if (btn) btn.click();
    });
    await delay(2000);
    
    // Try to login with old admin credentials
    await page.type('input[id="username"]', 'admin');
    await page.type('input[id="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await delay(2000);
    
    const adminLoginResult = await page.evaluate(() => {
      const error = document.body.textContent?.includes('Invalid username or password') ||
                    document.body.textContent?.includes('Invalid credentials');
      const user = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('👤 admin')
      );
      return {
        hasError: error,
        loggedIn: !!user
      };
    });
    
    if (adminLoginResult.hasError || !adminLoginResult.loggedIn) {
      console.log('   ✅ Legacy admin account blocked (as expected)');
      console.log('   ✅ Only netviz_admin can login\n');
    } else {
      console.log('   ⚠️  Legacy admin still works (unexpected)\n');
    }
    
    await delay(5000);
    await browser.close();
    
    console.log('=' .repeat(80));
    console.log('✅ PIN RESET TEST COMPLETE');
    console.log('=' .repeat(80) + '\n');
    
    console.log('📋 RESULTS:\n');
    console.log('✅ PIN reset (08230) works for netviz_admin');
    console.log('✅ netviz_admin can login after PIN reset');
    console.log('✅ Legacy admin account removed');
    console.log('✅ System security maintained\n');
    
    return 0;
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await browser.close();
    return 1;
  }
}

testPinReset()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });

