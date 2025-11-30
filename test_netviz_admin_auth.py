#!/usr/bin/env python3
"""
Test Script: netviz_admin Authentication Validation
Tests the new netviz_admin account across all authentication scenarios
"""

import sys
import json
import time
from pathlib import Path

# Add backend modules to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from modules.auth import (
    validate_credentials,
    create_session,
    validate_session,
    get_user,
    has_permission,
    get_role_permissions,
    UserRole
)

# Test credentials
OLD_USERNAME = "admin"
OLD_PASSWORD = "admin123"
NEW_USERNAME = "netviz_admin"
NEW_PASSWORD = "V3ry$trongAdm1n!2025"

# Color output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text.center(80)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}\n")

def print_test(name):
    print(f"{Colors.BOLD}TEST: {name}{Colors.END}")

def print_pass(msg):
    print(f"  {Colors.GREEN}✅ PASS:{Colors.END} {msg}")

def print_fail(msg):
    print(f"  {Colors.RED}❌ FAIL:{Colors.END} {msg}")

def print_info(msg):
    print(f"  {Colors.YELLOW}ℹ️  INFO:{Colors.END} {msg}")

# Test counters
tests_run = 0
tests_passed = 0
tests_failed = 0

def run_test(test_func):
    global tests_run, tests_passed, tests_failed
    tests_run += 1
    try:
        test_func()
        tests_passed += 1
        return True
    except AssertionError as e:
        print_fail(str(e))
        tests_failed += 1
        return False
    except Exception as e:
        print_fail(f"Unexpected error: {e}")
        tests_failed += 1
        return False

# ============================================================================
# TEST SUITE
# ============================================================================

def test_1_get_netviz_admin_user():
    """Test: Get netviz_admin user from database"""
    print_test("Get netviz_admin user from database")
    
    user = get_user(NEW_USERNAME)
    assert user is not None, f"User '{NEW_USERNAME}' not found in database"
    print_pass(f"User '{NEW_USERNAME}' found in database")
    
    assert user['username'] == NEW_USERNAME, f"Username mismatch: {user['username']}"
    print_pass(f"Username matches: {NEW_USERNAME}")
    
    assert user['role'] == 'admin', f"Role mismatch: {user['role']}"
    print_pass(f"Role is correct: admin")
    
    assert user['is_active'] == True, f"User is not active: {user['is_active']}"
    print_pass("User is active")
    
    print_info(f"User ID: {user['id']}")
    print_info(f"Created: {user['created_at']}")

def test_2_validate_netviz_admin_credentials():
    """Test: Validate netviz_admin credentials"""
    print_test("Validate netviz_admin credentials")
    
    valid, message, user_data = validate_credentials(NEW_USERNAME, NEW_PASSWORD)
    
    assert valid == True, f"Credentials validation failed: {message}"
    print_pass("Credentials are valid")
    
    assert message == "Login successful", f"Unexpected message: {message}"
    print_pass(f"Message: {message}")
    
    assert user_data is not None, "User data is None"
    assert user_data['username'] == NEW_USERNAME, f"Username mismatch: {user_data['username']}"
    assert user_data['role'] == 'admin', f"Role mismatch: {user_data['role']}"
    print_pass(f"User data correct: {user_data}")

def test_3_validate_wrong_password():
    """Test: Validate netviz_admin with wrong password (should fail)"""
    print_test("Validate netviz_admin with WRONG password")
    
    valid, message, user_data = validate_credentials(NEW_USERNAME, "wrongpassword123")
    
    assert valid == False, "Wrong password should fail validation"
    print_pass("Wrong password correctly rejected")
    
    assert "Invalid" in message, f"Expected 'Invalid' in message, got: {message}"
    print_pass(f"Error message: {message}")
    
    assert user_data is None, "User data should be None for failed login"
    print_pass("User data is None (as expected)")

def test_4_create_session_netviz_admin():
    """Test: Create session for netviz_admin"""
    print_test("Create session for netviz_admin")
    
    token = create_session(NEW_USERNAME, role='admin')
    
    assert token is not None, "Session token is None"
    assert len(token) > 20, f"Session token too short: {len(token)}"
    print_pass(f"Session token created (length: {len(token)})")
    
    # Validate the session
    valid, session_data = validate_session(token)
    
    assert valid == True, "Session validation failed"
    print_pass("Session is valid")
    
    assert session_data is not None, "Session data is None"
    assert session_data['username'] == NEW_USERNAME, f"Username mismatch: {session_data['username']}"
    assert session_data['role'] == 'admin', f"Role mismatch: {session_data['role']}"
    print_pass(f"Session data correct: username={session_data['username']}, role={session_data['role']}")
    
    print_info(f"Session expires at: {session_data.get('expires_at', 'N/A')}")

def test_5_admin_permissions_netviz():
    """Test: Check netviz_admin has full admin permissions"""
    print_test("Check netviz_admin admin permissions")
    
    permissions = get_role_permissions('admin')
    
    assert permissions is not None, "Permissions are None"
    assert len(permissions) > 0, "No permissions found"
    print_pass(f"Found {len(permissions)} permissions")
    
    # Check critical admin permissions
    critical_perms = [
        "users.create", "users.delete", "users.update",
        "devices.create", "devices.delete",
        "automation.start", "automation.stop",
        "database.manage", "database.reset",
        "settings.update"
    ]
    
    for perm in critical_perms:
        assert perm in permissions, f"Missing permission: {perm}"
    
    print_pass(f"All {len(critical_perms)} critical admin permissions present")
    print_info(f"Permissions: {', '.join(permissions[:5])}... (showing 5/{len(permissions)})")

def test_6_permission_checks():
    """Test: Verify netviz_admin can perform admin actions"""
    print_test("Verify netviz_admin permission checks")
    
    admin_actions = [
        ("users.create", "Create users"),
        ("users.delete", "Delete users"),
        ("devices.delete", "Delete devices"),
        ("database.reset", "Reset database"),
        ("settings.update", "Update settings"),
    ]
    
    for perm, desc in admin_actions:
        result = has_permission('admin', perm)
        assert result == True, f"Permission check failed: {perm}"
    
    print_pass(f"All {len(admin_actions)} permission checks passed")
    
    # Verify operator doesn't have these perms
    operator_restricted = ["users.delete", "database.reset"]
    for perm in operator_restricted:
        result = has_permission('operator', perm)
        assert result == False, f"Operator should not have: {perm}"
    
    print_pass("Operator role correctly restricted")

def test_7_old_admin_still_works():
    """Test: Verify old admin account still works (backward compatibility)"""
    print_test("Verify old 'admin' account still works")
    
    valid, message, user_data = validate_credentials(OLD_USERNAME, OLD_PASSWORD)
    
    assert valid == True, f"Old admin credentials failed: {message}"
    print_pass("Old 'admin' account still works")
    
    assert user_data['username'] == OLD_USERNAME, f"Username mismatch: {user_data['username']}"
    assert user_data['role'] == 'admin', f"Role mismatch: {user_data['role']}"
    print_pass("Old admin has correct role and permissions")
    
    print_info("✓ Backward compatibility maintained")

def test_8_compare_both_accounts():
    """Test: Compare old admin vs new netviz_admin"""
    print_test("Compare 'admin' vs 'netviz_admin'")
    
    old_user = get_user(OLD_USERNAME)
    new_user = get_user(NEW_USERNAME)
    
    assert old_user is not None, "Old admin not found"
    assert new_user is not None, "New netviz_admin not found"
    
    print_info(f"OLD: username={old_user['username']}, role={old_user['role']}, id={old_user['id']}")
    print_info(f"NEW: username={new_user['username']}, role={new_user['role']}, id={new_user['id']}")
    
    # Both should have admin role
    assert old_user['role'] == 'admin', "Old admin lost admin role"
    assert new_user['role'] == 'admin', "New netviz_admin doesn't have admin role"
    
    print_pass("Both accounts have 'admin' role")
    
    # Both should be active
    assert old_user['is_active'] == True, "Old admin is not active"
    assert new_user['is_active'] == True, "New netviz_admin is not active"
    
    print_pass("Both accounts are active")
    
    # Different IDs
    assert old_user['id'] != new_user['id'], "Accounts have same ID"
    print_pass(f"Accounts have different IDs (admin={old_user['id']}, netviz_admin={new_user['id']})")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    print_header("🔐 NETVIZ_ADMIN AUTHENTICATION TEST SUITE 🔐")
    
    start_time = time.time()
    
    # Run all tests
    tests = [
        test_1_get_netviz_admin_user,
        test_2_validate_netviz_admin_credentials,
        test_3_validate_wrong_password,
        test_4_create_session_netviz_admin,
        test_5_admin_permissions_netviz,
        test_6_permission_checks,
        test_7_old_admin_still_works,
        test_8_compare_both_accounts,
    ]
    
    for test_func in tests:
        run_test(test_func)
        print()  # Blank line between tests
    
    elapsed = time.time() - start_time
    
    # Print summary
    print_header("📊 TEST SUMMARY 📊")
    print(f"  Total Tests:  {tests_run}")
    print(f"  {Colors.GREEN}✅ Passed:     {tests_passed}{Colors.END}")
    print(f"  {Colors.RED}❌ Failed:     {tests_failed}{Colors.END}")
    print(f"  Time Elapsed: {elapsed:.2f}s")
    print()
    
    if tests_failed == 0:
        print(f"{Colors.GREEN}{Colors.BOLD}{'='*80}")
        print(f"🎉 ALL TESTS PASSED! netviz_admin is ready for production! 🎉".center(80))
        print(f"{'='*80}{Colors.END}\n")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}{'='*80}")
        print(f"❌ {tests_failed} TEST(S) FAILED - Review output above ❌".center(80))
        print(f"{'='*80}{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())

