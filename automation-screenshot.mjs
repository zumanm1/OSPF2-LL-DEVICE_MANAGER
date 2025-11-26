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

  // Go to Automation page
  await page.goto('http://localhost:5174/automation', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot 1: Full page showing command list
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/STEP2-automation-commands.png`,
    fullPage: true
  });
  console.log('📸 STEP2-automation-commands.png');

  // Scroll to command execution section to verify all commands visible
  await page.evaluate(() => {
    const cmdSection = document.querySelector('h3');
    if (cmdSection) cmdSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/STEP2-automation-commands-scrolled.png`,
    fullPage: false
  });
  console.log('📸 STEP2-automation-commands-scrolled.png');

  await browser.close();
  console.log('✅ Automation page screenshots captured!');
}

main().catch(console.error);
