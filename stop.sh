#!/bin/bash
# NetMan OSPF Device Manager - Stop Script
# Stops both frontend and backend servers

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  NetMan OSPF Device Manager - Stopping${NC}"
echo -e "${BLUE}==========================================${NC}"

# Function to stop process by PID file
stop_by_pid_file() {
    local pid_file=$1
    local name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo -e "Stopping $name (PID: $pid)..."
            kill $pid 2>/dev/null || true
            sleep 1
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                kill -9 $pid 2>/dev/null || true
            fi
            echo -e "${GREEN}  $name stopped.${NC}"
        else
            echo -e "${YELLOW}  $name was not running (stale PID file).${NC}"
        fi
        rm -f "$pid_file"
    fi
}

# Function to stop process by port
stop_by_port() {
    local port=$1
    local name=$2

    local pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "Stopping $name on port $port (PIDs: $pids)..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}  $name stopped.${NC}"
    else
        echo -e "${YELLOW}  $name not running on port $port.${NC}"
    fi
}

echo ""

# Stop using PID files first
stop_by_pid_file ".backend.pid" "Backend"
stop_by_pid_file ".frontend.pid" "Frontend"

# Also ensure nothing is running on the ports
echo ""
echo "Ensuring ports are free..."
stop_by_port 9051 "Backend"
stop_by_port 9050 "Frontend"

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  All Services Stopped${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "To start again: ${YELLOW}./start.sh${NC}"
echo ""
