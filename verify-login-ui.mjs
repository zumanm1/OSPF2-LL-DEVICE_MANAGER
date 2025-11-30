#!/usr/bin/env node
/**
 * Verify Login Page UI shows correct credentials
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function verifyLoginUI() {
  console.log('\n🔍 VERIFYING LOGIN PAGE UI\n');
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
    
    await page.screenshot({ path: './screenshots/login-ui-verification.png' });
    console.log('   📸 Screenshot: login-ui-verification.png\n');
    
    console.log('2️⃣ Checking UI text...\n');
    const uiContent = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return {
        hasOldAdmin: body.includes('admin/admin123'),
        hasNewAdmin: body.includes('netviz_admin'),
        hasPasswordExpired: body.includes('Password Expired'),
        fullText: body.substring(0, 500)
      };
    });
    
    console.log('   Results:');
    console.log(`   - Shows old admin/admin123: ${uiContent.hasOldAdmin ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
    console.log(`   - Shows netviz_admin: ${uiContent.hasNewAdmin ? '✅ YES (GOOD)' : '❌ NO (BAD)'}`);
    console.log(`   - Shows "Password Expired": ${uiContent.hasPasswordExpired ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
    console.log();
    
    if (!uiContent.hasOldAdmin && uiContent.hasNewAdmin && !uiContent.hasPasswordExpired) {
      console.log('✅✅✅ LOGIN PAGE UI IS CORRECT!\n');
      console.log('✅ Shows netviz_admin credentials');
      console.log('✅ No reference to old admin/admin123');
      console.log('✅ No password expired warning\n');
      
      await delay(5000);
      await browser.close();
      return 0;
    } else {
      console.log('❌ LOGIN PAGE UI HAS ISSUES\n');
      
      if (uiContent.hasOldAdmin) {
        console.log('❌ Still showing admin/admin123');
      }
      if (!uiContent.hasNewAdmin) {
        console.log('❌ Not showing netviz_admin');
      }
      if (uiContent.hasPasswordExpired) {
        console.log('❌ Still showing password expired warning');
      }
      
      console.log('\n📝 Page content preview:');
      console.log(uiContent.fullText.substring(0, 300) + '...\n');
      
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

verifyLoginUI()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });

