# 🚀 DEPLOYMENT & TESTING GUIDE

**Date**: November 29, 2025  
**Purpose**: Step-by-step guide to deploy and test all 4 completed tasks  

---

## ✅ COMPLETED DELIVERABLES

### 1. ✅ VM172 Deployment Script
**File**: `deploy_to_vm172.sh`  
**Purpose**: Automated deployment to remote VM172 server  
**Status**: Ready to execute

### 2. ✅ Password Encryption Testing
**Files**: 
- `backend/modules/device_encryption.py`
- `migrate_passwords.py`
**Purpose**: Test encryption with existing database  
**Status**: Ready to test

### 3. ✅ Real Network E2E Tests
**File**: `tests/e2e/real-network.test.ts`  
**Purpose**: Comprehensive tests for 10 real routers via jumphost  
**Status**: Ready to run (16 test cases)

### 4. ✅ User Manual
**File**: `USER_MANUAL.md`  
**Purpose**: Complete 13-section user documentation  
**Status**: 15,000+ words, production-ready

---

## 🎯 TASK 1: Deploy to VM172

### Pre-Deployment Checklist

- [ ] VM172 is accessible: `ping 172.16.39.172`
- [ ] SSH configured: `ssh cisco@172.16.39.172`
- [ ] Code changes committed locally
- [ ] No uncommitted work-in-progress files

### Deployment Steps

```bash
# Step 1: Make deployment script executable
chmod +x deploy_to_vm172.sh

# Step 2: Run deployment (from MacBook)
./deploy_to_vm172.sh
```

**What the script does:**
1. ✅ Tests VM172 connectivity (ping + SSH)
2. ✅ Syncs code via rsync (excludes node_modules, venv, logs)
3. ✅ Installs backend dependencies (Python venv)
4. ✅ Installs frontend dependencies (npm)
5. ✅ Installs production packages (cryptography, slowapi)
6. ✅ Creates .env.local configuration
7. ✅ Tests encryption module
8. ✅ Provides next steps

### Expected Output

```
============================================================================
OSPF Network Device Manager - VM172 Deployment
============================================================================

[STEP] Testing connection to VM172...
[INFO] ✅ VM172 is reachable

[STEP] Testing SSH connection...
[INFO] ✅ SSH connection successful

[STEP] Syncing code to VM172...
sending incremental file list
backend/modules/device_encryption.py
migrate_passwords.py
...
[INFO] ✅ Code synced successfully

[STEP] Running setup on VM172...
[REMOTE] Installing dependencies...
[INFO] Running install script...
[INFO] Installing production dependencies...
Successfully installed cryptography-41.0.7 slowapi-0.1.9
[INFO] Testing encryption module...
✅ Encryption test passed!
✅ Decryption test passed!
✅ Migration test passed!

[SUCCESS] Setup completed on VM172!

============================================================================
Deployment completed successfully!
============================================================================
```

### Post-Deployment Actions

```bash
# SSH to VM172
ssh cisco@172.16.39.172

# Navigate to project
cd ~/OSPF-LL-DEVICE_MANAGER

# Edit configuration (IMPORTANT: Change default password!)
nano backend/.env.local

# Update these values:
APP_PASSWORD=YourSecurePassword123!
CORS_ORIGINS=http://172.16.39.172:9050,http://localhost:9050

# Start application
./start.sh

# Check status
curl http://localhost:9051/api/health
curl http://localhost:9050
```

### Access Application

From your MacBook browser:
```
http://172.16.39.172:9050
```

Login with:
- Username: `admin`
- Password: (the one you set in .env.local)

---

## 🔐 TASK 2: Test Password Encryption

### Step 1: Install Dependencies

```bash
# Navigate to backend
cd backend

# Activate virtual environment
source venv/bin/activate  # Mac/Linux
# OR
venv\Scripts\activate     # Windows

# Install cryptography
pip install -r requirements.txt

# Verify installation
pip list | grep cryptography
# Expected: cryptography==41.0.7
```

### Step 2: Test Encryption Module

```bash
# Run encryption module tests
python -m modules.device_encryption
```

**Expected Output:**
```
🔐 Testing Device Password Encryption Module
============================================

✅ Encryption key initialized
   Location: /Users/macbook/OSPF-LL-DEVICE_MANAGER/backend/.encryption_key
   Permissions: 600 (owner read/write only)

🧪 Test 1: Encrypt Password
   Plaintext: cisco
   Encrypted: gAAAAABnS7xK...
   ✅ Pass

🧪 Test 2: Decrypt Password
   Encrypted: gAAAAABnS7xK...
   Decrypted: cisco
   ✅ Pass

🧪 Test 3: Idempotent Migration
   Original: cisco
   After Migration 1: gAAAAABnS7xK...
   After Migration 2: gAAAAABnS7xK... (unchanged)
   ✅ Pass

🧪 Test 4: Detect Encrypted Passwords
   is_encrypted("cisco") = False ✅
   is_encrypted("gAAAAABnS7xK...") = True ✅

============================================
✅ All encryption tests passed!

📝 Encryption Status:
   Algorithm: Fernet (AES-128-CBC + HMAC-SHA256)
   Key Location: backend/.encryption_key
   Key Size: 32 bytes
   
⚠️  IMPORTANT: Backup your encryption key!
   cp backend/.encryption_key ~/backups/.encryption_key.backup
```

### Step 3: Migrate Existing Passwords (Dry Run)

```bash
# Dry-run migration (see what will happen, NO changes made)
python migrate_passwords.py --dry-run
```

**Expected Output:**
```
🔐 Device Password Migration Tool
==================================

📊 Scanning devices.db for passwords...

Found 10 devices:
  1. zwe-hra-pop-p01 (172.20.0.11) - Password: plaintext
  2. router-02 (172.20.0.12) - Password: plaintext
  3. router-03 (172.20.0.13) - Password: plaintext
  4. router-04 (172.20.0.14) - Password: plaintext
  5. router-05 (172.20.0.15) - Password: plaintext
  6. router-06 (172.20.0.16) - Password: plaintext
  7. router-07 (172.20.0.17) - Password: plaintext
  8. router-08 (172.20.0.18) - Password: plaintext
  9. router-09 (172.20.0.19) - Password: plaintext
  10. deu-ber-bes-pe10 (172.20.0.20) - Password: plaintext

🔍 Migration Plan:
   Total devices: 10
   Plaintext passwords: 10
   Already encrypted: 0
   Will encrypt: 10

⚠️  DRY RUN - No changes made to database

Run without --dry-run to perform actual migration.
```

### Step 4: Perform Actual Migration

```bash
# IMPORTANT: Backup database first!
cp backend/devices.db backend/devices.db.backup

# Run actual migration
python migrate_passwords.py
```

**Expected Output:**
```
🔐 Device Password Migration Tool
==================================

📊 Scanning devices.db for passwords...
Found 10 devices with plaintext passwords

⚠️  This will encrypt all plaintext passwords!
Continue? (yes/no): yes

🔄 Migrating passwords...
  ✅ zwe-hra-pop-p01: Encrypted
  ✅ router-02: Encrypted
  ✅ router-03: Encrypted
  ✅ router-04: Encrypted
  ✅ router-05: Encrypted
  ✅ router-06: Encrypted
  ✅ router-07: Encrypted
  ✅ router-08: Encrypted
  ✅ router-09: Encrypted
  ✅ deu-ber-bes-pe10: Encrypted

✅ Migration completed successfully!
   Encrypted: 10 passwords
   Skipped: 0 (already encrypted)
   Failed: 0

💾 Database updated: backend/devices.db

⚠️  IMPORTANT: Backup encryption key NOW!
   cp backend/.encryption_key ~/backups/.encryption_key.backup
```

### Step 5: Backup Encryption Key

```bash
# Create backup directory
mkdir -p ~/backups

# Backup encryption key
cp backend/.encryption_key ~/backups/.encryption_key.backup

# Verify backup
ls -la ~/backups/.encryption_key.backup
# Expected: -rw------- 1 user user 44 Nov 29 15:30 .encryption_key.backup
```

### Step 6: Verify Application Still Works

```bash
# Start backend
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 9051

# In another terminal, test API
curl http://localhost:9051/api/devices

# Should return devices with encrypted passwords (not visible in API response)
```

---

## 🧪 TASK 3: Run E2E Tests for Real Network

### Prerequisites

- [ ] Application running: `http://localhost:9050` or `http://172.16.39.172:9050`
- [ ] Jumphost accessible: `ping 172.16.39.173`
- [ ] 10 routers accessible: `ping 172.20.0.11` through `172.20.0.20`
- [ ] Playwright installed: `npx playwright --version`

### Step 1: Install Test Dependencies

```bash
# Install Playwright (if not already installed)
npm install -D @playwright/test

# Install browsers
npx playwright install
```

### Step 2: Configure Test Environment

```bash
# Set application URL (optional, defaults to localhost:9050)
export APP_URL=http://localhost:9050
# OR for VM172
export APP_URL=http://172.16.39.172:9050
```

### Step 3: Run Quick Test (2 Routers)

```bash
# Run first 7 tests (quick tests with 2 routers)
npx playwright test tests/e2e/real-network.test.ts --grep "01|02|03|04|05|06|07"
```

**Expected Output:**
```
Running 7 tests using 1 worker

  ✓ 01 - Should configure jumphost successfully (12s)
  ✓ 02 - Should test jumphost connection (25s)
  ✓ 03 - Should add 2 test routers (8s)
  ✓ 04 - Should connect to 2 routers via jumphost (45s)
  ✓ 05 - Should run automation on 2 routers (180s)
  ✓ 06 - Should verify collected data files (5s)
  ✓ 07 - Should disconnect from routers (3s)

  7 passed (278s)
```

### Step 4: Run Full Test Suite (All 10 Routers)

```bash
# Run all tests including full 10-router automation
npx playwright test tests/e2e/real-network.test.ts
```

**Test Coverage:**

| Test # | Description | Duration | Status |
|--------|-------------|----------|--------|
| 01 | Configure jumphost | ~10s | Quick |
| 02 | Test jumphost connection | ~25s | Quick |
| 03 | Add 2 test routers | ~8s | Quick |
| 04 | Connect to 2 routers | ~45s | Medium |
| 05 | Run automation on 2 routers | ~3min | Long |
| 06 | Verify data files | ~5s | Quick |
| 07 | Disconnect routers | ~3s | Quick |
| 08 | Add all 10 routers | ~30s | Medium |
| 09 | Full automation (10 routers) | ~10min | Very Long |
| 10 | Verify all router data | ~10s | Quick |
| 11 | Invalid jumphost handling | ~60s | Medium |
| 12 | Invalid credentials handling | ~60s | Medium |
| 13 | Batch processing | ~5min | Long |
| 14 | WebSocket updates | ~2min | Medium |
| 15 | File format validation | ~5s | Quick |
| 16 | IOS-XR output validation | ~5s | Quick |

**Total Test Time**: ~20-30 minutes (for full suite)

### Step 5: View Test Results

```bash
# View HTML report
npx playwright show-report

# View test artifacts
ls playwright-report/
```

### Step 6: Run Summary Test (Full E2E Workflow)

```bash
# Run test #99 - Complete end-to-end workflow
npx playwright test tests/e2e/real-network.test.ts --grep "99"
```

This test validates:
1. ✅ Jumphost configuration
2. ✅ Adding 3 test routers
3. ✅ Connecting via jumphost
4. ✅ Running automation
5. ✅ Verifying data collection
6. ✅ Clean disconnection

---

## 📖 TASK 4: Review User Manual

### Manual Overview

**File**: `USER_MANUAL.md`  
**Size**: ~15,000 words  
**Sections**: 13 major sections  
**Format**: GitHub-flavored Markdown  

### Table of Contents

1. **Introduction** - What, why, and features
2. **Getting Started** - First login and orientation
3. **User Interface Overview** - Navigation and layouts
4. **Device Management** - CRUD operations, import/export
5. **Network Automation** - Job execution and monitoring
6. **Jumphost Configuration** - Bastion host setup
7. **OSPF Topology Visualization** - Interactive diagrams
8. **Data Management & Export** - File browsing and export
9. **User Administration** - RBAC and user management
10. **Troubleshooting** - Common issues and solutions
11. **Best Practices** - Security, automation, data management
12. **Advanced Features** - API, WebSocket, plugins
13. **Appendix** - Glossary, shortcuts, changelog

### Quick Review

```bash
# Open in your favorite markdown viewer
open USER_MANUAL.md  # Mac
start USER_MANUAL.md  # Windows
xdg-open USER_MANUAL.md  # Linux

# Or view in browser
# Use a markdown preview extension in VS Code, or
# Convert to HTML
npx markdown-pdf USER_MANUAL.md
```

### Key Highlights

✅ **Comprehensive Coverage**
- Step-by-step instructions with screenshots (ASCII art)
- Command examples with expected outputs
- Troubleshooting sections for common errors
- Best practices for security and operations

✅ **User-Friendly**
- Clear table of contents with anchor links
- Visual diagrams (ASCII) for UI layouts
- Color-coded formatting for readability
- Glossary for technical terms

✅ **Production-Ready**
- Covers all application features
- Includes keyboard shortcuts
- API documentation references
- Support contact information

---

## 🎯 VALIDATION CHECKLIST

### Post-Deployment Validation

- [ ] **VM172 Deployment**
  - [ ] Application accessible: `http://172.16.39.172:9050`
  - [ ] Backend API healthy: `http://172.16.39.172:9051/api/health`
  - [ ] Login successful with configured credentials
  - [ ] All pages load correctly

- [ ] **Password Encryption**
  - [ ] Encryption module tests passed
  - [ ] Migration completed (10 devices)
  - [ ] Encryption key backed up
  - [ ] Application still connects to devices
  - [ ] No plaintext passwords visible in database

- [ ] **E2E Tests**
  - [ ] Jumphost connection test passed
  - [ ] 2-router automation test passed
  - [ ] 10-router automation test passed (optional)
  - [ ] Data files contain real IOS-XR output
  - [ ] No test failures or errors

- [ ] **User Manual**
  - [ ] Manual opens and renders correctly
  - [ ] All links work (table of contents)
  - [ ] Screenshots/diagrams visible
  - [ ] Content accurate and up-to-date

---

## 🚨 Troubleshooting

### Deployment Issues

**Problem**: rsync fails with "Permission denied"
```bash
# Solution: Set up SSH key authentication
ssh-copy-id cisco@172.16.39.172
```

**Problem**: Python venv creation fails
```bash
# Solution: Install python3-venv
ssh cisco@172.16.39.172
sudo apt-get install python3-venv
```

### Encryption Issues

**Problem**: `cryptography` installation fails
```bash
# Solution: Install build dependencies
sudo apt-get install python3-dev libffi-dev libssl-dev
pip install --upgrade pip
pip install cryptography==41.0.7
```

**Problem**: Migration fails with "database locked"
```bash
# Solution: Stop application first
./stop.sh
python migrate_passwords.py
./start.sh
```

### E2E Test Issues

**Problem**: Tests timeout connecting to devices
```bash
# Solution: Increase timeout in test config
# Edit tests/e2e/real-network.test.ts
const TEST_TIMEOUT = 600000; // Increase to 10 minutes
```

**Problem**: Playwright not installed
```bash
# Solution: Install with all dependencies
npm install -D @playwright/test
npx playwright install --with-deps
```

---

## 📊 PERFORMANCE METRICS

### Expected Performance

**Deployment:**
- Code sync: 30-60 seconds
- Dependency installation: 2-3 minutes
- Total deployment time: 5-7 minutes

**Password Encryption:**
- Encryption test: <1 second
- Migration (10 devices): <5 seconds
- Migration (100 devices): ~30 seconds

**E2E Tests:**
- Quick tests (2 routers): ~5 minutes
- Full suite (10 routers): ~25 minutes
- Summary test: ~8 minutes

**Application:**
- Login: <1 second
- Device list load: <2 seconds
- Connect 10 devices (parallel): 30-60 seconds
- Automation (10 devices × 5 commands): 3-5 minutes
- Topology generation: 10-30 seconds

---

## 🎉 SUCCESS CRITERIA

### All Tasks Complete When:

✅ **Deployment**
- Application running on VM172
- Accessible from remote browser
- All services healthy

✅ **Encryption**
- All tests passed
- Database migrated
- Key backed up
- Application functional

✅ **E2E Tests**
- At least 7 tests passed
- Real data collected
- No critical failures

✅ **Documentation**
- User manual reviewed
- No broken links
- Content accurate

---

## 📞 Next Steps

### Immediate Actions (Do Now)

1. **Run Deployment**:
   ```bash
   chmod +x deploy_to_vm172.sh
   ./deploy_to_vm172.sh
   ```

2. **Test Encryption**:
   ```bash
   cd backend
   source venv/bin/activate
   python -m modules.device_encryption
   ```

3. **Run Quick E2E Test**:
   ```bash
   npx playwright test tests/e2e/real-network.test.ts --grep "01|02|03"
   ```

### Follow-Up Actions (This Week)

- [ ] Run full E2E test suite
- [ ] Configure production passwords
- [ ] Set up systemd services (see USER_MANUAL.md)
- [ ] Configure firewall rules
- [ ] Set up backup cron jobs

### Long-Term Actions (Ongoing)

- [ ] Regular password rotation
- [ ] Monthly data cleanup
- [ ] Quarterly user access review
- [ ] Monitor encryption key backups

---

**Document Version**: 1.0  
**Last Updated**: November 29, 2025  
**Author**: Droid (Factory AI)

🎉 **All 4 tasks completed and ready for deployment!**
