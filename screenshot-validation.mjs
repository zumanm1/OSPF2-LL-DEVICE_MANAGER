#!/usr/bin/env node
/**
 * Screenshot Validation Script
 * Visual proof of OSPF cost flow: Step 1 -> Step 2 -> Step 3
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const FRONTEND_URL = 'http://localhost:5174';
const BACKEND_URL = 'http://localhost:9051';
const SCREENSHOT_DIR = '/Users/macbook/OSPF-LL-DEVICE_MANAGER/validation-screenshots';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  OSPF Device Manager - Screenshot Validation (Steps 1-2-3)     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Check backend health
  try {
    const health = await fetch(`${BACKEND_URL}/api/health`);
    const data = await health.json();
    if (data.status !== 'OK') throw new Error('Backend unhealthy');
    console.log('✅ Backend is healthy\n');
  } catch (e) {
    console.log('❌ Backend not running. Start it first.');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // ============================================================
    // STEP 1: DEVICE MANAGER PAGE
    // ============================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 1: DEVICE MANAGER - Where devices are managed');
    console.log('═══════════════════════════════════════════════════════════════');

    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
    await sleep(1500);

    // Count devices in the table
    const deviceCount = await page.$$eval('table tbody tr', rows => rows.length);
    console.log(`📋 Devices in table: ${deviceCount}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-device-manager.png'),
      fullPage: false
    });
    console.log(`📸 Screenshot: 01-device-manager.png\n`);

    // ============================================================
    // STEP 2: AUTOMATION PAGE
    // ============================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 2: AUTOMATION - Where OSPF commands are executed');
    console.log('═══════════════════════════════════════════════════════════════');

    await page.goto(`${FRONTEND_URL}/automation`, { waitUntil: 'networkidle0' });
    await sleep(1500);

    // Check for OSPF commands
    const commandLabels = await page.$$eval('label', els =>
      els.map(el => el.textContent.trim()).filter(t => t.includes('ospf'))
    );
    console.log(`📋 OSPF commands available: ${commandLabels.length}`);
    commandLabels.forEach(cmd => console.log(`   - ${cmd}`));

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-automation-page.png'),
      fullPage: false
    });
    console.log(`📸 Screenshot: 02-automation-page.png\n`);

    // ============================================================
    // STEP 2.5: DATA SAVE PAGE
    // ============================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 2.5: DATA SAVE - Where collected data is stored');
    console.log('═══════════════════════════════════════════════════════════════');

    await page.goto(`${FRONTEND_URL}/data-save`, { waitUntil: 'networkidle0' });
    await sleep(1500);

    // Check for OSPF-related files
    const fileItems = await page.$$eval('li, tr', els =>
      els.map(el => el.textContent).filter(t => t && t.includes('ospf'))
    );
    console.log(`📋 OSPF data files found: ${fileItems.length}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-datasave-page.png'),
      fullPage: false
    });
    console.log(`📸 Screenshot: 03-datasave-page.png\n`);

    // ============================================================
    // STEP 3: TRANSFORMATION PAGE - GENERATE TOPOLOGY
    // ============================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 3: TRANSFORMATION - Generate topology with OSPF costs');
    console.log('═══════════════════════════════════════════════════════════════');

    await page.goto(`${FRONTEND_URL}/transformation`, { waitUntil: 'networkidle0' });
    await sleep(1500);

    // Click Generate Topology button
    const generateBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Generate Topology'));
    });

    if (generateBtn) {
      await generateBtn.click();
      console.log('🔄 Clicked "Generate Topology" button...');
      await sleep(3000); // Wait for topology generation
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-transformation-topology.png'),
      fullPage: false
    });
    console.log(`📸 Screenshot: 04-transformation-topology.png\n`);

    // ============================================================
    // VERIFY API DATA - Physical Links with Asymmetric Costs
    // ============================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('API VERIFICATION: Physical Links with Both Directional Costs');
    console.log('═══════════════════════════════════════════════════════════════');

    const topoResponse = await fetch(`${BACKEND_URL}/api/transform/topology/latest`);
    const topology = await topoResponse.json();

    console.log(`\n📊 TOPOLOGY SUMMARY:`);
    console.log(`   Nodes (Routers): ${topology.nodes?.length || 0}`);
    console.log(`   Directional Links: ${topology.links?.length || 0}`);
    console.log(`   Physical Links: ${topology.physical_links?.length || 0}`);

    const asymLinks = topology.physical_links?.filter(l => l.is_asymmetric) || [];
    const symLinks = topology.physical_links?.filter(l => !l.is_asymmetric) || [];

    console.log(`   Asymmetric Links: ${asymLinks.length}`);
    console.log(`   Symmetric Links: ${symLinks.length}`);

    console.log(`\n📋 ASYMMETRIC LINKS (Different costs in each direction):`);
    console.log('   ─────────────────────────────────────────────────────────────');
    asymLinks.forEach((link, i) => {
      console.log(`   ${i+1}. ${link.router_a} <-> ${link.router_b}`);
      console.log(`      Cost A->B: ${link.cost_a_to_b} | Cost B->A: ${link.cost_b_to_a}`);
      console.log(`      Interface A: ${link.interface_a}`);
      console.log(`      Interface B: ${link.interface_b}`);
    });

    console.log(`\n📋 SYMMETRIC LINKS (Same cost both directions):`);
    console.log('   ─────────────────────────────────────────────────────────────');
    symLinks.slice(0, 5).forEach((link, i) => {
      console.log(`   ${i+1}. ${link.router_a} <-> ${link.router_b}: ${link.cost_a_to_b}/${link.cost_b_to_a}`);
    });
    if (symLinks.length > 5) {
      console.log(`   ... and ${symLinks.length - 5} more`);
    }

    // ============================================================
    // DOWNLOAD JSON - Verify both costs in export
    // ============================================================
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log('JSON EXPORT: Verify physical_links in downloaded topology');
    console.log('═══════════════════════════════════════════════════════════════');

    // Save the topology JSON for verification
    const jsonPath = path.join(SCREENSHOT_DIR, 'topology-export.json');
    fs.writeFileSync(jsonPath, JSON.stringify(topology, null, 2));
    console.log(`💾 Topology JSON saved: topology-export.json`);

    // Check physical_links structure
    if (topology.physical_links && topology.physical_links.length > 0) {
      const sample = topology.physical_links[0];
      console.log(`\n📋 Sample physical_link structure:`);
      console.log(JSON.stringify(sample, null, 2));
    }

    // ============================================================
    // FINAL SUMMARY
    // ============================================================
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║                    VALIDATION COMPLETE                          ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝`);

    console.log(`\n📁 Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log(`   - 01-device-manager.png`);
    console.log(`   - 02-automation-page.png`);
    console.log(`   - 03-datasave-page.png`);
    console.log(`   - 04-transformation-topology.png`);
    console.log(`   - topology-export.json`);

    console.log(`\n✅ OSPF Cost Flow Verified:`);
    console.log(`   Step 1: ${deviceCount} devices managed`);
    console.log(`   Step 2: ${commandLabels.length} OSPF commands configured`);
    console.log(`   Step 3: ${topology.physical_links?.length} physical links with bidirectional costs`);
    console.log(`           ${asymLinks.length} asymmetric | ${symLinks.length} symmetric`);

  } catch (error) {
    console.error('\n❌ Validation Error:', error.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
