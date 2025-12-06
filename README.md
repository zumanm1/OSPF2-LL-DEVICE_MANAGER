# 🌐 NetViz OSPF Device Manager

A comprehensive OSPF (Open Shortest Path First) network device management and automation platform with real-time monitoring, jumphost support, and enterprise-grade security.

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER.git
cd OSPF2-LL-DEVICE_MANAGER
```

### 2. First-Time Setup (Recommended)

```bash
# Option A: Full isolated setup with nvm (recommended)
./netviz.sh setup     # Installs nvm + Node.js v20 (one-time)
./netviz.sh deps      # Install npm + Python dependencies
./netviz.sh start     # Start servers

# Option B: Quick start (if Node.js already installed)
./netviz.sh install && ./netviz.sh deps && ./netviz.sh start
```

### 3. Returning Users

```bash
# Just start - auto-switches to correct Node version if nvm installed
./netviz.sh start
```

### 4. Manual Installation

```bash
# Install frontend dependencies
npm install

# Setup backend environment
cd backend
python3 -m venv venv
source venv/bin/activate     # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Setup environment
cp backend/.env.local.example backend/.env.local
# Edit .env.local with your secure credentials

# Start development servers
npm run dev           # Vite only (port 9050)
# OR for full stack:
./start.sh            # All servers with authentication
```

**Access the app:** http://localhost:9050

**Default credentials:** `netviz_admin` / `V3ry$trongAdm1n!2025`

---

## 📜 Available Scripts

### Setup Commands

| Script | Description |
|--------|-------------|
| `./netviz.sh setup` | **First-time setup**: Install nvm + Node.js v20 (isolated environment) |
| `./netviz.sh install` | Check/install system requirements (Node.js, Python) |
| `./netviz.sh deps` | Check/install project dependencies (skips if already installed) |
| `./setup-nvm.sh` | Standalone nvm + Node.js environment setup script |

### Server Commands

| Script | Description |
|--------|-------------|
| `./netviz.sh start` | Start Frontend (9050) and Backend API (9051) servers |
| `./netviz.sh stop` | Stop all running servers |
| `./netviz.sh restart` | Restart all servers |
| `./netviz.sh status` | Show system and server status |
| `./netviz.sh logs` | View server logs (tail -f) |

### Build Commands

| Script | Description |
|--------|-------------|
| `./netviz.sh clean` | Clean build artifacts and node_modules |
| `./netviz.sh build` | Build for production |
| `./netviz.sh reset` | Reset database/auth |

### Individual Scripts

```bash
./setup-nvm.sh        # Setup nvm + Node.js (interactive)
./install.sh          # Install dependencies only
./deps.sh             # Smart dependency installer
./start.sh            # Start all servers (foreground)
./stop.sh             # Stop all servers
./restart.sh          # Restart servers
./reset.sh            # Reset database/auth
```

### Python Manager Commands

```bash
python3 netman.py check      # Check system requirements
python3 netman.py install    # Install all dependencies
python3 netman.py start      # Start all services
python3 netman.py stop       # Stop all services
python3 netman.py restart    # Restart all services
python3 netman.py status     # Show service status
python3 netman.py logs       # View logs
python3 netman.py logs -f    # Follow logs in real-time
```

### Script Options

```bash
# Start on a custom port
./netviz.sh start -p 3000

# Force reinstall dependencies
./netviz.sh deps --force

# Using environment variable
NETVIZ_PORT=8080 ./netviz.sh start

# Clean install (7-phase automated process)
./install.sh --clean
```

---

## 🔐 Authentication System

NetViz includes enterprise-grade authentication:

- **Session-based authentication** with secure tokens
- **PBKDF2 password hashing** (100,000 iterations)
- **Rate limiting** on auth endpoints
- **Admin panel** for user management
- **Usage tracking** and expiry controls
- **PIN-based password reset** for admin recovery

---

## 🛠️ System Requirements

- **Node.js** v18.0.0 - v24.x (v20 LTS recommended)
- **npm** v9.0.0+ (comes with Node.js)
- **Python** 3.8+ (3.11+ recommended)
- Modern browser (Chrome, Firefox, Safari, Edge)

---

## 🔒 Isolated Node.js Environment

This project uses **isolated Node.js/npm versions** to avoid conflicts with other projects on your machine.

### Quick Setup (Recommended)

```bash
# One command to install nvm + Node.js v20
./netviz.sh setup

# Or use the standalone script
./setup-nvm.sh
```

This will:
1. Install nvm (Node Version Manager) if not present
2. Install Node.js v20 LTS
3. Configure your shell for auto-switching
4. Display next steps

### Version Pinning Files

| File | Purpose | Tool Support |
|------|---------|--------------|
| `.nvmrc` | Pins Node v20 | nvm, fnm |
| `.node-version` | Pins Node v20 | fnm, volta, nodenv |
| `package.json` engines | Enforces Node 18-24, npm 9+ | npm |

### Using nvm (Recommended)

```bash
# Option 1: Use our setup script (easiest)
./netviz.sh setup

# Option 2: Manual nvm installation
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Restart terminal, then:
cd OSPF2-LL-DEVICE_MANAGER
nvm use          # Automatically uses Node v20 from .nvmrc

# Or manually:
nvm install 20
nvm use 20
```

### Using Volta (Alternative)

```bash
# Install Volta
curl https://get.volta.sh | bash

# Pin versions for this project
cd OSPF2-LL-DEVICE_MANAGER
volta pin node@20
volta pin npm@10
```

### Using fnm (Fast Alternative)

```bash
# Install fnm
curl -fsSL https://fnm.vercel.app/install | bash

# Use project version
cd OSPF2-LL-DEVICE_MANAGER
fnm use          # Reads .node-version
```

### Automatic Version Switching

All `./netviz.sh` commands automatically:
1. Detect if nvm is installed
2. Switch to the project's required Node version (v20)
3. Warn if using an incompatible version

```bash
./netviz.sh setup     # Install nvm + Node.js (first-time)
./netviz.sh install   # Shows isolation status and switches Node version
./netviz.sh start     # Auto-loads correct Node version before starting
./netviz.sh deps      # Auto-loads correct Node version before installing
```

### Shell Auto-Switching (Optional)

Add this to your `~/.zshrc` or `~/.bashrc` for automatic version switching when entering the project directory:

```bash
# Auto-switch Node version when entering directory with .nvmrc
autoload -U add-zsh-hook 2>/dev/null
load-nvmrc() {
  if [ -f .nvmrc ]; then
    nvm use 2>/dev/null
  fi
}
add-zsh-hook chpwd load-nvmrc 2>/dev/null
```

---

## 🐍 Isolated Python Environment

The backend uses a **Python virtual environment** for dependency isolation.

### Automatic Setup

```bash
# netviz.sh handles everything automatically
./netviz.sh deps      # Creates venv and installs packages
```

### Manual Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate    # Linux/macOS
venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Or use uv (10-100x faster)
uv pip install -r requirements.txt
```

### Using uv (Fast Package Manager)

The project supports [uv](https://github.com/astral-sh/uv) for faster Python package installation:

```bash
# Install uv (automatic in ./netviz.sh install)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Use with venv
cd backend
uv venv venv
source venv/bin/activate
uv pip install -r requirements.txt
```

---

## 📊 Features

### Device Management
| Feature | Description |
|---------|-------------|
| **Device CRUD** | Add, edit, delete network devices |
| **Bulk Import** | CSV import for multiple devices |
| **Credential Encryption** | AES-128-CBC encrypted passwords |
| **Device Types** | Cisco IOS, IOS-XE, IOS-XR, NX-OS |

### Automation
| Feature | Description |
|---------|-------------|
| **Batch Execution** | Run commands on multiple devices |
| **Real-time Progress** | WebSocket-based live updates |
| **Output Collection** | Automatic TEXT/JSON output saving |
| **Jumphost Support** | Connect through bastion hosts |

### OSPF Analysis
| Feature | Description |
|---------|-------------|
| **Topology Visualization** | Interactive network graph |
| **Impact Analysis** | Predict network changes |
| **Cost Optimization** | OSPF metric recommendations |
| **Path Calculation** | Shortest path analysis |

---

## 🌐 Network Visualization Features

- **OSPF Cost Labels** on network links (toggle with button)
- **Asymmetric cost display** (forward↔reverse format)
- **Color-coded links** (blue=normal, amber=asymmetric, red=down)
- **Interactive D3.js graph** with zoom/pan
- **Path highlighting** with animated dashed lines
- **Country-based filtering** and high-level view

---

## 📤 Export Features

- **Export CSV** button on each modal
- **Export JSON** for topology data
- **NetViz Pro format** for advanced visualization
- **Simulation export** for What-If scenarios

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript |
| Visualization | D3.js v7 |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend | FastAPI (Python) |
| Database | SQLite |
| Device Automation | Netmiko |
| Security | PBKDF2 + Fernet |

---

## 📁 Project Structure

```
OSPF2-LL-DEVICE_MANAGER/
├── netviz.sh               # Master control script
├── setup-nvm.sh            # NVM + Node.js setup script
├── install.sh              # System dependencies installer
├── deps.sh                 # Smart dependency installer
├── start.sh                # Start servers
├── stop.sh                 # Stop servers
├── restart.sh              # Restart servers
├── reset.sh                # Reset database/auth
├── netman.py               # Python service manager
│
├── index.html              # Main HTML entry
├── App.tsx                 # Main React application
├── public/
│   └── favicon.svg         # Network topology favicon
│
├── pages/                  # React page components
│   ├── Login.tsx           # Authentication UI
│   ├── DeviceManager.tsx   # Device management
│   ├── Automation.tsx      # Batch automation
│   ├── DataSave.tsx        # Output management
│   ├── Transformation.tsx  # Topology transformation
│   └── OSPFDesigner.tsx    # OSPF analysis & design
│
├── components/             # React UI components
├── hooks/                  # Custom React hooks
│
├── backend/                # FastAPI backend
│   ├── server.py           # Main API server
│   ├── requirements.txt    # Python dependencies
│   ├── venv/               # Python virtual environment
│   ├── modules/            # Backend modules
│   │   ├── auth.py         # Authentication
│   │   ├── command_executor.py
│   │   ├── topology_builder.py
│   │   ├── ospf_analyzer.py
│   │   └── ...
│   └── data/               # Data storage
│       ├── devices.db      # Device database
│       ├── users.db        # User database
│       └── executions/     # Automation outputs
│
├── .nvmrc                  # Node version (nvm)
├── .node-version           # Node version (fnm/volta)
├── package.json            # Node dependencies
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript config
└── README.md               # This file
```

---

## 📋 Default Configuration

### Application Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 9050 | Vite development server |
| Backend API | 9051 | FastAPI server |

### Default Login Credentials

```
Username: netviz_admin
Password: V3ry$trongAdm1n!2025
```

### Pre-configured Test Devices

The application comes with 10 pre-configured Cisco routers for testing:

| Device | Hostname | IP Address | Type |
|--------|----------|------------|------|
| 1 | R1 | 172.20.0.11 | cisco_ios |
| 2 | R2 | 172.20.0.12 | cisco_ios |
| ... | ... | ... | ... |
| 10 | R10 | 172.20.0.20 | cisco_ios |

**Default Device Credentials:** cisco / cisco

---

## 🔒 Network & IP Configuration

Configure in `backend/.env.local`:

```bash
# Server Binding - Controls which interface the server listens on
# Options: 127.0.0.1 (localhost only), 0.0.0.0 (all interfaces), or specific IP
SERVER_HOST=0.0.0.0

# IP Whitelist - Comma-separated list of allowed client IPs
# Use 0.0.0.0 to allow all IPs (not recommended for production)
# Examples: 127.0.0.1,192.168.1.0/24,10.0.0.5
ALLOWED_IPS=0.0.0.0

# Localhost Only Mode (overrides SERVER_HOST if true)
LOCALHOST_ONLY=false
```

| Setting | Description |
|---------|-------------|
| `SERVER_HOST=0.0.0.0` | Listen on all network interfaces |
| `SERVER_HOST=127.0.0.1` | Listen only on localhost |
| `ALLOWED_IPS=0.0.0.0` | Allow connections from any IP |
| `ALLOWED_IPS=192.168.1.0/24` | Allow only local subnet |
| `LOCALHOST_ONLY=true` | Override to localhost only |

---

## 🌉 Jumphost Configuration

To connect to devices behind a bastion host:

1. **Access Settings:**
   - Navigate to Settings → Jumphost Configuration

2. **Configure Jumphost:**
   - Enable jumphost
   - Hostname: `172.16.39.173`
   - Port: `22`
   - Username: `cisco`
   - Password: `cisco`

3. **Test Connection:**
   - Click "Test Connection"
   - Verify success message

4. **Run Automation:**
   - All device connections will now route through jumphost

---

## 🚀 Running in Production

```bash
# Build for production
./netviz.sh build

# Or manually:
npm run build

# Preview production build
npm run preview

# Serve with any static server
npx serve dist
```

---

## 🌍 Running on Remote Server

```bash
# Start servers (binds to 0.0.0.0)
./netviz.sh start

# Access from any machine on the network:
# http://<server-ip>:9050
```

---

## 🔧 Troubleshooting

### Port already in use
```bash
./netviz.sh stop
# Or manually:
lsof -ti:9050 | xargs kill -9
lsof -ti:9051 | xargs kill -9
```

### npm install fails
```bash
./netviz.sh clean
./netviz.sh deps --force
```

### Check server status
```bash
./netviz.sh status
```

### View logs
```bash
./netviz.sh logs
```

### App shows blank screen
- Check browser console for errors
- Ensure backend is running: `curl http://localhost:9051/api/health`
- Verify `.env.local` exists and is configured

### Python venv issues
```bash
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 🧪 Testing

### E2E Testing (Puppeteer)

```bash
# Run validation tests
node validate-app.mjs

# Run comprehensive E2E tests
node comprehensive-e2e-test.mjs

# Test specific features
node test-login-and-ui.mjs
node test-automation-workflow.cjs
```

---

## 📚 Documentation

### Getting Started
- **[Installation Guide](INSTALLATION_GUIDE.md)** - Complete setup instructions
- **[User Manual](USER_MANUAL.md)** - 15,000+ word comprehensive guide

### Deployment
- **[Deployment Options Guide](DEPLOYMENT_OPTIONS_COMPLETE_GUIDE.md)** - 3 deployment methods
- **[Remote Deployment Guide](REMOTE_DEPLOYMENT_GUIDE.md)** - VM deployment instructions

### Testing & Security
- **[E2E Test Plan](E2E_TEST_PLAN.md)** - 42 test scenarios
- **[Security Guide](SECURITY_GUIDE.md)** - Security best practices

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **XILO 2 XTRIX** - Initial work and development

---

## 📞 Support

For issues, questions, or contributions:

- **GitHub Issues:** [Create an issue](https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER/issues)
- **Documentation:** See docs/ directory

---

**Built with ❤️ using FastAPI, React, and modern web technologies**

---

**Version:** 1.0.0  
**Last Updated:** December 6, 2025  
**Status:** Production Ready

---

**[⬆ Back to Top](#-netviz-ospf-device-manager)**
