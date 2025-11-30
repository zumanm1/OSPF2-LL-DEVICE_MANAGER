
import sqlite3
import hashlib
import os

# Configuration from .env.local
SECRET_KEY = "change-this-to-a-random-secret-key"
SALT = SECRET_KEY[:16]
DB_PATH = 'backend/users.db'
NEW_PASSWORD = "admin123"

def hash_password(password):
    return hashlib.sha256(f"{SALT}{password}".encode()).hexdigest()

def reset_admin_password():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        password_hash = hash_password(NEW_PASSWORD)
        
        cursor.execute("""
            UPDATE users 
            SET password_hash = ? 
            WHERE username = 'admin'
        """, (password_hash,))
        
        if cursor.rowcount > 0:
            print(f"Successfully reset admin password to '{NEW_PASSWORD}'")
        else:
            print("Admin user not found")
            
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_admin_password()
