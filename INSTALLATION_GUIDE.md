# 🚀 OSPF Network Device Manager - Installation Guide

**Complete guide for cloning, installing, and running the application**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clone Repository](#clone-repository)
3. [Install Dependencies](#install-dependencies)
4. [Configure Environment](#configure-environment)
5. [Run the Application](#run-the-application)
6. [Stop the Application](#stop-the-application)
7. [Verify Installation](#verify-installation)
8. [Troubleshooting](#troubleshooting)

---

## 📦 Prerequisites

Before installing, ensure you have the following:

### Required Software

- **Python 3.8+** (Python 3.9 or 3.10 recommended)
  ```bash
  python3 --version
  # Should output: Python 3.8.x or higher
  ```

- **Node.js 18+** (Node 18 or 20 recommended)
  ```bash
  node --version
  # Should output: v18.x.x or higher
  ```

- **npm** (comes with Node.js)
  ```bash
  npm --version
  # Should output: 8.x.x or higher
  ```

- **Git**
  ```bash
  git --version
  # Should output: git version 2.x.x
  ```

### Optional Tools

- **Python venv** (usually included with Python 3)
- **SSH client** (for remote device management)
- **Network access** to target devices (if testing automation)

---

## 📥 Clone Repository

### Option 1: Clone via HTTPS (Recommended)

```bash
# Clone the repository
git clone https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER.git

# Navigate to project directory
cd OSPF2-LL-DEVICE_MANAGER
```

### Option 2: Clone via SSH

```bash
# Clone the repository (requires SSH key setup)
git clone git@github.com:zumanm1/OSPF2-LL-DEVICE_MANAGER.git

# Navigate to project directory
cd OSPF2-LL-DEVICE_MANAGER
```

### Option 3: Clone via GitHub CLI

```bash
# Clone the repository using gh CLI
gh repo clone zumanm1/OSPF2-LL-DEVICE_MANAGER

# Navigate to project directory
cd OSPF2-LL-DEVICE_MANAGER
```

### Verify Clone

```bash
# Check repository structure
ls -la

# You should see:
# - backend/          (FastAPI backend)
# - frontend/         (React frontend)
# - docs/            (Documentation)
# - tests/           (Test suites)
# - *.md files       (Documentation)
```

---

## 🔧 Install Dependencies

### Step 1: Install Backend Dependencies (Python)

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment (recommended)
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip

# Install Python dependencies
pip install -r requirements.txt

# Verify installation
pip list | grep -E "(fastapi|uvicorn|netmiko|cryptography|slowapi)"

# Navigate back to root
cd ..
```

**Expected packages:**
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `netmiko` - Network device automation
- `cryptography` - Password encryption
- `slowapi` - Rate limiting
- `pydantic` - Data validation
- `python-multipart` - Form handling

### Step 2: Install Frontend Dependencies (Node.js)

```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Verify installation
npm list --depth=0 | grep -E "(react|vite|typescript)"

# Navigate back to root
cd ..
```

**Expected packages:**
- `react` ^19.x - UI framework
- `react-dom` ^19.x - React DOM bindings
- `vite` - Build tool
- `typescript` - Type safety
- `tailwindcss` - CSS framework
- `lucide-react` - Icons

---

## ⚙️ Configure Environment

### Step 1: Create Backend Configuration

```bash
# Navigate to backend directory
cd backend

# Create .env file (if not exists)
cat > .env << 'EOF'
# Database Configuration
DATABASE_PATH=./devices.db

# Security Configuration
SECRET_KEY=your-secret-key-here-change-in-production
ENCRYPTION_KEY=your-encryption-key-here-change-in-production

# CORS Configuration (for development)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:9051
ENVIRONMENT=development

# Server Configuration
HOST=0.0.0.0
PORT=9050

# Rate Limiting
RATE_LIMIT_ENABLED=true

# Logging
LOG_LEVEL=INFO
EOF

# Navigate back to root
cd ..
```

### Step 2: Initialize Database

The database will be created automatically on first run, but you can verify:

```bash
# Check if database exists (will be created on first startup)
ls -la backend/*.db

# If it doesn't exist yet, it will be created when you start the backend
```

---

## 🚀 Run the Application

### Method 1: Run Using Terminal (Recommended for Development)

#### Terminal 1 - Start Backend Server

```bash
# Navigate to backend directory
cd backend

# Activate virtual environment (if not already activated)
source venv/bin/activate  # On macOS/Linux
# venv\Scripts\activate   # On Windows

# Start backend server
python3 -m uvicorn server:app --host 0.0.0.0 --port 9050 --reload

# You should see:
# INFO:     Uvicorn running on http://0.0.0.0:9050 (Press CTRL+C to quit)
# INFO:     Started reloader process [xxxxx] using StatReload
# INFO:     Started server process [xxxxx]
# INFO:     Waiting for application startup.
# INFO:     Application startup complete.
```

**Backend will be available at:**
- API: http://localhost:9050
- API Docs: http://localhost:9050/docs
- Health Check: http://localhost:9050/health

#### Terminal 2 - Start Frontend Server

```bash
# Open a NEW terminal window/tab

# Navigate to frontend directory
cd OSPF2-LL-DEVICE_MANAGER/frontend

# Start frontend development server
npm run dev

# You should see:
# VITE v5.x.x  ready in xxx ms
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

**Frontend will be available at:**
- Application: http://localhost:5173

#### Access the Application

```bash
# Open browser automatically
open http://localhost:5173

# Or visit manually:
# http://localhost:5173
```

**Default Login:**
- Username: `admin`
- Password: `admin123`

---

### Method 2: Run Using Screen/tmux (For Server/Remote)

#### Using screen

```bash
# Start backend in screen
screen -S ospf-backend
cd backend
source venv/bin/activate
python3 -m uvicorn server:app --host 0.0.0.0 --port 9050
# Press Ctrl+A then D to detach

# Start frontend in screen
screen -S ospf-frontend
cd frontend
npm run dev -- --host 0.0.0.0 --port 9051
# Press Ctrl+A then D to detach

# List screens
screen -ls

# Reattach to a screen
screen -r ospf-backend  # or ospf-frontend
```

#### Using tmux

```bash
# Create new tmux session
tmux new -s ospf

# Split window horizontally
# Ctrl+B then "

# Top pane - Backend
cd backend
source venv/bin/activate
python3 -m uvicorn server:app --host 0.0.0.0 --port 9050

# Switch to bottom pane (Ctrl+B then arrow down)
cd frontend
npm run dev -- --host 0.0.0.0 --port 9051

# Detach from tmux: Ctrl+B then D
# Reattach: tmux attach -t ospf
```

---

### Method 3: Run Using Scripts (Production-like)

#### Create start script

```bash
# Create start script
cat > start_app.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting OSPF Network Device Manager..."

# Start backend
echo "📡 Starting backend server..."
cd backend
source venv/bin/activate
python3 -m uvicorn server:app --host 0.0.0.0 --port 9050 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server..."
cd frontend
npm run dev -- --host 0.0.0.0 --port 9051 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..

# Save PIDs
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

echo "✅ Application started successfully!"
echo ""
echo "Access the application at:"
echo "  Frontend: http://localhost:9051"
echo "  Backend:  http://localhost:9050"
echo "  API Docs: http://localhost:9050/docs"
echo ""
echo "To stop: ./stop_app.sh"
EOF

chmod +x start_app.sh
```

#### Run the script

```bash
# Create logs directory
mkdir -p logs

# Start application
./start_app.sh
```

---

## 🛑 Stop the Application

### Method 1: Stop Terminal-based Servers

If you started the servers in terminals:

#### Stop Backend (Terminal 1)
```bash
# In the backend terminal, press:
Ctrl + C

# You should see:
# INFO:     Shutting down
# INFO:     Finished server process [xxxxx]
```

#### Stop Frontend (Terminal 2)
```bash
# In the frontend terminal, press:
Ctrl + C

# You should see:
# ➜ Server closed
```

---

### Method 2: Stop Screen Sessions

```bash
# List running screens
screen -ls

# Stop backend screen
screen -S ospf-backend -X quit

# Stop frontend screen
screen -S ospf-frontend -X quit

# Verify stopped
screen -ls
# Should show "No Sockets found"
```

---

### Method 3: Stop tmux Sessions

```bash
# Kill tmux session
tmux kill-session -t ospf

# Or if inside tmux session:
# Type: exit (in each pane)
# Or: Ctrl+B then X (to kill pane)
```

---

### Method 4: Stop Using Script

```bash
# Create stop script
cat > stop_app.sh << 'EOF'
#!/bin/bash

echo "🛑 Stopping OSPF Network Device Manager..."

# Stop backend
if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    echo "Stopping backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || echo "Backend already stopped"
    rm .backend.pid
fi

# Stop frontend
if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    echo "Stopping frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || echo "Frontend already stopped"
    rm .frontend.pid
fi

# Also kill by port (backup method)
echo "Cleaning up any remaining processes..."
lsof -ti:9050 | xargs kill -9 2>/dev/null || true
lsof -ti:9051 | xargs kill -9 2>/dev/null || true

echo "✅ Application stopped successfully!"
EOF

chmod +x stop_app.sh
```

#### Run stop script

```bash
./stop_app.sh
```

---

### Method 5: Force Kill by Port

If the application won't stop normally:

```bash
# Find and kill backend (port 9050)
lsof -ti:9050 | xargs kill -9

# Find and kill frontend (port 9051)
lsof -ti:9051 | xargs kill -9

# Verify ports are free
lsof -i :9050
lsof -i :9051
# Should return nothing
```

---

## ✅ Verify Installation

### Check Backend

```bash
# Health check
curl http://localhost:9050/health

# Expected output:
# {"status":"ok","timestamp":"2025-11-30T..."}

# Check API documentation
open http://localhost:9050/docs
# Should show FastAPI Swagger UI

# Check devices endpoint
curl http://localhost:9050/devices

# Expected output:
# [{"id":1,"hostname":"R1","ip":"172.20.0.11",...}]
```

### Check Frontend

```bash
# Check frontend is accessible
curl -I http://localhost:5173

# Expected output:
# HTTP/1.1 200 OK
# Content-Type: text/html

# Open in browser
open http://localhost:5173

# You should see:
# - Login page
# - OSPF Network Device Manager branding
# - Username and password fields
```

### Check Application Functionality

1. **Login:**
   - Username: `admin`
   - Password: `admin123`
   - Should successfully login and redirect to dashboard

2. **View Devices:**
   - Navigate to "Devices" page
   - Should see 10 pre-configured devices (R1-R10)
   - IP addresses: 172.20.0.11 to 172.20.0.20

3. **Configure Jumphost (if testing with real devices):**
   - Go to Settings → Jumphost Configuration
   - Enable jumphost
   - Host: 172.16.39.173
   - Username: cisco
   - Password: cisco
   - Click "Test Connection"
   - Should show success message

4. **Test Automation (if devices are reachable):**
   - Go to Automation page
   - Select devices
   - Click "Run Automation Job"
   - Should see real-time progress

---

## 🐛 Troubleshooting

### Issue 1: Port Already in Use

**Symptoms:**
```
Error: Address already in use
ERROR: [Errno 48] Address already in use
```

**Solution:**
```bash
# Find and kill process on port 9050 (backend)
lsof -ti:9050 | xargs kill -9

# Find and kill process on port 9051 or 5173 (frontend)
lsof -ti:9051 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Restart application
```

---

### Issue 2: Python Virtual Environment Not Activated

**Symptoms:**
```
ModuleNotFoundError: No module named 'fastapi'
```

**Solution:**
```bash
cd backend
source venv/bin/activate  # On macOS/Linux
# venv\Scripts\activate   # On Windows

# Verify activation (should show venv path)
which python3

# Install dependencies again if needed
pip install -r requirements.txt
```

---

### Issue 3: Node Modules Missing

**Symptoms:**
```
Error: Cannot find module 'react'
Error: Module not found
```

**Solution:**
```bash
cd frontend

# Remove existing node_modules and package-lock
rm -rf node_modules package-lock.json

# Clean npm cache
npm cache clean --force

# Reinstall dependencies
npm install

# Verify installation
npm list --depth=0
```

---

### Issue 4: Database Not Created

**Symptoms:**
```
Error: unable to open database file
```

**Solution:**
```bash
# Navigate to backend directory
cd backend

# Ensure directory is writable
ls -la

# Check if database exists
ls -la *.db

# If not, it will be created on first startup
# Start backend and database will be initialized automatically
```

---

### Issue 5: CORS Errors in Browser Console

**Symptoms:**
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solution:**
```bash
# Edit backend/.env file
cd backend
nano .env  # or vim .env

# Ensure ALLOWED_ORIGINS includes frontend URL
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:9051

# Restart backend server
```

---

### Issue 6: Backend Won't Start

**Symptoms:**
```
ImportError: cannot import name 'X' from 'Y'
```

**Solution:**
```bash
cd backend

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Reinstall all dependencies
pip install -r requirements.txt --force-reinstall

# Check for missing dependencies
pip check

# Restart backend
```

---

### Issue 7: Frontend Build Fails

**Symptoms:**
```
Error: Build failed with errors
```

**Solution:**
```bash
cd frontend

# Clear Vite cache
rm -rf node_modules/.vite

# Reinstall dependencies
npm install

# Try building
npm run build

# If successful, run dev server
npm run dev
```

---

## 📚 Additional Resources

### Documentation Files

- **DEPLOYMENT_OPTIONS_COMPLETE_GUIDE.md** - Remote deployment guide
- **REMOTE_DEPLOYMENT_GUIDE.md** - VM deployment instructions
- **DEPLOYMENT_COMPLETE_SUMMARY.md** - Deployment options summary
- **NETWORK_TESTING_GUIDE.md** - Testing with real devices
- **USER_MANUAL.md** - Complete user manual (15,000+ words)

### Quick Commands Reference

```bash
# Start backend
cd backend && source venv/bin/activate && python3 -m uvicorn server:app --host 0.0.0.0 --port 9050 --reload

# Start frontend
cd frontend && npm run dev

# Stop servers
# Ctrl+C in each terminal

# Check backend logs
tail -f backend/logs/app.log

# Check processes
ps aux | grep -E "(uvicorn|vite)"

# Check ports
lsof -i :9050  # Backend
lsof -i :5173  # Frontend dev
lsof -i :9051  # Frontend production
```

---

## 🎯 Quick Start Summary

```bash
# 1. Clone
git clone https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER.git
cd OSPF2-LL-DEVICE_MANAGER

# 2. Install Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Install Frontend
cd frontend
npm install
cd ..

# 4. Start Backend (Terminal 1)
cd backend
source venv/bin/activate
python3 -m uvicorn server:app --host 0.0.0.0 --port 9050 --reload

# 5. Start Frontend (Terminal 2)
cd frontend
npm run dev

# 6. Access Application
open http://localhost:5173
# Login: admin / admin123

# 7. Stop (in each terminal)
Ctrl + C
```

---

## ✅ Success Criteria

Installation is successful when:

- [ ] Repository cloned successfully
- [ ] Python dependencies installed (no errors)
- [ ] Node dependencies installed (no errors)
- [ ] Backend starts on port 9050
- [ ] Frontend starts on port 5173
- [ ] Health check returns `{"status":"ok"}`
- [ ] Frontend accessible in browser
- [ ] Login works with admin/admin123
- [ ] Dashboard displays correctly
- [ ] Devices page shows 10 devices
- [ ] No errors in browser console
- [ ] No errors in backend logs

---

## 🎉 Installation Complete!

You now have a fully functional OSPF Network Device Manager running locally!

**Next Steps:**
1. ✅ Configure jumphost (if testing with real devices)
2. ✅ Run automation jobs
3. ✅ Explore all features
4. ✅ Review documentation

**Need Help?**
- Check troubleshooting section above
- Review logs: `tail -f backend/logs/app.log`
- Check API docs: http://localhost:9050/docs

---

**Document Version:** 1.0.0  
**Last Updated:** November 30, 2025  
**Status:** PRODUCTION READY

---

**END OF INSTALLATION GUIDE**
