# NetMan OSPF Device Manager - Installation Guide

**For Ubuntu 24.04 LTS**

Version: 2.0
Last Updated: November 2025
Repository: https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Requirements](#2-system-requirements)
3. [Quick Start (Automated)](#3-quick-start-automated)
4. [Manual Installation](#4-manual-installation)
5. [Configuration](#5-configuration)
6. [Running the Application](#6-running-the-application)
7. [Management Commands](#7-management-commands)
8. [Security Features](#8-security-features)
9. [SSH Jumphost Configuration](#9-ssh-jumphost-configuration)
10. [Firewall Configuration](#10-firewall-configuration)
11. [Troubleshooting](#11-troubleshooting)
12. [Updating the Application](#12-updating-the-application)

---

## 1. Overview

NetMan OSPF Device Manager is a web-based network automation platform for:

- Managing Cisco network devices (IOS, IOS-XR, NX-OS)
- Collecting OSPF routing data
- Visualizing network topology
- Analyzing traffic patterns
- Interface cost management
- Multi-device automation with WebSocket real-time updates

### Architecture

| Component | Technology | Port |
|-----------|------------|------|
| Frontend | React 19 + TypeScript + Vite | 9050 |
| Backend | FastAPI + Python | 9051 |
| Database | SQLite | - |
| Real-time | WebSocket | 9051 |

---

## 2. System Requirements

### Minimum Hardware

- CPU: 2 cores
- RAM: 4 GB
- Disk: 10 GB free space

### Software Requirements

- Ubuntu 24.04 LTS (64-bit)
- Python 3.10 or higher
- Node.js 18 or higher
- npm 9 or higher
- Git

### Network Requirements

- Internet access (for package installation)
- Access to network devices via SSH/Telnet
- Ports 9050 and 9051 available

---

## 3. Quick Start (Automated)

### Option A: One-Command Installation

```bash
# Clone the repository
git clone https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER.git
cd OSPF2-LL-DEVICE_MANAGER

# Make scripts executable
chmod +x *.sh netman.py

# Run automated installation (installs dependencies if --with-deps flag used)
./install.sh

# Start the application
./start.sh
```

### Option B: With System Dependencies

If Node.js/Python are not installed:

```bash
# This will install Node.js 20.x and Python3 on Ubuntu/Debian
./install.sh --with-deps
```

### Verify Installation

```bash
# Check system requirements
python3 netman.py check

# Check status
python3 netman.py status
```

### Access the Application

- **Frontend**: http://localhost:9050
- **Backend API**: http://localhost:9051
- **Default Login**: admin / admin123

---

## 4. Manual Installation

### Step 4.1: Install System Dependencies (Ubuntu 24.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and required packages
sudo apt-get install -y python3 python3-pip python3-venv git curl

# Verify installations
node --version    # Should show v18+
npm --version     # Should show 9+
python3 --version # Should show Python 3.10+
```

### Step 4.2: Clone Repository

```bash
cd /opt
sudo git clone https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER.git
sudo chown -R $USER:$USER /opt/OSPF2-LL-DEVICE_MANAGER
cd /opt/OSPF2-LL-DEVICE_MANAGER
```

### Step 4.3: Setup Python Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

### Step 4.4: Install Node.js Dependencies

```bash
npm install
```

### Step 4.5: Create Required Directories

```bash
mkdir -p logs backend/data/executions
```

---

## 5. Configuration

### Default Configuration

The installation creates `backend/.env.local` with these defaults:

```env
# Security Settings
SECURITY_ENABLED=true
APP_USERNAME=admin
APP_PASSWORD=admin123
APP_LOGIN_MAX_USES=10
APP_SESSION_TIMEOUT=3600
APP_SECRET_KEY=change-this-to-a-random-secret-key

# Access Control
LOCALHOST_ONLY=true
ALLOWED_HOSTS=127.0.0.1,localhost

# Jumphost Configuration (optional)
JUMPHOST_ENABLED=false
JUMPHOST_IP=
JUMPHOST_USERNAME=
JUMPHOST_PASSWORD=
```

### Modify Configuration

```bash
# Edit environment file
nano backend/.env.local

# Or use the web UI Settings page after login
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
# Start services
python3 netman.py start

# Stop services
python3 netman.py stop

# Restart services
python3 netman.py restart

# Check status
python3 netman.py status

# View logs
python3 netman.py logs
python3 netman.py logs --backend
python3 netman.py logs --frontend
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

## 7. Management Commands

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
# Reset device database only
./reset.sh --db

# Reset authentication (login count, sessions)
./reset.sh --auth

# Reset users database (recreates admin)
./reset.sh --users

# Full factory reset
./reset.sh --all
```

---

## 8. Security Features

### Authentication

- Session-based authentication with configurable timeout
- Password hashing with SHA-256 + salt
- Login attempt limiting (configurable max uses)
- Password expiry after N logins

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, devices, automation, settings |
| **Operator** | Can manage devices, run automation, view settings |
| **Viewer** | Read-only access to view data |

### Reset Password/Login Count

```bash
# Reset authentication state (clears login count)
./reset.sh --auth

# Or delete session file manually
rm backend/auth_session.json
./restart.sh
```

---

## 9. SSH Jumphost Configuration

### Overview

The application supports SSH jump host (bastion) for connecting to network devices that are not directly accessible.

```
[NetMan App] --SSH--> [Jumphost] --SSH Tunnel--> [Network Devices]
```

### Configure via Web UI

1. Go to **Automation** page
2. Expand **SSH Jumphost Configuration** panel
3. Enable jumphost toggle
4. Enter host IP, port, username, password
5. Click **Test Connection** to verify
6. Click **Save Configuration**

### Configure via Config File

Edit `backend/jumphost_config.json`:

```json
{
  "enabled": true,
  "host": "172.16.39.173",
  "port": 22,
  "username": "jumpuser",
  "password": "jumppass"
}
```

---

## 10. Firewall Configuration

### Using UFW (Ubuntu)

```bash
# Allow application ports
sudo ufw allow 9050/tcp comment 'NetMan Frontend'
sudo ufw allow 9051/tcp comment 'NetMan Backend API'

# Allow SSH (if needed)
sudo ufw allow 22/tcp comment 'SSH'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

### Using iptables

```bash
sudo iptables -A INPUT -p tcp --dport 9050 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 9051 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

---

## 11. Troubleshooting

### Port Already in Use

```bash
# Check what's using the ports
lsof -i:9050
lsof -i:9051

# Kill processes on ports
lsof -ti:9050 | xargs kill -9
lsof -ti:9051 | xargs kill -9
```

### Password Expired

```bash
# Reset login count
./reset.sh --auth
./restart.sh
```

### Backend Won't Start

```bash
# Check backend log
tail -f logs/backend.log

# Verify Python venv
source backend/venv/bin/activate
python3 -c "import fastapi; print('OK')"
```

### Frontend Won't Start

```bash
# Check frontend log
tail -f logs/frontend.log

# Reinstall node modules
rm -rf node_modules
npm install
```

### SSH Connection to Devices Fails

1. Check device credentials in Device Manager
2. Verify network connectivity: `ping <device-ip>`
3. Test SSH manually: `ssh user@device-ip`
4. Check if jumphost is needed and configured

### Full System Check

```bash
python3 netman.py check
```

---

## 12. Updating the Application

### Using Git

```bash
# Stop services
./stop.sh

# Pull latest changes
git pull origin main

# Update dependencies
source backend/venv/bin/activate
pip install -r backend/requirements.txt
npm install

# Start services
./start.sh
```

### Fresh Installation

```bash
# Backup data
cp -r backend/*.db /tmp/netman-backup/

# Remove and re-clone
cd ..
rm -rf OSPF2-LL-DEVICE_MANAGER
git clone https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER.git
cd OSPF2-LL-DEVICE_MANAGER

# Install
./install.sh

# Restore data
cp /tmp/netman-backup/*.db backend/

# Start
./start.sh
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Install | `./install.sh` |
| Start | `./start.sh` |
| Stop | `./stop.sh` |
| Restart | `./restart.sh` |
| Status | `python3 netman.py status` |
| Check System | `python3 netman.py check` |
| Reset Auth | `./reset.sh --auth` |
| Reset All | `./reset.sh --all` |
| View Logs | `python3 netman.py logs` |

---

## Support

- **Repository**: https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER
- **Issues**: https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER/issues

---

*Built with Claude Code*
