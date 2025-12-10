#!/bin/bash
# NetMan OSPF Device Manager - Start Script
# Starts both frontend and backend servers
#
# Usage:
#   ./start.sh           - Start with interactive prompts
#   ./start.sh --force   - Force restart without prompts (for automation)
#   ./start.sh -f        - Same as --force

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
FORCE_START=false
for arg in "$@"; do
    case $arg in
        --force|-f)
            FORCE_START=true
            ;;
    esac
done

# Auto-detect non-interactive mode (SSH, cron, scripts)
if [ ! -t 0 ]; then
    FORCE_START=true
fi

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  NetMan OSPF Device Manager - Starting${NC}"
echo -e "${BLUE}==========================================${NC}"

# Check if already running
BACKEND_PID=$(lsof -ti:9051 2>/dev/null || true)
FRONTEND_PID=$(lsof -ti:9050 2>/dev/null || true)

if [ -n "$BACKEND_PID" ] || [ -n "$FRONTEND_PID" ]; then
    echo -e "${YELLOW}Warning: Services may already be running.${NC}"
    echo "Backend PID on port 9051: $BACKEND_PID"
    echo "Frontend PID on port 9050: $FRONTEND_PID"
    echo ""

    if [ "$FORCE_START" = true ]; then
        echo -e "${CYAN}Force mode: Stopping existing services...${NC}"
        [ -n "$BACKEND_PID" ] && kill -9 $BACKEND_PID 2>/dev/null || true
        [ -n "$FRONTEND_PID" ] && kill -9 $FRONTEND_PID 2>/dev/null || true
        sleep 2
    else
        read -p "Stop existing services and start fresh? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Stopping existing services..."
            [ -n "$BACKEND_PID" ] && kill -9 $BACKEND_PID 2>/dev/null || true
            [ -n "$FRONTEND_PID" ] && kill -9 $FRONTEND_PID 2>/dev/null || true
            sleep 2
        else
            echo "Aborting start."
            exit 0
        fi
    fi
fi

# Create logs directory
mkdir -p logs

# =============================================================================
# Helper function: Retry with multiple attempts
# =============================================================================
retry_start() {
    local name=$1
    local max_attempts=$2
    local cmd=$3
    local check_cmd=$4
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        echo -e "  ${CYAN}Attempt $attempt/$max_attempts...${NC}"
        eval "$cmd"
        sleep 3

        if eval "$check_cmd"; then
            return 0
        fi

        echo -e "  ${YELLOW}$name not ready, retrying...${NC}"
        attempt=$((attempt + 1))
        sleep 2
    done

    return 1
}

# =============================================================================
# Backend Startup with Retry
# =============================================================================
echo ""
echo -e "${GREEN}1. Starting Backend Server (port 9051)...${NC}"
cd backend

# Check/create venv if missing
if [ ! -f "venv/bin/activate" ]; then
    echo -e "${YELLOW}  Python venv not found. Creating...${NC}"
    python3 -m venv venv 2>/dev/null || {
        echo -e "${YELLOW}  Trying with uv...${NC}"
        export PATH="$HOME/.local/bin:$PATH"
        uv venv venv 2>/dev/null
    }

    if [ -f "venv/bin/activate" ]; then
        echo -e "${GREEN}  ✓ Virtual environment created${NC}"
        source venv/bin/activate
        echo -e "${CYAN}  Installing Python packages...${NC}"
        export PATH="$HOME/.local/bin:$PATH"
        if command -v uv &> /dev/null; then
            uv pip install -r requirements.txt --quiet 2>/dev/null
        else
            pip install -r requirements.txt -q 2>/dev/null
        fi
    else
        echo -e "${RED}Error: Cannot create Python venv. Run ./install.sh first.${NC}"
        exit 1
    fi
else
    source venv/bin/activate 2>/dev/null || {
        echo -e "${RED}Error: Cannot activate venv. Run ./install.sh --force${NC}"
        exit 1
    }
fi

# Start backend with retry logic
MAX_BACKEND_ATTEMPTS=3
BACKEND_STARTED=false

for attempt in $(seq 1 $MAX_BACKEND_ATTEMPTS); do
    echo -e "  ${CYAN}Starting backend (attempt $attempt/$MAX_BACKEND_ATTEMPTS)...${NC}"

    # Kill any existing process on port 9051
    lsof -ti:9051 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 1

    nohup python3 server.py > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!

    # Wait and verify
    sleep 3

    if kill -0 $BACKEND_PID 2>/dev/null; then
        # Check if API is responding
        for i in 1 2 3 4 5; do
            if curl -s http://localhost:9051/api/health >/dev/null 2>&1; then
                BACKEND_STARTED=true
                break 2
            fi
            sleep 1
        done
    fi

    echo -e "  ${YELLOW}Backend not responding, retrying...${NC}"
    kill -9 $BACKEND_PID 2>/dev/null || true
    sleep 2
done

if [ "$BACKEND_STARTED" = false ]; then
    echo -e "${RED}Error: Backend failed to start after $MAX_BACKEND_ATTEMPTS attempts.${NC}"
    echo -e "${RED}Check logs/backend.log for details.${NC}"
    tail -20 ../logs/backend.log 2>/dev/null || true
    exit 1
fi

echo -e "  ${GREEN}✓ Backend running (PID: $BACKEND_PID)${NC}"
cd ..

# =============================================================================
# Frontend Startup with Retry
# =============================================================================
echo ""
echo -e "${GREEN}2. Starting Frontend Server (port 9050)...${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  node_modules not found. Installing...${NC}"
    npm install --silent 2>/dev/null || {
        echo -e "${RED}Error: npm install failed. Run ./install.sh first.${NC}"
        exit 1
    }
fi

MAX_FRONTEND_ATTEMPTS=3
FRONTEND_STARTED=false

for attempt in $(seq 1 $MAX_FRONTEND_ATTEMPTS); do
    echo -e "  ${CYAN}Starting frontend (attempt $attempt/$MAX_FRONTEND_ATTEMPTS)...${NC}"

    # Kill any existing process on port 9050
    lsof -ti:9050 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 1

    nohup npm run dev > logs/frontend.log 2>&1 &
    FRONTEND_PID=$!

    # Wait and verify
    sleep 4

    if kill -0 $FRONTEND_PID 2>/dev/null; then
        # Check if frontend is responding
        for i in 1 2 3 4 5; do
            if curl -s http://localhost:9050 >/dev/null 2>&1; then
                FRONTEND_STARTED=true
                break 2
            fi
            sleep 1
        done
    fi

    echo -e "  ${YELLOW}Frontend not responding, retrying...${NC}"
    kill -9 $FRONTEND_PID 2>/dev/null || true
    sleep 2
done

if [ "$FRONTEND_STARTED" = false ]; then
    echo -e "${RED}Error: Frontend failed to start after $MAX_FRONTEND_ATTEMPTS attempts.${NC}"
    echo -e "${RED}Check logs/frontend.log for details.${NC}"
    tail -20 logs/frontend.log 2>/dev/null || true
    exit 1
fi

echo -e "  ${GREEN}✓ Frontend running (PID: $FRONTEND_PID)${NC}"

# Save PIDs to file for stop script
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  Application Started Successfully!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "Backend:  ${BLUE}http://localhost:9051${NC} (PID: $BACKEND_PID)"
echo -e "Frontend: ${BLUE}http://localhost:9050${NC} (PID: $FRONTEND_PID)"
echo ""
echo "Logs available in: ./logs/"
echo "  - Backend:  logs/backend.log"
echo "  - Frontend: logs/frontend.log"
echo ""
echo -e "Default credentials:"
echo "  Username: netviz_admin"
echo "  Password: V3ry\$trongAdm1n!2025"
echo ""
echo -e "To stop: ${YELLOW}./stop.sh${NC}"
echo ""
