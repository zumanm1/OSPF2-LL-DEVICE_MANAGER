#!/bin/bash
# =============================================================================
# NetViz OSPF Device Manager - NVM Setup Script
# =============================================================================
# Sets up an isolated Node.js environment using nvm (Node Version Manager)
# This ensures the project uses a consistent Node.js version regardless of
# what's installed system-wide.
#
# USAGE:
#   ./setup-nvm.sh           # Interactive setup
#   ./setup-nvm.sh --force   # Force reinstall nvm and Node.js
#   ./setup-nvm.sh --check   # Check current status only
#
# WHAT THIS DOES:
#   1. Installs nvm (Node Version Manager) if not present
#   2. Installs Node.js v20 LTS (isolated from system Node.js)
#   3. Creates .nvmrc file for automatic version switching
#   4. Configures shell for nvm auto-loading
#
# BENEFITS:
#   - Isolated Node.js version per project
#   - No conflicts with system Node.js
#   - Automatic version switching when entering project directory
#   - Easy upgrades and rollbacks
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Node.js version to install
NODE_VERSION="20"
NVM_VERSION="0.40.1"

print_banner() {
    echo -e "${MAGENTA}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║     ███╗   ██╗██╗   ██╗███╗   ███╗                            ║"
    echo "║     ████╗  ██║██║   ██║████╗ ████║                            ║"
    echo "║     ██╔██╗ ██║██║   ██║██╔████╔██║                            ║"
    echo "║     ██║╚██╗██║╚██╗ ██╔╝██║╚██╔╝██║                            ║"
    echo "║     ██║ ╚████║ ╚████╔╝ ██║ ╚═╝ ██║                            ║"
    echo "║     ╚═╝  ╚═══╝  ╚═══╝  ╚═╝     ╚═╝                            ║"
    echo "║                                                                ║"
    echo "║         Node Version Manager Setup for NetViz                  ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_header() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
}

log_ok() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

log_skip() {
    echo -e "${YELLOW}  ○ $1 (already installed)${NC}"
}

log_fail() {
    echo -e "${RED}  ✗ $1${NC}"
}

log_info() {
    echo -e "${CYAN}  ℹ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

# =============================================================================
# Parse Arguments
# =============================================================================
FORCE_INSTALL=false
CHECK_ONLY=false

for arg in "$@"; do
    case $arg in
        --force|-f)
            FORCE_INSTALL=true
            ;;
        --check|-c)
            CHECK_ONLY=true
            ;;
        --help|-h)
            echo ""
            echo "NetViz OSPF Device Manager - NVM Setup Script"
            echo ""
            echo "Usage: ./setup-nvm.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force, -f    Force reinstall nvm and Node.js"
            echo "  --check, -c    Check current status only (no installation)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./setup-nvm.sh              # Interactive setup"
            echo "  ./setup-nvm.sh --force      # Force reinstall"
            echo "  ./setup-nvm.sh --check      # Status check only"
            echo ""
            exit 0
            ;;
    esac
done

# =============================================================================
# Detect Shell
# =============================================================================
detect_shell() {
    if [ -n "$ZSH_VERSION" ]; then
        echo "zsh"
    elif [ -n "$BASH_VERSION" ]; then
        echo "bash"
    else
        basename "$SHELL"
    fi
}

get_shell_rc() {
    local shell_type=$(detect_shell)
    case $shell_type in
        zsh)
            echo "$HOME/.zshrc"
            ;;
        bash)
            if [ -f "$HOME/.bash_profile" ]; then
                echo "$HOME/.bash_profile"
            else
                echo "$HOME/.bashrc"
            fi
            ;;
        *)
            echo "$HOME/.profile"
            ;;
    esac
}

# =============================================================================
# Load nvm if available
# =============================================================================
load_nvm() {
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        . "$NVM_DIR/nvm.sh"
        return 0
    fi
    return 1
}

# =============================================================================
# Check Status
# =============================================================================
check_status() {
    print_header "Current Environment Status"
    
    echo ""
    echo -e "${BOLD}NVM:${NC}"
    if load_nvm 2>/dev/null && command -v nvm &>/dev/null; then
        NVM_VER=$(nvm --version 2>/dev/null || echo "unknown")
        echo -e "  ${GREEN}✓ Installed: v$NVM_VER${NC}"
        echo -e "  ${CYAN}  Location: $NVM_DIR${NC}"
    else
        echo -e "  ${RED}✗ Not installed${NC}"
    fi
    
    echo ""
    echo -e "${BOLD}Node.js:${NC}"
    if command -v node &>/dev/null; then
        NODE_VER=$(node --version 2>/dev/null || echo "error")
        NODE_PATH=$(which node 2>/dev/null || echo "unknown")
        echo -e "  ${GREEN}✓ Version: $NODE_VER${NC}"
        echo -e "  ${CYAN}  Path: $NODE_PATH${NC}"
        
        # Check if using nvm-managed Node
        if [[ "$NODE_PATH" == *".nvm"* ]]; then
            echo -e "  ${GREEN}  ✓ Using nvm-managed Node.js${NC}"
        else
            echo -e "  ${YELLOW}  ○ Using system Node.js (not nvm)${NC}"
        fi
    else
        echo -e "  ${RED}✗ Not installed${NC}"
    fi
    
    echo ""
    echo -e "${BOLD}npm:${NC}"
    if command -v npm &>/dev/null; then
        NPM_VER=$(npm --version 2>/dev/null || echo "error")
        echo -e "  ${GREEN}✓ Version: $NPM_VER${NC}"
    else
        echo -e "  ${RED}✗ Not installed${NC}"
    fi
    
    echo ""
    echo -e "${BOLD}Project Files:${NC}"
    if [ -f ".nvmrc" ]; then
        echo -e "  ${GREEN}✓ .nvmrc: $(cat .nvmrc)${NC}"
    else
        echo -e "  ${YELLOW}○ .nvmrc: Not found${NC}"
    fi
    
    if [ -f ".node-version" ]; then
        echo -e "  ${GREEN}✓ .node-version: $(cat .node-version)${NC}"
    else
        echo -e "  ${YELLOW}○ .node-version: Not found${NC}"
    fi
    
    echo ""
}

# =============================================================================
# Main Setup
# =============================================================================
print_banner

if [ "$CHECK_ONLY" = true ]; then
    check_status
    exit 0
fi

# =============================================================================
# Step 1: Install nvm
# =============================================================================
print_header "Step 1: Installing nvm (Node Version Manager)"

NVM_INSTALLED=false
if load_nvm 2>/dev/null && command -v nvm &>/dev/null; then
    if [ "$FORCE_INSTALL" = true ]; then
        log_warn "Force reinstall requested"
    else
        NVM_VER=$(nvm --version 2>/dev/null)
        log_skip "nvm v$NVM_VER"
        NVM_INSTALLED=true
    fi
fi

if [ "$NVM_INSTALLED" = false ]; then
    log_info "Downloading and installing nvm v$NVM_VERSION..."
    
    # Download and install nvm
    curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh" 2>/dev/null | bash
    
    # Load nvm immediately
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    
    if command -v nvm &>/dev/null; then
        log_ok "nvm v$(nvm --version) installed"
    else
        log_fail "nvm installation failed"
        echo ""
        echo -e "${RED}Please restart your terminal and run this script again.${NC}"
        exit 1
    fi
fi

# =============================================================================
# Step 2: Install Node.js
# =============================================================================
print_header "Step 2: Installing Node.js v$NODE_VERSION (LTS)"

# Ensure nvm is loaded
load_nvm

CURRENT_NODE=""
if command -v node &>/dev/null; then
    CURRENT_NODE=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
fi

if [ "$CURRENT_NODE" = "$NODE_VERSION" ] && [ "$FORCE_INSTALL" = false ]; then
    log_skip "Node.js v$NODE_VERSION already installed"
else
    log_info "Installing Node.js v$NODE_VERSION..."
    
    nvm install $NODE_VERSION 2>/dev/null
    nvm use $NODE_VERSION 2>/dev/null
    nvm alias default $NODE_VERSION 2>/dev/null
    
    if command -v node &>/dev/null; then
        log_ok "Node.js $(node --version) installed"
        log_ok "npm $(npm --version) installed"
    else
        log_fail "Node.js installation failed"
        exit 1
    fi
fi

# =============================================================================
# Step 3: Create Version Files
# =============================================================================
print_header "Step 3: Creating Version Pin Files"

# Create .nvmrc
if [ ! -f ".nvmrc" ] || [ "$FORCE_INSTALL" = true ]; then
    echo "$NODE_VERSION" > .nvmrc
    log_ok "Created .nvmrc (pins Node v$NODE_VERSION)"
else
    log_skip ".nvmrc exists"
fi

# Create .node-version (for fnm, volta, nodenv compatibility)
if [ ! -f ".node-version" ] || [ "$FORCE_INSTALL" = true ]; then
    echo "$NODE_VERSION" > .node-version
    log_ok "Created .node-version (fnm/volta/nodenv compatibility)"
else
    log_skip ".node-version exists"
fi

# =============================================================================
# Step 4: Configure Shell
# =============================================================================
print_header "Step 4: Configuring Shell"

SHELL_RC=$(get_shell_rc)
SHELL_TYPE=$(detect_shell)

log_info "Detected shell: $SHELL_TYPE"
log_info "RC file: $SHELL_RC"

# Check if nvm is already in shell config
if grep -q 'NVM_DIR' "$SHELL_RC" 2>/dev/null; then
    log_skip "nvm already configured in $SHELL_RC"
else
    log_info "Adding nvm configuration to $SHELL_RC..."
    
    cat >> "$SHELL_RC" << 'EOF'

# nvm (Node Version Manager) - Added by NetViz setup
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF
    
    log_ok "nvm configuration added to $SHELL_RC"
fi

# Add auto-switching for zsh
if [ "$SHELL_TYPE" = "zsh" ]; then
    if ! grep -q 'load-nvmrc' "$SHELL_RC" 2>/dev/null; then
        log_info "Adding auto-switching hook for zsh..."
        
        cat >> "$SHELL_RC" << 'EOF'

# Auto-switch Node version when entering directory with .nvmrc
autoload -U add-zsh-hook 2>/dev/null
load-nvmrc() {
  local nvmrc_path="$(nvm_find_nvmrc 2>/dev/null)"
  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")" 2>/dev/null)
    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install 2>/dev/null
    elif [ "$nvmrc_node_version" != "$(nvm version 2>/dev/null)" ]; then
      nvm use 2>/dev/null
    fi
  fi
}
add-zsh-hook chpwd load-nvmrc 2>/dev/null
load-nvmrc 2>/dev/null
EOF
        
        log_ok "Auto-switching hook added for zsh"
    else
        log_skip "Auto-switching already configured"
    fi
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
print_header "Setup Complete!"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          NVM Setup Completed Successfully!                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Installed:${NC}"
echo -e "  nvm:     ${GREEN}v$(nvm --version 2>/dev/null || echo 'N/A')${NC}"
echo -e "  Node.js: ${GREEN}$(node --version 2>/dev/null || echo 'N/A')${NC}"
echo -e "  npm:     ${GREEN}$(npm --version 2>/dev/null || echo 'N/A')${NC}"
echo ""
echo -e "${BOLD}Version Files:${NC}"
echo -e "  .nvmrc:        ${CYAN}$NODE_VERSION${NC}"
echo -e "  .node-version: ${CYAN}$NODE_VERSION${NC}"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Restart your terminal or run:${NC}"
echo -e "  ${CYAN}source $SHELL_RC${NC}"
echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo -e "  ${CYAN}./netviz.sh deps${NC}     Install project dependencies"
echo -e "  ${CYAN}./netviz.sh start${NC}    Start the application"
echo ""
echo -e "${BOLD}Usage in this project:${NC}"
echo -e "  ${CYAN}nvm use${NC}              Switch to project's Node version"
echo -e "  ${CYAN}nvm list${NC}             List installed Node versions"
echo -e "  ${CYAN}nvm install 22${NC}       Install a different version"
echo ""

