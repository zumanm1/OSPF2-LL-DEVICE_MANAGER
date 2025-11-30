# Remote Deployment and Testing Guide
**OSPF Network Device Manager - Production Test Server**

Date: November 30, 2025  
Target Server: 172.16.39.172  
Jumphost: 172.16.39.173

---

## 🎯 Deployment Objectives

1. ✅ Deploy application to remote test server (172.16.39.172)
2. ✅ Configure jumphost connection (172.16.39.173)
3. ✅ Run automation workflow on 10 real network devices
4. ✅ Validate end-to-end functionality
5. ✅ Generate production readiness report

---

## 📋 Prerequisites

### Local Machine Requirements
```bash
# Install sshpass (for automated SSH)
sudo apt-get install sshpass  # Ubuntu/Debian
brew install hudson/brew/sshpass  # macOS

# Verify Git is installed
git --version
```

### Remote Server Requirements (172.16.39.172)
- ✅ SSH access: cisco/cisco
- ✅ Python 3.8+ installed
- ✅ Node.js 16+ installed
- ✅ Network connectivity to GitHub
- ✅ Network connectivity to jumphost (172.16.39.173)

### Jumphost Requirements (172.16.39.173)
- ✅ SSH access: cisco/cisco
- ✅ Network connectivity to routers (172.20.0.11-20)
- ✅ Port 22 open for SSH connections

---

## 🚀 Automated Deployment

### Step 1: Make Script Executable
```bash
cd /Users/macbook/OSPF-LL-DEVICE_MANAGER
chmod +x deploy_remote_test.sh
```

### Step 2: Run Automated Deployment
```bash
./deploy_remote_test.sh
```

**This script will automatically:**
1. Commit and push all changes to GitHub
2. SSH into remote server (172.16.39.172)
3. Clone repository from GitHub
4. Install Python dependencies
5. Install Node dependencies and build frontend
6. Start backend server (port 9050)
7. Start frontend server (port 9051)
8. Create management scripts
9. Display access information

**Expected Duration:** 5-10 minutes

---

## 📊 Deployment Phases

### Phase 1: Git Commit and Push ✅
```
- Check git status
- Add all changes
- Commit with timestamp
- Push to GitHub main/master branch
```

### Phase 2: SSH Connection Test ✅
```
- Test SSH connection to 172.16.39.172
- Verify authentication
- Check hostname and user
```

### Phase 3: Clone Repository ✅
```
- Clean up existing deployment
- Kill any running processes
- Remove old directory
- Clone fresh from GitHub
```

### Phase 4: Python Setup ✅
```
- Verify Python 3 installed
- Install pip if needed
- Install requirements.txt
- Verify critical packages (fastapi, netmiko, paramiko, cryptography)
```

### Phase 5: Node Setup ✅
```
- Verify Node.js and npm installed
- Install npm packages
- Build frontend (npm run build)
- Verify dist/ directory created
```

### Phase 6: Start Backend ✅
```
- Start uvicorn server on port 9050
- Wait 5 seconds for startup
- Health check: curl http://localhost:9050/api/health
- Verify from local machine
```

### Phase 7: Start Frontend ✅
```
- Start vite preview server on port 9051
- Wait 5 seconds for startup
- Health check: curl http://localhost:9051
- Verify from local machine
```

### Phase 8: Management Script ✅
```
- Create manage.sh script on remote server
- Commands: start, stop, restart, status, logs
```

### Phase 9: Display Access Info ✅
```
- Show deployment summary
- Display URLs and credentials
- Provide next steps
```

---

## 🌐 Access Information

After successful deployment:

### Frontend (Web UI)
```
URL: http://172.16.39.172:9051
Username: admin
Password: admin123
```

### Backend (API)
```
URL: http://172.16.39.172:9050
Health Check: http://172.16.39.172:9050/api/health
API Docs: http://172.16.39.172:9050/docs
```

### SSH Access
```bash
ssh cisco@172.16.39.172
# Navigate to: /home/cisco/OSPF-LL-DEVICE_MANAGER
```

---

## ⚙️ Configuration Steps (Web UI)

### Step 1: Login
1. Open browser: `http://172.16.39.172:9051`
2. Click "Login"
3. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
4. Click "Login"

### Step 2: Configure Jumphost
1. Click "Settings" in navigation menu
2. Scroll to "Jumphost Configuration"
3. Enable jumphost toggle
4. Enter details:
   ```
   Host: 172.16.39.173
   Port: 22
   Username: cisco
   Password: cisco
   ```
5. Click "Test Connection" (should show success)
6. Click "Save Configuration"

### Step 3: Verify Devices
1. Click "Device Manager" in navigation menu
2. Should see 10 devices:
   - zwe-hra-pop-p01 (172.20.0.11)
   - zwe-hra-pop-p02 (172.20.0.12)
   - zwe-bul-pop-p03 (172.20.0.13)
   - zwe-bul-pop-p04 (172.20.0.14)
   - usa-nyc-dc1-pe05 (172.20.0.15)
   - deu-ber-bes-p06 (172.20.0.16)
   - gbr-ldn-wst-p07 (172.20.0.17)
   - usa-nyc-dc1-rr08 (172.20.0.18)
   - gbr-ldn-wst-pe09 (172.20.0.19)
   - deu-ber-bes-pe10 (172.20.0.20)

### Step 4: Run Automation
1. Click "Automation" in navigation menu
2. Select all 10 devices (checkbox at top)
3. Click "Run Automation Job"
4. Configure job (optional):
   ```
   Batch Size: 10 (all at once)
   Rate Limit: 0 (no limit)
   ```
5. Click "Start Job"
6. Monitor progress in real-time

### Step 5: Monitor Job Progress
1. Watch job status on Automation page
2. Real-time updates via WebSocket
3. See per-device progress:
   - Connecting...
   - Executing commands...
   - Complete (green) or Error (red)
4. View output files when complete

### Step 6: View Results
1. Click "View Results" when job completes
2. Navigate to each device tab
3. View command outputs:
   - OSPF neighbor status
   - Interface status
   - Configuration snapshots
4. Download output files (TEXT or JSON)

---

## 🔧 Remote Management Commands

### SSH into Remote Server
```bash
ssh cisco@172.16.39.172
cd /home/cisco/OSPF-LL-DEVICE_MANAGER
```

### Use Management Script
```bash
# Check status
./manage.sh status

# View logs
./manage.sh logs

# Restart services
./manage.sh restart

# Stop services
./manage.sh stop

# Start services
./manage.sh start
```

### Manual Service Management
```bash
# Backend
cd /home/cisco/OSPF-LL-DEVICE_MANAGER/backend
python3 -m uvicorn server:app --host 0.0.0.0 --port 9050

# Frontend (in separate terminal)
cd /home/cisco/OSPF-LL-DEVICE_MANAGER
npx vite preview --host 0.0.0.0 --port 9051
```

### View Live Logs
```bash
# Backend logs
tail -f /home/cisco/OSPF-LL-DEVICE_MANAGER/backend/backend.log

# Frontend logs
tail -f /home/cisco/OSPF-LL-DEVICE_MANAGER/frontend.log
```

---

## 🧪 Testing Checklist

### Deployment Validation ✅
- [ ] Git push successful
- [ ] SSH connection to 172.16.39.172 successful
- [ ] Repository cloned successfully
- [ ] Python dependencies installed
- [ ] Node dependencies installed
- [ ] Frontend built (dist/ exists)
- [ ] Backend started (port 9050)
- [ ] Frontend started (port 9051)
- [ ] Health check passes
- [ ] Management script created

### Application Validation ✅
- [ ] Web UI loads successfully
- [ ] Login works (admin/admin123)
- [ ] Device Manager shows 10 devices
- [ ] Settings page accessible
- [ ] Jumphost configuration page accessible

### Jumphost Validation ✅
- [ ] Jumphost configuration saved
- [ ] Test connection succeeds
- [ ] Settings persist after refresh

### Automation Validation ✅
- [ ] Automation page loads
- [ ] Can select all 10 devices
- [ ] Job starts successfully
- [ ] Real-time updates working (WebSocket)
- [ ] Job completes without errors
- [ ] Output files generated
- [ ] Can view device outputs
- [ ] Can download files

### Network Validation ✅
- [ ] Devices reachable via jumphost
- [ ] SSH connections succeed through jumphost
- [ ] Commands execute on real routers
- [ ] OSPF data collected
- [ ] No authentication failures
- [ ] No timeout errors

---

## 🐛 Troubleshooting

### Issue: Cannot SSH to Remote Server
```bash
# Test connectivity
ping 172.16.39.172

# Test SSH manually
ssh cisco@172.16.39.172

# Check firewall
# Ensure port 22 is open
```

### Issue: Backend Health Check Fails
```bash
ssh cisco@172.16.39.172
cd /home/cisco/OSPF-LL-DEVICE_MANAGER/backend
tail -f backend.log

# Check if process is running
ps aux | grep uvicorn

# Restart backend
./manage.sh restart
```

### Issue: Frontend Not Loading
```bash
# Check if port 9051 is open
curl http://172.16.39.172:9051

# Check logs
tail -f /home/cisco/OSPF-LL-DEVICE_MANAGER/frontend.log

# Rebuild
cd /home/cisco/OSPF-LL-DEVICE_MANAGER
npm run build
./manage.sh restart
```

### Issue: Jumphost Connection Fails
```bash
# Test jumphost from remote server
ssh cisco@172.16.39.172
ssh cisco@172.16.39.173

# If fails, check:
# 1. Network connectivity
# 2. Credentials (cisco/cisco)
# 3. SSH service running on jumphost
```

### Issue: Devices Not Reachable
```bash
# From remote server, test through jumphost
ssh cisco@172.16.39.172
ssh -J cisco@172.16.39.173 cisco@172.20.0.11

# If fails:
# 1. Verify jumphost has route to 172.20.0.0/24
# 2. Check device credentials (cisco/cisco)
# 3. Verify SSH enabled on devices
```

### Issue: Automation Job Fails
```bash
# Check backend logs
tail -f /home/cisco/OSPF-LL-DEVICE_MANAGER/backend/backend.log

# Common issues:
# 1. Jumphost not configured - Go to Settings → Configure Jumphost
# 2. Incorrect credentials - Verify cisco/cisco
# 3. Network timeout - Increase timeout in backend
# 4. Device unreachable - Test SSH manually
```

---

## 📊 Expected Results

### Successful Deployment Output
```
╔══════════════════════════════════════════════════════════════════╗
║         DEPLOYMENT SUCCESSFUL                                   ║
╚══════════════════════════════════════════════════════════════════╝

📍 Remote Server: 172.16.39.172
🌐 Frontend URL: http://172.16.39.172:9051
🔌 Backend URL: http://172.16.39.172:9050

🔐 Login Credentials:
   Username: admin
   Password: admin123

🌉 Jumphost Configuration (to be set in UI):
   Jumphost IP: 172.16.39.173
   Username: cisco
   Password: cisco
   Port: 22

✅ Deployment log saved to: deployment_YYYYMMDD_HHMMSS.log
```

### Successful Automation Job Output
```
Job Status: COMPLETED
Total Devices: 10
Successful: 10
Failed: 0
Duration: ~2-5 minutes
Output Files: 30 files (3 per device)
```

---

## 📝 Post-Deployment Verification

### Manual Verification Steps
1. **Access Web UI**
   ```
   Open: http://172.16.39.172:9051
   Login: admin/admin123
   ✅ Page loads, login successful
   ```

2. **Check Backend API**
   ```bash
   curl http://172.16.39.172:9050/api/health
   # Expected: {"status":"OK","database":"connected"}
   ```

3. **Verify Devices**
   ```bash
   curl http://172.16.39.172:9050/api/devices | jq
   # Expected: JSON array with 10 devices
   ```

4. **Test Jumphost Configuration**
   ```
   UI → Settings → Jumphost → Test Connection
   ✅ Should show "Connection successful"
   ```

5. **Run Test Automation**
   ```
   UI → Automation → Select 10 devices → Run Job
   ✅ Job should complete successfully
   ✅ All devices should show "Complete" status
   ```

---

## 🎯 Success Criteria

### ✅ Deployment Success
- All phases complete without errors
- Backend and frontend running
- Health checks pass
- Access URLs working

### ✅ Configuration Success
- Jumphost configured and tested
- 10 devices visible in Device Manager
- Settings persist across page reloads

### ✅ Automation Success
- Job starts without errors
- All 10 devices connect successfully
- Commands execute on all devices
- Output files generated (30 files total)
- No authentication failures
- No timeout errors

### ✅ Production Readiness
- Application stable on remote server
- Real network devices accessible
- Automation workflow functional
- No critical errors in logs
- Performance acceptable

---

## 📚 Related Documentation

- `E2E_IMPLEMENTATION_COMPLETE.md` - E2E test suite documentation
- `SYSTEMATIC_E2E_EXECUTION_PLAN.md` - Testing methodology
- `tests/e2e/README.md` - E2E test execution guide
- `PRODUCTION_READINESS_AUDIT_REPORT.md` - Security audit report

---

## 🚀 Next Steps After Deployment

1. ✅ Verify deployment successful
2. ✅ Login to web UI
3. ✅ Configure jumphost
4. ✅ Run automation on 10 devices
5. ✅ Validate results
6. ✅ Run E2E test suite (if available on remote server)
7. ✅ Generate production readiness report
8. ✅ Document any issues encountered
9. ✅ Create deployment certification

---

**Deployment Script:** `deploy_remote_test.sh`  
**Management Script:** `/home/cisco/OSPF-LL-DEVICE_MANAGER/manage.sh`  
**Log File:** `deployment_YYYYMMDD_HHMMSS.log`

---

**Ready to Deploy!** 🚀
