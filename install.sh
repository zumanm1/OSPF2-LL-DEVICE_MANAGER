#!/bin/bash
# =============================================================================
# NetMan OSPF Device Manager - Fully Automated Installation Script
# =============================================================================
# Optimized for Ubuntu 24.04 LTS (also works on 22.04, Debian 12)
#
# USAGE:
#   ./install.sh              - Install app dependencies only
#   ./install.sh --with-deps  - Install system deps + app (Node.js, Python)
#   ./install.sh --clean      - FULL 7-PHASE: Remove old, install fresh
#   ./install.sh --force      - Force reinstall all components
#
# The --clean option performs the complete 7-phase installation:
#   Phase 1: Remove old Node.js
#   Phase 2: Remove old npm
#   Phase 3: Remove old Python packages
#   Phase 4: Install Python 3.12
#   Phase 5: Install uv package manager
#   Phase 6: Install Node.js 20.x + app dependencies
#   Phase 7: Validate all components
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
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

print_phase() {
    echo -e "\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}  PHASE $1: $2${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo -e "\n${CYAN}[$1/$TOTAL_STEPS] $2${NC}"
}

log_installed() {
    echo -e "${GREEN}  ✓ $1${NC}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
}

log_skipped() {
    echo -e "${YELLOW}  ○ $1 (already done)${NC}"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
}

log_failed() {
    echo -e "${RED}  ✗ $1${NC}"
    FAILED_COUNT=$((FAILED_COUNT + 1))
}

log_info() {
    echo -e "${CYAN}  ℹ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

# =============================================================================
# Retry helper function - tries a command up to N times
# Usage: retry_cmd 3 "npm install" "Installing packages"
# =============================================================================
retry_cmd() {
    local max_attempts=$1
    local cmd=$2
    local description=$3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if [ $attempt -gt 1 ]; then
            log_warn "Retry $attempt/$max_attempts: $description"
            sleep 2
        fi

        if eval "$cmd"; then
            return 0
        fi

        attempt=$((attempt + 1))
    done

    return 1
}

# =============================================================================
# Parse Arguments
# =============================================================================
INSTALL_DEPS=false
FORCE_INSTALL=false
CLEAN_INSTALL=false

for arg in "$@"; do
    case $arg in
        --with-deps)
            INSTALL_DEPS=true
            ;;
        --force)
            FORCE_INSTALL=true
            ;;
        --clean)
            CLEAN_INSTALL=true
            INSTALL_DEPS=true
            FORCE_INSTALL=true
            ;;
        --help|-h)
            echo ""
            echo "NetMan OSPF Device Manager - Installation Script"
            echo ""
            echo "Usage: ./install.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --with-deps    Install system dependencies (Node.js, Python)"
            echo "  --force        Force reinstall all components"
            echo "  --clean        Full 7-phase clean installation (removes old, installs fresh)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./install.sh              # App dependencies only"
            echo "  ./install.sh --with-deps  # Include Node.js/Python if missing"
            echo "  ./install.sh --clean      # Complete fresh install (recommended for new servers)"
            echo ""
            exit 0
            ;;
    esac
done

# Detect OS
OS=""
OS_VERSION=""
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
fi

print_header "NetMan OSPF Device Manager - Installer"
echo ""
echo -e "${CYAN}Detected OS: ${OS:-unknown} ${OS_VERSION:-}${NC}"
echo -e "${CYAN}Architecture: $(uname -m)${NC}"
echo -e "${CYAN}Working Directory: $SCRIPT_DIR${NC}"
echo -e "${CYAN}Install Mode: $([ "$CLEAN_INSTALL" = true ] && echo 'CLEAN (7-Phase)' || ([ "$INSTALL_DEPS" = true ] && echo 'WITH-DEPS' || echo 'APP-ONLY'))${NC}"

# =============================================================================
# CLEAN INSTALL: 7-Phase Process
# =============================================================================
if [ "$CLEAN_INSTALL" = true ]; then
    echo ""
    echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║  CLEAN INSTALLATION MODE - 7-Phase Automated Process         ║${NC}"
    echo -e "${MAGENTA}║  This will remove old installations and install fresh        ║${NC}"
    echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════╝${NC}"

    # -------------------------------------------------------------------------
    # Phase 1: Remove old Node.js
    # -------------------------------------------------------------------------
    print_phase 1 "Remove Old Node.js"

    if command -v node &> /dev/null || [ -f /usr/bin/node ]; then
        log_info "Removing existing Node.js installation..."
        sudo apt-get remove -y nodejs npm 2>/dev/null || true
        sudo apt-get autoremove -y 2>/dev/null || true
        sudo rm -rf /usr/bin/node /usr/bin/npm 2>/dev/null || true
        sudo rm -rf /usr/local/bin/node /usr/local/bin/npm 2>/dev/null || true
        sudo rm -rf /usr/lib/node_modules 2>/dev/null || true
        sudo rm -rf /usr/local/lib/node_modules 2>/dev/null || true
        rm -rf ~/.npm ~/.node* 2>/dev/null || true
        log_installed "Node.js removed"
    else
        log_skipped "Node.js not installed"
    fi

    # -------------------------------------------------------------------------
    # Phase 2: Remove old npm
    # -------------------------------------------------------------------------
    print_phase 2 "Remove Old npm"

    if [ -d ~/.npm ] || [ -d /usr/local/lib/node_modules/npm ]; then
        log_info "Cleaning npm cache and global modules..."
        sudo rm -rf /usr/local/lib/node_modules/npm 2>/dev/null || true
        rm -rf ~/.npm 2>/dev/null || true
        log_installed "npm cleaned"
    else
        log_skipped "npm cache clean"
    fi

    # -------------------------------------------------------------------------
    # Phase 3: Clean Python environment
    # -------------------------------------------------------------------------
    print_phase 3 "Clean Python Environment"

    log_info "Cleaning Python virtual environment and cache..."
    rm -rf backend/venv 2>/dev/null || true
    rm -rf ~/.cache/pip 2>/dev/null || true
    rm -rf ~/.local/lib/python*/site-packages 2>/dev/null || true
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -delete 2>/dev/null || true
    log_installed "Python environment cleaned"

    # -------------------------------------------------------------------------
    # Phase 4: Install Python 3.12
    # -------------------------------------------------------------------------
    print_phase 4 "Install Python 3.12"

    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        log_info "Updating package lists..."
        sudo apt-get update -qq

        # Check if Python 3.12 is available, if not add deadsnakes PPA (Ubuntu)
        if ! apt-cache show python3.12 &>/dev/null && [ "$OS" = "ubuntu" ]; then
            log_info "Adding deadsnakes PPA for Python 3.12..."
            sudo apt-get install -y software-properties-common >/dev/null 2>&1
            sudo add-apt-repository -y ppa:deadsnakes/ppa >/dev/null 2>&1
            sudo apt-get update -qq
        fi

        log_info "Installing Python 3..."
        sudo apt-get install -y python3 python3-pip python3-venv python3-full curl git >/dev/null 2>&1

        PYTHON_VER=$(python3 --version 2>&1 | cut -d' ' -f2)
        log_installed "Python $PYTHON_VER installed"
    else
        log_info "Non-Ubuntu/Debian system - ensure Python 3.10+ is installed"
    fi

    # -------------------------------------------------------------------------
    # Phase 5: Install uv Package Manager
    # -------------------------------------------------------------------------
    print_phase 5 "Install uv Package Manager"

    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

    log_info "Installing uv (10-100x faster than pip)..."
    curl -LsSf https://astral.sh/uv/install.sh 2>/dev/null | sh >/dev/null 2>&1

    # Refresh PATH
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

    if command -v uv &> /dev/null; then
        UV_VER=$(uv --version 2>/dev/null | head -1)
        log_installed "uv installed ($UV_VER)"

        # Add to bashrc if not present
        if ! grep -q 'PATH="$HOME/.local/bin' ~/.bashrc 2>/dev/null; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
            log_info "Added uv to PATH in ~/.bashrc"
        fi
    else
        log_failed "uv installation failed - will use pip"
    fi

    # -------------------------------------------------------------------------
    # Phase 6: Install Node.js 20.x
    # -------------------------------------------------------------------------
    print_phase 6 "Install Node.js 20.x"

    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        log_info "Installing Node.js 20.x from NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | sudo -E bash - >/dev/null 2>&1
        sudo apt-get install -y nodejs >/dev/null 2>&1

        if command -v node &> /dev/null && node --version &>/dev/null; then
            NODE_VER=$(node --version)
            NPM_VER=$(npm --version 2>/dev/null || echo "N/A")
            log_installed "Node.js $NODE_VER installed"
            log_installed "npm $NPM_VER installed"
        else
            log_failed "Node.js installation failed"
            exit 1
        fi
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
        sudo yum install -y nodejs >/dev/null 2>&1
        log_installed "Node.js installed (RHEL/CentOS)"
    fi

    # -------------------------------------------------------------------------
    # Phase 7: Install Application Dependencies
    # -------------------------------------------------------------------------
    print_phase 7 "Install Application Dependencies"

    # This continues to the regular installation below...
    echo -e "${GREEN}  Clean phases complete, proceeding with app installation...${NC}"
fi

# =============================================================================
# Regular Installation (8 Steps)
# =============================================================================
TOTAL_STEPS=8

# =============================================================================
# STEP 1: System Dependencies
# =============================================================================
print_step 1 "System Dependencies"

if [ "$INSTALL_DEPS" = true ] && [ "$CLEAN_INSTALL" = false ]; then
    echo "  Installing system dependencies..."

    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        # Check and install Node.js
        NODE_WORKS=false
        if command -v node &> /dev/null; then
            node --version >/dev/null 2>&1 && NODE_WORKS=true
        fi

        if [ "$NODE_WORKS" = false ] || [ "$FORCE_INSTALL" = true ]; then
            echo "  Installing Node.js 20.x..."
            sudo apt-get remove -y nodejs npm >/dev/null 2>&1 || true
            sudo rm -rf /usr/bin/node /usr/bin/npm /usr/lib/node_modules 2>/dev/null || true
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
            sudo apt-get install -y nodejs >/dev/null 2>&1
            log_installed "Node.js installed"
        else
            log_skipped "Node.js $(node --version 2>/dev/null)"
        fi

        # Check and install Python
        PYTHON_WORKS=false
        if command -v python3 &> /dev/null; then
            python3 --version >/dev/null 2>&1 && PYTHON_WORKS=true
        fi

        if [ "$PYTHON_WORKS" = false ] || [ "$FORCE_INSTALL" = true ]; then
            echo "  Installing Python3..."
            sudo apt-get update >/dev/null 2>&1
            sudo apt-get install -y python3 python3-pip python3-venv curl git >/dev/null 2>&1
            log_installed "Python3 installed"
        else
            log_skipped "Python3 $(python3 --version 2>&1 | cut -d' ' -f2)"
        fi

        # Install git/curl if missing
        if ! command -v git &> /dev/null || ! command -v curl &> /dev/null; then
            sudo apt-get install -y git curl >/dev/null 2>&1
            log_installed "Git/curl installed"
        fi

    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        if ! command -v node &> /dev/null || [ "$FORCE_INSTALL" = true ]; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
            sudo yum install -y nodejs python3 python3-pip git curl >/dev/null 2>&1
            log_installed "Dependencies installed (RHEL/CentOS)"
        fi

    elif [ "$(uname)" = "Darwin" ]; then
        if command -v brew &> /dev/null; then
            if ! command -v node &> /dev/null || [ "$FORCE_INSTALL" = true ]; then
                brew install node python@3.12 >/dev/null 2>&1
                log_installed "Dependencies installed (macOS)"
            fi
        else
            echo -e "${YELLOW}  Homebrew not found. Install from https://brew.sh${NC}"
        fi
    fi
elif [ "$CLEAN_INSTALL" = false ]; then
    echo -e "${YELLOW}  Skipping system deps (use --with-deps or --clean to install)${NC}"
fi

# =============================================================================
# STEP 2: Verify Required Tools
# =============================================================================
print_step 2 "Verifying Required Tools"

MISSING_DEPS=false
ARCH_MISMATCH=false
SYSTEM_ARCH=$(uname -m)

echo -e "  ${CYAN}System Architecture: $SYSTEM_ARCH${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Node.js: $NODE_VERSION${NC}"
    else
        echo -e "${RED}  ✗ Node.js: exec format error (wrong architecture)${NC}"
        MISSING_DEPS=true
        ARCH_MISMATCH=true
    fi
else
    echo -e "${RED}  ✗ Node.js not found!${NC}"
    MISSING_DEPS=true
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version 2>&1)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ npm: $NPM_VERSION${NC}"
    else
        echo -e "${RED}  ✗ npm: exec format error${NC}"
        MISSING_DEPS=true
    fi
else
    echo -e "${RED}  ✗ npm not found!${NC}"
    MISSING_DEPS=true
fi

# Check Python 3
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ $PYTHON_VERSION${NC}"
    else
        echo -e "${RED}  ✗ Python3: exec format error${NC}"
        MISSING_DEPS=true
    fi
else
    echo -e "${RED}  ✗ Python 3 not found!${NC}"
    MISSING_DEPS=true
fi

# Check Git
if command -v git &> /dev/null; then
    echo -e "${GREEN}  ✓ Git: $(git --version 2>&1 | cut -d' ' -f3)${NC}"
else
    echo -e "${YELLOW}  ○ Git not found (optional)${NC}"
fi

if [ "$MISSING_DEPS" = true ]; then
    echo ""
    echo -e "${RED}Missing required dependencies!${NC}"
    echo ""
    echo "Run with --clean for full automated installation:"
    echo -e "  ${CYAN}./install.sh --clean${NC}"
    echo ""
    echo "Or with --with-deps to just add missing components:"
    echo -e "  ${CYAN}./install.sh --with-deps${NC}"
    exit 1
fi

# =============================================================================
# STEP 3: Frontend Dependencies (npm)
# =============================================================================
print_step 3 "Frontend Dependencies (npm)"

if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ] && [ "$FORCE_INSTALL" = false ]; then
    log_skipped "node_modules up to date"
else
    echo "  Installing npm packages..."
    rm -rf node_modules 2>/dev/null || true

    # Try npm install with retry logic (3 attempts)
    NPM_SUCCESS=false
    for attempt in 1 2 3; do
        if [ $attempt -gt 1 ]; then
            log_warn "npm install attempt $attempt/3..."
            rm -rf node_modules package-lock.json 2>/dev/null || true
            sleep 2
        fi

        if npm install --silent 2>/dev/null; then
            NPM_SUCCESS=true
            break
        fi
    done

    if [ "$NPM_SUCCESS" = true ]; then
        log_installed "npm packages installed ($(ls node_modules 2>/dev/null | wc -l | tr -d ' ') packages)"
    else
        # Fallback: Try with --legacy-peer-deps
        log_warn "Trying npm install with --legacy-peer-deps..."
        if npm install --legacy-peer-deps --silent 2>/dev/null; then
            log_installed "npm packages installed (legacy mode)"
        else
            log_failed "npm install failed after all attempts"
        fi
    fi
fi

# =============================================================================
# STEP 4: Python Package Manager (uv)
# =============================================================================
print_step 4 "Python Package Manager (uv)"

export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

USE_UV=false
if command -v uv &> /dev/null; then
    uv --version >/dev/null 2>&1 && USE_UV=true
fi

if [ "$USE_UV" = false ]; then
    echo "  Installing uv (10-100x faster than pip)..."
    curl -LsSf https://astral.sh/uv/install.sh 2>/dev/null | sh >/dev/null 2>&1
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    if command -v uv &> /dev/null; then
        uv --version >/dev/null 2>&1 && USE_UV=true
        log_installed "uv installed ($(uv --version 2>/dev/null | head -1))"
    else
        echo -e "  ${YELLOW}uv install failed, falling back to pip${NC}"
    fi
else
    log_skipped "uv already installed ($(uv --version 2>/dev/null | head -1))"
fi

# =============================================================================
# STEP 5: Python Virtual Environment
# =============================================================================
print_step 5 "Python Virtual Environment"

cd backend

if [ "$USE_UV" = true ]; then
    echo -e "  ${GREEN}Using uv (fast mode)${NC}"

    if [ -d "venv" ] && [ -f "venv/bin/activate" ] && [ "$FORCE_INSTALL" = false ]; then
        log_skipped "Virtual environment exists"
    else
        echo "  Creating virtual environment with uv..."
        rm -rf venv 2>/dev/null || true
        uv venv venv 2>/dev/null
        if [ $? -eq 0 ]; then
            log_installed "Virtual environment created (uv)"
        else
            echo -e "  ${YELLOW}uv venv failed, trying python3 -m venv${NC}"
            python3 -m venv venv
            log_installed "Virtual environment created (fallback)"
        fi
    fi
else
    echo -e "  ${YELLOW}Using pip (uv not available)${NC}"

    if [ -d "venv" ] && [ -f "venv/bin/activate" ] && [ "$FORCE_INSTALL" = false ]; then
        log_skipped "Virtual environment exists"
    else
        echo "  Creating virtual environment..."
        rm -rf venv 2>/dev/null || true
        python3 -m venv venv
        log_installed "Virtual environment created"
    fi
fi

source venv/bin/activate

# =============================================================================
# STEP 6: Python Dependencies
# =============================================================================
if [ "$USE_UV" = true ]; then
    print_step 6 "Python Dependencies (uv - fast mode)"
else
    print_step 6 "Python Dependencies (pip)"
fi

check_pip_package() {
    python3 -c "import $1" 2>/dev/null
    return $?
}

NEED_PIP_INSTALL=false
if ! check_pip_package "fastapi" || ! check_pip_package "netmiko" || ! check_pip_package "uvicorn"; then
    NEED_PIP_INSTALL=true
fi

if [ "$NEED_PIP_INSTALL" = true ] || [ "$FORCE_INSTALL" = true ] || [ "$CLEAN_INSTALL" = true ]; then
    PYTHON_INSTALL_SUCCESS=false

    if [ "$USE_UV" = true ]; then
        echo "  Installing Python packages with uv..."

        # Try uv pip install with retry logic (3 attempts)
        for attempt in 1 2 3; do
            if [ $attempt -gt 1 ]; then
                log_warn "uv pip install attempt $attempt/3..."
                sleep 2
            fi

            if uv pip install -r requirements.txt --quiet 2>/dev/null; then
                # Verify installation actually worked
                if python3 -c "import fastapi, uvicorn, netmiko" 2>/dev/null; then
                    PYTHON_INSTALL_SUCCESS=true
                    log_installed "Python packages installed (uv)"
                    break
                fi
            fi
        done

        # Fallback to pip if uv failed
        if [ "$PYTHON_INSTALL_SUCCESS" = false ]; then
            log_warn "uv failed, falling back to pip..."
            pip install --upgrade pip -q 2>/dev/null
            if pip install -r requirements.txt -q 2>/dev/null; then
                if python3 -c "import fastapi, uvicorn, netmiko" 2>/dev/null; then
                    PYTHON_INSTALL_SUCCESS=true
                    log_installed "Python packages installed (pip fallback)"
                fi
            fi
        fi
    else
        echo "  Installing Python packages with pip..."
        pip install --upgrade pip -q 2>/dev/null

        # Try pip install with retry logic (3 attempts)
        for attempt in 1 2 3; do
            if [ $attempt -gt 1 ]; then
                log_warn "pip install attempt $attempt/3..."
                sleep 2
            fi

            if pip install -r requirements.txt -q 2>/dev/null; then
                if python3 -c "import fastapi, uvicorn, netmiko" 2>/dev/null; then
                    PYTHON_INSTALL_SUCCESS=true
                    log_installed "Python packages installed (pip)"
                    break
                fi
            fi
        done
    fi

    if [ "$PYTHON_INSTALL_SUCCESS" = false ]; then
        log_failed "Python package installation failed after all attempts"
    fi
else
    log_skipped "All Python packages installed"
fi

cd ..

# =============================================================================
# STEP 7: Configuration Files
# =============================================================================
print_step 7 "Configuration Files"

if [ ! -f "backend/.env.local" ]; then
    cat > backend/.env.local << 'EOF'
# =============================================================================
# NetMan OSPF Device Manager - Environment Configuration
# =============================================================================

# Security Settings
SECURITY_ENABLED=true
APP_ADMIN_USERNAME=netviz_admin
APP_ADMIN_PASSWORD=V3ry$trongAdm1n!2025
APP_LOGIN_MAX_USES=10
APP_SESSION_TIMEOUT=3600
APP_SECRET_KEY=change-this-to-a-random-secret-key

# =============================================================================
# Server Binding - Controls which interface the server listens on
# =============================================================================
# Options: 127.0.0.1 (localhost only), 0.0.0.0 (all interfaces), or specific IP
# Using 0.0.0.0 to allow external access - IP whitelist controls who can connect
SERVER_HOST=0.0.0.0

# =============================================================================
# IP Whitelist - Comma-separated list of allowed client IPs
# =============================================================================
# Use 0.0.0.0 to allow all IPs (not recommended for production)
# Examples: 127.0.0.1,192.168.1.0/24,10.0.0.5
# For now allowing all - change to specific IPs for production
ALLOWED_IPS=0.0.0.0

# Legacy setting (kept for backward compatibility)
# Set to 'false' when using SERVER_HOST=0.0.0.0
LOCALHOST_ONLY=false
ALLOWED_HOSTS=127.0.0.1,localhost,0.0.0.0

# =============================================================================
# Jumphost Configuration (optional)
# =============================================================================
JUMPHOST_ENABLED=false
JUMPHOST_HOST=
JUMPHOST_PORT=22
JUMPHOST_USERNAME=
JUMPHOST_PASSWORD=
EOF
    log_installed "Created .env.local with secure defaults"
else
    log_skipped ".env.local exists"
fi

# Create directories
mkdir -p logs backend/data/executions backend/data/TEXT backend/data/JSON 2>/dev/null
log_skipped "Directories ready"

# Make scripts executable
chmod +x start.sh stop.sh restart.sh reset.sh netman.py 2>/dev/null

# =============================================================================
# STEP 8: Validation
# =============================================================================
print_step 8 "Installation Validation"

VALIDATION_PASSED=true

# Validate node_modules
if [ -d "node_modules" ] && [ $(ls node_modules 2>/dev/null | wc -l) -gt 100 ]; then
    echo -e "${GREEN}  ✓ Frontend packages: OK ($(ls node_modules | wc -l) packages)${NC}"
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
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║      Installation Complete!              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
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
    echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  Installation Failed - Check errors      ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
    exit 1
fi
