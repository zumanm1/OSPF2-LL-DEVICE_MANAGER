#!/usr/bin/env node
import puppeteer from 'puppeteer';

const SCREENSHOT_DIR = '/Users/macbook/OSPF-LL-DEVICE_MANAGER/workflow-proof';

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1200 });

  // Go to Interface Costs page
  await page.goto('http://localhost:5174/interface-costs', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot 1: Full page
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/STEP2.5b-interface-costs-page.png`,
    fullPage: true
  });
  console.log('📸 STEP2.5b-interface-costs-page.png');

  // Filter asymmetric only
  await page.select('select:nth-of-type(2)', 'asym');
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/STEP2.5b-asymmetric-only.png`,
    fullPage: false
  });
  console.log('📸 STEP2.5b-asymmetric-only.png');

  await browser.close();
  console.log('✅ Interface Costs screenshots captured!');
}

main().catch(console.error);
