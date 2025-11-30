#!/usr/bin/env node

/**
 * Test if wildcard CORS + credentials actually breaks in practice
 */

import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:9051';

console.log('Testing: Does wildcard CORS with credentials actually work?\n');

async function test() {
  try {
    // Test 1: Simple request with credentials
    console.log('Test 1: GET request with credentials from localhost:9050...');
    const response1 = await fetch(`${BACKEND_URL}/api/health`, {
      credentials: 'include',
      headers: {
        'Origin': 'http://localhost:9050',
        'Cookie': 'session_token=test123'
      }
    });

    const origin1 = response1.headers.get('access-control-allow-origin');
    const creds1 = response1.headers.get('access-control-allow-credentials');

    console.log(`  Origin: ${origin1}`);
    console.log(`  Credentials: ${creds1}`);
    console.log(`  Status: ${response1.status}`);

    if (origin1 === '*' && creds1 === 'true') {
      console.log('\n⚠️  BUG CONFIRMED: Server returns wildcard (*) with credentials=true');
      console.log('    This violates CORS spec and may fail in browsers!\n');
    }

    // Test 2: Request from different origin
    console.log('\nTest 2: Same request from different origin (http://evil.com)...');
    const response2 = await fetch(`${BACKEND_URL}/api/health`, {
      credentials: 'include',
      headers: {
        'Origin': 'http://evil.com',
        'Cookie': 'session_token=test123'
      }
    });

    const origin2 = response2.headers.get('access-control-allow-origin');
    console.log(`  Origin: ${origin2}`);
    console.log(`  Status: ${response2.status}`);

    if (origin2 === '*') {
      console.log('\n🚨 SECURITY ISSUE: Server accepts requests from ANY origin with credentials!');
      console.log('   An attacker at http://evil.com could make authenticated requests.\n');
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('VERDICT:');
    console.log('='.repeat(70));

    if (origin1 === '*' && creds1 === 'true') {
      console.log('❌ CRITICAL BUG FOUND\n');
      console.log('Issue: Server uses wildcard CORS (*) with credentials=true');
      console.log('Impact:');
      console.log('  1. Violates CORS specification');
      console.log('  2. May be rejected by modern browsers (Chrome, Firefox)');
      console.log('  3. Security risk - any website can make credentialed requests');
      console.log('\nLocation: backend/server.py line 197');
      console.log('Current: cors_origins = ["*"] when is_localhost_only() is False');
      console.log('Should be: cors_origins = get_allowed_cors_origins()');
      console.log('\nFix:');
      console.log('  Change line 197 from:');
      console.log('    cors_origins = ["http://localhost:9050", ...] if is_localhost_only() else ["*"]');
      console.log('  To:');
      console.log('    cors_origins = get_allowed_cors_origins()');
      console.log('');
      process.exit(1);
    } else {
      console.log('✓ No CORS issues found');
      process.exit(0);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

test();
