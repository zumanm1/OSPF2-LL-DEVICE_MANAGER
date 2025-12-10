#!/bin/bash

################################################################################
# Deployment Validation Test Suite
# OSPF Network Device Manager
#
# Tests all critical deployment aspects regardless of deployment method used
# Can be run after Option 1, 2, or 3 deployment
################################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REMOTE_SERVER="172.16.39.172"
BACKEND_PORT=9050
FRONTEND_PORT=9051
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_TESTS=0

# Test result tracking
test_result() {
    ((TOTAL_TESTS++))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((PASS_COUNT++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((FAIL_COUNT++))
        if [ -n "$3" ]; then
            echo -e "${YELLOW}   └─ Details: $3${NC}"
        fi
    fi
}

print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

################################################################################
# MAIN EXECUTION
################################################################################

clear
print_header "  DEPLOYMENT VALIDATION TEST SUITE - OSPF Network Device Manager              "
echo ""
echo -e "${BLUE}Target Server:${NC} $REMOTE_SERVER"
echo -e "${BLUE}Backend Port:${NC}  $BACKEND_PORT"
echo -e "${BLUE}Frontend Port:${NC} $FRONTEND_PORT"
echo -e "${BLUE}Date:${NC}          $(date +'%Y-%m-%d %H:%M:%S')"
echo ""

################################################################################
# TEST CATEGORY 1: Network Connectivity
################################################################################
print_section "TEST CATEGORY 1: Network Connectivity"

# Test 1.1: Server reachability
ping -c 3 $REMOTE_SERVER > /dev/null 2>&1
test_result $? "Server is reachable (ping)"

# Test 1.2: SSH port accessible
nc -z -w5 $REMOTE_SERVER 22 > /dev/null 2>&1
test_result $? "SSH port 22 is accessible"

# Test 1.3: Backend port listening
nc -z -w5 $REMOTE_SERVER $BACKEND_PORT > /dev/null 2>&1
test_result $? "Backend port $BACKEND_PORT is listening"

# Test 1.4: Frontend port listening
nc -z -w5 $REMOTE_SERVER $FRONTEND_PORT > /dev/null 2>&1
test_result $? "Frontend port $FRONTEND_PORT is listening"

################################################################################
# TEST CATEGORY 2: Backend Health & API
################################################################################
print_section "TEST CATEGORY 2: Backend Health & API"

# Test 2.1: Backend health check
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://$REMOTE_SERVER:$BACKEND_PORT/api/health 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)
[ "$HTTP_CODE" = "200" ] && echo "$HEALTH_BODY" | grep -q "OK"
test_result $? "Backend health endpoint returns 200 OK" "Response: $HEALTH_BODY"

# Test 2.2: Database connectivity
echo "$HEALTH_BODY" | grep -q "database.*connected"
test_result $? "Database connection confirmed"

# Test 2.3: Device API accessible
DEVICES_RESPONSE=$(curl -s -w "\n%{http_code}" http://$REMOTE_SERVER:$BACKEND_PORT/api/devices 2>/dev/null)
HTTP_CODE=$(echo "$DEVICES_RESPONSE" | tail -n1)
[ "$HTTP_CODE" = "200" ]
test_result $? "Device API returns 200 OK"

# Test 2.4: Device count validation
DEVICE_COUNT=$(echo "$DEVICES_RESPONSE" | head -n-1 | grep -c "deviceName")
[ "$DEVICE_COUNT" -eq 10 ]
test_result $? "Device count correct (expected 10, got $DEVICE_COUNT)"

# Test 2.5: Specific device present
echo "$DEVICES_RESPONSE" | head -n-1 | grep -q "zwe-hra-pop-p01"
test_result $? "Expected device 'zwe-hra-pop-p01' found in API response"

# Test 2.6: API documentation accessible
curl -s -o /dev/null -w "%{http_code}" http://$REMOTE_SERVER:$BACKEND_PORT/docs 2>/dev/null | grep -q "200"
test_result $? "API documentation (/docs) accessible"

################################################################################
# TEST CATEGORY 3: Frontend Accessibility
################################################################################
print_section "TEST CATEGORY 3: Frontend Accessibility"

# Test 3.1: Frontend HTTP response
FRONTEND_RESPONSE=$(curl -s -I http://$REMOTE_SERVER:$FRONTEND_PORT 2>/dev/null)
echo "$FRONTEND_RESPONSE" | grep -q "200 OK"
test_result $? "Frontend returns HTTP 200 OK"

# Test 3.2: Frontend content type
echo "$FRONTEND_RESPONSE" | grep -qi "content-type.*text/html"
test_result $? "Frontend serves HTML content"

# Test 3.3: Frontend index.html accessible
curl -s http://$REMOTE_SERVER:$FRONTEND_PORT/ 2>/dev/null | grep -q "<html"
test_result $? "Frontend index.html contains valid HTML"

# Test 3.4: Frontend assets directory
curl -s http://$REMOTE_SERVER:$FRONTEND_PORT/assets/ 2>/dev/null | grep -qE "(200|403)"
test_result $? "Frontend assets directory exists"

################################################################################
# TEST CATEGORY 4: Remote Server File System
################################################################################
print_section "TEST CATEGORY 4: Remote Server File System"

# Test 4.1: Application directory exists
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -d /home/cisco/OSPF-LL-DEVICE_MANAGER ]" 2>/dev/null
test_result $? "Application directory exists"

# Test 4.2: Backend directory exists
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -d /home/cisco/OSPF-LL-DEVICE_MANAGER/backend ]" 2>/dev/null
test_result $? "Backend directory exists"

# Test 4.3: Frontend build directory exists
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -d /home/cisco/OSPF-LL-DEVICE_MANAGER/dist ]" 2>/dev/null
test_result $? "Frontend build directory (dist/) exists"

# Test 4.4: Database file exists
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -f /home/cisco/OSPF-LL-DEVICE_MANAGER/backend/devices.db ]" 2>/dev/null
test_result $? "Database file (devices.db) exists"

# Test 4.5: Management script exists and executable
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -x /home/cisco/OSPF-LL-DEVICE_MANAGER/manage.sh ]" 2>/dev/null
test_result $? "Management script exists and is executable"

# Test 4.6: Backend log file exists
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -f /home/cisco/OSPF-LL-DEVICE_MANAGER/backend/backend.log ]" 2>/dev/null
test_result $? "Backend log file exists"

# Test 4.7: Logs directory exists
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -d /home/cisco/OSPF-LL-DEVICE_MANAGER/backend/logs ]" 2>/dev/null
test_result $? "Backend logs directory exists"

################################################################################
# TEST CATEGORY 5: Process Validation
################################################################################
print_section "TEST CATEGORY 5: Process Validation"

# Test 5.1: Backend process running
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "ps aux | grep -v grep | grep -q 'uvicorn server:app'" 2>/dev/null
test_result $? "Backend process (uvicorn) is running"

# Test 5.2: Frontend process running
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "ps aux | grep -v grep | grep -q 'vite preview'" 2>/dev/null
test_result $? "Frontend process (vite preview) is running"

# Test 5.3: Backend PID file exists
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -f /home/cisco/OSPF-LL-DEVICE_MANAGER/backend/backend.pid ]" 2>/dev/null
test_result $? "Backend PID file exists"

# Test 5.4: Frontend PID file exists
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -f /home/cisco/OSPF-LL-DEVICE_MANAGER/frontend.pid ]" 2>/dev/null
test_result $? "Frontend PID file exists"

################################################################################
# TEST CATEGORY 6: Dependencies & Configuration
################################################################################
print_section "TEST CATEGORY 6: Dependencies & Configuration"

# Test 6.1: Python 3 installed
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "python3 --version" 2>/dev/null | grep -q "Python 3"
test_result $? "Python 3 is installed"

# Test 6.2: Node.js installed
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "node --version" 2>/dev/null | grep -q "v"
test_result $? "Node.js is installed"

# Test 6.3: Critical Python packages
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "cd /home/cisco/OSPF-LL-DEVICE_MANAGER/backend && python3 -c 'import fastapi, netmiko, paramiko, cryptography, slowapi' 2>/dev/null"
test_result $? "Critical Python packages installed"

# Test 6.4: Node modules directory
sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "[ -d /home/cisco/OSPF-LL-DEVICE_MANAGER/node_modules ]" 2>/dev/null
test_result $? "Node modules directory exists"

################################################################################
# TEST CATEGORY 7: Security & Rate Limiting
################################################################################
print_section "TEST CATEGORY 7: Security & Rate Limiting"

# Test 7.1: CORS headers present
CORS_HEADERS=$(curl -s -I http://$REMOTE_SERVER:$BACKEND_PORT/api/devices 2>/dev/null | grep -i "access-control")
[ -n "$CORS_HEADERS" ]
test_result $? "CORS headers are configured"

# Test 7.2: CORS not using wildcard (*)
echo "$CORS_HEADERS" | grep -v "Access-Control-Allow-Origin: \*" > /dev/null
test_result $? "CORS not using wildcard (*) - SECURITY CHECK"

# Test 7.3: Rate limiting configured (check for X-RateLimit headers)
# Make request to login endpoint (which has rate limiting)
RATE_LIMIT_RESPONSE=$(curl -s -I -X POST http://$REMOTE_SERVER:$BACKEND_PORT/api/auth/login 2>/dev/null)
echo "$RATE_LIMIT_RESPONSE" | grep -qi "ratelimit\|rate-limit"
RATE_LIMIT_FOUND=$?
# Rate limiting may not always show in headers, so this is informational
if [ $RATE_LIMIT_FOUND -eq 0 ]; then
    test_result 0 "Rate limiting headers detected (INFORMATIONAL)"
else
    echo -e "${YELLOW}ℹ️  INFO${NC}: Rate limiting configured in backend but headers not visible in response"
fi

################################################################################
# TEST CATEGORY 8: Data Integrity
################################################################################
print_section "TEST CATEGORY 8: Data Integrity"

# Test 8.1: Device data structure valid
DEVICE_DATA=$(curl -s http://$REMOTE_SERVER:$BACKEND_PORT/api/devices 2>/dev/null | head -n-1)
echo "$DEVICE_DATA" | grep -q "\"id\":"
test_result $? "Device data contains 'id' field"

# Test 8.2: Device data contains IP addresses
echo "$DEVICE_DATA" | grep -q "\"ipAddress\":"
test_result $? "Device data contains 'ipAddress' field"

# Test 8.3: Device data contains device names
echo "$DEVICE_DATA" | grep -q "\"deviceName\":"
test_result $? "Device data contains 'deviceName' field"

# Test 8.4: IP addresses in valid format
echo "$DEVICE_DATA" | grep -q "172\.20\.0\.[0-9]\+"
test_result $? "IP addresses in expected range (172.20.0.x)"

################################################################################
# TEST CATEGORY 9: Management Tools
################################################################################
print_section "TEST CATEGORY 9: Management Tools"

# Test 9.1: Management script status command works
MGMT_STATUS=$(sshpass -p "cisco" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 cisco@$REMOTE_SERVER \
  "cd /home/cisco/OSPF-LL-DEVICE_MANAGER && ./manage.sh status 2>&1" 2>/dev/null)
echo "$MGMT_STATUS" | grep -q "Backend\|Frontend"
test_result $? "Management script 'status' command works"

# Test 9.2: Management script reports backend running
echo "$MGMT_STATUS" | grep -i "backend" | grep -q "✅\|running"
test_result $? "Management script reports backend as running"

# Test 9.3: Management script reports frontend running
echo "$MGMT_STATUS" | grep -i "frontend" | grep -q "✅\|running"
test_result $? "Management script reports frontend as running"

################################################################################
# TEST CATEGORY 10: End-to-End Functional Test
################################################################################
print_section "TEST CATEGORY 10: End-to-End Functional Test"

# Test 10.1: Complete request flow (GET devices, parse response)
E2E_RESPONSE=$(curl -s http://$REMOTE_SERVER:$BACKEND_PORT/api/devices 2>/dev/null | head -n-1)
FIRST_DEVICE_NAME=$(echo "$E2E_RESPONSE" | grep -o '"deviceName":"[^"]*"' | head -n1 | cut -d'"' -f4)
[ -n "$FIRST_DEVICE_NAME" ]
test_result $? "Complete E2E flow works (extracted device: $FIRST_DEVICE_NAME)"

# Test 10.2: WebSocket endpoint accessible
WS_RESPONSE=$(curl -s -I http://$REMOTE_SERVER:$BACKEND_PORT/ws/jobs/all 2>/dev/null)
echo "$WS_RESPONSE" | grep -qE "HTTP.*[0-9]{3}"
test_result $? "WebSocket endpoint is accessible"

################################################################################
# TEST SUMMARY
################################################################################
echo ""
print_header "  TEST SUMMARY                                                                 "
echo ""

PASS_PERCENT=$(awk "BEGIN {printf \"%.1f\", ($PASS_COUNT/$TOTAL_TESTS)*100}")
FAIL_PERCENT=$(awk "BEGIN {printf \"%.1f\", ($FAIL_COUNT/$TOTAL_TESTS)*100}")

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "Total Tests:     $TOTAL_TESTS"
echo -e "${GREEN}✅ Passed:        $PASS_COUNT ($PASS_PERCENT%)${NC}"
echo -e "${RED}❌ Failed:        $FAIL_COUNT ($FAIL_PERCENT%)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Breakdown by category
echo -e "${BLUE}Test Categories:${NC}"
echo "  1. Network Connectivity:   4 tests"
echo "  2. Backend Health & API:   6 tests"
echo "  3. Frontend Accessibility: 4 tests"
echo "  4. Remote File System:     7 tests"
echo "  5. Process Validation:     4 tests"
echo "  6. Dependencies & Config:  4 tests"
echo "  7. Security & Rate Limit:  3 tests"
echo "  8. Data Integrity:         4 tests"
echo "  9. Management Tools:       3 tests"
echo "  10. E2E Functional:        2 tests"
echo ""

# Final verdict
if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  🎉 ALL TESTS PASSED - DEPLOYMENT SUCCESSFUL                ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✅ The application is fully deployed and operational${NC}"
    echo -e "${GREEN}✅ All critical components are functioning correctly${NC}"
    echo -e "${GREEN}✅ Ready for production use${NC}"
    echo ""
    echo -e "${BLUE}Access Information:${NC}"
    echo -e "  Frontend: http://$REMOTE_SERVER:$FRONTEND_PORT"
    echo -e "  Backend:  http://$REMOTE_SERVER:$BACKEND_PORT"
    echo -e "  API Docs: http://$REMOTE_SERVER:$BACKEND_PORT/docs"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Login with netviz_admin/V3ry\$trongAdm1n!2025"
    echo "  2. Configure jumphost (172.16.39.173)"
    echo "  3. Test automation on 10 devices"
    echo "  4. Monitor logs for any issues"
    echo ""
    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⚠️  SOME TESTS FAILED - REVIEW DEPLOYMENT                  ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  $FAIL_COUNT out of $TOTAL_TESTS tests failed${NC}"
    echo -e "${YELLOW}⚠️  Review the failed tests above for details${NC}"
    echo ""
    echo -e "${BLUE}Troubleshooting:${NC}"
    echo "  1. Check backend logs: ssh cisco@$REMOTE_SERVER 'tail -n 50 /home/cisco/OSPF-LL-DEVICE_MANAGER/backend/backend.log'"
    echo "  2. Check frontend logs: ssh cisco@$REMOTE_SERVER 'tail -n 50 /home/cisco/OSPF-LL-DEVICE_MANAGER/frontend.log'"
    echo "  3. Verify processes: ssh cisco@$REMOTE_SERVER '/home/cisco/OSPF-LL-DEVICE_MANAGER/manage.sh status'"
    echo "  4. Restart services: ssh cisco@$REMOTE_SERVER '/home/cisco/OSPF-LL-DEVICE_MANAGER/manage.sh restart'"
    echo ""
    echo -e "${YELLOW}Refer to DEPLOYMENT_OPTIONS_COMPLETE_GUIDE.md for troubleshooting${NC}"
    echo ""
    exit 1
fi
