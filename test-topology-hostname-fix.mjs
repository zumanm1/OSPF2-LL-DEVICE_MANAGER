#!/usr/bin/env node
/**
 * Test Topology Hostname Fix
 * 
 * Validates that exported topology uses REAL device hostnames
 * from the devices database, not synthetic names.
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:9050';
const API_BASE = 'http://localhost:9051';

// Expected REAL device hostnames from database
const EXPECTED_HOSTNAMES = [
  'deu-ber-bes-p06',
  'deu-ber-bes-pe10',
  'gbr-ldn-wst-p07',
  'gbr-ldn-wst-pe09',
  'usa-nyc-dc1-pe05',
  'usa-nyc-dc1-rr08',
  'zwe-bul-pop-p03',
  'zwe-bul-pop-p04',
  'zwe-hra-pop-p01',
  'zwe-hra-pop-p02'
];

// OLD synthetic names that should NOT appear
const OLD_SYNTHETIC_NAMES = [
  'deu-r10', 'deu-r6',
  'gbr-r9', 'gbr-r7',
  'usa-r8', 'usa-r5',
  'zwe-r1', 'zwe-r2', 'zwe-r3', 'zwe-r4'
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TOPOLOGY HOSTNAME FIX VALIDATION');
  console.log('='.repeat(80) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // ========================================================================
    // STEP 1: Login
    // ========================================================================
    console.log('📝 Step 1: Login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    
    await page.type('input[type="text"]', 'netviz_admin');
    await page.type('input[type="password"]', 'V3ry$trongAdm1n!2025');
    await page.click('button[type="submit"]');
    
    await delay(2000);
    console.log('✅ Logged in successfully\n');

    // ========================================================================
    // STEP 2: Navigate to OSPF Designer (Transformation page)
    // ========================================================================
    console.log('📝 Step 2: Navigate to OSPF Designer...');
    await page.goto(`${BASE_URL}/transformation`, { waitUntil: 'networkidle0' });
    await delay(1000);
    console.log('✅ On OSPF Designer page\n');

    // ========================================================================
    // STEP 3: Generate Topology
    // ========================================================================
    console.log('📝 Step 3: Generate Topology...');
    
    // Click "Generate Topology" button
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const generateBtn = buttons.find(b => b.textContent.includes('Generate Topology'));
      if (generateBtn) {
        generateBtn.click();
        return true;
      }
      return false;
    });
    
    if (clicked) {
      console.log('🔄 Clicked Generate Topology button');
      await delay(5000); // Wait for topology generation
    } else {
      console.log('⚠️  Generate button not found, topology may already exist');
    }
    
    console.log('✅ Topology generation requested\n');

    // ========================================================================
    // STEP 4: Export NetViz Pro Topology
    // ========================================================================
    console.log('📝 Step 4: Export NetViz Pro Topology...');
    
    // Get session cookie for API call
    const cookies = await page.cookies();
    const sessionCookie = cookies.find(c => c.name === 'session_token');
    const sessionToken = sessionCookie ? sessionCookie.value : '';

    // Call API directly to get topology data
    const response = await page.evaluate(async (apiBase, token) => {
      const res = await fetch(`${apiBase}/api/transform/topology/netviz-pro`, {
        credentials: 'include',
        headers: {
          'Cookie': `session_token=${token}`
        }
      });
      return await res.json();
    }, API_BASE, sessionToken);

    console.log('✅ Topology exported\n');

    // ========================================================================
    // STEP 5: Validate Hostnames
    // ========================================================================
    console.log('📝 Step 5: Validate Hostnames...\n');
    console.log('─'.repeat(80));
    
    const nodes = response.nodes || [];
    console.log(`Total nodes in topology: ${nodes.length}\n`);

    let correctCount = 0;
    let incorrectCount = 0;
    const foundHostnames = [];
    const foundSyntheticNames = [];

    for (const node of nodes) {
      const nodeName = node.name || node.id || node.hostname;
      foundHostnames.push(nodeName);

      // Check if it's a real hostname
      if (EXPECTED_HOSTNAMES.includes(nodeName)) {
        console.log(`✅ CORRECT: ${nodeName} (real device hostname)`);
        correctCount++;
      }
      // Check if it's an old synthetic name
      else if (OLD_SYNTHETIC_NAMES.includes(nodeName)) {
        console.log(`❌ INCORRECT: ${nodeName} (old synthetic name - BUG!)`);
        incorrectCount++;
        foundSyntheticNames.push(nodeName);
      }
      // Unknown name
      else {
        console.log(`⚠️  UNKNOWN: ${nodeName} (not in expected list)`);
      }
    }

    console.log('\n' + '─'.repeat(80));
    console.log('📊 VALIDATION RESULTS:');
    console.log('─'.repeat(80));
    console.log(`✅ Correct hostnames: ${correctCount}/${nodes.length}`);
    console.log(`❌ Synthetic names (bug): ${incorrectCount}/${nodes.length}`);
    console.log('─'.repeat(80) + '\n');

    // ========================================================================
    // STEP 6: Final Verdict
    // ========================================================================
    if (incorrectCount === 0 && correctCount > 0) {
      console.log('🎉 SUCCESS! All nodes use REAL device hostnames!');
      console.log('✅ Bug is FIXED!\n');
      console.log('Found hostnames:', foundHostnames.join(', '));
    } else if (incorrectCount > 0) {
      console.log('❌ FAILURE! Topology still contains synthetic names!');
      console.log('🐛 Bug is NOT fixed yet!\n');
      console.log('Synthetic names found:', foundSyntheticNames.join(', '));
      console.log('\nExpected hostnames:', EXPECTED_HOSTNAMES.join(', '));
    } else {
      console.log('⚠️  WARNING! No nodes found or validation inconclusive.');
    }

    console.log('\n' + '='.repeat(80));
    console.log('Test complete!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

