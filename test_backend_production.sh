#!/bin/bash

# ============================================================================
# PRODUCTION BACKEND TESTING SCRIPT
# ============================================================================
# This script performs comprehensive backend testing including:
# - Server startup validation
# - Rate limiting verification
# - Critical endpoint testing
# - Security configuration validation
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="backend"
API_URL="http://localhost:9050"
SERVER_PID=""
TEST_RESULTS=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    TEST_RESULTS+=("✅ $1")
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    TEST_RESULTS+=("⚠️  $1")
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    TEST_RESULTS+=("❌ $1")
}

log_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Cleanup function
cleanup() {
    if [ ! -z "$SERVER_PID" ] && kill -0 $SERVER_PID 2>/dev/null; then
        log_info "Stopping backend server (PID: $SERVER_PID)..."
        kill $SERVER_PID
        wait $SERVER_PID 2>/dev/null || true
        log_success "Server stopped"
    fi
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

# ============================================================================
# TEST 1: BACKEND SERVER STARTUP
# ============================================================================
test_server_startup() {
    log_section "TEST 1: Backend Server Startup"
    
    cd $BACKEND_DIR
    
    # Check if Python is available
    if ! command -v python3 &> /dev/null; then
        log_error "Python3 not found"
        return 1
    fi
    
    log_info "Python version: $(python3 --version)"
    
    # Check if requirements are installed
    log_info "Checking required packages..."
    if ! python3 -c "import fastapi" 2>/dev/null; then
        log_warning "FastAPI not installed. Installing dependencies..."
        pip3 install -r requirements.txt
    fi
    
    # Start the server in background
    log_info "Starting backend server on port 9050..."
    python3 -m uvicorn server:app --host 0.0.0.0 --port 9050 > ../server.log 2>&1 &
    SERVER_PID=$!
    
    log_info "Server PID: $SERVER_PID"
    
    # Wait for server to start (max 30 seconds)
    log_info "Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s "$API_URL/api/health" > /dev/null 2>&1; then
            log_success "Backend server started successfully!"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    
    echo ""
    log_error "Server failed to start within 30 seconds"
    log_info "Server log:"
    tail -20 ../server.log
    return 1
}

# ============================================================================
# TEST 2: HEALTH CHECK
# ============================================================================
test_health_check() {
    log_section "TEST 2: Health Check Endpoint"
    
    response=$(curl -s "$API_URL/api/health")
    
    if echo "$response" | grep -q "OK"; then
        log_success "Health check passed"
        echo "Response: $response"
        return 0
    else
        log_error "Health check failed"
        echo "Response: $response"
        return 1
    fi
}

# ============================================================================
# TEST 3: CORS CONFIGURATION
# ============================================================================
test_cors_configuration() {
    log_section "TEST 3: CORS Configuration"
    
    # Test CORS headers
    response=$(curl -sI "$API_URL/api/health" \
        -H "Origin: http://localhost:9050")
    
    if echo "$response" | grep -q "access-control-allow-origin"; then
        log_success "CORS headers present"
        echo "$response" | grep -i "access-control"
        
        # Verify wildcard is NOT used
        if echo "$response" | grep -i "access-control-allow-origin: \*"; then
            log_error "❌ CRITICAL: Wildcard CORS detected! This is a security vulnerability!"
            return 1
        else
            log_success "CORS properly configured (no wildcard)"
        fi
        return 0
    else
        log_warning "CORS headers not found"
        return 1
    fi
}

# ============================================================================
# TEST 4: RATE LIMITING
# ============================================================================
test_rate_limiting() {
    log_section "TEST 4: Rate Limiting Verification"
    
    # Test login endpoint rate limiting (5 per minute)
    log_info "Testing login rate limiting (5/minute)..."
    
    success_count=0
    rate_limited_count=0
    
    for i in {1..7}; do
        http_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "$API_URL/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"username":"test","password":"wrong"}')
        
        if [ "$http_code" == "429" ]; then
            rate_limited_count=$((rate_limited_count + 1))
            log_info "Request $i: Rate limited (429) ✓"
        else
            success_count=$((success_count + 1))
            log_info "Request $i: Processed ($http_code)"
        fi
        
        sleep 0.2  # Small delay between requests
    done
    
    if [ $rate_limited_count -gt 0 ]; then
        log_success "Rate limiting is working! ($rate_limited_count requests blocked out of 7)"
        return 0
    else
        log_error "Rate limiting NOT working (all 7 requests succeeded)"
        return 1
    fi
}

# ============================================================================
# TEST 5: AUTHENTICATION ENDPOINTS
# ============================================================================
test_authentication() {
    log_section "TEST 5: Authentication Endpoints"
    
    # Test auth status
    log_info "Testing /api/auth/status..."
    response=$(curl -s "$API_URL/api/auth/status")
    
    if echo "$response" | grep -q "authenticated"; then
        log_success "Auth status endpoint working"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        log_error "Auth status endpoint failed"
        return 1
    fi
    
    # Test password status
    log_info "Testing /api/auth/password-status..."
    response=$(curl -s "$API_URL/api/auth/password-status")
    
    if echo "$response" | grep -q "using_custom"; then
        log_success "Password status endpoint working"
    else
        log_error "Password status endpoint failed"
        return 1
    fi
    
    return 0
}

# ============================================================================
# TEST 6: DEVICE MANAGEMENT ENDPOINTS
# ============================================================================
test_device_endpoints() {
    log_section "TEST 6: Device Management Endpoints"
    
    # Test GET /api/devices
    log_info "Testing GET /api/devices..."
    response=$(curl -s "$API_URL/api/devices")
    
    if echo "$response" | grep -q "deviceName\|^\[\]"; then
        device_count=$(echo "$response" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
        log_success "Device list endpoint working ($device_count devices)"
    else
        log_error "Device list endpoint failed"
        return 1
    fi
    
    return 0
}

# ============================================================================
# TEST 7: AUTOMATION ENDPOINTS
# ============================================================================
test_automation_endpoints() {
    log_section "TEST 7: Automation Endpoints"
    
    # Test automation status
    log_info "Testing /api/automation/status..."
    response=$(curl -s "$API_URL/api/automation/status")
    
    if echo "$response" | grep -q "active_connections\|status"; then
        log_success "Automation status endpoint working"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        log_error "Automation status endpoint failed"
        return 1
    fi
    
    # Test latest job
    log_info "Testing /api/automation/jobs/latest..."
    response=$(curl -s "$API_URL/api/automation/jobs/latest")
    
    if echo "$response" | grep -q "status\|message\|job_id"; then
        log_success "Latest job endpoint working"
    else
        log_warning "Latest job endpoint returned unexpected response"
    fi
    
    return 0
}

# ============================================================================
# TEST 8: WEBSOCKET STATUS
# ============================================================================
test_websocket() {
    log_section "TEST 8: WebSocket Status"
    
    log_info "Testing /api/ws/status..."
    response=$(curl -s "$API_URL/api/ws/status")
    
    if echo "$response" | grep -q "active_connections"; then
        log_success "WebSocket status endpoint working"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        log_error "WebSocket status endpoint failed"
        return 1
    fi
    
    return 0
}

# ============================================================================
# TEST 9: SECURITY CONFIGURATION
# ============================================================================
test_security_config() {
    log_section "TEST 9: Security Configuration"
    
    # Check for security headers
    log_info "Checking security headers..."
    headers=$(curl -sI "$API_URL/api/health")
    
    security_score=0
    total_checks=3
    
    # Check X-Process-Time header (from our middleware)
    if echo "$headers" | grep -qi "x-process-time"; then
        log_success "Request timing header present"
        security_score=$((security_score + 1))
    else
        log_warning "Request timing header missing"
    fi
    
    # Check Content-Type
    if echo "$headers" | grep -qi "content-type: application/json"; then
        log_success "Proper content-type header"
        security_score=$((security_score + 1))
    else
        log_warning "Content-type header issue"
    fi
    
    # Verify server info not leaked
    if ! echo "$headers" | grep -qi "server: uvicorn"; then
        log_success "Server information not leaked (good practice)"
        security_score=$((security_score + 1))
    else
        log_warning "Server information exposed in headers"
    fi
    
    log_info "Security score: $security_score/$total_checks"
    
    return 0
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================
main() {
    log_section "PRODUCTION BACKEND TESTING"
    log_info "Starting comprehensive backend tests..."
    log_info "Working directory: $(pwd)"
    
    # Navigate to project root if needed
    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "Backend directory not found. Run this script from project root."
        exit 1
    fi
    
    # Run all tests
    test_server_startup || exit 1
    cd ..  # Return to project root
    
    sleep 2  # Give server time to fully initialize
    
    test_health_check
    test_cors_configuration
    test_rate_limiting
    test_authentication
    test_device_endpoints
    test_automation_endpoints
    test_websocket
    test_security_config
    
    # Print summary
    log_section "TEST SUMMARY"
    
    echo ""
    for result in "${TEST_RESULTS[@]}"; do
        echo "$result"
    done
    echo ""
    
    success_count=$(echo "${TEST_RESULTS[@]}" | grep -o "✅" | wc -l)
    total_count=${#TEST_RESULTS[@]}
    
    log_info "Tests passed: $success_count/$total_count"
    
    if [ $success_count -eq $total_count ]; then
        log_success "🎉 ALL TESTS PASSED!"
        echo ""
        log_info "Backend is production ready!"
        echo ""
        log_info "Server log saved to: server.log"
        log_info "Server PID: $SERVER_PID"
        echo ""
        log_info "Press Ctrl+C to stop the server, or run: kill $SERVER_PID"
        
        # Keep server running
        log_info "Server is running and ready for frontend testing..."
        wait $SERVER_PID
    else
        log_error "Some tests failed. Review the results above."
        exit 1
    fi
}

# Run main function
main "$@"
