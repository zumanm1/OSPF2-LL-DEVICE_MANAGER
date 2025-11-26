
import sys
import os

# Add current directory to path so we can import backend
sys.path.append(os.getcwd())

from backend.server import init_db

if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("Database initialized.")
