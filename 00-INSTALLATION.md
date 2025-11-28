# NetMan OSPF Device Manager - Installation Guide

**For Ubuntu 24.04 LTS**

Version: 3.0
Last Updated: November 2025
Repository: https://github.com/zumanm1/OSPF-LL-DEVICE_MANAGER

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Requirements](#2-system-requirements)
3. [Quick Start (Automated)](#3-quick-start-automated)
4. [Manual Installation](#4-manual-installation)
5. [Configuration](#5-configuration)
6. [Running the Application](#6-running-the-application)
7. [Validation & Testing](#7-validation--testing)
8. [Management Commands](#8-management-commands)
9. [Security Features](#9-security-features)
10. [SSH Jumphost Configuration](#10-ssh-jumphost-configuration)
11. [Troubleshooting](#11-troubleshooting)
12. [Updating the Application](#12-updating-the-application)

---

## 1. Overview

NetMan OSPF Device Manager is a web-based network automation platform for:

- Managing Cisco network devices (IOS, IOS-XR, NX-OS)
- Collecting OSPF routing data via SSH/Telnet
- Visualizing network topology with dynamic country colors
- Analyzing traffic patterns and interface costs
- Multi-device automation with WebSocket real-time updates
- SSH Jumphost/Bastion support for isolated networks

### Architecture

| Component | Technology | Port |
|-----------|------------|------|
| Frontend | React 19 + TypeScript + Vite | 9050 |
| Backend | FastAPI + Python 3.12 | 9051 |
| Database | SQLite (4 databases) | - |
| Real-time | WebSocket | 9051 |
| SSH | Netmiko + Paramiko | 22 |

### Data Flow

```
Device Manager → Automation → Data Save → Transformation → Interface Costs → OSPF Designer
   (CRUD)      (SSH/Telnet)  (TEXT/JSON)   (Topology)      (Cost Analysis)   (Impact)
```

---

## 2. System Requirements

### Minimum Hardware

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 10 GB free | 20 GB free |

### Software Requirements

- Ubuntu 24.04 LTS (64-bit) or compatible Linux
- Python 3.10+ (3.12 recommended)
- Node.js 18+ (20.x recommended)
- npm 9+
- Git (optional, for updates)

### Network Requirements

- Internet access (for package installation)
- SSH access to network devices (port 22)
- Ports 9050 and 9051 available on host
- Optional: SSH Jumphost for isolated networks

---

## 3. Quick Start (Automated)

### Option A: Fresh Install with Dependencies

```bash
# Clone the repository
git clone https://github.com/zumanm1/OSPF-LL-DEVICE_MANAGER.git
cd OSPF-LL-DEVICE_MANAGER

# Make scripts executable
chmod +x *.sh netman.py

# Install everything (Node.js, Python, dependencies)
./install.sh --with-deps

# Start the application
./start.sh
```

### Option B: Install Only App Dependencies

If Node.js and Python are already installed:

```bash
git clone https://github.com/zumanm1/OSPF-LL-DEVICE_MANAGER.git
cd OSPF-LL-DEVICE_MANAGER
chmod +x *.sh netman.py
./install.sh
./start.sh
```

### Option C: Force Reinstall Everything

```bash
./install.sh --with-deps --force
```

### The 8-Step Installation Process

The `./install.sh` script automatically performs:

| Step | Description | Details |
|------|-------------|---------|
| 1/8 | System Dependencies | Checks/installs Node.js, Python (with `--with-deps`) |
| 2/8 | Verify Required Tools | Validates Node.js, npm, Python3, Git can execute |
| 3/8 | Frontend Dependencies | Runs `npm install` for React packages |
| 4/8 | **Auto-install uv** | Installs fast Python package manager (10-100x faster) |
| 5/8 | Python Virtual Environment | Creates `backend/venv` using uv or venv |
| 6/8 | Python Dependencies | Installs FastAPI, Netmiko, etc. via uv/pip |
| 7/8 | Configuration Files | Creates `.env.local`, logs dir, data dirs |
| 8/8 | Validation | Verifies all components are working |

### Post-Installation Validation

```bash
# Check system requirements
python3 netman.py check

# Check service status
python3 netman.py status

# Test backend API
curl http://localhost:9051/api/health
```

### Access the Application

| Component | URL | Credentials |
|-----------|-----|-------------|
| Frontend | http://localhost:9050 | admin / admin123 |
| Backend API | http://localhost:9051/api | - |
| API Docs | http://localhost:9051/docs | - |

---

## 4. Manual Installation

### Step 4.1: Install System Dependencies (Ubuntu 24.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (official NodeSource repo)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and required packages
sudo apt-get install -y python3 python3-pip python3-venv git curl

# Verify installations
node --version    # Should show v20.x
npm --version     # Should show 10.x
python3 --version # Should show Python 3.12.x
```

### Step 4.2: Clone Repository

```bash
cd ~
git clone https://github.com/zumanm1/OSPF-LL-DEVICE_MANAGER.git
cd OSPF-LL-DEVICE_MANAGER
chmod +x *.sh netman.py
```

### Step 4.3: Install uv (Fast Python Package Manager)

```bash
# Install uv (10-100x faster than pip)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Verify
uv --version
```

### Step 4.4: Setup Python Virtual Environment

```bash
cd backend

# Using uv (recommended)
uv venv venv
source venv/bin/activate
uv pip install -r requirements.txt

# OR using pip (traditional)
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

cd ..
```

### Step 4.5: Install Node.js Dependencies

```bash
npm install
```

### Step 4.6: Create Configuration

```bash
# Create required directories
mkdir -p logs backend/data/executions backend/data/TEXT backend/data/JSON

# Create environment config
cat > backend/.env.local << 'EOF'
SECURITY_ENABLED=true
APP_USERNAME=admin
APP_PASSWORD=admin123
APP_LOGIN_MAX_USES=10
APP_SESSION_TIMEOUT=3600
LOCALHOST_ONLY=true
EOF
```

---

## 5. Configuration

### Environment Variables (`backend/.env.local`)

```env
# Security Settings
SECURITY_ENABLED=true              # Enable authentication
APP_USERNAME=admin                 # Default username
APP_PASSWORD=admin123              # Default password (change in production!)
APP_LOGIN_MAX_USES=10              # Password expires after N logins
APP_SESSION_TIMEOUT=3600           # Session timeout in seconds
APP_SECRET_KEY=your-secret-key     # JWT secret key

# Access Control
LOCALHOST_ONLY=true                # Restrict to localhost only
ALLOWED_HOSTS=127.0.0.1,localhost  # Allowed hosts list

# SSH Jumphost (Optional)
JUMPHOST_ENABLED=false
JUMPHOST_IP=
JUMPHOST_PORT=22
JUMPHOST_USERNAME=
JUMPHOST_PASSWORD=
```

### Jumphost Configuration (`backend/jumphost_config.json`)

```json
{
  "enabled": true,
  "host": "172.16.39.173",
  "port": 22,
  "username": "vmuser",
  "password": "your-password"
}
```

---

## 6. Running the Application

### Using Shell Scripts (Recommended)

```bash
# Start both frontend and backend
./start.sh

# Stop all services
./stop.sh

# Restart all services
./restart.sh
```

### Using Python Manager

```bash
python3 netman.py start      # Start services
python3 netman.py stop       # Stop services
python3 netman.py restart    # Restart services
python3 netman.py status     # Check status
python3 netman.py logs       # View all logs
python3 netman.py logs --backend   # Backend logs only
python3 netman.py logs --frontend  # Frontend logs only
```

### Manual Start (Development)

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python3 server.py
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

---

## 7. Validation & Testing

### Quick Health Check

```bash
# Check all system requirements
python3 netman.py check

# Check service status
python3 netman.py status

# Test API endpoints
curl -s http://localhost:9051/api/health | jq
curl -s http://localhost:9051/api/devices | jq
```

### Database Validation

```bash
# Check all databases exist
ls -la backend/*.db

# Expected databases:
# - devices.db     (device inventory)
# - automation.db  (job history)
# - topology.db    (network topology)
# - datasave.db    (file operations)
```

### Frontend Validation

```bash
# Check if frontend is serving
curl -s http://localhost:9050 | head -20

# Check for React app
curl -s http://localhost:9050 | grep -o "root"
```

### Full E2E Test (Puppeteer)

```bash
# Run comprehensive E2E tests
node comprehensive-e2e-test.mjs

# View test screenshots
ls -la e2e-test-screenshots/
```

---

## 8. Management Commands

### netman.py Commands

| Command | Description |
|---------|-------------|
| `python3 netman.py check` | Verify system requirements |
| `python3 netman.py install` | Run installation |
| `python3 netman.py start` | Start services |
| `python3 netman.py stop` | Stop services |
| `python3 netman.py restart` | Restart services |
| `python3 netman.py status` | Show service status |
| `python3 netman.py logs` | View logs |
| `python3 netman.py reset` | Reset databases |

### reset.sh Options

```bash
./reset.sh --db      # Reset device database only
./reset.sh --auth    # Reset authentication (login count, sessions)
./reset.sh --users   # Reset users database (recreates admin)
./reset.sh --all     # Full factory reset
```

---

## 9. Security Features

### Authentication

- Session-based authentication with configurable timeout
- Password hashing with SHA-256 + salt
- Login attempt limiting (password expires after N logins)
- Pre-flight jumphost validation before enabling

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: users, devices, automation, settings |
| **Operator** | Devices, automation, view settings |
| **Viewer** | Read-only access |

### Security Fixes (v3.0)

- Removed hardcoded default credentials
- Added pre-flight SSH validation for jumphost
- UI state sync for accurate status display
- Input validation for all configuration fields

### Reset Password

```bash
# Method 1: Reset auth state
./reset.sh --auth
./restart.sh

# Method 2: Delete session file
rm backend/auth_session.json
./restart.sh

# Method 3: Python script
python3 reset_password.py
```

---

## 10. SSH Jumphost Configuration

### Overview

Route connections through a bastion host for isolated networks:

```
[NetMan App] --SSH--> [Jumphost/Bastion] --SSH Tunnel--> [Network Devices]
    9051              172.16.39.173:22                   172.20.x.x:22
```

### Configure via Web UI

1. Navigate to **Automation** page
2. Expand **SSH Jumphost / Bastion** panel
3. Toggle **Enable Jumphost**
4. Enter: Host IP, Port, Username, Password
5. Click **Save Configuration** (auto-validates connection)
6. Badge shows "ENABLED" only after successful save

### Configure via File

Edit `backend/jumphost_config.json`:

```json
{
  "enabled": true,
  "host": "172.16.39.173",
  "port": 22,
  "username": "vmuser",
  "password": "your-secure-password"
}
```

### Pre-flight Validation

When enabling jumphost via UI:
1. System tests SSH connection to jumphost BEFORE saving
2. If connection fails, config is NOT saved
3. Clear error message shows what failed
4. "ENABLED" badge only appears after successful save

---

## 11. Troubleshooting

### Node.js Exec Format Error

```bash
# Symptom: "cannot execute binary file: exec format error"
# Cause: Wrong architecture Node.js binary

# Fix:
sudo apt-get remove -y nodejs npm
sudo rm -rf /usr/bin/node /usr/bin/npm /usr/lib/node_modules
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or use installer:
./install.sh --with-deps --force
```

### Port Already in Use

```bash
# Check what's using ports
lsof -i:9050
lsof -i:9051

# Kill processes
lsof -ti:9050 | xargs kill -9
lsof -ti:9051 | xargs kill -9

# Or use stop script
./stop.sh
```

### Password Expired

```bash
# Reset login count
./reset.sh --auth
./restart.sh

# Or run Python script
python3 reset_password.py
```

### Backend Won't Start

```bash
# Check logs
tail -f logs/backend.log

# Verify Python venv
source backend/venv/bin/activate
python3 -c "import fastapi, uvicorn, netmiko; print('OK')"

# Check port
lsof -i:9051
```

### Frontend Won't Start

```bash
# Check logs
tail -f logs/frontend.log

# Reinstall node modules
rm -rf node_modules package-lock.json
npm install
```

### SSH Connection Fails

1. Verify device credentials in Device Manager
2. Test connectivity: `ping <device-ip>`
3. Test SSH manually: `ssh user@device-ip`
4. Check jumphost config if needed
5. View backend logs: `tail -f logs/backend.log`

### Full System Check

```bash
python3 netman.py check
```

---

## 12. Updating the Application

### Using Git

```bash
./stop.sh
git stash
git pull origin main
git stash pop
source backend/venv/bin/activate
uv pip install -r backend/requirements.txt  # or pip install
npm install
./start.sh
```

### Fresh Installation

```bash
# Backup data
cp -r backend/*.db /tmp/netman-backup/

# Remove and re-clone
cd ..
rm -rf OSPF-LL-DEVICE_MANAGER
git clone https://github.com/zumanm1/OSPF-LL-DEVICE_MANAGER.git
cd OSPF-LL-DEVICE_MANAGER
./install.sh

# Restore data
cp /tmp/netman-backup/*.db backend/
./start.sh
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Install (fresh) | `./install.sh --with-deps` |
| Install (app only) | `./install.sh` |
| Start | `./start.sh` |
| Stop | `./stop.sh` |
| Restart | `./restart.sh` |
| Status | `python3 netman.py status` |
| Check System | `python3 netman.py check` |
| Reset Auth | `./reset.sh --auth` |
| Reset All | `./reset.sh --all` |
| View Logs | `python3 netman.py logs` |
| E2E Test | `node comprehensive-e2e-test.mjs` |

---

## Appendix A: Verified Clean Installation (7-Phase Deployment)

This appendix documents a verified clean installation from scratch on Ubuntu 24.04.

### Phase Overview

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Remove old repository | Verified |
| 2 | Remove npm | Verified |
| 3 | Remove Node.js | Verified |
| 4 | Install Python 3.12 | Verified |
| 5 | Install uv package manager | Verified |
| 6 | Run install.sh | Verified |
| 7 | Validate all components | Verified |

### Phase 1: Remove Old Repository

```bash
# Connect to remote server
ssh vmuser@172.16.39.173

# Remove old installation
cd ~
rm -rf OSPF-LL-DEVICE_MANAGER
rm -rf OSPF2-LL-DEVICE_MANAGER

# Verify removal
ls -la | grep -i ospf  # Should show nothing
```

### Phase 2: Remove npm

```bash
sudo rm -rf /usr/local/lib/node_modules/npm
sudo rm -rf ~/.npm
sudo rm -f /usr/local/bin/npm /usr/bin/npm

# Verify
which npm  # Should return nothing
```

### Phase 3: Remove Node.js

```bash
sudo apt-get purge -y nodejs
sudo rm -rf /usr/local/lib/node* /usr/local/include/node*
sudo rm -rf /usr/local/bin/node /usr/bin/node
sudo rm -rf ~/.nvm ~/.node*

# Verify
which node  # Should return nothing
```

### Phase 4: Install Python 3.12

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv python3-full

# Verify
python3 --version  # Should show Python 3.12.x
pip3 --version     # Should show pip 24.x
```

### Phase 5: Install uv Package Manager

```bash
# Install uv (10-100x faster than pip)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

# Verify
uv --version  # Should show uv 0.9.x
```

### Phase 6: Run install.sh

```bash
# Clone repository
cd ~
git clone https://github.com/zumanm1/OSPF-LL-DEVICE_MANAGER.git
cd OSPF-LL-DEVICE_MANAGER
chmod +x *.sh netman.py

# Run automated installation with dependencies
./install.sh --with-deps

# Expected output:
# [1/8] ✓ Node.js installed
# [2/8] ✓ All tools verified
# [3/8] ✓ npm packages installed (137 packages)
# [4/8] ✓ uv already installed
# [5/8] ✓ Virtual environment created
# [6/8] ✓ Python packages installed
# [7/8] ✓ Configuration files created
# [8/8] ✓ Validation passed
```

### Phase 7: Validate All Components

```bash
# Start the application
./start.sh

# Wait for services (15 seconds)
sleep 15

# Check status
python3 netman.py status
# Expected: Backend RUNNING, Frontend RUNNING

# Validate API
curl -s http://localhost:9051/api/health
# Expected: {"status":"OK","database":"connected"}

# Validate Frontend
curl -s -o /dev/null -w '%{http_code}' http://localhost:9050
# Expected: 200

# Validate Databases
ls -la backend/*.db
# Expected: devices.db, automation.db, topology.db, datasave.db, users.db

# Check logs
tail -20 logs/backend.log
# Expected: No errors, API ready messages
```

### Validation Checklist

| Component | Check Command | Expected Result |
|-----------|---------------|-----------------|
| Node.js | `node --version` | v20.19.x |
| npm | `npm --version` | 10.8.x |
| Python | `python3 --version` | Python 3.12.x |
| uv | `uv --version` | uv 0.9.x |
| Backend | `curl localhost:9051/api/health` | `{"status":"OK"}` |
| Frontend | `curl -o /dev/null -w '%{http_code}' localhost:9050` | 200 |
| Databases | `ls backend/*.db` | 5 database files |

### Deployment Time

| Phase | Duration |
|-------|----------|
| Phase 1-3 (Cleanup) | ~2 minutes |
| Phase 4 (Python) | ~1 minute |
| Phase 5 (uv) | ~30 seconds |
| Phase 6 (Install) | ~3 minutes |
| Phase 7 (Validation) | ~1 minute |
| **Total** | **~8 minutes** |

---

## Support

- **Repository**: https://github.com/zumanm1/OSPF-LL-DEVICE_MANAGER
- **Issues**: https://github.com/zumanm1/OSPF-LL-DEVICE_MANAGER/issues

---

*Built with Claude Code - Version 3.0*
*Verified Deployment: November 28, 2025*
