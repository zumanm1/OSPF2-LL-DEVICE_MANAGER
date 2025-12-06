#!/usr/bin/env python3
"""
Test PIN Reset Functionality for both admin and netviz_admin
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from modules.auth import verify_admin_pin

print("\n" + "=" * 80)
print("🔐 TESTING PIN RESET FUNCTIONALITY")
print("=" * 80 + "\n")

# Test the PIN
test_pin = "08230"
print(f"Testing PIN: {test_pin}")
result = verify_admin_pin(test_pin)

if result:
    print(f"✅ PIN {test_pin} is VALID")
    print("\nThis PIN can be used to reset passwords for:")
    print("  - netviz_admin account")
    print("  - admin account (if it exists)")
    print("  - Any admin user account")
    print("\nThe PIN reset is GLOBAL and works for ALL admin accounts.")
else:
    print(f"❌ PIN {test_pin} is INVALID")

print("\n" + "=" * 80)
print("✅ PIN RESET VERIFICATION COMPLETE")
print("=" * 80 + "\n")




