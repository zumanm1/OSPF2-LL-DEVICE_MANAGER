
import json
import os
from datetime import datetime

SESSION_FILE = 'backend/auth_session.json'

data = {
    "login_count": 0,
    "last_login": datetime.now().isoformat()
}

with open(SESSION_FILE, 'w') as f:
    json.dump(data, f, indent=2)

print("Reset auth_session.json")
