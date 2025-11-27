#!/bin/bash
# NetMan OSPF Device Manager - Smart Installation Script
# Optimized for Ubuntu 24.04 LTS
# Features: Idempotent, skips already-installed components
# Usage: ./install.sh [--with-deps] [--force]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Counters
INSTALLED_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0

print_header() {
    echo -e "${BLUE}==========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}==========================================${NC}"
}

print_step() {
    echo -e "\n${CYAN}[$1/$TOTAL_STEPS] $2${NC}"
}

log_installed() {
    echo -e "${GREEN}  ✓ $1${NC}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
}

log_skipped() {
    echo -e "${YELLOW}  ○ $1 (already installed)${NC}"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
}

log_failed() {
    echo -e "${RED}  ✗ $1${NC}"
    FAILED_COUNT=$((FAILED_COUNT + 1))
}

print_header "NetMan OSPF Device Manager - Smart Installer"

# Parse arguments
INSTALL_DEPS=false
FORCE_INSTALL=false
for arg in "$@"; do
    case $arg in
        --with-deps)
            INSTALL_DEPS=true
            ;;
        --force)
            FORCE_INSTALL=true
            ;;
        --help|-h)
            echo ""
            echo "Usage: ./install.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --with-deps    Install system dependencies (Node.js, Python)"
            echo "  --force        Force reinstall all components"
            echo "  --help, -h     Show this help message"
            echo ""
            exit 0
            ;;
    esac
done

TOTAL_STEPS=7

# Detect OS
OS=""
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
fi

echo ""
echo -e "${CYAN}Detected OS: ${OS:-unknown}${NC}"
echo -e "${CYAN}Working Directory: $SCRIPT_DIR${NC}"

# =============================================================================
# STEP 1: System Dependencies (Optional)
# =============================================================================
print_step 1 "Checking System Dependencies"

if [ "$INSTALL_DEPS" = true ]; then
    echo "  Installing system dependencies..."

    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        # Check and install Node.js
        if ! command -v node &> /dev/null || [ "$FORCE_INSTALL" = true ]; then
            echo "  Installing Node.js 20.x..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
            sudo apt-get install -y nodejs >/dev/null 2>&1
            log_installed "Node.js installed"
        else
            log_skipped "Node.js $(node --version)"
        fi

        # Check and install Python
        if ! command -v python3 &> /dev/null || [ "$FORCE_INSTALL" = true ]; then
            echo "  Installing Python3..."
            sudo apt-get update >/dev/null 2>&1
            sudo apt-get install -y python3 python3-pip python3-venv >/dev/null 2>&1
            log_installed "Python3 installed"
        else
            log_skipped "Python3 $(python3 --version 2>&1 | cut -d' ' -f2)"
        fi

        # Install git if missing
        if ! command -v git &> /dev/null; then
            sudo apt-get install -y git curl >/dev/null 2>&1
            log_installed "Git installed"
        fi

    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        if ! command -v node &> /dev/null || [ "$FORCE_INSTALL" = true ]; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
            sudo yum install -y nodejs python3 python3-pip git >/dev/null 2>&1
            log_installed "Dependencies installed (CentOS/RHEL)"
        fi

    elif [ "$(uname)" = "Darwin" ]; then
        if command -v brew &> /dev/null; then
            if ! command -v node &> /dev/null || [ "$FORCE_INSTALL" = true ]; then
                brew install node python@3.11 >/dev/null 2>&1
                log_installed "Dependencies installed (macOS)"
            fi
        else
            echo -e "${YELLOW}  Homebrew not found. Install from https://brew.sh${NC}"
        fi
    fi
else
    echo -e "${YELLOW}  Skipping system deps (use --with-deps to install)${NC}"
fi

# =============================================================================
# STEP 2: Verify Required Tools
# =============================================================================
print_step 2 "Verifying Required Tools"

MISSING_DEPS=false

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}  ✓ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}  ✗ Node.js not found!${NC}"
    MISSING_DEPS=true
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}  ✓ npm: $NPM_VERSION${NC}"
else
    echo -e "${RED}  ✗ npm not found!${NC}"
    MISSING_DEPS=true
fi

# Check Python 3
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}  ✓ $PYTHON_VERSION${NC}"
else
    echo -e "${RED}  ✗ Python 3 not found!${NC}"
    MISSING_DEPS=true
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e "${GREEN}  ✓ Git: $GIT_VERSION${NC}"
else
    echo -e "${YELLOW}  ○ Git not found (optional)${NC}"
fi

if [ "$MISSING_DEPS" = true ]; then
    echo ""
    echo -e "${RED}Missing required dependencies!${NC}"
    echo ""
    echo "Install on Ubuntu 24.04:"
    echo -e "  ${CYAN}./install.sh --with-deps${NC}"
    echo ""
    echo "Or manually:"
    echo -e "  ${CYAN}curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -${NC}"
    echo -e "  ${CYAN}sudo apt-get install -y nodejs python3 python3-pip python3-venv${NC}"
    exit 1
fi

# =============================================================================
# STEP 3: Frontend Dependencies (npm)
# =============================================================================
print_step 3 "Frontend Dependencies (npm)"

# Check if node_modules exists and has packages
if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ] && [ "$FORCE_INSTALL" = false ]; then
    # Check if package.json has changed
    if [ "package-lock.json" -ot "node_modules/.package-lock.json" ] 2>/dev/null; then
        log_skipped "node_modules up to date"
    else
        echo "  Updating npm packages..."
        npm install --silent 2>/dev/null
        log_installed "npm packages updated"
    fi
else
    echo "  Installing npm packages..."
    npm install --silent 2>/dev/null
    if [ $? -eq 0 ]; then
        log_installed "npm packages installed ($(ls node_modules 2>/dev/null | wc -l | tr -d ' ') packages)"
    else
        log_failed "npm install failed"
    fi
fi

# =============================================================================
# STEP 4: Python Virtual Environment
# =============================================================================
print_step 4 "Python Virtual Environment"

cd backend

if [ -d "venv" ] && [ -f "venv/bin/activate" ] && [ "$FORCE_INSTALL" = false ]; then
    log_skipped "Virtual environment exists"
else
    echo "  Creating virtual environment..."
    python3 -m venv venv
    log_installed "Virtual environment created"
fi

# Activate venv
source venv/bin/activate

# =============================================================================
# STEP 5: Python Dependencies (pip)
# =============================================================================
print_step 5 "Python Dependencies (pip)"

# Check if key packages are installed
check_pip_package() {
    python3 -c "import $1" 2>/dev/null
    return $?
}

NEED_PIP_INSTALL=false

# Check core packages
if ! check_pip_package "fastapi" || ! check_pip_package "netmiko" || ! check_pip_package "uvicorn"; then
    NEED_PIP_INSTALL=true
fi

if [ "$NEED_PIP_INSTALL" = true ] || [ "$FORCE_INSTALL" = true ]; then
    echo "  Installing Python packages..."
    pip install --upgrade pip -q 2>/dev/null
    pip install -r requirements.txt -q 2>/dev/null
    if [ $? -eq 0 ]; then
        log_installed "Python packages installed"
    else
        log_failed "pip install failed"
    fi
else
    # Verify all packages are present
    MISSING_PKGS=$(pip install -r requirements.txt --dry-run 2>&1 | grep -c "Would install" || echo "0")
    if [ "$MISSING_PKGS" != "0" ]; then
        echo "  Installing missing packages..."
        pip install -r requirements.txt -q 2>/dev/null
        log_installed "Missing packages installed"
    else
        log_skipped "All Python packages installed"
    fi
fi

cd ..

# =============================================================================
# STEP 6: Configuration Files
# =============================================================================
print_step 6 "Configuration Files"

# Create .env.local if not exists
if [ ! -f "backend/.env.local" ]; then
    cat > backend/.env.local << 'EOF'
# NetMan OSPF Device Manager - Environment Configuration
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
EOF
    log_installed "Created .env.local with defaults"
else
    log_skipped ".env.local exists"
fi

# Create logs directory
if [ ! -d "logs" ]; then
    mkdir -p logs
    log_installed "Created logs directory"
else
    log_skipped "logs directory exists"
fi

# Create data directories
if [ ! -d "backend/data/executions" ]; then
    mkdir -p backend/data/executions backend/data/TEXT backend/data/JSON
    log_installed "Created data directories"
else
    log_skipped "data directories exist"
fi

# Make scripts executable
chmod +x start.sh stop.sh restart.sh reset.sh netman.py 2>/dev/null

# =============================================================================
# STEP 7: Validation
# =============================================================================
print_step 7 "Installation Validation"

VALIDATION_PASSED=true

# Validate node_modules
if [ -d "node_modules" ] && [ $(ls node_modules 2>/dev/null | wc -l) -gt 100 ]; then
    echo -e "${GREEN}  ✓ Frontend packages: OK${NC}"
else
    echo -e "${RED}  ✗ Frontend packages: MISSING${NC}"
    VALIDATION_PASSED=false
fi

# Validate Python venv
if [ -f "backend/venv/bin/activate" ]; then
    echo -e "${GREEN}  ✓ Python venv: OK${NC}"
else
    echo -e "${RED}  ✗ Python venv: MISSING${NC}"
    VALIDATION_PASSED=false
fi

# Validate Python packages
source backend/venv/bin/activate 2>/dev/null
if python3 -c "import fastapi, uvicorn, netmiko, pydantic" 2>/dev/null; then
    echo -e "${GREEN}  ✓ Python packages: OK${NC}"
else
    echo -e "${RED}  ✗ Python packages: MISSING${NC}"
    VALIDATION_PASSED=false
fi

# Validate config
if [ -f "backend/.env.local" ]; then
    echo -e "${GREEN}  ✓ Configuration: OK${NC}"
else
    echo -e "${YELLOW}  ○ Configuration: Using defaults${NC}"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
print_header "Installation Summary"
echo ""
echo -e "  ${GREEN}Installed: $INSTALLED_COUNT${NC}"
echo -e "  ${YELLOW}Skipped:   $SKIPPED_COUNT${NC}"
if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "  ${RED}Failed:    $FAILED_COUNT${NC}"
fi

if [ "$VALIDATION_PASSED" = true ]; then
    echo ""
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}  Installation Complete!${NC}"
    echo -e "${GREEN}==========================================${NC}"
    echo ""
    echo "Quick Start:"
    echo -e "  ${CYAN}./start.sh${NC}              Start application"
    echo -e "  ${CYAN}python3 netman.py start${NC} Start (Python)"
    echo ""
    echo "Other Commands:"
    echo -e "  ${CYAN}./stop.sh${NC}               Stop application"
    echo -e "  ${CYAN}./restart.sh${NC}            Restart application"
    echo -e "  ${CYAN}python3 netman.py status${NC} Check status"
    echo ""
    echo "Default Credentials:"
    echo -e "  Username: ${GREEN}admin${NC}"
    echo -e "  Password: ${GREEN}admin123${NC}"
    echo ""
    echo "Access URLs:"
    echo -e "  Frontend: ${CYAN}http://localhost:9050${NC}"
    echo -e "  Backend:  ${CYAN}http://localhost:9051${NC}"
else
    echo ""
    echo -e "${RED}==========================================${NC}"
    echo -e "${RED}  Installation Failed - Check errors above${NC}"
    echo -e "${RED}==========================================${NC}"
    exit 1
fi
