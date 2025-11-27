#!/bin/bash
# NetMan OSPF Device Manager - Restart Script
# Restarts both frontend and backend servers

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  NetMan OSPF Device Manager - Restarting${NC}"
echo -e "${BLUE}==========================================${NC}"

# Force stop without prompts
echo ""
echo "Stopping all services..."

# Kill by port to ensure clean shutdown
lsof -ti:9051 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:9050 2>/dev/null | xargs kill -9 2>/dev/null || true
rm -f .backend.pid .frontend.pid

sleep 2

# Now start
echo ""
echo "Starting services..."

# Create logs directory
mkdir -p logs

echo ""
echo -e "${GREEN}1. Starting Backend Server (port 9051)...${NC}"
cd backend
source venv/bin/activate 2>/dev/null || {
    echo -e "${RED}Error: Python venv not found. Run ./install.sh first.${NC}"
    exit 1
}
nohup python3 server.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
cd ..

sleep 3

# Verify backend
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Backend failed to start. Check logs/backend.log${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}2. Starting Frontend Server (port 9050)...${NC}"
nohup npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

sleep 3

# Verify frontend
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Frontend failed to start. Check logs/frontend.log${NC}"
    exit 1
fi

# Save PIDs
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  Application Restarted Successfully!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "Backend:  ${BLUE}http://localhost:9051${NC} (PID: $BACKEND_PID)"
echo -e "Frontend: ${BLUE}http://localhost:9050${NC} (PID: $FRONTEND_PID)"
echo ""
echo "Logs available in: ./logs/"
echo ""
