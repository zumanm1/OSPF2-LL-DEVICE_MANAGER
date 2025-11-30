# 🔍 Blank Page Diagnostic Test

**Purpose**: Diagnose why http://172.16.39.172:9050 shows a blank page

---

## Quick Start

### Step 1: Install Dependencies

```bash
# Make sure you're in the project root
cd ~/OSPF-LL-DEVICE_MANAGER  # or your repo path

# Install puppeteer (if not already installed)
npm install --save-dev puppeteer node-fetch
```

### Step 2: Run Diagnostic Test

```bash
# Test the VM172 deployment (default)
node tests/diagnostic-blank-page.js

# OR test localhost
TEST_URL=http://localhost:9050 BACKEND_URL=http://localhost:9051 node tests/diagnostic-blank-page.js
```

---

## What the Test Does

The diagnostic test performs **8 comprehensive checks**:

1. ✅ **Backend Health Check** - Verifies backend API is responding
2. ✅ **Browser Launch** - Opens headless Chrome with console capture
3. ✅ **Page Navigation** - Loads the page and captures initial state
4. ✅ **Content Check** - Verifies page body is not empty
5. ✅ **React Root Check** - Ensures React app is mounting
6. ✅ **JavaScript Errors** - Lists all console errors
7. ✅ **Network Analysis** - Shows failed HTTP requests
8. ✅ **Common Issues** - Detects CORS, WebSocket, bundle problems

---

## Output Files

All diagnostic data is saved to: **`diagnostic-screenshots/`**

- `{timestamp}_01_initial_load.png` - Screenshot of the blank page
- `{timestamp}_page_content.html` - Full HTML source
- `{timestamp}_diagnostic_report.json` - Complete test results

---

## Example Output

```bash
🔍 ================================================================================
🔍 BLANK PAGE DIAGNOSTIC TEST
🔍 ================================================================================
ℹ️ Test URL: http://172.16.39.172:9050
ℹ️ Backend URL: http://172.16.39.172:9051

📋 TEST 1: Backend Health Check
✅ Backend is healthy: {"status":"OK","database":"connected"}

📋 TEST 2: Launch Browser & Capture Console
✅ Browser launched and listeners attached

📋 TEST 3: Navigate to Page
✅ Page loaded with status: 200
📸 Screenshot saved: diagnostic-screenshots/2025-11-29_initial_load.png

📋 TEST 4: Check Page Content
📄 HTML length: 523 characters
📄 Body text length: 0 characters
📄 Body HTML length: 31 characters
❌ Body is EMPTY - This is the blank page issue!

📋 TEST 5: Check for React Root
✅ React root (#root) found with 0 characters
❌ React root is EMPTY - React may not be mounting!
🔴 Console Error: Failed to load resource: net::ERR_CONNECTION_REFUSED

📋 TEST 6: JavaScript Errors Summary
❌ Found 3 JavaScript errors:
  1. Failed to load resource: http://172.16.39.172:9050/assets/index-ABC123.js
  2. Uncaught ReferenceError: React is not defined
  3. Failed to mount React application

📋 TEST 7: Network Requests Analysis
📡 Total requests: 5
📡 Total responses: 3
❌ Found 2 failed requests:
  1. [404] http://172.16.39.172:9050/assets/index-ABC123.js
  2. [500] http://172.16.39.172:9051/api/devices

📋 TEST 8: Common Issues Check
❌ JavaScript bundle loading failed (1 files)

📊 ================================================================================
📊 DIAGNOSTIC SUMMARY
📊 ================================================================================
✅ Tests Passed: 3
❌ Tests Failed: 5
⚠️ Warnings: 1
🚨 Errors: 4

🔴 Primary issues: Backend server is not running or unreachable; React is not mounting - check index.html and main bundle; JavaScript bundles are not loading - check build output

💾 Diagnostic report saved: diagnostic-screenshots/2025-11-29_diagnostic_report.json
```

---

## Common Issues & Fixes

### Issue 1: Backend Unreachable
```
❌ Backend health check failed: connect ECONNREFUSED
```

**Fix:**
```bash
# SSH to VM172
ssh cisco@172.16.39.172

# Check backend status
cd ~/OSPF-LL-DEVICE_MANAGER
./status.sh

# If not running, start it
./start.sh
```

---

### Issue 2: React Not Mounting
```
❌ React root is EMPTY - React may not be mounting!
```

**Fix:**
```bash
# SSH to VM172
ssh cisco@172.16.39.172
cd ~/OSPF-LL-DEVICE_MANAGER

# Rebuild frontend
npm run build

# Restart application
./restart.sh
```

---

### Issue 3: JavaScript Bundles Failed
```
❌ [404] http://172.16.39.172:9050/assets/index-ABC123.js
```

**Fix:**
```bash
# Check if dist folder exists with built assets
ssh cisco@172.16.39.172
cd ~/OSPF-LL-DEVICE_MANAGER
ls -la dist/assets/

# If empty or missing, rebuild
npm run build

# Verify files exist
ls -lh dist/assets/*.js
```

---

### Issue 4: CORS Configuration
```
❌ CORS issues detected (2)
Console Error: Access to fetch at 'http://172.16.39.172:9051' blocked by CORS
```

**Fix:**
```bash
# Edit CORS settings in .env.local
ssh cisco@172.16.39.172
cd ~/OSPF-LL-DEVICE_MANAGER
nano backend/.env.local

# Add your MacBook IP to CORS origins
CORS_ORIGINS=http://172.16.39.172:9050,http://localhost:9050,http://YOUR_MACBOOK_IP:9050

# Restart backend
./restart.sh
```

---

### Issue 5: Frontend Not Serving
```
✅ Page loaded with status: 200
❌ Body is EMPTY
```

**Fix:**
```bash
# Frontend server might not be running
ssh cisco@172.16.39.172
cd ~/OSPF-LL-DEVICE_MANAGER

# Check process status
./status.sh

# Check if Vite dev server is running
ps aux | grep vite

# If not running, restart
./restart.sh

# Check frontend logs
tail -f logs/app.log | grep -i "frontend\|vite"
```

---

## Advanced Troubleshooting

### Check Backend Logs
```bash
ssh cisco@172.16.39.172
cd ~/OSPF-LL-DEVICE_MANAGER
tail -50 logs/app.log
tail -50 logs/error.log
```

### Check Frontend Dev Server
```bash
# See if Vite is serving correctly
curl -I http://172.16.39.172:9050

# Expected response:
# HTTP/1.1 200 OK
# Content-Type: text/html
```

### Check Network Connectivity
```bash
# From MacBook, test backend
curl http://172.16.39.172:9051/api/health

# Expected: {"status":"OK","database":"connected"}

# Test frontend
curl -I http://172.16.39.172:9050

# Expected: HTTP/1.1 200 OK
```

### Manual Test in Browser Console
```javascript
// Open http://172.16.39.172:9050 in browser
// Open Developer Tools (F12)
// Go to Console tab

// Check if React loaded
console.log(typeof React);  // Should be 'object'

// Check if root exists
console.log(document.getElementById('root'));  // Should show <div id="root">

// Check for errors
console.log(window.__REACT_ERROR__);  // Should be undefined
```

---

## Next Steps After Running Diagnostic

1. **Review the diagnostic report** in `diagnostic-screenshots/{timestamp}_diagnostic_report.json`
2. **Look at the screenshot** to see what the page looks like
3. **Check the HTML source** to verify structure
4. **Follow the fixes** for the top issues identified
5. **Re-run the test** after applying fixes

---

## Testing Localhost Instead

If you want to test your local development server:

```bash
# Start your local servers first
./start.sh

# Then run diagnostic against localhost
TEST_URL=http://localhost:9050 BACKEND_URL=http://localhost:9051 node tests/diagnostic-blank-page.js
```

---

## Need More Help?

If the diagnostic test doesn't identify the issue:

1. Check if VM172 firewall is blocking port 9050/9051
2. Verify VM172 has internet access to download npm packages
3. Check VM172 disk space: `df -h`
4. Check VM172 memory: `free -h`
5. Review full application logs on VM172

---

**Created**: November 29, 2025  
**Last Updated**: November 29, 2025
