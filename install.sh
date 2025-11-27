#!/bin/bash
# NetMan OSPF Device Manager - Installation Script
# Installs all dependencies for frontend and backend

set -e

echo "=========================================="
echo "  NetMan OSPF Device Manager Installer"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3.9+ first."
    exit 1
fi

echo ""
echo "1. Installing Frontend Dependencies..."
echo "--------------------------------------"
npm install

echo ""
echo "2. Setting up Backend Python Environment..."
echo "--------------------------------------------"
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "3. Creating Default Configuration..."
echo "------------------------------------"
if [ ! -f ".env.local" ]; then
    cat > .env.local << 'EOF'
# NetMan OSPF Device Manager - Environment Configuration
# Copy this file to .env.local and modify as needed

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
    echo "Created default .env.local configuration file."
else
    echo ".env.local already exists, skipping."
fi

cd ..

echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "To start the application:"
echo "  ./start.sh"
echo ""
echo "To stop the application:"
echo "  ./stop.sh"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Access the application at:"
echo "  http://localhost:9050"
echo ""
