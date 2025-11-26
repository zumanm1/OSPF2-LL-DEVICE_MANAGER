#!/usr/bin/env node
import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:9050';

async function testRouting() {
  console.log('🚀 QUICK ROUTING VALIDATION\n');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const results = {};

  // Test 1: Root path (/)
  console.log('Testing: http://localhost:9050/');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  const rootH1 = await page.$eval('h1', el => el.textContent.trim());
  const hasDeviceTable = await page.$('table') !== null;
  results.root = { h1: rootH1, hasDeviceTable };
  console.log(`  ✓ H1: "${rootH1}"`);
  console.log(`  ✓ Device table: ${hasDeviceTable ? 'YES' : 'NO'}\n`);

  // Test 2: Automation page (/automation)
  console.log('Testing: http://localhost:9050/automation');
  await page.goto(`${BASE_URL}/automation`, { waitUntil: 'networkidle0' });
  const automationH1 = await page.$eval('h1', el => el.textContent.trim());
  const hasStartButton = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(btn =>
      btn.textContent.includes('Start Automation') || btn.textContent.includes('Run Automation')
    );
  });
  results.automation = { h1: automationH1, hasStartButton };
  console.log(`  ✓ H1: "${automationH1}"`);
  console.log(`  ✓ Start button: ${hasStartButton ? 'YES' : 'NO'}\n`);

  // Test 3: Data Save page (/data-save)
  console.log('Testing: http://localhost:9050/data-save');
  await page.goto(`${BASE_URL}/data-save`, { waitUntil: 'networkidle0' });
  const dataSaveH1 = await page.$eval('h1', el => el.textContent.trim());
  const hasGenerateTopologyButton = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(btn =>
      btn.textContent.includes('Generate Topology')
    );
  });
  results.dataSave = { h1: dataSaveH1, hasGenerateTopologyButton };
  console.log(`  ✓ H1: "${dataSaveH1}"`);
  console.log(`  ✓ Generate Topology button: ${hasGenerateTopologyButton ? 'YES' : 'NO'}\n`);

  // Test 4: Transformation page (/transformation)
  console.log('Testing: http://localhost:9050/transformation');
  await page.goto(`${BASE_URL}/transformation`, { waitUntil: 'networkidle0' });
  const transformationH1 = await page.$eval('h1', el => el.textContent.trim());
  const hasNewAutomationButton = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(btn =>
      btn.textContent.includes('New Automation')
    );
  });
  const hasSVG = await page.$('svg[viewBox]') !== null;
  results.transformation = { h1: transformationH1, hasNewAutomationButton, hasSVG };
  console.log(`  ✓ H1: "${transformationH1}"`);
  console.log(`  ✓ New Automation button: ${hasNewAutomationButton ? 'YES' : 'NO'}`);
  console.log(`  ✓ SVG canvas: ${hasSVG ? 'YES' : 'NO'}\n`);

  await browser.close();

  // Validation
  console.log('='.repeat(60));
  console.log('VALIDATION RESULTS:');
  console.log('='.repeat(60));

  const allUnique = new Set([
    results.root.h1,
    results.automation.h1,
    results.dataSave.h1,
    results.transformation.h1
  ]).size === 4;

  if (allUnique) {
    console.log('✅ SUCCESS: All pages show UNIQUE h1 titles!');
  } else {
    console.log('❌ FAILURE: Some pages show IDENTICAL h1 titles (routing not working)');
  }

  if (results.root.hasDeviceTable && results.automation.hasStartButton &&
      results.dataSave.hasGenerateTopologyButton && results.transformation.hasNewAutomationButton) {
    console.log('✅ SUCCESS: All page-specific buttons found!');
  } else {
    console.log('❌ FAILURE: Some page-specific elements missing');
  }

  console.log('\nDetailed Results:');
  console.log(JSON.stringify(results, null, 2));

  return allUnique;
}

testRouting().catch(console.error);
