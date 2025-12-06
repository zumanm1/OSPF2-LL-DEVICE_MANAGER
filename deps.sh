#!/bin/bash
# =============================================================================
# NetMan OSPF Device Manager - Dependencies Installation Script
# =============================================================================
# Installs npm and Python dependencies without system-level changes
#
# USAGE:
#   ./deps.sh              - Install all dependencies (smart mode)
#   ./deps.sh --force      - Force reinstall all dependencies
#   ./deps.sh --frontend   - Install only frontend (npm) dependencies
#   ./deps.sh --backend    - Install only backend (Python) dependencies
#
# This script is separate from install.sh for users who:
#   - Already have Node.js and Python installed
#   - Want to update dependencies without full reinstall
#   - Need to install frontend/backend deps separately
# =============================================================================

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

# =============================================================================
# Parse Arguments
# =============================================================================
FORCE_INSTALL=false
INSTALL_FRONTEND=true
INSTALL_BACKEND=true

for arg in "$@"; do
    case $arg in
        --force)
            FORCE_INSTALL=true
            ;;
        --frontend)
            INSTALL_FRONTEND=true
            INSTALL_BACKEND=false
            ;;
        --backend)
            INSTALL_FRONTEND=false
            INSTALL_BACKEND=true
            ;;
        --help|-h)
            echo ""
            echo "NetMan OSPF Device Manager - Dependencies Script"
            echo ""
            echo "Usage: ./deps.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force       Force reinstall all dependencies"
            echo "  --frontend    Install only frontend (npm) dependencies"
            echo "  --backend     Install only backend (Python) dependencies"
            echo "  --help, -h    Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deps.sh              # Install all dependencies (smart mode)"
            echo "  ./deps.sh --force      # Force reinstall everything"
            echo "  ./deps.sh --frontend   # Only npm packages"
            echo "  ./deps.sh --backend    # Only Python packages"
            echo ""
            exit 0
            ;;
    esac
done

print_header "NetMan OSPF Device Manager - Dependencies"
echo ""
echo -e "${CYAN}Mode: $([ "$FORCE_INSTALL" = true ] && echo 'FORCE' || echo 'SMART')${NC}"
echo -e "${CYAN}Frontend: $([ "$INSTALL_FRONTEND" = true ] && echo 'YES' || echo 'NO')${NC}"
echo -e "${CYAN}Backend: $([ "$INSTALL_BACKEND" = true ] && echo 'YES' || echo 'NO')${NC}"

# =============================================================================
# Verify System Dependencies
# =============================================================================
echo ""
echo -e "${CYAN}[1/4] Verifying system dependencies...${NC}"

MISSING_DEPS=false

# Check Node.js
if [ "$INSTALL_FRONTEND" = true ]; then
    if command -v node &> /dev/null && node --version &>/dev/null; then
        NODE_VER=$(node --version)
        echo -e "${GREEN}  ✓ Node.js: $NODE_VER${NC}"
    else
        echo -e "${RED}  ✗ Node.js not found or not working${NC}"
        MISSING_DEPS=true
    fi

    # Check npm
    if command -v npm &> /dev/null && npm --version &>/dev/null; then
        NPM_VER=$(npm --version)
        echo -e "${GREEN}  ✓ npm: $NPM_VER${NC}"
    else
        echo -e "${RED}  ✗ npm not found${NC}"
        MISSING_DEPS=true
    fi
fi

# Check Python
if [ "$INSTALL_BACKEND" = true ]; then
    if command -v python3 &> /dev/null && python3 --version &>/dev/null; then
        PYTHON_VER=$(python3 --version 2>&1)
        echo -e "${GREEN}  ✓ $PYTHON_VER${NC}"
    else
        echo -e "${RED}  ✗ Python3 not found${NC}"
        MISSING_DEPS=true
    fi
fi

if [ "$MISSING_DEPS" = true ]; then
    echo ""
    echo -e "${RED}Missing system dependencies!${NC}"
    echo "Run: ./install.sh --with-deps"
    exit 1
fi

# =============================================================================
# Frontend Dependencies (npm)
# =============================================================================
if [ "$INSTALL_FRONTEND" = true ]; then
    echo ""
    echo -e "${CYAN}[2/4] Frontend dependencies (npm)...${NC}"

    if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ] && [ "$FORCE_INSTALL" = false ]; then
        PKG_COUNT=$(ls node_modules 2>/dev/null | wc -l | tr -d ' ')
        if [ "$PKG_COUNT" -gt 100 ]; then
            log_skipped "node_modules up to date ($PKG_COUNT packages)"
        else
            echo "  Updating npm packages..."
            npm install --silent 2>/dev/null && log_installed "npm packages updated" || log_failed "npm install"
        fi
    else
        echo "  Installing npm packages..."
        rm -rf node_modules 2>/dev/null || true
        
        # Try npm install with retry
        NPM_SUCCESS=false
        for attempt in 1 2 3; do
            if [ $attempt -gt 1 ]; then
                echo -e "${YELLOW}  Retry $attempt/3...${NC}"
                rm -rf node_modules package-lock.json 2>/dev/null || true
                sleep 2
            fi
            
            if npm install --silent 2>/dev/null; then
                NPM_SUCCESS=true
                break
            fi
        done
        
        if [ "$NPM_SUCCESS" = true ]; then
            PKG_COUNT=$(ls node_modules 2>/dev/null | wc -l | tr -d ' ')
            log_installed "npm packages installed ($PKG_COUNT packages)"
        else
            # Fallback with legacy peer deps
            if npm install --legacy-peer-deps --silent 2>/dev/null; then
                log_installed "npm packages installed (legacy mode)"
            else
                log_failed "npm install failed"
            fi
        fi
    fi
else
    echo ""
    echo -e "${YELLOW}[2/4] Frontend dependencies - SKIPPED${NC}"
fi

# =============================================================================
# Backend Dependencies (Python)
# =============================================================================
if [ "$INSTALL_BACKEND" = true ]; then
    echo ""
    echo -e "${CYAN}[3/4] Backend dependencies (Python)...${NC}"

    cd backend

    # Check/create virtual environment
    if [ -d "venv" ] && [ -f "venv/bin/activate" ] && [ "$FORCE_INSTALL" = false ]; then
        log_skipped "Virtual environment exists"
    else
        echo "  Creating virtual environment..."
        rm -rf venv 2>/dev/null || true
        
        # Try uv first (faster), fallback to python3 -m venv
        export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
        if command -v uv &> /dev/null; then
            uv venv venv 2>/dev/null && log_installed "Virtual environment created (uv)" || {
                python3 -m venv venv && log_installed "Virtual environment created (fallback)"
            }
        else
            python3 -m venv venv && log_installed "Virtual environment created"
        fi
    fi

    # Activate venv
    source venv/bin/activate 2>/dev/null || {
        echo -e "${RED}  Error: Cannot activate venv${NC}"
        exit 1
    }

    # Install Python packages
    check_pip_package() {
        python3 -c "import $1" 2>/dev/null
        return $?
    }

    NEED_INSTALL=false
    if ! check_pip_package "fastapi" || ! check_pip_package "netmiko" || ! check_pip_package "uvicorn"; then
        NEED_INSTALL=true
    fi

    if [ "$NEED_INSTALL" = true ] || [ "$FORCE_INSTALL" = true ]; then
        echo "  Installing Python packages..."
        
        # Try uv pip first (10-100x faster)
        export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
        PIP_SUCCESS=false
        
        if command -v uv &> /dev/null; then
            if uv pip install -r requirements.txt --quiet 2>/dev/null; then
                if python3 -c "import fastapi, uvicorn, netmiko" 2>/dev/null; then
                    PIP_SUCCESS=true
                    log_installed "Python packages installed (uv)"
                fi
            fi
        fi
        
        # Fallback to pip
        if [ "$PIP_SUCCESS" = false ]; then
            pip install --upgrade pip -q 2>/dev/null
            if pip install -r requirements.txt -q 2>/dev/null; then
                if python3 -c "import fastapi, uvicorn, netmiko" 2>/dev/null; then
                    log_installed "Python packages installed (pip)"
                else
                    log_failed "Python packages verification failed"
                fi
            else
                log_failed "pip install failed"
            fi
        fi
    else
        log_skipped "Python packages up to date"
    fi

    cd ..
else
    echo ""
    echo -e "${YELLOW}[3/4] Backend dependencies - SKIPPED${NC}"
fi

# =============================================================================
# Validation
# =============================================================================
echo ""
echo -e "${CYAN}[4/4] Validation...${NC}"

VALIDATION_PASSED=true

# Validate frontend
if [ "$INSTALL_FRONTEND" = true ]; then
    if [ -d "node_modules" ] && [ $(ls node_modules 2>/dev/null | wc -l) -gt 100 ]; then
        echo -e "${GREEN}  ✓ Frontend: OK${NC}"
    else
        echo -e "${RED}  ✗ Frontend: MISSING${NC}"
        VALIDATION_PASSED=false
    fi
fi

# Validate backend
if [ "$INSTALL_BACKEND" = true ]; then
    if [ -f "backend/venv/bin/activate" ]; then
        source backend/venv/bin/activate 2>/dev/null
        if python3 -c "import fastapi, uvicorn, netmiko" 2>/dev/null; then
            echo -e "${GREEN}  ✓ Backend: OK${NC}"
        else
            echo -e "${RED}  ✗ Backend packages: MISSING${NC}"
            VALIDATION_PASSED=false
        fi
    else
        echo -e "${RED}  ✗ Backend venv: MISSING${NC}"
        VALIDATION_PASSED=false
    fi
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
print_header "Summary"
echo ""
echo -e "  ${GREEN}Installed: $INSTALLED_COUNT${NC}"
echo -e "  ${YELLOW}Skipped:   $SKIPPED_COUNT${NC}"
if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "  ${RED}Failed:    $FAILED_COUNT${NC}"
fi

if [ "$VALIDATION_PASSED" = true ]; then
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║    Dependencies Installed Successfully!  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next step:"
    echo -e "  ${CYAN}./start.sh${NC}    Start the application"
    echo ""
else
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  Some dependencies failed - check errors ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
    exit 1
fi



