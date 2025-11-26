#!/usr/bin/env node

/**
 * DEEP VALIDATION - CROSS-PAGE DATA CORRELATION
 *
 * Bounty Hunter Mission: Validate complete workflow and data consistency
 *
 * PHASE 1: Individual Page Analysis
 * PHASE 2: Workflow Testing (Step 1 → 2 → 3)
 * PHASE 3: Data Correlation & Verification
 * PHASE 4: Bug Detection
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';

// Expected network topology (from network validation report)
const EXPECTED_DATA = {
  devices: 10,
  ospf_neighbors: 36, // 18 bidirectional links = 36 adjacencies
  topology_links: 18,
  e_network_links: 14,
  f_network_links: 4
};

const log = (phase, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] [${phase}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class DeepValidator {
  constructor() {
    this.results = {
      phase1: {},
      phase2: {},
      phase3: {},
      phase4: { bugs: [] },
      summary: {}
    };
    this.automationData = null;
    this.dataSaveData = null;
    this.transformationData = null;
  }

  /**
   * PHASE 1: DEEP UNDERSTANDING - Individual Page Analysis
   */
  async phase1_analyzePages(page) {
    log('PHASE 1', '🔍 DEEP UNDERSTANDING - Analyzing each webpage individually');

    // 1.1: Automation Page Analysis
    log('PHASE 1.1', 'Analyzing AUTOMATION PAGE (Step 1)');
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'phase1_01_automation_page.png', fullPage: true });

    const automationAnalysis = await page.evaluate(() => {
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent,
        deviceTable: !!document.querySelector('table'),
        deviceRows: document.querySelectorAll('tbody tr').length,
        hasSelectAll: !!document.querySelector('input[type="checkbox"]'),
        hasStartButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Start Automation')),
        hasBatchControls: Array.from(document.querySelectorAll('label')).some(l => l.textContent.includes('Batch Size')),
        commandsList: Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.parentElement?.textContent.includes('show')).length
      };
    });

    this.results.phase1.automation = automationAnalysis;
    log('PHASE 1.1', '✅ Automation Page Analysis Complete', automationAnalysis);

    // 1.2: Data Save Page Analysis
    log('PHASE 1.2', 'Analyzing DATA SAVE PAGE (Step 2)');
    await page.goto(`${FRONTEND_URL}/data-save`, { waitUntil: 'networkidle0' });
    await wait(2000);
    await page.screenshot({ path: 'phase1_02_datasave_page.png', fullPage: true });

    const dataSaveAnalysis = await page.evaluate(() => {
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent,
        hasTextFolder: Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('TEXT') || el.textContent?.includes('text')),
        hasJsonFolder: Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('JSON') || el.textContent?.includes('json')),
        hasReloadButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Reload')),
        hasGenerateTopologyButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Generate Topology')),
        fileListPresent: !!document.querySelector('[class*="file"]') || document.querySelectorAll('li').length > 0
      };
    });

    this.results.phase1.dataSave = dataSaveAnalysis;
    log('PHASE 1.2', '✅ Data Save Page Analysis Complete', dataSaveAnalysis);

    // 1.3: Transformation Page Analysis
    log('PHASE 1.3', 'Analyzing TRANSFORMATION PAGE (Step 3)');
    await page.goto(`${FRONTEND_URL}/transformation`, { waitUntil: 'networkidle0' });
    await wait(2000);
    await page.screenshot({ path: 'phase1_03_transformation_page.png', fullPage: true });

    const transformationAnalysis = await page.evaluate(() => {
      const svgElement = document.querySelector('svg');
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent,
        hasSVG: !!svgElement,
        svgWidth: svgElement?.getAttribute('width'),
        svgHeight: svgElement?.getAttribute('height'),
        hasGenerateButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Generate')),
        hasNewAutomationButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('New Automation')),
        hasLayoutToggle: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Layout')),
        hasDownloadButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Download'))
      };
    });

    this.results.phase1.transformation = transformationAnalysis;
    log('PHASE 1.3', '✅ Transformation Page Analysis Complete', transformationAnalysis);

    log('PHASE 1', '✅ PHASE 1 COMPLETE - All pages analyzed individually');
  }

  /**
   * PHASE 2: WORKFLOW TESTING - Complete flow Step 1 → 2 → 3
   */
  async phase2_testWorkflow(page) {
    log('PHASE 2', '🔄 WORKFLOW TESTING - Testing complete Step 1 → Step 2 → Step 3');

    // 2.1: Check if there's existing data
    log('PHASE 2.1', 'Checking for existing execution data');

    const executionsResponse = await fetch(`${BACKEND_URL}/api/automation/executions`);
    const executions = await executionsResponse.json();

    log('PHASE 2.1', `Found ${executions.length} existing executions`, executions);

    if (executions.length === 0) {
      log('PHASE 2.1', '⚠️  No existing executions found. Need to run automation first.');
      this.results.phase2.hasExistingData = false;
      this.results.phase2.needsAutomation = true;

      // Store this for later analysis
      this.results.phase4.bugs.push({
        severity: 'INFO',
        page: 'System',
        issue: 'No existing execution data',
        impact: 'Cannot validate data flow without running automation',
        recommendation: 'Run automation with 2-3 devices for testing'
      });
    } else {
      this.results.phase2.hasExistingData = true;
      this.results.phase2.latestExecution = executions[0];

      // 2.2: Check execution metadata
      const executionId = executions[0].execution_id;
      const executionDetails = await fetch(`${BACKEND_URL}/api/automation/executions/${executionId}`);
      const executionData = await executionDetails.json();

      this.automationData = executionData;
      log('PHASE 2.2', '📊 Latest Execution Data', {
        execution_id: executionId,
        devices: executionData.devices?.length,
        commands: executionData.commands?.length,
        status: executionData.status,
        timestamp: executionData.timestamp
      });

      // 2.3: Verify files exist in Data Save
      log('PHASE 2.3', 'Verifying files in Data Save (Step 2)');
      await page.goto(`${FRONTEND_URL}/data-save`, { waitUntil: 'networkidle0' });
      await wait(2000);

      // Click reload to ensure latest files
      const reloadButton = await page.$('button:has-text("Reload")');
      if (reloadButton) {
        await reloadButton.click();
        await wait(2000);
      }

      const dataSaveFiles = await page.evaluate(() => {
        const textFiles = [];
        const jsonFiles = [];

        // Try to find file elements
        document.querySelectorAll('[class*="file"], li').forEach(el => {
          const text = el.textContent;
          if (text.includes('.txt')) textFiles.push(text.trim());
          if (text.includes('.json')) jsonFiles.push(text.trim());
        });

        return { textFiles, jsonFiles };
      });

      this.dataSaveData = dataSaveFiles;
      log('PHASE 2.3', '📁 Data Save Files', dataSaveFiles);

      // 2.4: Generate and verify topology
      log('PHASE 2.4', 'Generating Topology (Step 3)');
      await page.goto(`${FRONTEND_URL}/transformation`, { waitUntil: 'networkidle0' });
      await wait(2000);

      // Click Generate Topology button
      const generateButton = await page.$('button:has-text("Generate")');
      if (generateButton) {
        await generateButton.click();
        await wait(5000); // Wait for topology generation
      }

      // Fetch topology data from API
      const topologyResponse = await fetch(`${BACKEND_URL}/api/transform/topology/latest`);
      if (topologyResponse.ok) {
        const topologyData = await topologyResponse.json();
        this.transformationData = topologyData;

        log('PHASE 2.4', '🗺️  Topology Data', {
          nodes: topologyData.nodes?.length,
          links: topologyData.links?.length,
          timestamp: topologyData.timestamp
        });

        // Count OSPF adjacencies from raw data
        const ospfFiles = dataSaveFiles.textFiles.filter(f => f.includes('ospf_neighbor'));
        log('PHASE 2.4', `📡 Found ${ospfFiles.length} OSPF neighbor files`);

      } else {
        log('PHASE 2.4', '❌ Failed to fetch topology data');
      }

      await page.screenshot({ path: 'phase2_04_topology_generated.png', fullPage: true });
    }

    log('PHASE 2', '✅ PHASE 2 COMPLETE - Workflow tested');
  }

  /**
   * PHASE 3: DATA CORRELATION - Cross-check data consistency
   */
  async phase3_correlateData() {
    log('PHASE 3', '🔗 DATA CORRELATION - Verifying consistency across pages');

    if (!this.results.phase2.hasExistingData) {
      log('PHASE 3', '⚠️  Skipping correlation - no data available');
      this.results.phase3.skipped = true;
      return;
    }

    const correlation = {
      devices: {
        expected: EXPECTED_DATA.devices,
        automation: this.automationData?.devices?.length || 0,
        topology: this.transformationData?.nodes?.length || 0,
        match: false
      },
      links: {
        expected: EXPECTED_DATA.topology_links,
        topology: this.transformationData?.links?.length || 0,
        match: false
      },
      ospfNeighbors: {
        expected: EXPECTED_DATA.ospf_neighbors,
        dataSave: this.dataSaveData?.textFiles.filter(f => f.includes('ospf_neighbor')).length * 2 || 0, // Rough estimate
        match: false
      }
    };

    // Check device count consistency
    correlation.devices.match = (
      correlation.devices.automation === correlation.devices.topology &&
      correlation.devices.topology === correlation.devices.expected
    );

    // Check link count consistency
    correlation.links.match = (
      correlation.links.topology === correlation.links.expected
    );

    this.results.phase3.correlation = correlation;
    log('PHASE 3', '📊 Data Correlation Results', correlation);

    // Identify mismatches
    if (!correlation.devices.match) {
      this.results.phase4.bugs.push({
        severity: 'HIGH',
        page: 'Cross-Page',
        issue: 'Device count mismatch between pages',
        details: `Automation: ${correlation.devices.automation}, Topology: ${correlation.devices.topology}, Expected: ${correlation.devices.expected}`,
        impact: 'Data inconsistency across workflow',
        recommendation: 'Verify execution isolation and data flow'
      });
    }

    if (!correlation.links.match) {
      this.results.phase4.bugs.push({
        severity: 'HIGH',
        page: 'Transformation',
        issue: 'Topology link count incorrect',
        details: `Got ${correlation.links.topology}, Expected ${correlation.links.expected}`,
        impact: 'Incomplete network topology visualization',
        recommendation: 'Check topology builder algorithm and OSPF parsing'
      });
    }

    log('PHASE 3', '✅ PHASE 3 COMPLETE - Data correlation analyzed');
  }

  /**
   * PHASE 4: BUG HUNTING - Identify critical issues
   */
  async phase4_bugHunting(page) {
    log('PHASE 4', '🐛 BUG HUNTING - Scanning for critical issues');

    // 4.1: Check navigation buttons
    log('PHASE 4.1', 'Checking navigation buttons');
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle0' });
    await wait(1000);

    const navButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        hasViewDataButton: buttons.some(b => b.textContent.includes('View Data')),
        hasGenerateTopologyButton: buttons.some(b => b.textContent.includes('Generate Topology')),
        hasNewAutomationButton: buttons.some(b => b.textContent.includes('New Automation'))
      };
    });

    if (!navButtons.hasViewDataButton) {
      this.results.phase4.bugs.push({
        severity: 'MEDIUM',
        page: 'Automation',
        issue: 'Missing "View Data" navigation button',
        impact: 'Users cannot easily navigate to Data Save page after job completion',
        recommendation: 'Add navigation button when job status is completed'
      });
    }

    // 4.2: Check API health
    log('PHASE 4.2', 'Checking API endpoints');
    try {
      const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
      const health = await healthResponse.json();

      if (health.status !== 'OK') {
        this.results.phase4.bugs.push({
          severity: 'CRITICAL',
          page: 'Backend',
          issue: 'API health check failed',
          details: health,
          impact: 'Backend may not be functioning correctly',
          recommendation: 'Check backend server logs and database connection'
        });
      }
    } catch (error) {
      this.results.phase4.bugs.push({
        severity: 'CRITICAL',
        page: 'Backend',
        issue: 'Cannot connect to backend API',
        details: error.message,
        impact: 'Frontend cannot communicate with backend',
        recommendation: 'Ensure backend server is running on port 9051'
      });
    }

    // 4.3: Check CORS
    log('PHASE 4.3', 'Checking CORS configuration');
    const corsIssues = await page.evaluate(async (backendUrl) => {
      const issues = [];
      try {
        const response = await fetch(`${backendUrl}/api/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          issues.push('CORS preflight may be failing');
        }
      } catch (error) {
        issues.push(`CORS error: ${error.message}`);
      }
      return issues;
    }, BACKEND_URL);

    corsIssues.forEach(issue => {
      this.results.phase4.bugs.push({
        severity: 'HIGH',
        page: 'Backend/CORS',
        issue: issue,
        impact: 'API calls may fail from frontend',
        recommendation: 'Check CORS configuration in server.py'
      });
    });

    // 4.4: Check execution isolation
    log('PHASE 4.4', 'Checking execution isolation implementation');
    const executionsResponse = await fetch(`${BACKEND_URL}/api/automation/executions`);
    const executions = await executionsResponse.json();

    if (executions.length > 0) {
      const hasExecutionIds = executions.every(e => e.execution_id);
      const hasMetadata = executions.every(e => e.timestamp && e.status);

      if (!hasExecutionIds) {
        this.results.phase4.bugs.push({
          severity: 'HIGH',
          page: 'Backend',
          issue: 'Execution isolation not properly implemented',
          details: 'Some executions missing execution_id',
          impact: 'Cannot track individual automation runs',
          recommendation: 'Ensure execution_id is generated for all jobs'
        });
      }
    }

    // 4.5: Check UI/UX issues
    log('PHASE 4.5', 'Checking UI/UX issues');
    await page.goto(`${FRONTEND_URL}/transformation`, { waitUntil: 'networkidle0' });
    await wait(2000);

    const uiIssues = await page.evaluate(() => {
      const issues = [];

      // Check if topology is visible
      const svg = document.querySelector('svg');
      if (!svg) {
        issues.push('No SVG topology visualization found');
      } else {
        const circles = svg.querySelectorAll('circle').length;
        const lines = svg.querySelectorAll('line, path').length;

        if (circles === 0) issues.push('No nodes (circles) in topology');
        if (lines === 0) issues.push('No links (lines) in topology');
      }

      return issues;
    });

    uiIssues.forEach(issue => {
      this.results.phase4.bugs.push({
        severity: 'HIGH',
        page: 'Transformation/UI',
        issue: issue,
        impact: 'Users cannot visualize network topology',
        recommendation: 'Check topology generation and SVG rendering'
      });
    });

    log('PHASE 4', '✅ PHASE 4 COMPLETE - Bug hunting finished');
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    log('REPORT', '📄 GENERATING COMPREHENSIVE VALIDATION REPORT');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalBugs: this.results.phase4.bugs.length,
        criticalBugs: this.results.phase4.bugs.filter(b => b.severity === 'CRITICAL').length,
        highBugs: this.results.phase4.bugs.filter(b => b.severity === 'HIGH').length,
        mediumBugs: this.results.phase4.bugs.filter(b => b.severity === 'MEDIUM').length,
        infoBugs: this.results.phase4.bugs.filter(b => b.severity === 'INFO').length
      },
      phase1: this.results.phase1,
      phase2: this.results.phase2,
      phase3: this.results.phase3,
      phase4: this.results.phase4,
      recommendations: []
    };

    // Priority recommendations
    if (report.summary.criticalBugs > 0) {
      report.recommendations.push('🔴 CRITICAL: Fix critical bugs immediately - system may not function');
    }
    if (report.summary.highBugs > 0) {
      report.recommendations.push('🟡 HIGH: Address high-severity bugs - affects core functionality');
    }
    if (!this.results.phase2.hasExistingData) {
      report.recommendations.push('📊 Run automation with 2-3 devices to validate complete workflow');
    }

    // Save report
    fs.writeFileSync('DEEP_VALIDATION_REPORT.json', JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION REPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n📊 Total Issues Found: ${report.summary.totalBugs}`);
    console.log(`   🔴 Critical: ${report.summary.criticalBugs}`);
    console.log(`   🟡 High: ${report.summary.highBugs}`);
    console.log(`   🟠 Medium: ${report.summary.mediumBugs}`);
    console.log(`   🔵 Info: ${report.summary.infoBugs}`);

    if (this.results.phase4.bugs.length > 0) {
      console.log('\n📋 ISSUES DETECTED:\n');
      this.results.phase4.bugs.forEach((bug, idx) => {
        const icon = bug.severity === 'CRITICAL' ? '🔴' : bug.severity === 'HIGH' ? '🟡' : bug.severity === 'MEDIUM' ? '🟠' : '🔵';
        console.log(`${icon} [${bug.severity}] ${bug.page}: ${bug.issue}`);
        console.log(`   Impact: ${bug.impact}`);
        console.log(`   Fix: ${bug.recommendation}\n`);
      });
    } else {
      console.log('\n✅ No critical issues detected!');
    }

    console.log('\n📁 Full report saved to: DEEP_VALIDATION_REPORT.json');
    console.log('='.repeat(80) + '\n');

    return report;
  }
}

/**
 * MAIN EXECUTION
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('DEEP VALIDATION - BOUNTY HUNTER MODE ACTIVATED');
  console.log('Cross-Page Data Correlation & Bug Detection');
  console.log('='.repeat(80) + '\n');

  const validator = new DeepValidator();
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Execute all phases
    await validator.phase1_analyzePages(page);
    await validator.phase2_testWorkflow(page);
    await validator.phase3_correlateData();
    await validator.phase4_bugHunting(page);

    // Generate final report
    const report = validator.generateReport();

    console.log('\n✅ VALIDATION COMPLETE\n');

  } catch (error) {
    console.error('\n❌ VALIDATION FAILED:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch(console.error);
