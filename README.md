# 🌐 NetMan OSPF Device Manager

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

### 2. Using Bash Scripts (Recommended)

```bash
# One-liner to install and start
./install.sh --with-deps && ./start.sh

# Or step by step:
./install.sh --with-deps   # Install Node.js, Python, and all dependencies
./install.sh               # Install app dependencies only (if system deps exist)
./start.sh                 # Start servers (frontend: 9050, API: 9051)

# For a fresh/clean installation (recommended for new servers):
./install.sh --clean       # Full 7-phase clean install (removes old, installs fresh)
```

### 3. Using Python Manager (Alternative)

```bash
# Install and start with Python
python3 netman.py install    # Install all dependencies
python3 netman.py start      # Start frontend (9050) and API (9051) servers

# Check system requirements first
python3 netman.py check      # Verify all dependencies are installed
```

### 4. Manual Installation

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
python3 -m venv venv
source venv/bin/activate     # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Start backend (Terminal 1)
cd backend && source venv/bin/activate
python3 server.py

# Start frontend (Terminal 2)
npm run dev

# Access the application
# Frontend: http://localhost:9050
# Backend API: http://localhost:9051/docs
# Login: netviz_admin / V3ry$trongAdm1n!2025
```

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `./install.sh` | Install app dependencies (npm + Python packages) |
| `./install.sh --with-deps` | Install system requirements (Node.js, Python) + app deps |
| `./install.sh --clean` | Full 7-phase clean installation (removes old, installs fresh) |
| `./install.sh --force` | Force reinstall all components |
| `./start.sh` | Start frontend (9050) and backend (9051) servers |
| `./start.sh --force` | Force restart without prompts (for automation) |
| `./stop.sh` | Stop all running servers |
| `./restart.sh` | Restart all servers |
| `./reset.sh --auth` | Reset authentication state (login count, sessions) |
| `./reset.sh --db` | Reset device database |
| `./reset.sh --users` | Reset users database (recreates admin) |
| `./reset.sh --all` | Full factory reset |

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
python3 netman.py reset      # Reset database/auth
```

### Script Options

```bash
# Start on force mode (no prompts)
./start.sh --force

# Clean install (7-phase automated process)
./install.sh --clean

# Reset only authentication (when password expired)
./reset.sh --auth

# View Python manager help
python3 netman.py --help
```

---

## 📋 Overview

NetMan OSPF Device Manager is a full-stack web application designed for managing and automating network devices (routers, switches) with support for:

- **Jumphost/Bastion Connectivity** - Connect to devices behind firewalls
- **Real-time Job Tracking** - WebSocket-based live progress updates
- **Enterprise-grade Security** - Encrypted credentials, rate limiting, CORS protection
- **OSPF Topology Visualization** - Design and analyze OSPF networks
- **Impact Analysis** - Predict network changes before implementation

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔐 **Secure Device Management** | Encrypted credential storage with PBKDF2 hashing |
| 🚀 **Automated Command Execution** | Batch automation on multiple devices |
| 🌉 **Jumphost Support** | Connect to devices behind bastion hosts |
| 📊 **Real-time Job Tracking** | WebSocket-based live progress updates |
| 🎨 **Modern UI** | React 19 with TypeScript and Tailwind CSS |
| ⚡ **Fast API** | Python FastAPI backend with async support |
| 🔒 **Rate Limiting** | API protection against abuse |
| 📝 **Comprehensive Logging** | Audit trail for all operations |
| 🧪 **E2E Testing** | Production-ready test suite with Puppeteer |
| 📦 **Multiple Deployment Options** | Automated, phase-by-phase, or manual |

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for blazing-fast development
- Tailwind CSS for styling
- Lucide React for icons
- React Router for navigation
- WebSocket for real-time updates

**Backend:**
- FastAPI (Python 3.8+)
- SQLite database
- Netmiko for device automation
- Uvicorn ASGI server
- Cryptography for encryption
- SlowAPI for rate limiting

**Security:**
- PBKDF2 password hashing (100,000 iterations)
- Fernet credential encryption (AES-128-CBC)
- Rate limiting on all endpoints
- CORS configuration
- Input validation
- Audit logging

---

## 📁 Project Structure

```
OSPF2-LL-DEVICE_MANAGER/
├── backend/                    # FastAPI backend
│   ├── server.py              # Main API server
│   ├── modules/               # Backend modules
│   │   ├── auth.py           # Authentication & CORS
│   │   ├── device_encryption.py  # Credential encryption
│   │   ├── security.py       # Security utilities
│   │   └── netmiko_runner.py # Device automation
│   ├── requirements.txt       # Python dependencies
│   ├── devices.db            # SQLite database
│   └── venv/                 # Python virtual environment
│
├── pages/                     # React page components
├── components/                # React UI components
├── hooks/                     # Custom React hooks
│
├── install.sh                # Installation script
├── start.sh                  # Start servers
├── stop.sh                   # Stop servers
├── restart.sh                # Restart servers
├── reset.sh                  # Reset database/auth
├── netman.py                 # Python service manager
│
├── package.json              # Node dependencies
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config
└── README.md                 # This file
```

---

## 🔒 Security

### Authentication
- PBKDF2 password hashing with 100,000 iterations
- Secure session management
- Password change functionality with PIN protection

### Credential Protection
- Fernet encryption (AES-128-CBC) for device passwords
- Encryption keys managed via environment variables
- Automatic password migration script

### API Protection
- Rate limiting on all critical endpoints:
  - Login: 5 requests/minute
  - Password change: 3 requests/hour
  - PIN reset: 3 requests/hour
  - Bulk delete: 10 requests/minute
  - Automation: 30 requests/minute
- CORS configuration with environment-based origins
- Input validation on all endpoints

### Audit Logging
- All operations logged with timestamps
- User action tracking
- Failed login attempt logging
- Device access audit trail

---

## 📊 Default Configuration

### Application Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 9050 | React development server |
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
| 3 | R3 | 172.20.0.13 | cisco_ios |
| 4 | R4 | 172.20.0.14 | cisco_ios |
| 5 | R5 | 172.20.0.15 | cisco_ios |
| 6 | R6 | 172.20.0.16 | cisco_ios |
| 7 | R7 | 172.20.0.17 | cisco_ios |
| 8 | R8 | 172.20.0.18 | cisco_ios |
| 9 | R9 | 172.20.0.19 | cisco_ios |
| 10 | R10 | 172.20.0.20 | cisco_ios |

**Default Device Credentials:** cisco / cisco

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
   - Test with 10 pre-configured devices (172.20.0.11-20)

---

## 🔧 Configuration

### Backend Configuration (.env.local)

```bash
# Security Settings
SECURITY_ENABLED=true
APP_ADMIN_USERNAME=netviz_admin
APP_ADMIN_PASSWORD=V3ry$trongAdm1n!2025
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

### 41 Comprehensive Tests Across:
- Network connectivity (4 tests)
- Backend health & API (6 tests)
- Frontend accessibility (4 tests)
- File system integrity (7 tests)
- Process validation (4 tests)
- Dependencies (4 tests)
- Security & rate limiting (3 tests)
- Data integrity (4 tests)
- Management tools (3 tests)
- End-to-end functional (2 tests)

---

## 🚀 Deployment

### Option 1: Automated Deployment (Recommended)

```bash
# Run the automated deployment script
chmod +x deploy_remote_test.sh
./deploy_remote_test.sh

# Validate deployment
chmod +x deployment_validation.sh
./deployment_validation.sh
```

### Option 2: Clean Installation (New Servers)

```bash
# Full 7-phase automated installation
./install.sh --clean

# Phases:
# 1. Remove old Node.js
# 2. Remove old npm
# 3. Clean Python environment
# 4. Install Python 3.12
# 5. Install uv package manager
# 6. Install Node.js 20.x
# 7. Install application dependencies
```

### Option 3: Manual Deployment

Follow the detailed steps in [DEPLOYMENT_OPTIONS_COMPLETE_GUIDE.md](DEPLOYMENT_OPTIONS_COMPLETE_GUIDE.md).

---

## 📈 Performance

| Metric | Value |
|--------|-------|
| Startup Time | < 5 seconds |
| API Response Time | < 100ms (local) |
| WebSocket Latency | < 50ms |
| Frontend Build Time | < 30 seconds |
| Database Operations | Async with connection pooling |

---

## 📚 Documentation

### Getting Started
- **[Installation Guide](INSTALLATION_GUIDE.md)** - Complete setup instructions
- **[User Manual](USER_MANUAL.md)** - 15,000+ word comprehensive guide
- **[Network Testing Guide](NETWORK_TESTING_GUIDE.md)** - Testing with real devices

### Deployment
- **[Deployment Options Guide](DEPLOYMENT_OPTIONS_COMPLETE_GUIDE.md)** - 3 deployment methods
- **[Remote Deployment Guide](REMOTE_DEPLOYMENT_GUIDE.md)** - VM deployment instructions

### Testing & Security
- **[E2E Test Plan](E2E_TEST_PLAN.md)** - 42 test scenarios
- **[Security Guide](SECURITY_GUIDE.md)** - Security best practices

---

## 🎯 Use Cases

This application is ideal for:

- **Network Engineers** - Automating repetitive tasks
- **DevOps Teams** - Network infrastructure management
- **Service Providers** - Managing customer network devices
- **Enterprises** - Internal network administration
- **Educational Institutions** - Teaching network automation
- **MSPs** - Multi-tenant network management

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

## 🗺️ Roadmap

### Planned Features

- [ ] Multi-user support with role-based access control
- [ ] Device configuration backup and restore
- [ ] Scheduled automation jobs
- [ ] Email notifications
- [ ] Advanced reporting and analytics
- [ ] REST API key authentication
- [ ] Device inventory management
- [ ] Configuration templating
- [ ] Compliance checking
- [ ] Integration with monitoring tools

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| Total Lines of Code | ~15,000+ |
| Backend Endpoints | 20+ |
| Frontend Components | 25+ |
| Test Coverage | 41 E2E tests |
| Documentation | 100,000+ words |
| Deployment Options | 3 |
| Security Features | 10+ |

---

**Built with ❤️ using FastAPI, React, and modern web technologies**

---

**Version:** 1.0.0  
**Last Updated:** December 4, 2025  
**Status:** Production Ready

---

**[⬆ Back to Top](#-netman-ospf-device-manager)**
