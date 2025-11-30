
import sqlite3
import os
import sys

# Add backend/modules to path to import auth utils if needed, 
# but for now let's just inspect the DB directly.

DB_PATH = 'backend/users.db'

if not os.path.exists(DB_PATH):
    print(f"Database not found at {DB_PATH}")
    sys.exit(1)

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("--- Users Table ---")
    cursor.execute("SELECT id, username, role, login_count, is_active, created_at FROM users")
    rows = cursor.fetchall()
    
    if not rows:
        print("No users found in database.")
    
    for row in rows:
        print(f"User: {row[1]}, Role: {row[2]}, Login Count: {row[3]}, Active: {row[4]}")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
