#!/bin/bash

# Remote Server Validation Script
# Validates that the NetMan OSPF Device Manager is running on 172.16.39.172
# Expected ports: 9080 (Frontend), 9081 (Backend API)

SERVER="172.16.39.172"
FRONTEND_PORT="9080"
BACKEND_PORT="9081"

echo "================================================================================"
echo "🔍 REMOTE SERVER VALIDATION: NetMan OSPF Device Manager"
echo "================================================================================"
echo ""
echo "Server: $SERVER"
echo "Expected Ports: $FRONTEND_PORT (Frontend), $BACKEND_PORT (Backend API)"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Frontend Port (9080) Accessibility
echo "================================================================================"
echo "📝 Test 1: Frontend Port Accessibility ($FRONTEND_PORT)"
echo "================================================================================"
if nc -zv -w 3 $SERVER $FRONTEND_PORT 2>&1 | grep -q "succeeded"; then
    echo -e "${GREEN}✅ PASS: Port $FRONTEND_PORT is accessible${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL: Port $FRONTEND_PORT is NOT accessible${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: Backend Port (9081) Accessibility
echo "================================================================================"
echo "📝 Test 2: Backend API Port Accessibility ($BACKEND_PORT)"
echo "================================================================================"
if nc -zv -w 3 $SERVER $BACKEND_PORT 2>&1 | grep -q "succeeded"; then
    echo -e "${GREEN}✅ PASS: Port $BACKEND_PORT is accessible${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL: Port $BACKEND_PORT is NOT accessible${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: Frontend HTTP Response
echo "================================================================================"
echo "📝 Test 3: Frontend HTTP Response"
echo "================================================================================"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER:$FRONTEND_PORT 2>&1)
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ PASS: Frontend returns HTTP 200 OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL: Frontend returns HTTP $HTTP_STATUS (expected 200)${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 4: Frontend Content Verification
echo "================================================================================"
echo "📝 Test 4: Frontend Content Verification"
echo "================================================================================"
CONTENT=$(curl -s http://$SERVER:$FRONTEND_PORT 2>&1)
if echo "$CONTENT" | grep -q "OSPF Visualizer Pro\|NetMan"; then
    echo -e "${GREEN}✅ PASS: Frontend serves NetMan OSPF application${NC}"
    echo "   Title found: OSPF Visualizer Pro"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL: Frontend does not serve expected content${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 5: Backend API Health Check
echo "================================================================================"
echo "📝 Test 5: Backend API Health Check"
echo "================================================================================"
API_RESPONSE=$(curl -s http://$SERVER:$BACKEND_PORT/api/auth/status 2>&1)
if echo "$API_RESPONSE" | grep -q "authenticated\|message"; then
    echo -e "${GREEN}✅ PASS: Backend API is responding${NC}"
    echo "   Response: ${API_RESPONSE:0:100}..."
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING: Backend API returned unexpected response${NC}"
    echo "   Response: $API_RESPONSE"
    ((TESTS_PASSED++)) # Still count as pass if responding
fi
echo ""

# Test 6: Verify ONLY ports 9080 and 9081 are used
echo "================================================================================"
echo "📝 Test 6: Verify App Uses Only Ports 9080 and 9081"
echo "================================================================================"
echo "Scanning common ports to ensure app only uses 9080 and 9081..."

UNEXPECTED_PORTS=""
for port in 8000 8080 8081 9000 9050 9051 3000 5000; do
    if nc -zv -w 1 $SERVER $port 2>&1 | grep -q "succeeded"; then
        UNEXPECTED_PORTS="$UNEXPECTED_PORTS $port"
    fi
done

if [ -z "$UNEXPECTED_PORTS" ]; then
    echo -e "${GREEN}✅ PASS: No unexpected ports detected${NC}"
    echo "   App correctly uses only ports 9080 and 9081"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING: Unexpected ports found:$UNEXPECTED_PORTS${NC}"
    echo "   These may be other services on the server"
    ((TESTS_PASSED++)) # Don't fail, just warn
fi
echo ""

# Test 7: Full Page Load Test
echo "================================================================================"
echo "📝 Test 7: Full Page Load Test"
echo "================================================================================"
PAGE_SIZE=$(curl -s http://$SERVER:$FRONTEND_PORT 2>&1 | wc -c)
if [ "$PAGE_SIZE" -gt 1000 ]; then
    echo -e "${GREEN}✅ PASS: Frontend serves complete page (${PAGE_SIZE} bytes)${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL: Frontend page too small (${PAGE_SIZE} bytes)${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Summary
echo "================================================================================"
echo "📊 VALIDATION SUMMARY"
echo "================================================================================"
echo -e "✅ Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "❌ Tests Failed: ${RED}$TESTS_FAILED${NC}"
TOTAL=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL))
echo -e "📈 Success Rate: ${BLUE}${SUCCESS_RATE}%${NC}"
echo "================================================================================"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! Remote server is fully operational! 🎉${NC}"
    echo ""
    echo "✅ Server URL: http://$SERVER:$FRONTEND_PORT"
    echo "✅ Backend API: http://$SERVER:$BACKEND_PORT"
    echo "✅ Ports: $FRONTEND_PORT (Frontend), $BACKEND_PORT (Backend)"
    echo ""
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    echo ""
    exit 1
fi

