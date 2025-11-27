#!/bin/bash
# NetMan OSPF Device Manager - Installation Script
# Optimized for Ubuntu 24.04 LTS
# Usage: ./install.sh [--with-deps]

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

print_header() {
    echo -e "${BLUE}==========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}==========================================${NC}"
}

print_header "NetMan OSPF Device Manager Installer"

# Check if --with-deps flag is passed
INSTALL_DEPS=false
if [ "$1" == "--with-deps" ]; then
    INSTALL_DEPS=true
fi

# Detect OS
OS=""
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
fi

echo ""
echo -e "${CYAN}Detected OS: ${OS:-unknown}${NC}"

# Install system dependencies if requested
if [ "$INSTALL_DEPS" = true ]; then
    echo ""
    echo -e "${YELLOW}Installing system dependencies...${NC}"

    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        echo "Installing Node.js, Python, and dependencies for Ubuntu/Debian..."

        # Install Node.js 20.x
        if ! command -v node &> /dev/null; then
            echo "Installing Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi

        # Install Python and venv
        sudo apt-get update
        sudo apt-get install -y python3 python3-pip python3-venv git curl

    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        echo "Installing Node.js, Python for CentOS/RHEL/Fedora..."
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs python3 python3-pip git

    elif [ "$(uname)" = "Darwin" ]; then
        echo "macOS detected. Using Homebrew..."
        if command -v brew &> /dev/null; then
            brew install node python@3.11
        else
            echo -e "${RED}Homebrew not found. Install from https://brew.sh${NC}"
        fi
    fi
fi

# Check for Node.js
echo ""
echo "Checking system dependencies..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not found!${NC}"
    echo ""
    echo "Install on Ubuntu 24.04:"
    echo -e "${CYAN}  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -${NC}"
    echo -e "${CYAN}  sudo apt-get install -y nodejs${NC}"
    echo ""
    echo "Or run: ./install.sh --with-deps"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js: $NODE_VERSION${NC}"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm not found!${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ npm: $NPM_VERSION${NC}"

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 not found!${NC}"
    echo ""
    echo "Install on Ubuntu 24.04:"
    echo -e "${CYAN}  sudo apt-get install -y python3 python3-pip python3-venv${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✓ $PYTHON_VERSION${NC}"

echo ""
echo -e "${GREEN}All dependencies found!${NC}"

# Install frontend dependencies
echo ""
echo -e "${YELLOW}1. Installing Frontend Dependencies...${NC}"
echo "--------------------------------------"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install frontend dependencies!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# Setup Python virtual environment
echo ""
echo -e "${YELLOW}2. Setting up Backend Python Environment...${NC}"
echo "--------------------------------------------"
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate and install dependencies
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install backend dependencies!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Create default configuration
echo ""
echo -e "${YELLOW}3. Creating Default Configuration...${NC}"
echo "------------------------------------"
if [ ! -f ".env.local" ]; then
    cat > .env.local << 'EOF'
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
    echo -e "${GREEN}✓ Created .env.local with defaults${NC}"
else
    echo -e "${YELLOW}⚠ .env.local already exists, skipping${NC}"
fi

cd ..

# Create logs directory
mkdir -p logs

# Make scripts executable
chmod +x start.sh stop.sh restart.sh netman.py 2>/dev/null || true

echo ""
print_header "Installation Complete!"
echo ""
echo "Quick Start Commands:"
echo -e "  ${CYAN}./start.sh${NC}           - Start application (bash)"
echo -e "  ${CYAN}python3 netman.py start${NC} - Start application (python)"
echo ""
echo "Other Commands:"
echo -e "  ${CYAN}./stop.sh${NC}            - Stop application"
echo -e "  ${CYAN}./restart.sh${NC}         - Restart application"
echo -e "  ${CYAN}python3 netman.py status${NC} - Check status"
echo ""
echo "Default Credentials:"
echo -e "  Username: ${GREEN}admin${NC}"
echo -e "  Password: ${GREEN}admin123${NC}"
echo ""
echo "Access URLs:"
echo -e "  Frontend: ${CYAN}http://localhost:9050${NC}"
echo -e "  Backend:  ${CYAN}http://localhost:9051${NC}"
echo ""
