#!/bin/bash
# =============================================================================
# NetViz OSPF Device Manager - Unified Management Script
# =============================================================================
# A comprehensive tool for managing the NetViz OSPF Device Manager application
# with isolated Node.js (via nvm) and Python (via venv) environments.
#
# USAGE:
#   ./netviz.sh setup     # First-time setup: Install nvm + Node.js v20 (isolated)
#   ./netviz.sh install   # Install system requirements (Node.js, Python) if not present
#   ./netviz.sh deps      # Install npm + Python dependencies (smart - skips existing)
#   ./netviz.sh start     # Start frontend (9050) and API (9051) servers
#   ./netviz.sh stop      # Stop all running servers
#   ./netviz.sh restart   # Restart all servers
#   ./netviz.sh status    # Show system and server status
#   ./netviz.sh clean     # Clean build artifacts and node_modules
#   ./netviz.sh build     # Build for production
#   ./netviz.sh logs      # View logs
#   ./netviz.sh reset     # Reset database/auth
#
# OPTIONS:
#   -p, --port PORT    Start on custom port
#   -f, --force        Force reinstall/restart without prompts
#   -y, --yes          Skip confirmation prompts
#   -h, --help         Show help message
#
# EXAMPLES:
#   ./netviz.sh setup && ./netviz.sh deps && ./netviz.sh start
#   ./netviz.sh start --force
#   ./netviz.sh stop --force
#   NETVIZ_PORT=8080 ./netviz.sh start
# =============================================================================

set -e

# =============================================================================
# Configuration
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Node.js version for this project
NODE_VERSION="20"
NVM_VERSION="0.40.1"

# Ports
FRONTEND_PORT=${NETVIZ_PORT:-9050}
BACKEND_PORT=${NETVIZ_API_PORT:-9051}

# PID files
PID_BACKEND=".backend.pid"
PID_FRONTEND=".frontend.pid"

# Directories
BACKEND_DIR="backend"
LOGS_DIR="logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# Counters
INSTALLED_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0

# =============================================================================
# Helper Functions
# =============================================================================
print_banner() {
    echo -e "${MAGENTA}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║     ███╗   ██╗███████╗████████╗██╗   ██╗██╗███████╗           ║"
    echo "║     ████╗  ██║██╔════╝╚══██╔══╝██║   ██║██║╚══███╔╝           ║"
    echo "║     ██╔██╗ ██║█████╗     ██║   ██║   ██║██║  ███╔╝            ║"
    echo "║     ██║╚██╗██║██╔══╝     ██║   ╚██╗ ██╔╝██║ ███╔╝             ║"
    echo "║     ██║ ╚████║███████╗   ██║    ╚████╔╝ ██║███████╗           ║"
    echo "║     ╚═╝  ╚═══╝╚══════╝   ╚═╝     ╚═══╝  ╚═╝╚══════╝           ║"
    echo "║                                                                ║"
    echo "║              OSPF Device Manager v1.0                          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_header() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
}

print_step() {
    echo -e "\n${CYAN}[$1] $2${NC}"
}

log_ok() {
    echo -e "${GREEN}  ✓ $1${NC}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
}

log_skip() {
    echo -e "${YELLOW}  ○ $1 (already installed)${NC}"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
}

log_fail() {
    echo -e "${RED}  ✗ $1${NC}"
    FAILED_COUNT=$((FAILED_COUNT + 1))
}

log_info() {
    echo -e "${CYAN}  ℹ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

# Check if a command exists
cmd_exists() {
    command -v "$1" &> /dev/null
}

# Check if a port is in use
port_in_use() {
    lsof -ti:$1 &>/dev/null
}

# Get PID using a port
get_port_pid() {
    lsof -ti:$1 2>/dev/null | head -1
}

# Check Python package
check_python_pkg() {
    python3 -c "import $1" 2>/dev/null
}

# =============================================================================
# NVM Functions - Isolated Node.js Environment
# =============================================================================
load_nvm() {
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        . "$NVM_DIR/nvm.sh" 2>/dev/null
        return 0
    fi
    return 1
}

nvm_installed() {
    load_nvm && command -v nvm &>/dev/null
}

use_project_node() {
    # Try to use nvm-managed Node.js first
    if nvm_installed; then
        # Check if project version is installed
        if nvm ls "$NODE_VERSION" &>/dev/null; then
            nvm use "$NODE_VERSION" &>/dev/null
            return 0
        fi
    fi
    
    # Fallback to system Node.js
    if cmd_exists node && node --version &>/dev/null; then
        return 0
    fi
    
    return 1
}

show_node_status() {
    if nvm_installed; then
        local nvm_ver=$(nvm --version 2>/dev/null)
        echo -e "${GREEN}  ✓ nvm: v$nvm_ver (isolated environment)${NC}"
        
        if nvm ls "$NODE_VERSION" &>/dev/null; then
            nvm use "$NODE_VERSION" &>/dev/null
            echo -e "${GREEN}  ✓ Node.js: $(node --version) (nvm-managed)${NC}"
        else
            echo -e "${YELLOW}  ○ Node.js v$NODE_VERSION not installed in nvm${NC}"
        fi
    elif cmd_exists node; then
        echo -e "${YELLOW}  ○ Node.js: $(node --version) (system - not isolated)${NC}"
        echo -e "${CYAN}    Tip: Run './netviz.sh setup' for isolated environment${NC}"
    else
        echo -e "${RED}  ✗ Node.js: Not installed${NC}"
    fi
}

# =============================================================================
# Command: help
# =============================================================================
cmd_help() {
    print_banner
    echo -e "${BOLD}USAGE:${NC}"
    echo "  ./netviz.sh <command> [options]"
    echo ""
    echo -e "${BOLD}SETUP COMMANDS:${NC}"
    echo -e "  ${GREEN}setup${NC}       First-time setup: Install nvm + Node.js v$NODE_VERSION (isolated environment)"
    echo -e "  ${GREEN}install${NC}     Install system requirements (Node.js, Python) if not present"
    echo -e "  ${GREEN}deps${NC}        Install npm + Python dependencies (smart - skips existing)"
    echo ""
    echo -e "${BOLD}SERVER COMMANDS:${NC}"
    echo -e "  ${GREEN}start${NC}       Start frontend (9050) and API (9051) servers"
    echo -e "  ${GREEN}stop${NC}        Stop all running servers"
    echo -e "  ${GREEN}restart${NC}     Restart all servers"
    echo -e "  ${GREEN}status${NC}      Show system and server status"
    echo -e "  ${GREEN}logs${NC}        View logs (use -f to follow)"
    echo ""
    echo -e "${BOLD}BUILD COMMANDS:${NC}"
    echo -e "  ${GREEN}clean${NC}       Clean build artifacts and node_modules"
    echo -e "  ${GREEN}build${NC}       Build for production"
    echo -e "  ${GREEN}reset${NC}       Reset database/auth"
    echo ""
    echo -e "${BOLD}OPTIONS:${NC}"
    echo "  -p, --port PORT    Start on custom frontend port"
    echo "  -f, --force        Force reinstall/restart without prompts"
    echo "  -y, --yes          Skip confirmation prompts"
    echo "  -h, --help         Show this help message"
    echo ""
    echo -e "${BOLD}QUICK START:${NC}"
    echo ""
    echo "  # Option A: Full isolated setup with nvm (recommended)"
    echo -e "  ${CYAN}./netviz.sh setup${NC}     # Installs nvm + Node.js v$NODE_VERSION (one-time)"
    echo -e "  ${CYAN}./netviz.sh deps${NC}      # Install npm + Python dependencies"
    echo -e "  ${CYAN}./netviz.sh start${NC}     # Start servers"
    echo ""
    echo "  # Option B: Quick start (if Node.js already installed)"
    echo -e "  ${CYAN}./netviz.sh install && ./netviz.sh deps && ./netviz.sh start${NC}"
    echo ""
    echo -e "${BOLD}RETURNING USERS:${NC}"
    echo -e "  ${CYAN}./netviz.sh start${NC}     # Auto-switches to correct Node version if nvm installed"
    echo ""
    echo -e "${BOLD}ENVIRONMENT VARIABLES:${NC}"
    echo "  NETVIZ_PORT       Frontend port (default: 9050)"
    echo "  NETVIZ_API_PORT   Backend API port (default: 9051)"
    echo ""
}

# =============================================================================
# Command: setup - First-time nvm + Node.js setup (isolated environment)
# =============================================================================
cmd_setup() {
    print_header "Setting Up Isolated Node.js Environment"
    
    # Reset counters
    INSTALLED_COUNT=0
    SKIPPED_COUNT=0
    FAILED_COUNT=0
    
    # -------------------------------------------------------------------------
    # Step 1: Install nvm
    # -------------------------------------------------------------------------
    print_step "1/4" "Installing nvm (Node Version Manager)"
    
    if nvm_installed && [ "$FORCE" != true ]; then
        NVM_VER=$(nvm --version 2>/dev/null)
        log_skip "nvm v$NVM_VER"
    else
        log_info "Downloading nvm v$NVM_VERSION..."
        curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh" 2>/dev/null | bash
        
        # Load nvm immediately
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        
        if nvm_installed; then
            log_ok "nvm v$(nvm --version) installed"
        else
            log_fail "nvm installation failed"
            echo ""
            echo -e "${YELLOW}Please restart your terminal and run this script again.${NC}"
            exit 1
        fi
    fi
    
    # -------------------------------------------------------------------------
    # Step 2: Install Node.js
    # -------------------------------------------------------------------------
    print_step "2/4" "Installing Node.js v$NODE_VERSION (LTS)"
    
    load_nvm
    
    if nvm ls "$NODE_VERSION" &>/dev/null && [ "$FORCE" != true ]; then
        nvm use "$NODE_VERSION" &>/dev/null
        log_skip "Node.js $(node --version)"
    else
        log_info "Installing Node.js v$NODE_VERSION..."
        nvm install "$NODE_VERSION" 2>/dev/null
        nvm use "$NODE_VERSION" 2>/dev/null
        nvm alias default "$NODE_VERSION" 2>/dev/null
        
        if cmd_exists node; then
            log_ok "Node.js $(node --version) installed"
            log_ok "npm $(npm --version) installed"
        else
            log_fail "Node.js installation failed"
            exit 1
        fi
    fi
    
    # -------------------------------------------------------------------------
    # Step 3: Create version files
    # -------------------------------------------------------------------------
    print_step "3/4" "Creating Version Pin Files"
    
    # Create .nvmrc
    if [ ! -f ".nvmrc" ] || [ "$FORCE" = true ]; then
        echo "$NODE_VERSION" > .nvmrc
        log_ok "Created .nvmrc (pins Node v$NODE_VERSION)"
    else
        log_skip ".nvmrc exists"
    fi
    
    # Create .node-version (for fnm, volta, nodenv compatibility)
    if [ ! -f ".node-version" ] || [ "$FORCE" = true ]; then
        echo "$NODE_VERSION" > .node-version
        log_ok "Created .node-version"
    else
        log_skip ".node-version exists"
    fi
    
    # -------------------------------------------------------------------------
    # Step 4: Check Python
    # -------------------------------------------------------------------------
    print_step "4/4" "Checking Python Environment"
    
    if cmd_exists python3 && python3 --version &>/dev/null; then
        log_ok "$(python3 --version 2>&1)"
    else
        log_warn "Python3 not found - run './netviz.sh install' to install"
    fi
    
    # Check uv
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    if cmd_exists uv; then
        log_ok "uv $(uv --version 2>/dev/null | head -1)"
    else
        log_info "uv not installed (optional - speeds up Python package installs)"
    fi
    
    # Summary
    echo ""
    print_header "Setup Summary"
    echo -e "  ${GREEN}Installed: $INSTALLED_COUNT${NC}"
    echo -e "  ${YELLOW}Skipped:   $SKIPPED_COUNT${NC}"
    [ $FAILED_COUNT -gt 0 ] && echo -e "  ${RED}Failed:    $FAILED_COUNT${NC}"
    
    if [ $FAILED_COUNT -eq 0 ]; then
        echo ""
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║     Isolated Node.js Environment Ready!                      ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${YELLOW}⚠ IMPORTANT: Restart your terminal or run:${NC}"
        echo -e "  ${CYAN}source ~/.zshrc${NC}  (or ~/.bashrc)"
        echo ""
        echo "Next steps:"
        echo -e "  ${CYAN}./netviz.sh deps${NC}     Install project dependencies"
        echo -e "  ${CYAN}./netviz.sh start${NC}    Start the application"
    fi
}

# =============================================================================
# Command: install - Install system requirements (Node.js, Python)
# =============================================================================
cmd_install() {
    print_header "Installing System Requirements"
    
    # Reset counters
    INSTALLED_COUNT=0
    SKIPPED_COUNT=0
    FAILED_COUNT=0
    
    # Detect OS
    OS=""
    OS_VERSION=""
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    elif [ "$(uname)" = "Darwin" ]; then
        OS="darwin"
    fi
    
    log_info "Detected OS: ${OS:-unknown} ${OS_VERSION:-}"
    log_info "Architecture: $(uname -m)"
    
    # -------------------------------------------------------------------------
    # Check/Install Node.js
    # -------------------------------------------------------------------------
    print_step "1/3" "Node.js"
    
    # First check if nvm is available
    if nvm_installed; then
        if nvm ls "$NODE_VERSION" &>/dev/null; then
            nvm use "$NODE_VERSION" &>/dev/null
            log_skip "Node.js $(node --version) (nvm-managed)"
        else
            log_info "Installing Node.js v$NODE_VERSION via nvm..."
            nvm install "$NODE_VERSION" 2>/dev/null
            nvm use "$NODE_VERSION" 2>/dev/null
            log_ok "Node.js $(node --version) installed (nvm)"
        fi
    elif cmd_exists node && node --version &>/dev/null; then
        NODE_VER=$(node --version)
        NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_MAJOR" -ge 18 ]; then
            log_skip "Node.js $NODE_VER (system)"
            log_info "Tip: Run './netviz.sh setup' for isolated nvm environment"
        else
            log_warn "Node.js $NODE_VER is outdated (need 18+)"
            NEED_NODE=true
        fi
    else
        log_info "Node.js not found, installing..."
        NEED_NODE=true
    fi
    
    if [ "${NEED_NODE:-false}" = true ]; then
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            log_info "Installing Node.js 20.x from NodeSource..."
            curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | sudo -E bash - >/dev/null 2>&1
            sudo apt-get install -y nodejs >/dev/null 2>&1
            if cmd_exists node && node --version &>/dev/null; then
                log_ok "Node.js $(node --version) installed"
            else
                log_fail "Node.js installation failed"
            fi
        elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
            sudo yum install -y nodejs >/dev/null 2>&1
            log_ok "Node.js installed (RHEL/CentOS)"
        elif [ "$OS" = "darwin" ]; then
            if cmd_exists brew; then
                brew install node >/dev/null 2>&1
                log_ok "Node.js installed (macOS/Homebrew)"
            else
                log_warn "Please install Node.js manually from https://nodejs.org"
                log_info "Or run './netviz.sh setup' to use nvm"
            fi
        else
            log_warn "Please install Node.js 18+ manually from https://nodejs.org"
            log_info "Or run './netviz.sh setup' to use nvm"
        fi
    fi
    
    # -------------------------------------------------------------------------
    # Check/Install Python
    # -------------------------------------------------------------------------
    print_step "2/3" "Python 3"
    
    if cmd_exists python3 && python3 --version &>/dev/null; then
        PYTHON_VER=$(python3 --version 2>&1)
        log_skip "$PYTHON_VER"
    else
        log_info "Python3 not found, installing..."
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            sudo apt-get update -qq >/dev/null 2>&1
            sudo apt-get install -y python3 python3-pip python3-venv >/dev/null 2>&1
            log_ok "Python3 installed"
        elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
            sudo yum install -y python3 python3-pip >/dev/null 2>&1
            log_ok "Python3 installed"
        elif [ "$OS" = "darwin" ]; then
            if cmd_exists brew; then
                brew install python@3.12 >/dev/null 2>&1
                log_ok "Python3 installed (macOS/Homebrew)"
            else
                log_warn "Please install Python 3.8+ manually"
            fi
        else
            log_warn "Please install Python 3.8+ manually"
        fi
    fi
    
    # -------------------------------------------------------------------------
    # Check/Install uv (fast pip alternative)
    # -------------------------------------------------------------------------
    print_step "3/3" "uv Package Manager (optional)"
    
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    
    if cmd_exists uv && uv --version &>/dev/null; then
        UV_VER=$(uv --version 2>/dev/null | head -1)
        log_skip "uv ($UV_VER)"
    else
        log_info "Installing uv (10-100x faster than pip)..."
        curl -LsSf https://astral.sh/uv/install.sh 2>/dev/null | sh >/dev/null 2>&1 || true
        export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
        if cmd_exists uv; then
            log_ok "uv installed"
        else
            log_info "uv not installed (will use pip)"
        fi
    fi
    
    # Summary
    echo ""
    print_header "Installation Summary"
    echo -e "  ${GREEN}Installed: $INSTALLED_COUNT${NC}"
    echo -e "  ${YELLOW}Skipped:   $SKIPPED_COUNT${NC}"
    [ $FAILED_COUNT -gt 0 ] && echo -e "  ${RED}Failed:    $FAILED_COUNT${NC}"
    
    if [ $FAILED_COUNT -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ System requirements ready!${NC}"
        echo ""
        echo "Next step:"
        echo -e "  ${CYAN}./netviz.sh deps${NC}    Install application dependencies"
    fi
}

# =============================================================================
# Command: deps - Install npm + Python dependencies (smart mode)
# =============================================================================
cmd_deps() {
    print_header "Installing Application Dependencies"
    
    # Reset counters
    INSTALLED_COUNT=0
    SKIPPED_COUNT=0
    FAILED_COUNT=0
    
    # -------------------------------------------------------------------------
    # Verify system dependencies first
    # -------------------------------------------------------------------------
    print_step "1/4" "Verifying System Dependencies"
    
    MISSING_DEPS=false
    
    # Try to use nvm-managed Node.js first
    if nvm_installed; then
        if nvm ls "$NODE_VERSION" &>/dev/null; then
            nvm use "$NODE_VERSION" &>/dev/null
            echo -e "${GREEN}  ✓ Node.js: $(node --version) (nvm-managed)${NC}"
        else
            echo -e "${YELLOW}  ○ Node.js v$NODE_VERSION not in nvm, checking system...${NC}"
            if ! cmd_exists node || ! node --version &>/dev/null; then
                echo -e "${RED}  ✗ Node.js not found${NC}"
                MISSING_DEPS=true
            else
                echo -e "${GREEN}  ✓ Node.js: $(node --version) (system)${NC}"
            fi
        fi
    elif cmd_exists node && node --version &>/dev/null; then
        echo -e "${GREEN}  ✓ Node.js: $(node --version) (system)${NC}"
    else
        echo -e "${RED}  ✗ Node.js not found${NC}"
        MISSING_DEPS=true
    fi
    
    if cmd_exists npm && npm --version &>/dev/null; then
        echo -e "${GREEN}  ✓ npm: $(npm --version)${NC}"
    else
        echo -e "${RED}  ✗ npm not found${NC}"
        MISSING_DEPS=true
    fi
    
    if cmd_exists python3 && python3 --version &>/dev/null; then
        echo -e "${GREEN}  ✓ $(python3 --version 2>&1)${NC}"
    else
        echo -e "${RED}  ✗ Python3 not found${NC}"
        MISSING_DEPS=true
    fi
    
    if [ "$MISSING_DEPS" = true ]; then
        echo ""
        echo -e "${RED}Missing system dependencies!${NC}"
        echo "Run: ./netviz.sh install"
        echo "Or:  ./netviz.sh setup (for isolated nvm environment)"
        exit 1
    fi
    
    # -------------------------------------------------------------------------
    # Frontend Dependencies (npm)
    # -------------------------------------------------------------------------
    print_step "2/4" "Frontend Dependencies (npm)"
    
    # Smart check: skip if node_modules exists and has enough packages
    if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ] && [ "$FORCE" != true ]; then
        PKG_COUNT=$(ls node_modules 2>/dev/null | wc -l | tr -d ' ')
        if [ "$PKG_COUNT" -gt 100 ]; then
            log_skip "node_modules up to date ($PKG_COUNT packages)"
        else
            log_info "node_modules incomplete, updating..."
            npm install --silent 2>/dev/null && log_ok "npm packages updated" || log_fail "npm install"
        fi
    else
        log_info "Installing npm packages..."
        [ "$FORCE" = true ] && rm -rf node_modules 2>/dev/null
        
        if npm install --silent 2>/dev/null; then
            PKG_COUNT=$(ls node_modules 2>/dev/null | wc -l | tr -d ' ')
            log_ok "npm packages installed ($PKG_COUNT packages)"
        else
            log_warn "Trying with --legacy-peer-deps..."
            if npm install --legacy-peer-deps --silent 2>/dev/null; then
                log_ok "npm packages installed (legacy mode)"
            else
                log_fail "npm install failed"
            fi
        fi
    fi
    
    # -------------------------------------------------------------------------
    # Backend Virtual Environment
    # -------------------------------------------------------------------------
    print_step "3/4" "Python Virtual Environment"
    
    cd "$BACKEND_DIR"
    
    if [ -d "venv" ] && [ -f "venv/bin/activate" ] && [ "$FORCE" != true ]; then
        log_skip "Virtual environment exists"
    else
        log_info "Creating virtual environment..."
        [ "$FORCE" = true ] && rm -rf venv 2>/dev/null
        
        export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
        if cmd_exists uv; then
            uv venv venv 2>/dev/null && log_ok "venv created (uv)" || {
                python3 -m venv venv && log_ok "venv created (fallback)"
            }
        else
            python3 -m venv venv && log_ok "venv created"
        fi
    fi
    
    # Activate venv
    source venv/bin/activate 2>/dev/null || {
        log_fail "Cannot activate venv"
        exit 1
    }
    
    # -------------------------------------------------------------------------
    # Backend Python Packages
    # -------------------------------------------------------------------------
    print_step "4/4" "Python Dependencies"
    
    # Smart check: verify core packages are installed
    NEED_INSTALL=false
    if ! check_python_pkg "fastapi" || ! check_python_pkg "uvicorn" || ! check_python_pkg "netmiko" || ! check_python_pkg "networkx"; then
        NEED_INSTALL=true
    fi
    
    if [ "$NEED_INSTALL" = true ] || [ "$FORCE" = true ]; then
        log_info "Installing Python packages..."
        
        export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
        PIP_SUCCESS=false
        
        # Try uv first (much faster)
        if cmd_exists uv; then
            if uv pip install -r requirements.txt --quiet 2>/dev/null; then
                if check_python_pkg "fastapi" && check_python_pkg "uvicorn" && check_python_pkg "netmiko"; then
                    PIP_SUCCESS=true
                    log_ok "Python packages installed (uv)"
                fi
            fi
        fi
        
        # Fallback to pip
        if [ "$PIP_SUCCESS" = false ]; then
            pip install --upgrade pip -q 2>/dev/null
            if pip install -r requirements.txt -q 2>/dev/null; then
                if check_python_pkg "fastapi" && check_python_pkg "uvicorn" && check_python_pkg "netmiko"; then
                    log_ok "Python packages installed (pip)"
                else
                    log_fail "Python packages verification failed"
                fi
            else
                log_fail "pip install failed"
            fi
        fi
    else
        log_skip "Python packages up to date"
    fi
    
    cd "$SCRIPT_DIR"
    
    # Summary
    echo ""
    print_header "Dependencies Summary"
    echo -e "  ${GREEN}Installed: $INSTALLED_COUNT${NC}"
    echo -e "  ${YELLOW}Skipped:   $SKIPPED_COUNT${NC}"
    [ $FAILED_COUNT -gt 0 ] && echo -e "  ${RED}Failed:    $FAILED_COUNT${NC}"
    
    if [ $FAILED_COUNT -eq 0 ]; then
        echo ""
        echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║    Dependencies Ready!                   ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
        echo ""
        echo "Next step:"
        echo -e "  ${CYAN}./netviz.sh start${NC}    Start the application"
    else
        exit 1
    fi
}

# =============================================================================
# Command: start - Start frontend and backend servers
# =============================================================================
cmd_start() {
    print_header "Starting NetViz OSPF Device Manager"
    
    # Try to use nvm-managed Node.js
    if nvm_installed; then
        if nvm ls "$NODE_VERSION" &>/dev/null; then
            nvm use "$NODE_VERSION" &>/dev/null
            log_info "Using Node.js $(node --version) (nvm-managed)"
        fi
    fi
    
    # Check if already running
    if port_in_use $BACKEND_PORT || port_in_use $FRONTEND_PORT; then
        if [ "$FORCE" = true ]; then
            log_warn "Stopping existing services..."
            cmd_stop quiet
            sleep 2
        else
            echo -e "${YELLOW}Services may already be running:${NC}"
            port_in_use $BACKEND_PORT && echo "  Backend on port $BACKEND_PORT: PID $(get_port_pid $BACKEND_PORT)"
            port_in_use $FRONTEND_PORT && echo "  Frontend on port $FRONTEND_PORT: PID $(get_port_pid $FRONTEND_PORT)"
            echo ""
            read -p "Stop and restart? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cmd_stop quiet
                sleep 2
            else
                echo "Aborted."
                exit 0
            fi
        fi
    fi
    
    mkdir -p "$LOGS_DIR"
    
    # -------------------------------------------------------------------------
    # Start Backend
    # -------------------------------------------------------------------------
    print_step "1/2" "Starting Backend (port $BACKEND_PORT)"
    
    cd "$BACKEND_DIR"
    
    if [ ! -f "venv/bin/activate" ]; then
        log_fail "Python venv not found. Run: ./netviz.sh deps"
        exit 1
    fi
    
    source venv/bin/activate 2>/dev/null
    
    nohup python3 server.py > "../$LOGS_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "../$PID_BACKEND"
    
    # Wait and verify
    sleep 3
    if kill -0 $BACKEND_PID 2>/dev/null; then
        # Check API health
        for i in 1 2 3 4 5; do
            if curl -s "http://localhost:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
                log_ok "Backend running (PID: $BACKEND_PID)"
                break
            fi
            sleep 1
        done
    else
        log_fail "Backend failed to start. Check $LOGS_DIR/backend.log"
        tail -10 "../$LOGS_DIR/backend.log" 2>/dev/null
        exit 1
    fi
    
    cd "$SCRIPT_DIR"
    
    # -------------------------------------------------------------------------
    # Start Frontend
    # -------------------------------------------------------------------------
    print_step "2/2" "Starting Frontend (port $FRONTEND_PORT)"
    
    if [ ! -d "node_modules" ]; then
        log_fail "node_modules not found. Run: ./netviz.sh deps"
        exit 1
    fi
    
    nohup npm run dev > "$LOGS_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$PID_FRONTEND"
    
    # Wait and verify
    sleep 4
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        log_ok "Frontend running (PID: $FRONTEND_PID)"
    else
        log_fail "Frontend failed to start. Check $LOGS_DIR/frontend.log"
        tail -10 "$LOGS_DIR/frontend.log" 2>/dev/null
        exit 1
    fi
    
    # Success message
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          Application Started Successfully!                   ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Frontend:  ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  Backend:   ${CYAN}http://localhost:$BACKEND_PORT${NC}"
    echo -e "  API Docs:  ${CYAN}http://localhost:$BACKEND_PORT/docs${NC}"
    echo ""
    echo "  Default credentials:"
    echo -e "    Username: ${GREEN}netviz_admin${NC}"
    echo -e "    Password: ${GREEN}V3ry\$trongAdm1n!2025${NC}"
    echo ""
    echo "  Logs: ./$LOGS_DIR/"
    echo ""
    echo -e "  To stop: ${YELLOW}./netviz.sh stop${NC}"
}

# =============================================================================
# Command: stop - Stop all servers
# =============================================================================
cmd_stop() {
    [ "$1" != "quiet" ] && print_header "Stopping Services"
    
    # Stop by PID file
    for pid_file in "$PID_BACKEND" "$PID_FRONTEND"; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file" 2>/dev/null)
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                [ "$1" != "quiet" ] && log_info "Stopping PID $pid..."
                kill "$pid" 2>/dev/null || true
                sleep 1
                kill -9 "$pid" 2>/dev/null || true
            fi
            rm -f "$pid_file"
        fi
    done
    
    # Also stop by port
    for port in $BACKEND_PORT $FRONTEND_PORT; do
        if port_in_use $port; then
            pid=$(get_port_pid $port)
            [ "$1" != "quiet" ] && log_info "Stopping process on port $port (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 1
            kill -9 "$pid" 2>/dev/null || true
        fi
    done
    
    [ "$1" != "quiet" ] && echo -e "\n${GREEN}✓ All services stopped${NC}"
    [ "$1" != "quiet" ] && echo -e "\nTo start: ${CYAN}./netviz.sh start${NC}"
}

# =============================================================================
# Command: restart - Restart all servers
# =============================================================================
cmd_restart() {
    print_header "Restarting Services"
    cmd_stop quiet
    sleep 2
    cmd_start
}

# =============================================================================
# Command: status - Show system and server status
# =============================================================================
cmd_status() {
    print_header "System Status"
    
    # System info
    echo ""
    echo -e "${BOLD}System:${NC}"
    show_node_status
    cmd_exists npm && echo -e "${GREEN}  ✓ npm: $(npm --version)${NC}" || echo -e "${RED}  ✗ npm: Not installed${NC}"
    cmd_exists python3 && echo -e "${GREEN}  ✓ Python: $(python3 --version 2>&1)${NC}" || echo -e "${RED}  ✗ Python: Not installed${NC}"
    
    # uv status
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    if cmd_exists uv; then
        echo -e "${GREEN}  ✓ uv: $(uv --version 2>/dev/null | head -1)${NC}"
    fi
    
    # Dependencies
    echo ""
    echo -e "${BOLD}Dependencies:${NC}"
    [ -d "node_modules" ] && echo -e "  Frontend: ${GREEN}✓ Installed ($(ls node_modules | wc -l | tr -d ' ') packages)${NC}" || echo -e "  Frontend: ${RED}✗ Not installed${NC}"
    [ -f "$BACKEND_DIR/venv/bin/activate" ] && echo -e "  Backend:  ${GREEN}✓ Installed (Python venv)${NC}" || echo -e "  Backend:  ${RED}✗ Not installed${NC}"
    
    # Services
    echo ""
    echo -e "${BOLD}Services:${NC}"
    if port_in_use $BACKEND_PORT; then
        echo -e "  Backend (port $BACKEND_PORT):  ${GREEN}● RUNNING${NC} (PID: $(get_port_pid $BACKEND_PORT))"
    else
        echo -e "  Backend (port $BACKEND_PORT):  ${RED}○ STOPPED${NC}"
    fi
    
    if port_in_use $FRONTEND_PORT; then
        echo -e "  Frontend (port $FRONTEND_PORT): ${GREEN}● RUNNING${NC} (PID: $(get_port_pid $FRONTEND_PORT))"
    else
        echo -e "  Frontend (port $FRONTEND_PORT): ${RED}○ STOPPED${NC}"
    fi
    
    # Version files
    echo ""
    echo -e "${BOLD}Version Files:${NC}"
    [ -f ".nvmrc" ] && echo -e "  .nvmrc:        ${GREEN}$(cat .nvmrc)${NC}" || echo -e "  .nvmrc:        ${YELLOW}Not found${NC}"
    [ -f ".node-version" ] && echo -e "  .node-version: ${GREEN}$(cat .node-version)${NC}" || echo -e "  .node-version: ${YELLOW}Not found${NC}"
    
    echo ""
}

# =============================================================================
# Command: clean - Clean build artifacts
# =============================================================================
cmd_clean() {
    print_header "Cleaning Build Artifacts"
    
    if [ "$FORCE" != true ]; then
        echo "This will remove:"
        echo "  - node_modules/"
        echo "  - backend/venv/"
        echo "  - logs/"
        echo "  - __pycache__/"
        echo ""
        read -p "Continue? (y/n): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
    fi
    
    cmd_stop quiet
    
    rm -rf node_modules && log_ok "Removed node_modules"
    rm -rf "$BACKEND_DIR/venv" && log_ok "Removed backend/venv"
    rm -rf "$LOGS_DIR" && log_ok "Removed logs"
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null && log_ok "Removed __pycache__"
    rm -f "$PID_BACKEND" "$PID_FRONTEND"
    
    echo -e "\n${GREEN}✓ Clean complete${NC}"
    echo -e "\nTo reinstall: ${CYAN}./netviz.sh deps${NC}"
}

# =============================================================================
# Command: build - Build for production
# =============================================================================
cmd_build() {
    print_header "Building for Production"
    
    # Use nvm if available
    if nvm_installed && nvm ls "$NODE_VERSION" &>/dev/null; then
        nvm use "$NODE_VERSION" &>/dev/null
    fi
    
    if [ ! -d "node_modules" ]; then
        log_fail "node_modules not found. Run: ./netviz.sh deps"
        exit 1
    fi
    
    log_info "Building frontend..."
    npm run build && log_ok "Frontend built" || log_fail "Build failed"
    
    echo -e "\n${GREEN}✓ Build complete${NC}"
    echo "Output: ./dist/"
}

# =============================================================================
# Command: logs - View logs
# =============================================================================
cmd_logs() {
    if [ "$FOLLOW" = true ]; then
        tail -f "$LOGS_DIR/backend.log" "$LOGS_DIR/frontend.log" 2>/dev/null
    else
        echo -e "${BOLD}=== Backend Logs ===${NC}"
        tail -50 "$LOGS_DIR/backend.log" 2>/dev/null || echo "No backend logs"
        echo ""
        echo -e "${BOLD}=== Frontend Logs ===${NC}"
        tail -50 "$LOGS_DIR/frontend.log" 2>/dev/null || echo "No frontend logs"
    fi
}

# =============================================================================
# Command: reset - Reset database/auth
# =============================================================================
cmd_reset() {
    print_header "Reset Options"
    
    echo "What would you like to reset?"
    echo "  1) Authentication state (login count, sessions)"
    echo "  2) Device database"
    echo "  3) Users database (recreates admin)"
    echo "  4) Everything (full factory reset)"
    echo "  5) Cancel"
    echo ""
    read -p "Choice [1-5]: " choice
    
    case $choice in
        1) ./reset.sh --auth ;;
        2) ./reset.sh --db ;;
        3) ./reset.sh --users ;;
        4) ./reset.sh --all ;;
        *) echo "Cancelled." ;;
    esac
}

# =============================================================================
# Main Entry Point
# =============================================================================
COMMAND=""
FORCE=false
FOLLOW=false
CUSTOM_PORT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        setup|install|deps|start|stop|restart|status|clean|build|logs|reset|help)
            COMMAND=$1
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -y|--yes)
            FORCE=true
            shift
            ;;
        -p|--port)
            CUSTOM_PORT=$2
            FRONTEND_PORT=$2
            shift 2
            ;;
        -h|--help)
            cmd_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use: ./netviz.sh --help"
            exit 1
            ;;
    esac
done

# Default to help if no command
if [ -z "$COMMAND" ]; then
    cmd_help
    exit 0
fi

# Execute command
case $COMMAND in
    setup)    cmd_setup ;;
    install)  cmd_install ;;
    deps)     cmd_deps ;;
    start)    cmd_start ;;
    stop)     cmd_stop ;;
    restart)  cmd_restart ;;
    status)   cmd_status ;;
    clean)    cmd_clean ;;
    build)    cmd_build ;;
    logs)     cmd_logs ;;
    reset)    cmd_reset ;;
    help)     cmd_help ;;
esac
