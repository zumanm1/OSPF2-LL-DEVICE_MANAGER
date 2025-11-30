#!/usr/bin/env node
/**
 * Quick Screenshot Tool - Verify App is Running
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const SCREENSHOT_PATH = './screenshots/app-running-verification.png';

async function takeScreenshot() {
  console.log('🔍 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log(`📸 Navigating to ${FRONTEND_URL}...`);
    await page.goto(FRONTEND_URL, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });

    console.log('⏳ Waiting for page to render...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`💾 Saving screenshot to ${SCREENSHOT_PATH}...`);
    await page.screenshot({ 
      path: SCREENSHOT_PATH,
      fullPage: true 
    });

    console.log('✅ Screenshot saved successfully!');
    
    // Get page title
    const title = await page.title();
    console.log(`📄 Page Title: ${title}`);
    
    // Check if login page
    const loginElements = await page.evaluate(() => {
      const username = document.querySelector('input[id="username"]');
      const password = document.querySelector('input[id="password"]');
      const loginButton = document.querySelector('button[type="submit"]');
      const heading = document.querySelector('h1');
      
      return {
        hasUsername: !!username,
        hasPassword: !!password,
        hasLoginButton: !!loginButton,
        heading: heading ? heading.textContent : 'No heading found'
      };
    });
    
    console.log('🔍 Page Elements:', JSON.stringify(loginElements, null, 2));
    
    if (loginElements.hasUsername && loginElements.hasPassword) {
      console.log('✅ LOGIN PAGE DETECTED - App is running correctly!');
    } else {
      console.log('⚠️  Login page elements not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
    console.log('🔒 Browser closed');
  }
}

// Create screenshots directory
import { mkdirSync } from 'fs';
try {
  mkdirSync('./screenshots', { recursive: true });
} catch (e) {}

// Run
takeScreenshot()
  .then(() => {
    console.log('\n✅ VERIFICATION COMPLETE');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ VERIFICATION FAILED:', error.message);
    process.exit(1);
  });

