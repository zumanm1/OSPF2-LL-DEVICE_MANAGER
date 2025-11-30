# E2E Test Plan - Comprehensive Production Validation

## Date: November 30, 2025
## Status: PLANNING PHASE
## Test Framework: Puppeteer 24.31.0

---

## 1. TEST SUITE OVERVIEW

### 1.1 Objectives
- Validate all critical user workflows
- Verify security controls (rate limiting, CORS, authentication)
- Test real-time features (WebSocket)
- Ensure data integrity
- Validate error handling
- Measure performance

### 1.2 Test Environment
- **Frontend URL:** http://localhost:9051 (Vite preview)
- **Backend API:** http://localhost:9050
- **Browser:** Chromium (Puppeteer headless)
- **Test Execution:** Sequential (to avoid rate limit conflicts)
- **Test Isolation:** Each test starts with clean state

### 1.3 Test Data Strategy
- Use dedicated test devices (IDs: test-001 to test-020)
- Create test user accounts (admin-test, operator-test, viewer-test)
- Reset test database before suite execution
- Clean up test data after each test

---

## 2. DETAILED TEST SCENARIOS

### Suite 1: Authentication & Security (CRITICAL - Priority 1)

#### Test 1.1: Successful Login
**Objective:** Verify users can log in with valid credentials  
**Steps:**
1. Navigate to http://localhost:9051
2. Verify login page loads (detect login form)
3. Enter valid credentials (username: admin, password: admin123)
4. Click "Login" button
5. Wait for navigation to dashboard

**Expected:**
- ✅ Redirected to device manager page
- ✅ Navbar shows logged-in user
- ✅ Session cookie set

**Assertions:**
```typescript
- Current URL should be http://localhost:9051/
- Page should contain text "Device Manager" or "Devices"
- Cookie "session_token" should exist
```

---

#### Test 1.2: Failed Login with Invalid Credentials
**Objective:** Verify login fails with incorrect password  
**Steps:**
1. Navigate to login page
2. Enter username: admin, password: wrongpassword
3. Click "Login" button
4. Wait for error message

**Expected:**
- ✅ Stays on login page
- ✅ Error message displayed ("Invalid credentials" or similar)
- ✅ No session cookie created

**Assertions:**
```typescript
- Current URL should still be /login (if redirected) or stay on /
- Page should contain error message
- Cookie "session_token" should NOT exist
```

---

#### Test 1.3: Rate Limiting - Login Brute Force Protection
**Objective:** Verify login endpoint rate limiting (5/minute)  
**Steps:**
1. Make 7 consecutive login requests via Puppeteer
2. Track HTTP response codes

**Expected:**
- ✅ First 5 requests return 200 or 401
- ✅ Requests 6 and 7 return 429 (Too Many Requests)

**Assertions:**
```typescript
- rateLimitedCount should be >= 2
- Rate limit error message displayed on 6th+ attempt
```

**Test Data:**
```json
{
  "username": "test-user",
  "password": "wrong-password-123"
}
```

---

#### Test 1.4: Session Persistence
**Objective:** Verify session persists across page refreshes  
**Steps:**
1. Login successfully
2. Navigate to different pages
3. Refresh browser
4. Verify still logged in

**Expected:**
- ✅ User remains authenticated
- ✅ No redirect to login
- ✅ Session token still valid

---

#### Test 1.5: Logout Functionality
**Objective:** Verify logout invalidates session  
**Steps:**
1. Login successfully
2. Click logout button (or call /api/auth/logout)
3. Verify redirected to login
4. Try to access protected page

**Expected:**
- ✅ Session cookie cleared
- ✅ Redirected to login page
- ✅ Cannot access protected pages

---

### Suite 2: Device Management (CRITICAL - Priority 1)

#### Test 2.1: Load Device List
**Objective:** Verify device list loads and displays correctly  
**Steps:**
1. Login
2. Navigate to device manager (default page)
3. Wait for device table to load

**Expected:**
- ✅ Device table visible
- ✅ At least 10 devices displayed (from seed data)
- ✅ Table columns: Name, IP, Type, Country, Actions

**Assertions:**
```typescript
- Device table selector should exist
- Device count should be >= 10
- First device should have valid data
```

---

#### Test 2.2: Create New Device
**Objective:** Verify device creation workflow  
**Steps:**
1. Login
2. Click "Add Device" button
3. Fill device form:
   - Device Name: test-device-001
   - IP Address: 172.20.0.100
   - Protocol: SSH
   - Port: 22
   - Username: cisco
   - Password: cisco
   - Country: United States
   - Device Type: PE
   - Platform: ASR9905
   - Software: IOS XR
   - Tags: ["test", "e2e"]
4. Click "Save" or "Add Device"
5. Wait for success message

**Expected:**
- ✅ Device appears in table
- ✅ Success notification shown
- ✅ Modal closes

**Assertions:**
```typescript
- Device with name "test-device-001" should exist in table
- IP should be "172.20.0.100"
```

---

#### Test 2.3: Edit Existing Device
**Objective:** Verify device editing workflow  
**Steps:**
1. Login
2. Find device "test-device-001" in table
3. Click edit icon/button
4. Modify country to "Germany"
5. Click "Save"
6. Wait for success message

**Expected:**
- ✅ Device updated in table
- ✅ Country shows "Germany"
- ✅ Success notification shown

---

#### Test 2.4: Delete Single Device
**Objective:** Verify device deletion  
**Steps:**
1. Login
2. Find device "test-device-001"
3. Click delete icon/button
4. Confirm deletion in dialog
5. Wait for success message

**Expected:**
- ✅ Device removed from table
- ✅ Success notification shown

---

#### Test 2.5: Bulk Delete Devices
**Objective:** Verify bulk delete functionality  
**Steps:**
1. Login
2. Create 5 test devices
3. Select all 5 devices (checkboxes)
4. Click "Bulk Delete" or delete selected action
5. Confirm deletion
6. Wait for completion

**Expected:**
- ✅ All 5 devices removed from table
- ✅ Success message shows count ("5 devices deleted")

---

#### Test 2.6: Search Devices
**Objective:** Verify device search functionality  
**Steps:**
1. Login
2. Ensure devices with various names exist
3. Enter search query: "zwe-hra" (should match zimbabwe routers)
4. Verify filtered results

**Expected:**
- ✅ Only matching devices displayed
- ✅ Non-matching devices hidden
- ✅ Clear search resets filter

**Assertions:**
```typescript
- Visible device count should be < total device count
- All visible devices should contain search term
```

---

#### Test 2.7: Sort Devices by Column
**Objective:** Verify table sorting  
**Steps:**
1. Login
2. Click "Device Name" column header
3. Verify ascending sort
4. Click again
5. Verify descending sort

**Expected:**
- ✅ Devices sorted alphabetically A-Z on first click
- ✅ Devices sorted Z-A on second click
- ✅ Sort indicator (arrow icon) shows direction

---

###Suite 3: Automation & Job Execution (CRITICAL - Priority 1)

#### Test 3.1: Create Automation Job
**Objective:** Verify job creation and execution  
**Steps:**
1. Login
2. Navigate to Automation page
3. Select 2 devices via checkboxes
4. Click "Start Automation" or "Execute"
5. Wait for job to start

**Expected:**
- ✅ Job created successfully
- ✅ Job ID returned
- ✅ Job status shows "running" or "in_progress"

**Assertions:**
```typescript
- Job ID should be a valid UUID
- Job status should not be "failed"
```

---

#### Test 3.2: Monitor Job Progress via WebSocket
**Objective:** Verify real-time job updates  
**Steps:**
1. Login
2. Start automation job
3. Monitor WebSocket connection (ws://localhost:9050/ws/jobs/{job_id})
4. Verify receives progress updates

**Expected:**
- ✅ WebSocket connects successfully
- ✅ Receives "connected" message
- ✅ Receives job progress updates
- ✅ Progress percentage increases (0% → 100%)
- ✅ Receives "completed" message when done

**Assertions:**
```typescript
- WebSocket message type should be "progress" or "update"
- Progress should be between 0-100
- Final status should be "completed" or "success"
```

---

#### Test 3.3: View Job Results
**Objective:** Verify job results displayed correctly  
**Steps:**
1. Login
2. Complete an automation job
3. View job results/history
4. Verify device outputs shown

**Expected:**
- ✅ Job listed in history
- ✅ Each device shows execution result
- ✅ Command outputs visible
- ✅ Success/failure status per device

---

#### Test 3.4: Stop Running Job
**Objective:** Verify job cancellation  
**Steps:**
1. Login
2. Start long-running job (10+ devices)
3. Click "Stop" or "Cancel" button
4. Verify job stops

**Expected:**
- ✅ Job status changes to "stopped" or "cancelled"
- ✅ No further progress updates
- ✅ Devices disconnect

---

### Suite 4: Rate Limiting Tests (CRITICAL - Priority 1)

#### Test 4.1: Bulk Delete Rate Limiting (10/minute)
**Objective:** Verify bulk delete rate limiting  
**Steps:**
1. Login
2. Create 12 test devices
3. Attempt 12 bulk delete operations in < 60 seconds
4. Track which requests succeed vs rate limited

**Expected:**
- ✅ First 10 operations succeed
- ✅ Operations 11-12 return 429
- ✅ Error message displayed for rate-limited requests

---

#### Test 4.2: Job Creation Rate Limiting (30/minute)
**Objective:** Verify automation job rate limiting  
**Steps:**
1. Login
2. Rapidly create 32 automation jobs
3. Track success vs rate limited

**Expected:**
- ✅ First 30 jobs created
- ✅ Jobs 31-32 return 429
- ✅ Rate limit error shown

---

### Suite 5: Security Tests (CRITICAL - Priority 1)

#### Test 5.1: CORS Configuration Validation
**Objective:** Verify CORS does NOT use wildcard  
**Steps:**
1. Make API request from Puppeteer
2. Inspect response headers
3. Check Access-Control-Allow-Origin header

**Expected:**
- ✅ Header value is NOT "*"
- ✅ Header value is specific origin (localhost:9050 or 127.0.0.1:9050)

**Assertions:**
```typescript
- header "access-control-allow-origin" should NOT equal "*"
- header should match /localhost|127.0.0.1/
```

---

#### Test 5.2: Unauthenticated Access Prevention
**Objective:** Verify protected endpoints require authentication  
**Steps:**
1. Do NOT login
2. Try to access /api/devices directly
3. Verify 401 Unauthorized

**Expected:**
- ✅ Request returns 401
- ✅ Redirected to login or error shown

---

### Suite 6: Data Integrity Tests (HIGH - Priority 2)

#### Test 6.1: IP Address Validation
**Objective:** Verify invalid IP rejected  
**Steps:**
1. Login
2. Try to create device with IP: "999.999.999.999"
3. Click Save

**Expected:**
- ✅ Validation error shown
- ✅ Device NOT created
- ✅ Form highlights invalid field

---

#### Test 6.2: Required Fields Validation
**Objective:** Verify required fields enforced  
**Steps:**
1. Login
2. Open device form
3. Leave Device Name empty
4. Try to save

**Expected:**
- ✅ Validation error shown
- ✅ Form submission prevented
- ✅ Error message: "Device name is required"

---

### Suite 7: Transformation & Topology (MEDIUM - Priority 3)

#### Test 7.1: Generate Topology
**Objective:** Verify topology generation from device data  
**Steps:**
1. Login
2. Ensure automation has run (output files exist)
3. Navigate to Transformation page
4. Click "Generate Topology"
5. Wait for completion

**Expected:**
- ✅ Topology generated successfully
- ✅ Nodes and links displayed
- ✅ No errors shown

---

### Suite 8: Error Handling (MEDIUM - Priority 3)

#### Test 8.1: Backend Offline Handling
**Objective:** Verify graceful handling when backend unavailable  
**Steps:**
1. Stop backend server
2. Open frontend
3. Try to load devices

**Expected:**
- ✅ Error message displayed
- ✅ User-friendly message (not technical stack trace)
- ✅ App doesn't crash

---

## 3. TEST DATA FIXTURES

### 3.1 Test Devices
```typescript
const testDevices = [
  {
    id: "test-001",
    deviceName: "test-zwe-hra-p01",
    ipAddress: "172.20.0.101",
    protocol: "SSH",
    port: 22,
    username: "cisco",
    password: "cisco",
    country: "Zimbabwe",
    deviceType: "P",
    platform: "ASR9905",
    software: "IOS XR",
    tags: ["test", "e2e"]
  },
  // ... 19 more test devices
];
```

### 3.2 Test Users
```typescript
const testUsers = [
  { username: "admin-test", password: "test123", role: "admin" },
  { username: "operator-test", password: "test123", role: "operator" },
  { username: "viewer-test", password: "test123", role: "viewer" }
];
```

---

## 4. PUPPETEER CONFIGURATION

### 4.1 Browser Launch Options
```typescript
const browser = await puppeteer.launch({
  headless: true, // Set to false for debugging
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
  slowMo: 50, // Slow down by 50ms for stability
});
```

### 4.2 Default Timeouts
- **Navigation:** 30 seconds
- **Element Wait:** 10 seconds
- **Network Idle:** 5 seconds

### 4.3 Screenshot on Failure
Capture screenshot for every failed test for debugging

---

## 5. TEST EXECUTION STRATEGY

### 5.1 Sequential Execution
Run tests one at a time to avoid:
- Rate limit conflicts
- Database race conditions
- WebSocket connection conflicts

### 5.2 Test Isolation
Each test:
1. Starts with clean browser context
2. Uses dedicated test data
3. Cleans up after completion

### 5.3 Retry Logic
- Retry flaky tests up to 2 times
- Wait 5 seconds between retries
- Log retry attempts

---

## 6. SUCCESS METRICS

### 6.1 Pass Criteria
- ✅ **Critical Tests:** 100% pass rate (Suite 1-5)
- ✅ **High Priority Tests:** >= 95% pass rate
- ✅ **Medium Priority Tests:** >= 90% pass rate

### 6.2 Performance Criteria
- ✅ Login flow: < 2 seconds
- ✅ Device list load: < 3 seconds
- ✅ Automation job creation: < 1 second
- ✅ WebSocket connection: < 1 second

### 6.3 Security Criteria
- ✅ All rate limiting tests pass
- ✅ No wildcard CORS detected
- ✅ Authentication enforced on all protected endpoints

---

## 7. TEST EXECUTION PLAN

### 7.1 Pre-Test Setup
1. ✅ Start backend server (port 9050)
2. ✅ Build frontend (`npm run build`)
3. ✅ Start frontend preview (port 9051)
4. ✅ Seed test database with test devices
5. ✅ Create test user accounts
6. ✅ Verify all services healthy

### 7.2 Test Execution Order
1. **Authentication Tests** (Suite 1) - 10 minutes
2. **Device Management Tests** (Suite 2) - 15 minutes
3. **Automation Tests** (Suite 3) - 20 minutes
4. **Rate Limiting Tests** (Suite 4) - 15 minutes
5. **Security Tests** (Suite 5) - 10 minutes
6. **Data Integrity Tests** (Suite 6) - 10 minutes
7. **Transformation Tests** (Suite 7) - 10 minutes
8. **Error Handling Tests** (Suite 8) - 10 minutes

**Total Estimated Time:** ~100 minutes (1 hour 40 minutes)

### 7.3 Post-Test Cleanup
1. ✅ Stop frontend preview
2. ✅ Stop backend server
3. ✅ Archive test logs
4. ✅ Save test screenshots
5. ✅ Generate test report

---

## 8. REPORTING

### 8.1 Test Report Format
```
=================================
E2E Test Report
=================================
Date: November 30, 2025
Total Tests: 42
Passed: 40
Failed: 2
Skipped: 0
Pass Rate: 95.24%
Duration: 98 minutes
=================================

FAILED TESTS:
1. Test 4.2: Job Creation Rate Limiting
   - Expected 429 on 31st request, got 200
   - Screenshot: screenshots/test-4-2-failed.png

2. Test 8.1: Backend Offline Handling
   - Timeout waiting for error message
   - Screenshot: screenshots/test-8-1-failed.png

CRITICAL TESTS: 38/38 PASSED ✅
HIGH PRIORITY TESTS: 2/4 PASSED ⚠️
MEDIUM PRIORITY TESTS: 0/0 PASSED

RECOMMENDATION: Fix failed high-priority tests before production deployment.
```

---

## 9. RISK MITIGATION

### 9.1 Flaky Test Prevention
- Use explicit waits (waitForSelector, waitForNetworkIdle)
- Add retry logic for network-dependent tests
- Increase timeouts for slow operations

### 9.2 Test Environment Stability
- Use dedicated test database
- Reset state between tests
- Avoid parallel test execution

### 9.3 Debugging Failed Tests
- Capture screenshots on failure
- Log all network requests
- Save HTML content for inspection

---

## 10. NEXT ACTIONS

### Immediate (Step 7c)
- [ ] Implement test utility functions
- [ ] Create Puppeteer test helpers
- [ ] Implement authentication test suite
- [ ] Implement device management test suite
- [ ] Implement rate limiting tests

### Short-term (Step 7d)
- [ ] Run sample tests to validate approach
- [ ] Fix any test framework issues
- [ ] Optimize test performance

### Medium-term (Step 8)
- [ ] Execute full E2E suite
- [ ] Analyze and fix failures
- [ ] Generate comprehensive report

---

**Planning Phase Complete!** ✅  
**Next:** Proceed to Step 7c - Build the Puppeteer E2E Test Suite
