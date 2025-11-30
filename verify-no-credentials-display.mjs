#!/usr/bin/env node
/**
 * Verify login page does NOT show credentials
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function verifyNoCredentials() {
  console.log('\n🔒 VERIFYING NO CREDENTIALS DISPLAYED ON LOGIN PAGE\n');
  console.log('='.repeat(80) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  try {
    const page = await browser.newPage();
    
    console.log('1️⃣ Loading login page...\n');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
    await delay(3000);
    
    await page.screenshot({ path: './screenshots/login-no-creds.png' });
    console.log('   📸 Screenshot: login-no-creds.png\n');
    
    console.log('2️⃣ Checking for credential leaks...\n');
    const content = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return {
        hasNetvizAdmin: text.includes('netviz_admin'),
        hasPassword: text.includes('V3ry$trongAdm1n!2025'),
        hasAdminOld: text.includes('admin123'),
        hasDefaultCreds: text.includes('default credentials'),
        hasUsingCreds: text.includes('Using'),
        fullText: text.substring(0, 600)
      };
    });
    
    console.log('   Security Checks:');
    console.log(`   - Shows netviz_admin username: ${content.hasNetvizAdmin ? '❌ YES (SECURITY ISSUE!)' : '✅ NO (SECURE)'}`);
    console.log(`   - Shows password: ${content.hasPassword ? '❌ YES (SECURITY ISSUE!)' : '✅ NO (SECURE)'}`);
    console.log(`   - Shows old admin123: ${content.hasAdminOld ? '❌ YES (SECURITY ISSUE!)' : '✅ NO (SECURE)'}`);
    console.log(`   - Mentions "default credentials": ${content.hasDefaultCreds ? '❌ YES (SECURITY ISSUE!)' : '✅ NO (SECURE)'}`);
    console.log(`   - Shows "Using" message: ${content.hasUsingCreds ? '❌ YES (SECURITY ISSUE!)' : '✅ NO (SECURE)'}`);
    console.log();
    
    if (!content.hasNetvizAdmin && !content.hasPassword && !content.hasAdminOld && !content.hasDefaultCreds && !content.hasUsingCreds) {
      console.log('✅✅✅ LOGIN PAGE IS SECURE!\n');
      console.log('✅ No credentials displayed');
      console.log('✅ No usernames shown');
      console.log('✅ No passwords exposed');
      console.log('✅ No credential hints');
      console.log('✅ Clean and secure login page\n');
      
      await delay(5000);
      await browser.close();
      return 0;
    } else {
      console.log('❌ SECURITY ISSUE: Credentials are visible!\n');
      
      if (content.hasNetvizAdmin) {
        console.log('❌ Username "netviz_admin" is visible');
      }
      if (content.hasPassword) {
        console.log('❌ Password is visible on page');
      }
      if (content.hasDefaultCreds || content.hasUsingCreds) {
        console.log('❌ Credential hints are visible');
      }
      
      console.log('\n📝 Page preview:');
      console.log(content.fullText.substring(0, 400) + '...\n');
      
      await delay(10000);
      await browser.close();
      return 1;
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    return 1;
  }
}

verifyNoCredentials()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });

