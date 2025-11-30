#!/usr/bin/env python3
"""
Regenerate netviz_admin password hash and update the database
This ensures the password hash matches the current APP_SECRET_KEY
"""

import sqlite3
import hashlib
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from modules.env_config import load_env_file, get_env

# Load environment
env = load_env_file()

APP_SECRET_KEY = env.get('APP_SECRET_KEY', '')
APP_ADMIN_USERNAME = env.get('APP_ADMIN_USERNAME', 'netviz_admin')
APP_ADMIN_PASSWORD = env.get('APP_ADMIN_PASSWORD', 'V3ry$trongAdm1n!2025')

print("🔐 REGENERATING NETVIZ_ADMIN PASSWORD HASH")
print("=" * 80)
print(f"Username: {APP_ADMIN_USERNAME}")
print(f"Password: {APP_ADMIN_PASSWORD}")
print(f"Secret Key (first 16 chars): {APP_SECRET_KEY[:16]}...")
print()

# Hash the password using the same algorithm as auth.py
def hash_password(password: str) -> str:
    """Hash a password using SHA-256 with salt from secret key"""
    salt = APP_SECRET_KEY[:16]
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

new_hash = hash_password(APP_ADMIN_PASSWORD)
print(f"New Password Hash: {new_hash}")
print()

# Update the database
USERS_DB = Path(__file__).parent / 'backend' / 'users.db'

try:
    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()
    
    # Check if netviz_admin exists
    cursor.execute("SELECT username, password_hash, role FROM users WHERE username = ?", (APP_ADMIN_USERNAME,))
    result = cursor.fetchone()
    
    if result:
        old_hash = result[1]
        print(f"✅ Found existing user: {APP_ADMIN_USERNAME}")
        print(f"   Old hash: {old_hash}")
        print(f"   New hash: {new_hash}")
        print()
        
        # Update password hash
        cursor.execute("""
            UPDATE users 
            SET password_hash = ?, updated_at = datetime('now')
            WHERE username = ?
        """, (new_hash, APP_ADMIN_USERNAME))
        
        conn.commit()
        print(f"✅ Successfully updated password hash for {APP_ADMIN_USERNAME}")
    else:
        print(f"⚠️  User {APP_ADMIN_USERNAME} not found!")
        print(f"   Creating new user...")
        
        from datetime import datetime
        now = datetime.now().isoformat()
        
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, created_at, updated_at)
            VALUES (?, ?, 'admin', ?, ?)
        """, (APP_ADMIN_USERNAME, new_hash, now, now))
        
        conn.commit()
        print(f"✅ Created new admin user: {APP_ADMIN_USERNAME}")
    
    # Verify the update
    cursor.execute("SELECT username, role, created_at FROM users WHERE username = ?", (APP_ADMIN_USERNAME,))
    user = cursor.fetchone()
    print()
    print("🔍 VERIFICATION:")
    print(f"   Username: {user[0]}")
    print(f"   Role: {user[1]}")
    print(f"   Created: {user[2]}")
    
    conn.close()
    
    print()
    print("=" * 80)
    print("✅ PASSWORD HASH REGENERATION COMPLETE!")
    print()
    print("Next steps:")
    print("1. Restart the backend: cd backend && pkill -f server.py && python3 server.py &")
    print("2. Try logging in with:")
    print(f"   Username: {APP_ADMIN_USERNAME}")
    print(f"   Password: {APP_ADMIN_PASSWORD}")
    print("=" * 80)
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

