#!/usr/bin/env node

/**
 * CORS and Network Specialist - Bounty Hunter #5
 *
 * Tests:
 * 1. Frontend-to-Backend communication (port 9050 → 9051)
 * 2. OPTIONS preflight requests
 * 3. Access-Control-Allow-Origin headers
 * 4. WebSocket connection
 * 5. Credentials handling
 */

import fetch from 'node-fetch';

const FRONTEND_PORT = 9050;
const BACKEND_PORT = 9051;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const bugs = [];
let testCount = 0;
let passCount = 0;

function logTest(name, passed, details) {
  testCount++;
  if (passed) {
    passCount++;
    console.log(`${colors.green}✓${colors.reset} ${name}`);
  } else {
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    bugs.push({ test: name, details });
  }
  if (details) {
    console.log(`  ${colors.cyan}${details}${colors.reset}`);
  }
}

function logSection(title) {
  console.log(`\n${colors.bold}${colors.blue}=== ${title} ===${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TEST 1: BASIC CONNECTIVITY
// ============================================================================

async function testBasicConnectivity() {
  logSection('Test 1: Basic Backend Connectivity');

  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': `http://localhost:${FRONTEND_PORT}`,
      },
    });

    const isOk = response.ok;
    logTest(
      'Backend health check responds',
      isOk,
      isOk ? `Status: ${response.status}` : `Failed with status: ${response.status}`
    );

    if (!isOk) {
      bugs.push({
        test: 'Backend connectivity',
        details: `Backend not responding on port ${BACKEND_PORT}. Server may not be running.`
      });
    }

    return isOk;
  } catch (error) {
    logTest('Backend health check responds', false, `Error: ${error.message}`);
    bugs.push({
      test: 'Backend connectivity',
      details: `Cannot connect to backend: ${error.message}`
    });
    return false;
  }
}

// ============================================================================
// TEST 2: CORS HEADERS ON SIMPLE REQUEST
// ============================================================================

async function testCorsHeadersSimpleRequest() {
  logSection('Test 2: CORS Headers on Simple GET Request');

  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': `http://localhost:${FRONTEND_PORT}`,
      },
    });

    const corsHeader = response.headers.get('access-control-allow-origin');
    const credentialsHeader = response.headers.get('access-control-allow-credentials');

    // Check CORS origin header
    const hasValidOrigin = corsHeader === `http://localhost:${FRONTEND_PORT}` || corsHeader === '*';
    logTest(
      'Access-Control-Allow-Origin header present',
      !!corsHeader,
      corsHeader ? `Value: "${corsHeader}"` : 'Header missing'
    );

    if (!corsHeader) {
      bugs.push({
        test: 'CORS Allow-Origin header',
        severity: 'CRITICAL',
        details: 'Access-Control-Allow-Origin header is missing. Frontend will be blocked by browser CORS policy.',
        fix: 'Ensure CORSMiddleware is configured in backend/server.py'
      });
    }

    // Check credentials header
    logTest(
      'Access-Control-Allow-Credentials header present',
      credentialsHeader === 'true',
      credentialsHeader ? `Value: "${credentialsHeader}"` : 'Header missing'
    );

    if (credentialsHeader !== 'true') {
      bugs.push({
        test: 'CORS credentials header',
        severity: 'CRITICAL',
        details: 'Access-Control-Allow-Credentials not set to "true". Session cookies will not work.',
        fix: 'Set allow_credentials=True in CORSMiddleware configuration'
      });
    }

  } catch (error) {
    logTest('CORS headers check', false, `Error: ${error.message}`);
  }
}

// ============================================================================
// TEST 3: OPTIONS PREFLIGHT REQUEST
// ============================================================================

async function testPreflightRequest() {
  logSection('Test 3: OPTIONS Preflight Request');

  try {
    const response = await fetch(`${BACKEND_URL}/api/devices`, {
      method: 'OPTIONS',
      headers: {
        'Origin': `http://localhost:${FRONTEND_PORT}`,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    const allowOrigin = response.headers.get('access-control-allow-origin');
    const allowMethods = response.headers.get('access-control-allow-methods');
    const allowHeaders = response.headers.get('access-control-allow-headers');
    const allowCredentials = response.headers.get('access-control-allow-credentials');

    logTest(
      'OPTIONS request returns 200',
      response.status === 200,
      `Status: ${response.status}`
    );

    logTest(
      'Preflight: Allow-Origin header',
      !!allowOrigin,
      allowOrigin ? `Value: "${allowOrigin}"` : 'Missing'
    );

    logTest(
      'Preflight: Allow-Methods header',
      !!allowMethods,
      allowMethods ? `Value: "${allowMethods}"` : 'Missing'
    );

    logTest(
      'Preflight: Allow-Headers header',
      !!allowHeaders,
      allowHeaders ? `Value: "${allowHeaders}"` : 'Missing'
    );

    logTest(
      'Preflight: Allow-Credentials header',
      allowCredentials === 'true',
      allowCredentials ? `Value: "${allowCredentials}"` : 'Missing'
    );

    if (response.status !== 200 || !allowOrigin || !allowMethods) {
      bugs.push({
        test: 'OPTIONS preflight',
        severity: 'CRITICAL',
        details: 'Preflight requests failing. Browser will block POST/PUT/DELETE requests from frontend.',
        fix: 'Ensure allow_methods=["*"] is set in CORSMiddleware'
      });
    }

  } catch (error) {
    logTest('OPTIONS preflight request', false, `Error: ${error.message}`);
    bugs.push({
      test: 'OPTIONS preflight',
      severity: 'CRITICAL',
      details: `Preflight requests failing: ${error.message}`,
    });
  }
}

// ============================================================================
// TEST 4: CREDENTIALS ARE SENT
// ============================================================================

async function testCredentials() {
  logSection('Test 4: Credentials Handling');

  try {
    // Test that credentials: 'include' works
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Origin': `http://localhost:${FRONTEND_PORT}`,
        'Cookie': 'test_cookie=test_value',
      },
    });

    const allowCredentials = response.headers.get('access-control-allow-credentials');

    logTest(
      'Server accepts credentials',
      allowCredentials === 'true',
      `Access-Control-Allow-Credentials: ${allowCredentials || 'missing'}`
    );

    if (allowCredentials !== 'true') {
      bugs.push({
        test: 'Credentials support',
        severity: 'CRITICAL',
        details: 'Server does not support credentials. Session-based authentication will fail.',
        fix: 'Set allow_credentials=True in CORSMiddleware'
      });
    }

  } catch (error) {
    logTest('Credentials handling', false, `Error: ${error.message}`);
  }
}

// ============================================================================
// TEST 5: WEBSOCKET CONNECTION
// ============================================================================

async function testWebSocketConnection() {
  logSection('Test 5: WebSocket Connection');

  return new Promise(async (resolve) => {
    try {
      const { default: WebSocket } = await import('ws');
      const ws = new WebSocket(`ws://localhost:${BACKEND_PORT}/ws/jobs/test-cors-check`);

      const timeout = setTimeout(() => {
        ws.close();
        logTest('WebSocket connection', false, 'Connection timeout after 5s');
        bugs.push({
          test: 'WebSocket connection',
          severity: 'HIGH',
          details: 'WebSocket connection timed out. Real-time job progress updates will not work.',
          fix: 'Check WebSocket endpoint configuration in backend/server.py'
        });
        resolve(false);
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        logTest('WebSocket connection established', true, `ws://localhost:${BACKEND_PORT}/ws/jobs/*`);
        ws.close();
        resolve(true);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        logTest('WebSocket connection', false, `Error: ${error.message}`);
        bugs.push({
          test: 'WebSocket connection',
          severity: 'HIGH',
          details: `WebSocket failed: ${error.message}. Real-time updates won't work.`,
          fix: 'Verify WebSocket routes are configured in server.py'
        });
        resolve(false);
      });

    } catch (error) {
      logTest('WebSocket connection', false, `Import error: ${error.message}`);
      console.log(`  ${colors.yellow}Note: Install 'ws' package to test WebSocket: npm install ws${colors.reset}`);
      resolve(false);
    }
  });
}

// ============================================================================
// TEST 6: CROSS-ORIGIN REQUEST SIMULATION
// ============================================================================

async function testCrossOriginRequest() {
  logSection('Test 6: Cross-Origin API Request Simulation');

  try {
    // Simulate a request from the frontend
    const response = await fetch(`${BACKEND_URL}/api/devices`, {
      method: 'GET',
      headers: {
        'Origin': `http://localhost:${FRONTEND_PORT}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const corsOrigin = response.headers.get('access-control-allow-origin');
    const corsCredentials = response.headers.get('access-control-allow-credentials');

    // This request will likely return 401 if not authenticated, but that's OK
    // We're testing CORS headers, not authentication
    const hasCorsHeaders = !!corsOrigin && corsCredentials === 'true';

    logTest(
      'GET /api/devices has CORS headers',
      hasCorsHeaders,
      `Status: ${response.status}, CORS: ${hasCorsHeaders ? 'OK' : 'MISSING'}`
    );

    if (!hasCorsHeaders) {
      bugs.push({
        test: 'API endpoints CORS',
        severity: 'CRITICAL',
        details: 'API endpoints missing CORS headers. Frontend cannot fetch data.',
        fix: 'Verify CORSMiddleware is added before route handlers'
      });
    }

    // Test if response is valid JSON (even if 401)
    try {
      const data = await response.json();
      logTest(
        'API returns valid JSON',
        true,
        `Response type: ${Array.isArray(data) ? 'array' : typeof data}`
      );
    } catch (e) {
      logTest('API returns valid JSON', false, 'Response is not valid JSON');
    }

  } catch (error) {
    logTest('Cross-origin API request', false, `Error: ${error.message}`);
  }
}

// ============================================================================
// TEST 7: WILDCARD CORS CHECK (SECURITY)
// ============================================================================

async function testWildcardCors() {
  logSection('Test 7: CORS Security (No Wildcard with Credentials)');

  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': `http://localhost:${FRONTEND_PORT}`,
      },
    });

    const allowOrigin = response.headers.get('access-control-allow-origin');
    const allowCredentials = response.headers.get('access-control-allow-credentials');

    // If credentials are enabled, origin cannot be wildcard
    const hasWildcardWithCredentials = (allowOrigin === '*' && allowCredentials === 'true');

    logTest(
      'No wildcard CORS with credentials (security)',
      !hasWildcardWithCredentials,
      hasWildcardWithCredentials
        ? `INSECURE: Using "*" with credentials=true`
        : `Secure: Origin="${allowOrigin}", Credentials="${allowCredentials}"`
    );

    if (hasWildcardWithCredentials) {
      bugs.push({
        test: 'CORS security',
        severity: 'MEDIUM',
        details: 'Using wildcard "*" with credentials=true is a security risk and may not work in browsers.',
        fix: 'Set specific allowed origins instead of "*" in CORSMiddleware'
      });
    }

  } catch (error) {
    logTest('CORS security check', false, `Error: ${error.message}`);
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log(`${colors.bold}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        BOUNTY HUNTER #5 - CORS & Network Specialist           ║');
  console.log('║                                                                ║');
  console.log('║  Testing CORS configuration and network communication          ║');
  console.log('║  Frontend (port 9050) → Backend (port 9051)                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  // Run tests sequentially
  const backendOnline = await testBasicConnectivity();

  if (!backendOnline) {
    console.log(`\n${colors.red}${colors.bold}⚠️  Backend is not running. Start servers with: ./start.sh${colors.reset}`);
    printReport();
    return;
  }

  await testCorsHeadersSimpleRequest();
  await testPreflightRequest();
  await testCredentials();
  await testWebSocketConnection();
  await testCrossOriginRequest();
  await testWildcardCors();

  printReport();
}

function printReport() {
  console.log(`\n${colors.bold}${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bold}TEST SUMMARY${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`Tests run: ${testCount}`);
  console.log(`${colors.green}Passed: ${passCount}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testCount - passCount}${colors.reset}`);

  if (bugs.length > 0) {
    console.log(`\n${colors.bold}${colors.red}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.bold}${colors.red}CRITICAL BUGS FOUND: ${bugs.length}${colors.reset}`);
    console.log(`${colors.red}${'='.repeat(70)}${colors.reset}\n`);

    bugs.forEach((bug, index) => {
      console.log(`${colors.bold}${index + 1}. ${bug.test}${colors.reset}`);
      if (bug.severity) {
        const severityColor = bug.severity === 'CRITICAL' ? colors.red :
                              bug.severity === 'HIGH' ? colors.yellow : colors.cyan;
        console.log(`   ${severityColor}Severity: ${bug.severity}${colors.reset}`);
      }
      console.log(`   ${colors.yellow}Issue: ${bug.details}${colors.reset}`);
      if (bug.fix) {
        console.log(`   ${colors.green}Fix: ${bug.fix}${colors.reset}`);
      }
      console.log('');
    });

    console.log(`${colors.bold}${colors.red}Status: BUGS FOUND - Frontend-Backend communication may be broken${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.bold}${colors.green}✓ ALL TESTS PASSED - CORS configuration is correct${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(70)}${colors.reset}\n`);
    console.log(`${colors.green}Frontend (port ${FRONTEND_PORT}) can successfully communicate with Backend (port ${BACKEND_PORT})${colors.reset}`);
    console.log('');
    process.exit(0);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
});
