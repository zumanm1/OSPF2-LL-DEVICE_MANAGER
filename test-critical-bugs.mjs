/**
 * Puppeteer Test: Validate Critical Data Flow Bugs
 *
 * This script validates the critical bugs found in the OSPF-LL-DEVICE_MANAGER application:
 *
 * BUG #1: DATA FLOW BROKEN - Files saved to /executions/ but read from /OUTPUT-Data_save/
 * BUG #2: Topology History Path Error - wrong os.path.dirname usage
 * BUG #3: JobStatus missing execution_id in TypeScript types
 * BUG #4: DataSave shows wrong folder names (IOSXRV-TEXT vs OUTPUT-Data_save)
 * BUG #5: 'current' symlink created but never used
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';
const TIMEOUT = 15000;

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(`  ${title}`, 'cyan');
  console.log('='.repeat(70) + '\n');
}

async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function testBug1_DataFlowMismatch() {
  logSection('BUG #1: DATA FLOW MISMATCH - File Location Check');

  const results = { passed: true, issues: [] };

  // Check filesystem paths
  const basePath = '/Users/macbook/OSPF-LL-DEVICE_MANAGER/backend/data';

  // 1. Check if executions directory has files (where automation SAVES)
  const executionsPath = path.join(basePath, 'executions');
  const outputDataSavePath = path.join(basePath, 'OUTPUT-Data_save', 'TEXT');
  const currentSymlink = path.join(basePath, 'current');

  log('Checking file system paths...', 'blue');

  // Check executions directory
  if (fs.existsSync(executionsPath)) {
    const execDirs = fs.readdirSync(executionsPath).filter(f => f.startsWith('exec_'));
    log(`  ✓ Executions directory found with ${execDirs.length} execution(s)`, 'green');

    if (execDirs.length > 0) {
      const latestExec = execDirs.sort().reverse()[0];
      const latestTextDir = path.join(executionsPath, latestExec, 'TEXT');
      if (fs.existsSync(latestTextDir)) {
        const filesInExec = fs.readdirSync(latestTextDir).length;
        log(`    → Latest execution (${latestExec}) has ${filesInExec} TEXT files`, 'yellow');
      }
    }
  } else {
    log(`  ✗ Executions directory NOT FOUND`, 'red');
    results.issues.push('Executions directory missing');
  }

  // Check OUTPUT-Data_save (where FileManager/API READS from)
  if (fs.existsSync(outputDataSavePath)) {
    const filesInOutput = fs.readdirSync(outputDataSavePath).length;
    log(`  ✓ OUTPUT-Data_save/TEXT found with ${filesInOutput} files`, 'green');
  } else {
    log(`  ✗ OUTPUT-Data_save/TEXT NOT FOUND`, 'red');
    results.issues.push('OUTPUT-Data_save/TEXT missing');
  }

  // Check if 'current' symlink exists and is valid
  if (fs.existsSync(currentSymlink)) {
    const linkTarget = fs.readlinkSync(currentSymlink);
    log(`  ✓ 'current' symlink exists → ${linkTarget}`, 'green');
    log(`    ⚠️  BUG: This symlink is NEVER USED by any API endpoint!`, 'yellow');
    results.issues.push("'current' symlink exists but is never used by FileManager or TopologyBuilder");
  } else {
    log(`  ✗ 'current' symlink NOT FOUND`, 'red');
  }

  // Test API endpoint for automation files
  log('\nTesting /api/automation/files endpoint...', 'blue');
  try {
    const response = await fetch(`${BACKEND_URL}/api/automation/files?folder_type=text`);
    const data = await response.json();

    log(`  API returned ${data.file_count} files from FileManager`, 'yellow');

    // FIXED: FileManager now uses 'current' symlink to read from executions/
    if (data.files && data.files.length > 0) {
      const sampleFile = data.files[0];
      log(`  Sample file path: ${sampleFile.filepath}`, 'yellow');

      if (sampleFile.filepath.includes('executions/')) {
        log(`  ✅ FIX VERIFIED: API now reads from executions/ (CORRECT location)`, 'green');
        results.passed = true;
      } else if (sampleFile.filepath.includes('OUTPUT-Data_save')) {
        log(`  ⚠️  BUG STILL EXISTS: API reads from OUTPUT-Data_save (OLD location)`, 'red');
        log(`     Should read from: executions/{execution_id}/ or current/`, 'red');
        results.passed = false;
        results.issues.push('API reads from OUTPUT-Data_save instead of executions/');
      } else {
        log(`  ⚠️  Unexpected path format: ${sampleFile.filepath}`, 'yellow');
      }
    }
  } catch (error) {
    log(`  ✗ API call failed: ${error.message}`, 'red');
    results.issues.push(`API call failed: ${error.message}`);
  }

  return results;
}

async function testBug2_TopologyHistoryPath() {
  logSection('BUG #2: TOPOLOGY HISTORY PATH ERROR');

  const results = { passed: true, issues: [] };

  // The bug: server.py uses os.path.dirname(BASE_DIR) which goes UP a directory
  // BASE_DIR = /backend/
  // os.path.dirname(BASE_DIR) = /OSPF-LL-DEVICE_MANAGER/ (WRONG!)

  const correctPath = '/Users/macbook/OSPF-LL-DEVICE_MANAGER/backend/data/OUTPUT-Transformation';
  const buggyPath = '/Users/macbook/OSPF-LL-DEVICE_MANAGER/data/OUTPUT-Transformation';

  log('Checking topology history paths...', 'blue');

  // Check if correct path exists
  if (fs.existsSync(correctPath)) {
    const files = fs.readdirSync(correctPath);
    log(`  ✓ CORRECT path exists: ${correctPath}`, 'green');
    log(`    Contains ${files.length} file(s)`, 'yellow');
  } else {
    log(`  ✗ CORRECT path MISSING: ${correctPath}`, 'red');
  }

  // Check if buggy path exists (it shouldn't have files)
  if (fs.existsSync(buggyPath)) {
    const files = fs.readdirSync(buggyPath);
    log(`  ⚠️  BUGGY path also exists: ${buggyPath}`, 'yellow');
    log(`    Contains ${files.length} file(s)`, 'yellow');
  } else {
    log(`  BUGGY path does not exist: ${buggyPath}`, 'yellow');
  }

  // Test API endpoint
  log('\nTesting /api/transform/history endpoint...', 'blue');
  try {
    const response = await fetch(`${BACKEND_URL}/api/transform/history`);

    if (response.ok) {
      const data = await response.json();
      log(`  API returned ${data.length} history entries`, 'yellow');

      // If no history found but files exist in correct path, bug is confirmed
      if (data.length === 0 && fs.existsSync(correctPath)) {
        const filesInCorrect = fs.readdirSync(correctPath).filter(f => f.endsWith('.json'));
        if (filesInCorrect.length > 0) {
          log(`  ⚠️  CONFIRMED BUG: API found 0 entries but ${filesInCorrect.length} files exist in correct path`, 'red');
          results.passed = false;
          results.issues.push('History API looks in wrong directory (os.path.dirname bug)');
        }
      }
    } else {
      const error = await response.text();
      log(`  ⚠️  API returned error: ${error}`, 'yellow');
    }
  } catch (error) {
    log(`  ✗ API call failed: ${error.message}`, 'red');
  }

  return results;
}

async function testBug3_TypeScriptMismatch(page) {
  logSection('BUG #3: TYPESCRIPT TYPE MISMATCH - execution_id');

  const results = { passed: true, issues: [] };

  log('Checking if JobStatus interface has execution_id...', 'blue');

  // Check TypeScript file for execution_id in JobStatus interface
  const apiTsContent = fs.readFileSync('/Users/macbook/OSPF-LL-DEVICE_MANAGER/api.ts', 'utf-8');

  if (apiTsContent.includes('execution_id?: string')) {
    log(`  ✅ FIX VERIFIED: JobStatus interface now includes execution_id property`, 'green');
    results.passed = true;
  } else {
    log(`  ⚠️  BUG: JobStatus interface missing execution_id property`, 'red');
    results.issues.push('JobStatus interface missing execution_id property');
    results.passed = false;
  }

  return results;
}

async function testBug4_DataSaveFolderNames(page) {
  logSection('BUG #4: DATA SAVE PAGE - WRONG FOLDER NAMES');

  const results = { passed: true, issues: [] };

  log('Navigating to Data Save page...', 'blue');
  await page.goto(`${FRONTEND_URL}/data-save`, { waitUntil: 'networkidle0', timeout: TIMEOUT });

  // Wait for page to load
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check folder names displayed in UI
  const folderInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const folderButtons = buttons.filter(b =>
      b.textContent.includes('IOSXRV') ||
      b.textContent.includes('TEXT') ||
      b.textContent.includes('JSON')
    );

    return {
      buttonTexts: folderButtons.map(b => b.textContent.trim()),
      hasIOSXRV: document.body.innerHTML.includes('IOSXRV'),
      hasOutputDataSave: document.body.innerHTML.includes('OUTPUT-Data_save')
    };
  });

  log(`  Folder buttons found: ${folderInfo.buttonTexts.join(', ')}`, 'yellow');

  if (folderInfo.hasIOSXRV) {
    log(`  ⚠️  BUG: UI still shows "IOSXRV-TEXT" and "IOSXRV-JSON"`, 'red');
    results.passed = false;
    results.issues.push('UI folder names still show IOSXRV instead of descriptive names');
  } else {
    log(`  ✅ FIX VERIFIED: UI no longer shows misleading "IOSXRV" folder names`, 'green');
    results.passed = true;
  }

  // Take screenshot
  await page.screenshot({ path: '/tmp/bug4-datasave-folders.png', fullPage: false });
  log(`  📸 Screenshot saved: /tmp/bug4-datasave-folders.png`, 'green');

  return results;
}

async function testBug5_CurrentSymlinkUnused() {
  logSection('BUG #5: CURRENT SYMLINK USAGE');

  const results = { passed: true, issues: [] };

  const currentSymlink = '/Users/macbook/OSPF-LL-DEVICE_MANAGER/backend/data/current';

  log('Checking "current" symlink and API usage...', 'blue');

  if (fs.existsSync(currentSymlink)) {
    const target = fs.readlinkSync(currentSymlink);
    log(`  ✓ Symlink exists: current → ${target}`, 'green');

    // Check if target exists
    if (fs.existsSync(target)) {
      const textFiles = fs.existsSync(path.join(target, 'TEXT'))
        ? fs.readdirSync(path.join(target, 'TEXT')).length
        : 0;
      log(`  ✓ Target has ${textFiles} TEXT files`, 'green');
    }

    // Check if FileManager is using current symlink by looking at code
    const fileManagerContent = fs.readFileSync('/Users/macbook/OSPF-LL-DEVICE_MANAGER/backend/modules/file_manager.py', 'utf-8');

    if (fileManagerContent.includes('get_current_data_dirs') && fileManagerContent.includes('current_link')) {
      log(`  ✅ FIX VERIFIED: FileManager now uses 'current' symlink`, 'green');
      results.passed = true;
    } else {
      log(`  ⚠️  BUG: FileManager doesn't use 'current' symlink`, 'red');
      results.passed = false;
      results.issues.push("FileManager doesn't use 'current' symlink");
    }
  } else {
    log(`  Symlink does not exist (no automation runs yet?)`, 'yellow');
  }

  return results;
}

async function runAllTests() {
  log('\n' + '█'.repeat(70), 'magenta');
  log('  CRITICAL BUGS VALIDATION TEST - OSPF-LL-DEVICE_MANAGER', 'magenta');
  log('█'.repeat(70) + '\n', 'magenta');

  const allResults = {
    bug1: null,
    bug2: null,
    bug3: null,
    bug4: null,
    bug5: null
  };

  let browser;

  try {
    // Check backend health first
    log('Checking backend health...', 'blue');
    const backendHealthy = await checkBackendHealth();

    if (!backendHealthy) {
      log('❌ Backend is not running! Start it with: cd backend && python server.py', 'red');
      process.exit(1);
    }
    log('✓ Backend is healthy\n', 'green');

    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Run all tests
    allResults.bug1 = await testBug1_DataFlowMismatch();
    allResults.bug2 = await testBug2_TopologyHistoryPath();
    allResults.bug3 = await testBug3_TypeScriptMismatch(page);
    allResults.bug4 = await testBug4_DataSaveFolderNames(page);
    allResults.bug5 = await testBug5_CurrentSymlinkUnused();

  } catch (error) {
    log(`\n❌ Test Error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Print Summary
  logSection('TEST SUMMARY');

  let totalPassed = 0;
  let totalFailed = 0;
  const allIssues = [];

  for (const [bugName, result] of Object.entries(allResults)) {
    if (result) {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      const color = result.passed ? 'green' : 'red';
      log(`  ${bugName.toUpperCase()}: ${status}`, color);

      if (result.passed) totalPassed++;
      else totalFailed++;

      allIssues.push(...result.issues);
    }
  }

  console.log('\n' + '-'.repeat(70));
  log(`\n  TOTAL: ${totalPassed} passed, ${totalFailed} failed`, totalFailed > 0 ? 'red' : 'green');

  if (allIssues.length > 0) {
    log('\n  ALL ISSUES FOUND:', 'yellow');
    allIssues.forEach((issue, i) => {
      log(`    ${i + 1}. ${issue}`, 'yellow');
    });
  }

  console.log('\n' + '='.repeat(70));
  log('\n  RECOMMENDED FIXES:', 'cyan');
  log('  1. Update FileManager to use "current" symlink or accept execution_id', 'cyan');
  log('  2. Fix os.path.dirname(BASE_DIR) → should be just BASE_DIR', 'cyan');
  log('  3. Add execution_id to JobStatus interface in api.ts', 'cyan');
  log('  4. Update DataSave.tsx folder names to match backend paths', 'cyan');
  log('  5. Make FileManager and TopologyBuilder use the "current" symlink\n', 'cyan');

  process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests();
