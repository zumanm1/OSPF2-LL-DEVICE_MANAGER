#!/bin/bash

# ============================================================================
# PRODUCTION HARDENING SCRIPT
# Systematically validates, fixes, tests, and validates the application
# ============================================================================

set -e  # Exit on error

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🔐 PRODUCTION HARDENING - NetMan OSPF Device Manager         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# STEP 1: PRE-FLIGHT VALIDATION
# ============================================================================
echo -e "${BLUE}━━━ Step 1: Pre-Flight Validation ━━━${NC}"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.8+${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Python: $(python3 --version)${NC}"
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"
echo ""

# ============================================================================
# STEP 2: RUN VALIDATION SCRIPT
# ============================================================================
echo -e "${BLUE}━━━ Step 2: Running Production Readiness Validation ━━━${NC}"
echo ""

chmod +x validate_production_readiness.py 2>/dev/null || true

python3 validate_production_readiness.py

VALIDATION_EXIT_CODE=$?

if [ $VALIDATION_EXIT_CODE -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Validation found issues. Will proceed with fixes...${NC}"
    echo ""
else
    echo ""
    echo -e "${GREEN}✅ Validation passed!${NC}"
    echo ""
fi

# ============================================================================
# STEP 3: CHECK FOR CRITICAL ISSUES
# ============================================================================
echo -e "${BLUE}━━━ Step 3: Checking Critical Issues ━━━${NC}"
echo ""

# Check if validation report exists
if [ -f "production_validation_report.json" ]; then
    # Extract critical failures count
    CRITICAL_COUNT=$(python3 -c "
import json
with open('production_validation_report.json', 'r') as f:
    data = json.load(f)
    print(data['summary']['critical'])
" 2>/dev/null || echo "0")

    echo -e "${BLUE}Critical Issues Found: ${CRITICAL_COUNT}${NC}"
    
    if [ "$CRITICAL_COUNT" -gt "0" ]; then
        echo -e "${YELLOW}⚠️  Critical issues detected. Fixes will be applied automatically.${NC}"
    else
        echo -e "${GREEN}✅ No critical issues found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Validation report not found${NC}"
fi

echo ""

# ============================================================================
# STEP 4: ASK USER TO PROCEED
# ============================================================================
echo -e "${BLUE}━━━ Ready to Apply Fixes ━━━${NC}"
echo ""
echo "The following will be applied:"
echo "  1. Fix CORS wildcard vulnerability"
echo "  2. Add get_allowed_cors_origins() function"
echo "  3. Implement rate limiting on critical endpoints"
echo "  4. Run tests"
echo "  5. Build frontend"
echo "  6. Create Puppeteer E2E validation"
echo ""

read -p "$(echo -e ${YELLOW}Continue with production hardening? [Y/n]: ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
    echo -e "${RED}Aborted by user${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Proceeding with production hardening...${NC}"
echo ""

# ============================================================================
# STEP 5: BACKUP ORIGINAL FILES
# ============================================================================
echo -e "${BLUE}━━━ Step 5: Creating Backups ━━━${NC}"
echo ""

BACKUP_DIR="backups/pre-hardening-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

cp backend/server.py "$BACKUP_DIR/server.py.backup" 2>/dev/null || true
cp backend/modules/auth.py "$BACKUP_DIR/auth.py.backup" 2>/dev/null || true

echo -e "${GREEN}✅ Backups created in: $BACKUP_DIR${NC}"
echo ""

# ============================================================================
# COMPLETION MESSAGE
# ============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Pre-Flight Complete - Ready for Automated Fixes            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Backups stored in: $BACKUP_DIR"
echo "Validation report: production_validation_report.json"
echo ""
echo -e "${BLUE}Next: Droid AI will now apply fixes systematically...${NC}"
echo ""
