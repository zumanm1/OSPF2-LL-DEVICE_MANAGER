#!/bin/bash
# NetMan OSPF Device Manager - Reset Script
# Resets the database and authentication state

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}==========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}==========================================${NC}"
}

print_header "NetMan OSPF Device Manager - Reset"

# Parse arguments
RESET_DB=false
RESET_AUTH=false
RESET_ALL=false
RESET_USERS=false

if [ $# -eq 0 ]; then
    echo ""
    echo "Usage: ./reset.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --db       Reset device database only"
    echo "  --auth     Reset authentication (login count, sessions)"
    echo "  --users    Reset users database (recreates admin)"
    echo "  --all      Reset everything (full factory reset)"
    echo ""
    echo "Examples:"
    echo "  ./reset.sh --auth     # Reset login count when password expired"
    echo "  ./reset.sh --db       # Clear all devices"
    echo "  ./reset.sh --all      # Full reset"
    exit 0
fi

for arg in "$@"; do
    case $arg in
        --db)
            RESET_DB=true
            ;;
        --auth)
            RESET_AUTH=true
            ;;
        --users)
            RESET_USERS=true
            ;;
        --all)
            RESET_ALL=true
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            exit 1
            ;;
    esac
done

# Confirm reset
echo ""
echo -e "${YELLOW}WARNING: This will delete data!${NC}"
echo ""
if [ "$RESET_ALL" = true ]; then
    echo "  - Device database"
    echo "  - User database"
    echo "  - Authentication state"
    echo "  - Session data"
    echo "  - Logs"
else
    [ "$RESET_DB" = true ] && echo "  - Device database"
    [ "$RESET_AUTH" = true ] && echo "  - Authentication state (login count, sessions)"
    [ "$RESET_USERS" = true ] && echo "  - User database (will recreate admin)"
fi
echo ""
read -p "Are you sure? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Stop services first
echo ""
echo "Stopping services..."
./stop.sh 2>/dev/null || true

echo ""
echo "Resetting..."

# Reset device database
if [ "$RESET_DB" = true ] || [ "$RESET_ALL" = true ]; then
    echo -e "${YELLOW}  Resetting device database...${NC}"
    rm -f backend/devices.db
    rm -f backend/data/*.db 2>/dev/null
    rm -f backend/data/current 2>/dev/null
    echo -e "${GREEN}  ✓ Device database reset${NC}"
fi

# Reset authentication
if [ "$RESET_AUTH" = true ] || [ "$RESET_ALL" = true ]; then
    echo -e "${YELLOW}  Resetting authentication state...${NC}"
    rm -f backend/auth_session.json
    echo -e "${GREEN}  ✓ Authentication state reset (login count = 0)${NC}"
fi

# Reset users database
if [ "$RESET_USERS" = true ] || [ "$RESET_ALL" = true ]; then
    echo -e "${YELLOW}  Resetting users database...${NC}"
    rm -f backend/users.db
    echo -e "${GREEN}  ✓ Users database reset (admin will be recreated on start)${NC}"
fi

# Reset all (including logs)
if [ "$RESET_ALL" = true ]; then
    echo -e "${YELLOW}  Clearing logs...${NC}"
    rm -rf logs/*
    echo -e "${GREEN}  ✓ Logs cleared${NC}"

    echo -e "${YELLOW}  Clearing PID files...${NC}"
    rm -f .backend.pid .frontend.pid
    echo -e "${GREEN}  ✓ PID files cleared${NC}"
fi

echo ""
print_header "Reset Complete!"
echo ""
echo "To start the application:"
echo -e "  ${BLUE}./start.sh${NC}"
echo ""
if [ "$RESET_USERS" = true ] || [ "$RESET_ALL" = true ]; then
    echo "Default credentials (will be created on start):"
    echo -e "  Username: ${GREEN}admin${NC}"
    echo -e "  Password: ${GREEN}admin123${NC}"
    echo ""
fi
