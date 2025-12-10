#!/bin/bash

################################################################################
# Remote Deployment and Testing Script
# OSPF Network Device Manager - Production Test on Remote Server
#
# Target Server: 172.16.39.172 (cisco/cisco)
# Jumphost: 172.16.39.173 (cisco/cisco)
# Test: Deploy, configure, and run automation on 10 devices
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REMOTE_SERVER="172.16.39.172"
REMOTE_USER="cisco"
REMOTE_PASS="cisco"
JUMPHOST="172.16.39.173"
JUMPHOST_USER="cisco"
JUMPHOST_PASS="cisco"
GITHUB_REPO="https://github.com/zumanm1/OSPF2-LL-DEVICE_MANAGER.git"
REMOTE_DIR="/home/cisco/OSPF-LL-DEVICE_MANAGER"
BACKEND_PORT=9050
FRONTEND_PORT=9051

# Log file
LOG_FILE="deployment_$(date +%Y%m%d_%H%M%S).log"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

################################################################################
# PHASE 1: Git Commit and Push
################################################################################
phase1_git_push() {
    log "═══════════════════════════════════════════════════════════════"
    log "PHASE 1: Git Commit and Push to GitHub"
    log "═══════════════════════════════════════════════════════════════"
    
    # Check git status
    log "Checking git status..."
    git status
    
    # Add all changes
    log "Adding all changes..."
    git add .
    
    # Commit with timestamp
    COMMIT_MSG="Deploy: Remote test deployment with E2E tests and jumphost config - $(date +'%Y-%m-%d %H:%M:%S')"
    log "Committing changes: $COMMIT_MSG"
    git commit -m "$COMMIT_MSG" || warn "No changes to commit or commit failed"
    
    # Push to GitHub
    log "Pushing to GitHub..."
    git push origin main || git push origin master || error "Git push failed"
    
    log "✅ Phase 1 Complete: Code pushed to GitHub"
}

################################################################################
# PHASE 2: SSH Connection Test
################################################################################
phase2_ssh_test() {
    log "═══════════════════════════════════════════════════════════════"
    log "PHASE 2: Testing SSH Connection to Remote Server"
    log "═══════════════════════════════════════════════════════════════"
    
    info "Target: $REMOTE_USER@$REMOTE_SERVER"
    
    # Test SSH connection
    log "Testing SSH connection..."
    sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
        "$REMOTE_USER@$REMOTE_SERVER" "echo 'SSH Connection Successful'; hostname; whoami" || \
        error "SSH connection failed to $REMOTE_SERVER"
    
    log "✅ Phase 2 Complete: SSH connection verified"
}

################################################################################
# PHASE 3: Clone Repository
################################################################################
phase3_clone_repo() {
    log "═══════════════════════════════════════════════════════════════"
    log "PHASE 3: Clone Repository on Remote Server"
    log "═══════════════════════════════════════════════════════════════"
    
    log "Cleaning up any existing deployment..."
    sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_SERVER" << 'ENDSSH'
        # Kill any running processes
        pkill -f "uvicorn server:app" || true
        pkill -f "vite preview" || true
        
        # Remove old directory
        rm -rf /home/cisco/OSPF-LL-DEVICE_MANAGER
        
        echo "Cleanup complete"
ENDSSH
    
    log "Cloning repository from GitHub..."
    sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_SERVER" << ENDSSH
        cd /home/cisco
        git clone $GITHUB_REPO || { echo "Git clone failed"; exit 1; }
        cd OSPF-LL-DEVICE_MANAGER
        echo "Repository cloned successfully"
        ls -la
ENDSSH
    
    log "✅ Phase 3 Complete: Repository cloned"
}

################################################################################
# PHASE 4: Install Python Dependencies
################################################################################
phase4_python_setup() {
    log "═══════════════════════════════════════════════════════════════"
    log "PHASE 4: Install Python Dependencies"
    log "═══════════════════════════════════════════════════════════════"
    
    log "Installing Python dependencies..."
    sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_SERVER" << 'ENDSSH'
        cd /home/cisco/OSPF-LL-DEVICE_MANAGER/backend
        
        # Check Python version
        python3 --version || { echo "Python3 not installed"; exit 1; }
        
        # Install pip if needed
        python3 -m pip --version || { echo "Installing pip..."; sudo apt-get install -y python3-pip; }
        
        # Install dependencies
        echo "Installing Python packages..."
        python3 -m pip install --user -r requirements.txt
        
        # Verify critical packages
        python3 -c "import fastapi; import netmiko; import paramiko; import cryptography; print('✅ All critical packages installed')"
        
        echo "Python dependencies installed successfully"
ENDSSH
    
    log "✅ Phase 4 Complete: Python dependencies installed"
}

################################################################################
# PHASE 5: Install Node Dependencies and Build
################################################################################
phase5_node_setup() {
    log "═══════════════════════════════════════════════════════════════"
    log "PHASE 5: Install Node Dependencies and Build Frontend"
    log "═══════════════════════════════════════════════════════════════"
    
    log "Installing Node dependencies and building..."
    sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_SERVER" << 'ENDSSH'
        cd /home/cisco/OSPF-LL-DEVICE_MANAGER
        
        # Check Node version
        node --version || { echo "Node.js not installed"; exit 1; }
        npm --version || { echo "NPM not installed"; exit 1; }
        
        # Install dependencies
        echo "Installing Node packages..."
        npm install
        
        # Build frontend
        echo "Building frontend..."
        npm run build
        
        # Verify build
        ls -la dist/ || { echo "Build failed - dist/ not created"; exit 1; }
        
        echo "Frontend built successfully"
ENDSSH
    
    log "✅ Phase 5 Complete: Frontend built"
}

################################################################################
# PHASE 6: Start Backend Server
################################################################################
phase6_start_backend() {
    log "═══════════════════════════════════════════════════════════════"
    log "PHASE 6: Start Backend Server"
    log "═══════════════════════════════════════════════════════════════"
    
    log "Starting backend server on port $BACKEND_PORT..."
    sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_SERVER" << ENDSSH
        cd /home/cisco/OSPF-LL-DEVICE_MANAGER/backend
        
        # Start backend in background
        nohup python3 -m uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT > backend.log 2>&1 &
        echo \$! > backend.pid
        
        # Wait for startup
        sleep 5
        
        # Verify backend is running
        curl -s http://localhost:$BACKEND_PORT/api/health || { echo "Backend health check failed"; exit 1; }
        
        echo "Backend server started successfully"
ENDSSH
    
    # Verify from local machine
    log "Verifying backend from local machine..."
    curl -s "http://$REMOTE_SERVER:$BACKEND_PORT/api/health" || warn "Cannot reach backend from local machine"
    
    log "✅ Phase 6 Complete: Backend server running"
}

################################################################################
# PHASE 7: Start Frontend Server
################################################################################
phase7_start_frontend() {
    log "═══════════════════════════════════════════════════════════════"
    log "PHASE 7: Start Frontend Server"
    log "═══════════════════════════════════════════════════════════════"
    
    log "Starting frontend server on port $FRONTEND_PORT..."
    sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_SERVER" << ENDSSH
        cd /home/cisco/OSPF-LL-DEVICE_MANAGER
        
        # Start frontend in background
        nohup npx vite preview --host 0.0.0.0 --port $FRONTEND_PORT > frontend.log 2>&1 &
        echo \$! > frontend.pid
        
        # Wait for startup
        sleep 5
        
        # Verify frontend is running
        curl -s -I http://localhost:$FRONTEND_PORT || { echo "Frontend health check failed"; exit 1; }
        
        echo "Frontend server started successfully"
ENDSSH
    
    # Verify from local machine
    log "Verifying frontend from local machine..."
    curl -s -I "http://$REMOTE_SERVER:$FRONTEND_PORT" || warn "Cannot reach frontend from local machine"
    
    log "✅ Phase 7 Complete: Frontend server running"
    info "Access UI at: http://$REMOTE_SERVER:$FRONTEND_PORT"
}

################################################################################
# PHASE 8: Display Access Information
################################################################################
phase8_access_info() {
    log "═══════════════════════════════════════════════════════════════"
    log "PHASE 8: Deployment Complete - Access Information"
    log "═══════════════════════════════════════════════════════════════"
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         DEPLOYMENT SUCCESSFUL                                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📍 Remote Server:${NC} $REMOTE_SERVER"
    echo -e "${BLUE}🌐 Frontend URL:${NC} http://$REMOTE_SERVER:$FRONTEND_PORT"
    echo -e "${BLUE}🔌 Backend URL:${NC} http://$REMOTE_SERVER:$BACKEND_PORT"
    echo ""
    echo -e "${YELLOW}🔐 Login Credentials:${NC}"
    echo -e "   Username: netviz_admin"
    echo -e "   Password: V3ry\$trongAdm1n!2025"
    echo ""
    echo -e "${YELLOW}🌉 Jumphost Configuration (to be set in UI):${NC}"
    echo -e "   Jumphost IP: $JUMPHOST"
    echo -e "   Username: $JUMPHOST_USER"
    echo -e "   Password: $JUMPHOST_PASS"
    echo -e "   Port: 22"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo -e "   1. Open browser: http://$REMOTE_SERVER:$FRONTEND_PORT"
    echo -e "   2. Login with netviz_admin/V3ry\$trongAdm1n!2025"
    echo -e "   3. Go to Settings → Configure Jumphost"
    echo -e "   4. Enter jumphost details: $JUMPHOST (cisco/cisco)"
    echo -e "   5. Go to Automation → Select 10 devices"
    echo -e "   6. Click 'Run Automation'"
    echo -e "   7. Monitor job progress"
    echo ""
    echo -e "${GREEN}✅ Deployment log saved to: $LOG_FILE${NC}"
    echo ""
}

################################################################################
# PHASE 9: Create Remote Management Script
################################################################################
phase9_create_management_script() {
    log "═══════════════════════════════════════════════════════════════"
    log "PHASE 9: Creating Remote Management Script"
    log "═══════════════════════════════════════════════════════════════"
    
    # Create management script on remote server
    sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_SERVER" << 'ENDSSH'
        cat > /home/cisco/OSPF-LL-DEVICE_MANAGER/manage.sh << 'EOF'
#!/bin/bash

# OSPF Device Manager - Management Script

case "$1" in
    start)
        echo "Starting services..."
        cd /home/cisco/OSPF-LL-DEVICE_MANAGER/backend
        nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 9050 > backend.log 2>&1 &
        echo $! > backend.pid
        
        cd /home/cisco/OSPF-LL-DEVICE_MANAGER
        nohup npx vite preview --host 0.0.0.0 --port 9051 > frontend.log 2>&1 &
        echo $! > frontend.pid
        
        echo "Services started"
        ;;
    
    stop)
        echo "Stopping services..."
        [ -f backend/backend.pid ] && kill $(cat backend/backend.pid) 2>/dev/null
        [ -f frontend.pid ] && kill $(cat frontend.pid) 2>/dev/null
        pkill -f "uvicorn server:app"
        pkill -f "vite preview"
        echo "Services stopped"
        ;;
    
    restart)
        $0 stop
        sleep 3
        $0 start
        ;;
    
    status)
        echo "Service Status:"
        echo "==============="
        
        if curl -s http://localhost:9050/api/health > /dev/null; then
            echo "✅ Backend: Running (port 9050)"
        else
            echo "❌ Backend: Not running"
        fi
        
        if curl -s -I http://localhost:9051 > /dev/null; then
            echo "✅ Frontend: Running (port 9051)"
        else
            echo "❌ Frontend: Not running"
        fi
        ;;
    
    logs)
        echo "=== Backend Logs ==="
        tail -n 50 backend/backend.log 2>/dev/null || echo "No backend logs"
        echo ""
        echo "=== Frontend Logs ==="
        tail -n 50 frontend.log 2>/dev/null || echo "No frontend logs"
        ;;
    
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
EOF

        chmod +x /home/cisco/OSPF-LL-DEVICE_MANAGER/manage.sh
        echo "Management script created: /home/cisco/OSPF-LL-DEVICE_MANAGER/manage.sh"
ENDSSH
    
    log "✅ Phase 9 Complete: Management script created"
}

################################################################################
# Main Execution
################################################################################
main() {
    log "╔══════════════════════════════════════════════════════════════════╗"
    log "║  OSPF Network Device Manager - Remote Deployment                 ║"
    log "║  Target: $REMOTE_SERVER                                          ║"
    log "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Check prerequisites
    command -v sshpass >/dev/null 2>&1 || error "sshpass not installed. Install with: sudo apt-get install sshpass"
    command -v git >/dev/null 2>&1 || error "git not installed"
    
    # Execute phases
    phase1_git_push
    echo ""
    
    phase2_ssh_test
    echo ""
    
    phase3_clone_repo
    echo ""
    
    phase4_python_setup
    echo ""
    
    phase5_node_setup
    echo ""
    
    phase6_start_backend
    echo ""
    
    phase7_start_frontend
    echo ""
    
    phase9_create_management_script
    echo ""
    
    phase8_access_info
    
    log "╔══════════════════════════════════════════════════════════════════╗"
    log "║  ALL PHASES COMPLETE - DEPLOYMENT SUCCESSFUL                     ║"
    log "╚══════════════════════════════════════════════════════════════════╝"
}

# Run main function
main "$@"
