#!/usr/bin/env python3
"""
Delete the legacy admin account from the database
Only netviz_admin will remain as the primary admin account
"""

import sqlite3
from pathlib import Path

USERS_DB = Path(__file__).parent / 'backend' / 'users.db'

print("\n" + "=" * 80)
print("🗑️  REMOVING LEGACY ADMIN ACCOUNT")
print("=" * 80 + "\n")

try:
    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()
    
    # First, check all admin users
    cursor.execute("SELECT username, role FROM users WHERE role = 'admin'")
    admins = cursor.fetchall()
    
    print("📊 Current admin accounts:")
    for username, role in admins:
        print(f"  - {username} (role: {role})")
    print()
    
    if len(admins) <= 1:
        print("⚠️  WARNING: Only one admin account exists!")
        print("   Cannot delete - system must have at least one admin.")
        conn.close()
        exit(1)
    
    # Check if 'admin' exists
    cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
    if cursor.fetchone()[0] == 0:
        print("ℹ️  Legacy 'admin' account not found. Already deleted?")
        conn.close()
        exit(0)
    
    # Delete the admin account
    print("🗑️  Deleting legacy 'admin' account...")
    cursor.execute("DELETE FROM users WHERE username = 'admin'")
    rows_deleted = cursor.rowcount
    conn.commit()
    
    if rows_deleted > 0:
        print(f"✅ Successfully deleted 'admin' account ({rows_deleted} row)")
    else:
        print("⚠️  No rows deleted - admin account not found")
    
    # Verify remaining admins
    cursor.execute("SELECT username, role, is_active FROM users WHERE role = 'admin'")
    remaining_admins = cursor.fetchall()
    
    print("\n📊 Remaining admin accounts:")
    for username, role, is_active in remaining_admins:
        status = "✅ Active" if is_active else "❌ Inactive"
        print(f"  - {username} (role: {role}, {status})")
    
    conn.close()
    
    print("\n" + "=" * 80)
    print("✅ LEGACY ADMIN ACCOUNT REMOVED SUCCESSFULLY")
    print("=" * 80 + "\n")
    
    print("📋 SUMMARY:\n")
    print("✅ Legacy 'admin' account deleted")
    print("✅ netviz_admin is now the PRIMARY admin account")
    print("✅ System has at least one admin account (security maintained)")
    print("\n🔐 PRIMARY ADMIN CREDENTIALS:")
    print("   Username: netviz_admin")
    print("   Password: V3ry$trongAdm1n!2025")
    print("   PIN Reset: 08230")
    print()

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)




