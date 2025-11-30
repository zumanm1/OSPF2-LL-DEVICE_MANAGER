#!/usr/bin/env node
/**
 * Test API Topology Export
 * Direct API test without UI interaction
 */

import puppeteer from 'puppeteer';

const API_BASE = 'http://localhost:9051';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 API TOPOLOGY EXPORT TEST');
  console.log('='.repeat(80) + '\n');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Login to get session token
    console.log('📝 Step 1: Login via API...');
    const loginResponse = await page.evaluate(async (apiBase) => {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'netviz_admin',
          password: 'V3ry$trongAdm1n!2025'
        })
      });
      return await res.json();
    }, API_BASE);

    if (!loginResponse.token) {
      throw new Error('Login failed');
    }
    console.log('✅ Logged in\n');

    // Get NetViz Pro topology
    console.log('📝 Step 2: Fetch NetViz Pro topology...');
    const topology = await page.evaluate(async (apiBase, token) => {
      const res = await fetch(`${apiBase}/api/transform/topology/netviz-pro`, {
        headers: {
          'X-Session-Token': token
        }
      });
      return await res.json();
    }, API_BASE, loginResponse.token);

    console.log('✅ Topology fetched\n');

    // Validate
    console.log('📝 Step 3: Validate hostnames...\n');
    console.log('─'.repeat(80));
    
    const nodes = topology.nodes || [];
    console.log(`Total nodes: ${nodes.length}\n`);

    const EXPECTED = [
      'deu-ber-bes-p06', 'deu-ber-bes-pe10',
      'gbr-ldn-wst-p07', 'gbr-ldn-wst-pe09',
      'usa-nyc-dc1-pe05', 'usa-nyc-dc1-rr08',
      'zwe-bul-pop-p03', 'zwe-bul-pop-p04',
      'zwe-hra-pop-p01', 'zwe-hra-pop-p02'
    ];

    const OLD_SYNTHETIC = [
      'deu-r10', 'deu-r6', 'gbr-r9', 'gbr-r7',
      'usa-r8', 'usa-r5', 'zwe-r1', 'zwe-r2', 'zwe-r3', 'zwe-r4'
    ];

    let correctCount = 0;
    let syntheticCount = 0;

    for (const node of nodes) {
      const name = node.name || node.id;
      if (EXPECTED.includes(name)) {
        console.log(`✅ ${name} (real hostname)`);
        correctCount++;
      } else if (OLD_SYNTHETIC.includes(name)) {
        console.log(`❌ ${name} (synthetic - BUG!)`);
        syntheticCount++;
      } else {
        console.log(`⚠️  ${name} (unknown)`);
      }
    }

    console.log('\n' + '─'.repeat(80));
    console.log(`✅ Correct: ${correctCount}/${nodes.length}`);
    console.log(`❌ Synthetic: ${syntheticCount}/${nodes.length}`);
    console.log('─'.repeat(80) + '\n');

    if (syntheticCount === 0 && correctCount > 0) {
      console.log('🎉 SUCCESS! All hostnames are correct!');
      console.log('✅ Bug is FIXED!\n');
    } else if (syntheticCount > 0) {
      console.log('❌ FAILURE! Synthetic names still present!');
      console.log('🐛 Bug NOT fixed!\n');
    } else {
      console.log('⚠️  No nodes or inconclusive\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

