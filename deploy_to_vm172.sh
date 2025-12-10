#!/bin/bash

# ============================================================================
# OSPF Network Device Manager - VM172 Deployment Script
# ============================================================================
# This script automates deployment to VM172 (172.16.39.172)
# Run from your MacBook: ./deploy_to_vm172.sh
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VM_USER="cisco"
VM_HOST="172.16.39.172"
VM_PATH="/home/cisco/OSPF-LL-DEVICE_MANAGER"
LOCAL_PATH="$(pwd)"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}OSPF Network Device Manager - VM172 Deployment${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Function to print colored messages
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if VM is reachable
print_step "Testing connection to VM172..."
if ping -c 2 $VM_HOST > /dev/null 2>&1; then
    print_info "✅ VM172 is reachable"
else
    print_error "❌ Cannot reach VM172 at $VM_HOST"
    exit 1
fi

# Test SSH connection
print_step "Testing SSH connection..."
if ssh -o ConnectTimeout=5 -o BatchMode=yes $VM_USER@$VM_HOST exit 2>/dev/null; then
    print_info "✅ SSH connection successful"
else
    print_warning "⚠️  SSH key authentication not configured"
    print_info "You will need to enter password for each step"
    echo ""
    read -p "Continue with password authentication? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Sync code to VM172
print_step "Syncing code to VM172..."
rsync -avz --exclude 'node_modules' \
           --exclude 'backend/venv' \
           --exclude 'backend/__pycache__' \
           --exclude 'backend/**/__pycache__' \
           --exclude '.git' \
           --exclude 'logs' \
           --exclude 'backend/data/executions/*' \
           --exclude 'backend/*.db' \
           --progress \
           $LOCAL_PATH/ $VM_USER@$VM_HOST:$VM_PATH/

if [ $? -eq 0 ]; then
    print_info "✅ Code synced successfully"
else
    print_error "❌ Code sync failed"
    exit 1
fi

# Run remote setup commands
print_step "Running setup on VM172..."

ssh $VM_USER@$VM_HOST << 'ENDSSH'
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd ~/OSPF-LL-DEVICE_MANAGER

echo -e "${GREEN}[REMOTE]${NC} Installing dependencies..."

# Make scripts executable
chmod +x install.sh start.sh stop.sh restart.sh

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Python 3 is not installed"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed"
    exit 1
fi

# Stop any running instances
echo -e "${BLUE}[INFO]${NC} Stopping any running instances..."
./stop.sh || true

# Install dependencies
echo -e "${BLUE}[INFO]${NC} Running install script..."
./install.sh

# Install production dependencies (encryption + rate limiting)
echo -e "${BLUE}[INFO]${NC} Installing production dependencies..."
cd backend
source venv/bin/activate
pip install cryptography==41.0.7 slowapi==0.1.9
deactivate
cd ..

# Check if .env.local exists, if not create from template
if [ ! -f backend/.env.local ]; then
    echo -e "${YELLOW}[WARN]${NC} No .env.local found, creating from defaults..."
    cat > backend/.env.local << 'ENVFILE'
# Application Security
SECURITY_ENABLED=true
APP_ADMIN_USERNAME=netviz_admin
APP_ADMIN_PASSWORD=V3ry$trongAdm1n!2025
MAX_LOGIN_USES=10000

# Network Access
LOCALHOST_ONLY=false
ALLOWED_HOSTS=172.16.39.172,127.0.0.1,localhost

# CORS Configuration
CORS_ORIGINS=http://172.16.39.172:9050,http://localhost:9050

# Session Configuration
SESSION_TIMEOUT=3600
ENVFILE
    echo -e "${GREEN}[INFO]${NC} Created default .env.local - please update password!"
fi

# Test encryption module
echo -e "${BLUE}[INFO]${NC} Testing encryption module..."
cd backend
source venv/bin/activate
python -m modules.device_encryption
deactivate
cd ..

echo -e "${GREEN}[SUCCESS]${NC} Setup completed on VM172!"
echo -e "${YELLOW}[NEXT]${NC} To start the application, run: ssh $VM_USER@$VM_HOST 'cd ~/OSPF-LL-DEVICE_MANAGER && ./start.sh'"

ENDSSH

if [ $? -eq 0 ]; then
    print_info "✅ Remote setup completed successfully"
else
    print_error "❌ Remote setup failed"
    exit 1
fi

echo ""
print_step "Deployment Summary:"
echo -e "  ${GREEN}✅${NC} Code synced to VM172"
echo -e "  ${GREEN}✅${NC} Dependencies installed"
echo -e "  ${GREEN}✅${NC} Encryption module tested"
echo -e "  ${GREEN}✅${NC} Configuration created"
echo ""
print_info "Next steps:"
echo "  1. SSH to VM172: ${BLUE}ssh $VM_USER@$VM_HOST${NC}"
echo "  2. Edit configuration: ${BLUE}nano $VM_PATH/backend/.env.local${NC}"
echo "  3. Start application: ${BLUE}cd $VM_PATH && ./start.sh${NC}"
echo "  4. Access from browser: ${BLUE}http://$VM_HOST:9050${NC}"
echo ""
print_info "Optional: Migrate existing passwords"
echo "  ${BLUE}ssh $VM_USER@$VM_HOST 'cd $VM_PATH && python migrate_passwords.py --dry-run'${NC}"
echo "  ${BLUE}ssh $VM_USER@$VM_HOST 'cd $VM_PATH && python migrate_passwords.py'${NC}"
echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}============================================================================${NC}"
