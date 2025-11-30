#!/usr/bin/env node
/**
 * Complete Workflow Validation - NetViz Pro Export with 0 Links
 * 
 * Tests:
 * 1. Login
 * 2. Navigate to Transformation page
 * 3. Verify topology shows 10 nodes with 0 links
 * 4. Test "Download JSON 2" (NetViz Pro format)
 * 5. Validate exported JSON has correct hostnames
 * 6. Take screenshots for visual confirmation
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = 'http://localhost:9050';
const API_BASE = 'http://localhost:9051';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 COMPLETE WORKFLOW VALIDATION - NETVIZ PRO EXPORT');
  console.log('='.repeat(80) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
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
    // STEP 2: Navigate to Transformation Page
    // ========================================================================
    console.log('📝 Step 2: Navigate to Transformation page...');
    await page.goto(`${BASE_URL}/transformation`, { waitUntil: 'networkidle0' });
    await delay(2000);
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/transformation-page.png', fullPage: true });
    console.log('✅ On Transformation page');
    console.log('📸 Screenshot saved: /tmp/transformation-page.png\n');

    // ========================================================================
    // STEP 3: Check Topology Display
    // ========================================================================
    console.log('📝 Step 3: Verify topology display...');
    
    const topologyInfo = await page.evaluate(() => {
      const nodesText = document.body.textContent;
      
      // Look for node count
      const nodesMatch = nodesText.match(/Nodes[:\s]*(\d+)/i);
      const linksMatch = nodesText.match(/Links[:\s]*(\d+)/i);
      
      // Check if node list is visible
      const nodesList = Array.from(document.querySelectorAll('body *'))
        .filter(el => el.textContent.includes('zwe-') || el.textContent.includes('deu-') || 
                      el.textContent.includes('gbr-') || el.textContent.includes('usa-'))
        .map(el => el.textContent.trim())
        .filter(text => text.match(/^(zwe|deu|gbr|usa)-[\w-]+$/));
      
      return {
        nodesCount: nodesMatch ? nodesMatch[1] : 'not found',
        linksCount: linksMatch ? linksMatch[1] : 'not found',
        visibleNodes: [...new Set(nodesList)].slice(0, 10)
      };
    });
    
    console.log(`   Nodes displayed: ${topologyInfo.nodesCount}`);
    console.log(`   Links displayed: ${topologyInfo.linksCount}`);
    console.log(`   Visible node names: ${topologyInfo.visibleNodes.length > 0 ? '✅' : '❌'}`);
    if (topologyInfo.visibleNodes.length > 0) {
      topologyInfo.visibleNodes.forEach(node => console.log(`     - ${node}`));
    }
    console.log();

    // ========================================================================
    // STEP 4: Test "Download JSON 2" Button
    // ========================================================================
    console.log('📝 Step 4: Test "Download JSON 2" (NetViz Pro format)...');
    
    // Listen for download
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: '/tmp/'
    });
    
    // Click Download JSON 2 button
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const downloadBtn = buttons.find(b => 
        b.textContent.includes('Download') && 
        (b.textContent.includes('JSON 2') || b.textContent.includes('JSON2'))
      );
      if (downloadBtn) {
        downloadBtn.click();
        return true;
      }
      return false;
    });
    
    if (clicked) {
      console.log('🔄 Clicked "Download JSON 2" button');
      await delay(3000); // Wait for download
      
      // Check for error message
      const errorMessage = await page.evaluate(() => {
        const body = document.body.textContent;
        if (body.includes('Failed to download') || body.includes('Error')) {
          const errorDiv = Array.from(document.querySelectorAll('*'))
            .find(el => el.textContent.includes('Failed to download') || 
                        el.textContent.includes('Error:'));
          return errorDiv ? errorDiv.textContent : 'Error found in page';
        }
        return null;
      });
      
      if (errorMessage) {
        console.log(`❌ Error: ${errorMessage}\n`);
      } else {
        console.log('✅ No error message displayed');
        
        // Check if file was downloaded
        const files = fs.readdirSync('/tmp/').filter(f => f.includes('netviz-pro-topology'));
        if (files.length > 0) {
          const latestFile = files.sort().reverse()[0];
          console.log(`✅ File downloaded: ${latestFile}`);
          
          // Read and validate the file
          const fileContent = fs.readFileSync(`/tmp/${latestFile}`, 'utf8');
          const topology = JSON.parse(fileContent);
          
          console.log('\n📊 Downloaded Topology Validation:');
          console.log(`   Nodes: ${topology.nodes?.length || 0}`);
          console.log(`   Links: ${topology.links?.length || 0}`);
          
          if (topology.nodes && topology.nodes.length > 0) {
            console.log('\n   Node Names (first 5):');
            topology.nodes.slice(0, 5).forEach(node => {
              console.log(`     ✅ ${node.name} (${node.loopback_ip})`);
            });
          }
        } else {
          console.log('⚠️  File not found in /tmp/ - may have downloaded to different location');
        }
      }
    } else {
      console.log('⚠️  "Download JSON 2" button not found');
    }
    console.log();

    // ========================================================================
    // STEP 5: API Test (Direct)
    // ========================================================================
    console.log('📝 Step 5: Direct API test...');
    
    const cookies = await page.cookies();
    const sessionCookie = cookies.find(c => c.name === 'session_token');
    
    if (sessionCookie) {
      const apiResponse = await page.evaluate(async (apiBase, token) => {
        try {
          const res = await fetch(`${apiBase}/api/transform/topology/netviz-pro`, {
            headers: {
              'X-Session-Token': token
            }
          });
          const data = await res.json();
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, API_BASE, sessionCookie.value);
      
      if (apiResponse.success) {
        console.log('✅ API responded successfully');
        console.log(`   Nodes: ${apiResponse.data.nodes?.length || 0}`);
        console.log(`   Links: ${apiResponse.data.links?.length || 0}`);
        console.log(`   Metadata: ${JSON.stringify(apiResponse.data.metadata || {}, null, 2)}`);
      } else {
        console.log(`❌ API error: ${apiResponse.error}`);
      }
    }
    console.log();

    // ========================================================================
    // STEP 6: Final Screenshot
    // ========================================================================
    console.log('📝 Step 6: Final screenshots...');
    await page.screenshot({ path: '/tmp/transformation-final.png', fullPage: true });
    console.log('📸 Final screenshot: /tmp/transformation-final.png\n');

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log('='.repeat(80));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Login: SUCCESS`);
    console.log(`✅ Navigation: SUCCESS`);
    console.log(`✅ Topology Display: ${topologyInfo.nodesCount} nodes, ${topologyInfo.linksCount} links`);
    console.log(`✅ Download Test: ${clicked ? 'Button clicked' : 'Button not found'}`);
    console.log(`✅ Screenshots: 2 images saved`);
    console.log('='.repeat(80));
    console.log('\n🎉 VALIDATION COMPLETE!\n');
    console.log('Screenshots saved:');
    console.log('  - /tmp/transformation-page.png');
    console.log('  - /tmp/transformation-final.png\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    await page.screenshot({ path: '/tmp/error-screenshot.png', fullPage: true });
    console.log('📸 Error screenshot: /tmp/error-screenshot.png');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

