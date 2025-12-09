"""
Authentication Module for NetMan OSPF Device Manager
Implements session-based authentication with password expiry and role-based access control
"""

import os
import json
import secrets
import hashlib
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from pathlib import Path
from enum import Enum
from .env_config import get_env, load_env_file, reload_env

logger = logging.getLogger(__name__)

# Session storage file (persists login count across restarts)
SESSION_FILE = Path(__file__).parent.parent / "auth_session.json"
# User database file
USERS_DB = Path(__file__).parent.parent / "users.db"
# Secure credentials file (stores hashed custom password)
SECURE_CREDS_FILE = Path(__file__).parent.parent / "secure_credentials.json"

# In-memory session store
_active_sessions: Dict[str, dict] = {}
_login_count: int = 0

# Pre-hashed admin reset PIN - SHA256 with fixed salt
# The PIN cannot be reverse-engineered from this hash
_PIN_SALT = "netman-secure-pin-salt-2024"
_ADMIN_RESET_PIN_HASH = "d083fc7db6ad56821245ad428a2ccf55cd491503398abce1080d0295992adbf5"

# Default credentials (fallback when no custom password is set)
_DEFAULT_USERNAME = "admin"
_DEFAULT_PASSWORD = "admin123"


class UserRole(str, Enum):
    """User roles with different permission levels"""
    ADMIN = "admin"       # Full access: can manage users, configure settings, run automation
    OPERATOR = "operator"  # Can run automation, view data, but not manage users
    VIEWER = "viewer"      # Read-only access: can view data but not execute commands


# Permission definitions for each role
ROLE_PERMISSIONS = {
    UserRole.ADMIN: [
        "users.create", "users.delete", "users.update", "users.list",
        "devices.create", "devices.update", "devices.delete", "devices.view",
        "automation.start", "automation.stop", "automation.view",
        "settings.view", "settings.update",
        "database.manage", "database.reset",
        "transform.execute", "transform.view",
        "ospf.design", "ospf.view",
    ],
    UserRole.OPERATOR: [
        "devices.create", "devices.update", "devices.delete", "devices.view",
        "automation.start", "automation.stop", "automation.view",
        "settings.view",
        "transform.execute", "transform.view",
        "ospf.design", "ospf.view",
    ],
    UserRole.VIEWER: [
        "devices.view",
        "automation.view",
        "settings.view",
        "transform.view",
        "ospf.view",
    ],
}


def _init_users_db():
    """Initialize the users database"""
    try:
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()

        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login TEXT,
                login_count INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1
            )
        """)

        # Check if admin user exists, create default if not
        cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
        if cursor.fetchone()[0] == 0:
            # Get default admin password from env
            env = load_env_file()
            default_password = env.get('APP_PASSWORD', 'admin123')
            password_hash = hash_password(default_password)
            now = datetime.now().isoformat()

            cursor.execute("""
                INSERT INTO users (username, password_hash, role, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, ('admin', password_hash, UserRole.ADMIN.value, now, now))
            logger.info("✅ Created default admin user")

        conn.commit()
        conn.close()
        logger.info("✅ Users database initialized")
    except Exception as e:
        logger.error(f"Failed to initialize users database: {e}")


def hash_password(password: str) -> str:
    """Hash a password using SHA-256 with salt"""
    salt = get_secret_key()[:16]  # Use part of secret key as salt
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash"""
    return hash_password(password) == password_hash


def get_user(username: str) -> Optional[dict]:
    """Get user from database"""
    try:
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, password_hash, role, created_at, updated_at,
                   last_login, login_count, is_active
            FROM users WHERE username = ?
        """, (username,))
        row = cursor.fetchone()
        conn.close()

        if row:
            return {
                'id': row[0],
                'username': row[1],
                'password_hash': row[2],
                'role': row[3],
                'created_at': row[4],
                'updated_at': row[5],
                'last_login': row[6],
                'login_count': row[7],
                'is_active': bool(row[8])
            }
        return None
    except Exception as e:
        logger.error(f"Failed to get user: {e}")
        return None


def get_all_users() -> List[dict]:
    """Get all users from database"""
    try:
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, role, created_at, updated_at,
                   last_login, login_count, is_active
            FROM users ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        conn.close()

        return [{
            'id': row[0],
            'username': row[1],
            'role': row[2],
            'created_at': row[3],
            'updated_at': row[4],
            'last_login': row[5],
            'login_count': row[6],
            'is_active': bool(row[7])
        } for row in rows]
    except Exception as e:
        logger.error(f"Failed to get users: {e}")
        return []


def create_user(username: str, password: str, role: str = "viewer") -> tuple[bool, str]:
    """Create a new user"""
    try:
        if role not in [r.value for r in UserRole]:
            return False, f"Invalid role: {role}"

        password_hash = hash_password(password)
        now = datetime.now().isoformat()

        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (username, password_hash, role, now, now))
        conn.commit()
        conn.close()

        logger.info(f"✅ Created user '{username}' with role '{role}'")
        return True, f"User '{username}' created successfully"
    except sqlite3.IntegrityError:
        return False, f"User '{username}' already exists"
    except Exception as e:
        logger.error(f"Failed to create user: {e}")
        return False, str(e)


def update_user(username: str, password: str = None, role: str = None, is_active: bool = None) -> tuple[bool, str]:
    """Update user details"""
    try:
        user = get_user(username)
        if not user:
            return False, f"User '{username}' not found"

        updates = []
        params = []

        if password:
            updates.append("password_hash = ?")
            params.append(hash_password(password))

        if role:
            if role not in [r.value for r in UserRole]:
                return False, f"Invalid role: {role}"
            updates.append("role = ?")
            params.append(role)

        if is_active is not None:
            updates.append("is_active = ?")
            params.append(1 if is_active else 0)

        if not updates:
            return False, "No updates provided"

        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(username)

        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        cursor.execute(f"""
            UPDATE users SET {', '.join(updates)} WHERE username = ?
        """, params)
        conn.commit()
        conn.close()

        logger.info(f"✅ Updated user '{username}'")
        return True, f"User '{username}' updated successfully"
    except Exception as e:
        logger.error(f"Failed to update user: {e}")
        return False, str(e)


def delete_user(username: str) -> tuple[bool, str]:
    """Delete a user"""
    try:
        if username == 'admin':
            return False, "Cannot delete admin user"

        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE username = ?", (username,))
        if cursor.rowcount == 0:
            conn.close()
            return False, f"User '{username}' not found"
        conn.commit()
        conn.close()

        logger.info(f"✅ Deleted user '{username}'")
        return True, f"User '{username}' deleted successfully"
    except Exception as e:
        logger.error(f"Failed to delete user: {e}")
        return False, str(e)


def has_permission(role: str, permission: str) -> bool:
    """Check if a role has a specific permission"""
    try:
        user_role = UserRole(role)
        return permission in ROLE_PERMISSIONS.get(user_role, [])
    except ValueError:
        return False


def get_role_permissions(role: str) -> List[str]:
    """Get all permissions for a role"""
    try:
        user_role = UserRole(role)
        return ROLE_PERMISSIONS.get(user_role, [])
    except ValueError:
        return []


def _load_session_data() -> dict:
    """Load persistent session data from file"""
    global _login_count
    try:
        if SESSION_FILE.exists():
            with open(SESSION_FILE, 'r') as f:
                data = json.load(f)
                _login_count = data.get('login_count', 0)
                return data
    except Exception as e:
        logger.warning(f"Failed to load session data: {e}")
    return {'login_count': 0}


def _save_session_data():
    """Save persistent session data to file"""
    try:
        data = {
            'login_count': _login_count,
            'last_login': datetime.now().isoformat()
        }
        with open(SESSION_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save session data: {e}")


def is_security_enabled() -> bool:
    """Check if security is enabled in environment"""
    env = load_env_file()
    return env.get('SECURITY_ENABLED', 'true').lower() == 'true'


def get_max_login_uses() -> int:
    """Get maximum login uses before password expires (0 = unlimited/permanent)"""
    env = load_env_file()
    try:
        return int(env.get('APP_LOGIN_MAX_USES', '0'))  # Default: 0 = permanent/never expires
    except ValueError:
        return 0  # Default to permanent


def get_session_timeout() -> int:
    """Get session timeout in seconds"""
    env = load_env_file()
    try:
        return int(env.get('APP_SESSION_TIMEOUT', '3600'))
    except ValueError:
        return 3600


def get_secret_key() -> str:
    """Get the application secret key"""
    env = load_env_file()
    return env.get('APP_SECRET_KEY', 'default-secret-key-change-me')


def is_localhost_only() -> bool:
    """Check if access should be restricted to localhost only"""
    env = load_env_file()
    return env.get('LOCALHOST_ONLY', 'true').lower() == 'true'


def get_allowed_hosts() -> list:
    """Get list of allowed hosts"""
    env = load_env_file()
    hosts_str = env.get('ALLOWED_HOSTS', '127.0.0.1,localhost')
    return [h.strip() for h in hosts_str.split(',') if h.strip()]


def get_jumphost_ip() -> str:
    """
    Get current jumphost IP from JSON config file (UI changes) or .env.local fallback.
    This is called dynamically to always get the latest jumphost IP.
    """
    import json
    import os

    # First check JSON config (UI-saved config takes priority)
    jumphost_config_file = Path(__file__).parent.parent / "jumphost_config.json"
    try:
        if jumphost_config_file.exists():
            with open(jumphost_config_file, 'r') as f:
                config = json.load(f)
                if config.get('host'):
                    return config.get('host')
    except Exception:
        pass

    # Fallback to .env.local
    env = load_env_file()
    return env.get('JUMPHOST_HOST', '') or env.get('JUMPHOST_IP', '')


def get_allowed_cors_origins() -> list:
    """
    Get list of allowed CORS origins from environment configuration.
    This prevents wildcard CORS (*) in production.

    Auto-generates CORS origins from ALLOWED_HOSTS for convenience.
    Each allowed host gets origins for both port 9050 (frontend) and 9051 (backend).

    AUTOMATICALLY includes the jumphost IP so users can access from jumphost.

    Returns:
        List of allowed origins (e.g., ['http://localhost:9050', 'http://172.16.39.172:9050'])
    """
    env = load_env_file()

    # If localhost-only mode, only allow localhost origins
    if is_localhost_only():
        return ['http://localhost:9050', 'http://127.0.0.1:9050']

    # Auto-generate origins from ALLOWED_HOSTS
    allowed_hosts = get_allowed_hosts()

    # AUTOMATICALLY include jumphost IP in allowed hosts
    jumphost_ip = get_jumphost_ip()
    if jumphost_ip and jumphost_ip not in allowed_hosts:
        allowed_hosts.append(jumphost_ip)
        logger.info(f"🔗 Auto-added jumphost IP to CORS: {jumphost_ip}")

    origins = []

    for host in allowed_hosts:
        host = host.strip()
        if not host:
            continue

        # Add both frontend (9050) and backend (9051) ports for each host
        # This ensures API calls and WebSocket connections work
        origins.append(f'http://{host}:9050')
        origins.append(f'http://{host}:9051')

        # Also add without port for flexibility (some browsers)
        if host in ['localhost', '127.0.0.1']:
            origins.append(f'http://{host}')

    # Also check explicit CORS_ORIGINS if set (for advanced users)
    cors_str = env.get('CORS_ORIGINS', '')
    if cors_str:
        explicit_origins = [o.strip() for o in cors_str.split(',') if o.strip()]
        for origin in explicit_origins:
            if origin != '*' and origin not in origins:
                origins.append(origin)

    # Never allow wildcard
    if '*' in origins:
        logger.warning("⚠️ Wildcard '*' found in CORS_ORIGINS - removing for security")
        origins = [o for o in origins if o != '*']

    # If no valid origins, fall back to localhost
    if not origins:
        logger.warning("⚠️ No valid CORS origins configured, falling back to localhost only")
        origins = ['http://localhost:9050', 'http://127.0.0.1:9050']

    logger.info(f"🔒 CORS origins from ALLOWED_HOSTS: {origins}")
    return origins


def get_login_count() -> int:
    """Get current login count"""
    global _login_count
    if _login_count == 0:
        _load_session_data()
    return _login_count


def is_password_expired() -> bool:
    """Check if password has expired (exceeded max uses)"""
    max_uses = get_max_login_uses()
    if max_uses == 0:
        return False  # 0 means never expires
    return get_login_count() >= max_uses


def validate_credentials(username: str, password: str) -> tuple[bool, str, Optional[dict]]:
    """
    Validate login credentials against users database

    Returns:
        Tuple of (success, message, user_data)
    """
    # Check if password expired
    if is_password_expired():
        return False, "Password expired. Please update password and restart the application.", None

    # First try database authentication
    user = get_user(username)
    if user:
        if not user.get('is_active', True):
            return False, "User account is disabled", None

        if verify_password(password, user['password_hash']):
            # Update last login
            try:
                conn = sqlite3.connect(USERS_DB)
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE users SET last_login = ?, login_count = login_count + 1
                    WHERE username = ?
                """, (datetime.now().isoformat(), username))
                conn.commit()
                conn.close()
            except Exception as e:
                logger.warning(f"Failed to update user last_login: {e}")

            return True, "Login successful", {
                'username': user['username'],
                'role': user['role'],
                'id': user['id']
            }

    # Fallback to .env.local credentials (for backwards compatibility)
    env = load_env_file()
    expected_username = env.get('APP_USERNAME', 'admin')
    expected_password = env.get('APP_PASSWORD', '')

    if expected_password and username == expected_username and password == expected_password:
        return True, "Login successful", {
            'username': username,
            'role': 'admin',  # .env.local user is always admin
            'id': 0
        }

    return False, "Invalid username or password", None


def create_session(username: str, role: str = "viewer") -> str:
    """
    Create a new session for authenticated user

    Returns:
        Session token
    """
    global _login_count

    # Increment login count
    _login_count += 1
    _save_session_data()

    # Generate secure session token
    token = secrets.token_urlsafe(32)

    # Store session with role
    _active_sessions[token] = {
        'username': username,
        'role': role,
        'created_at': datetime.now().isoformat(),
        'expires_at': (datetime.now() + timedelta(seconds=get_session_timeout())).isoformat(),
        'login_number': _login_count
    }

    logger.info(f"✅ Session created for user '{username}' (role: {role}, login #{_login_count})")

    return token


def validate_session(token: str) -> tuple[bool, Optional[dict]]:
    """
    Validate a session token

    Returns:
        Tuple of (valid, session_data)
    """
    if not token or token not in _active_sessions:
        return False, None

    session = _active_sessions[token]

    # Check expiration
    expires_at = datetime.fromisoformat(session['expires_at'])
    if datetime.now() > expires_at:
        # Session expired, remove it
        del _active_sessions[token]
        logger.info(f"⏰ Session expired for user '{session['username']}'")
        return False, None

    return True, session


def invalidate_session(token: str) -> bool:
    """
    Invalidate (logout) a session

    Returns:
        True if session was invalidated
    """
    if token in _active_sessions:
        username = _active_sessions[token].get('username', 'unknown')
        del _active_sessions[token]
        logger.info(f"🚪 Session invalidated for user '{username}'")
        return True
    return False


def get_session_info(token: str) -> Optional[dict]:
    """Get information about a session"""
    valid, session = validate_session(token)
    if valid and session:
        return {
            'username': session['username'],
            'role': session.get('role', 'viewer'),
            'permissions': get_role_permissions(session.get('role', 'viewer')),
            'created_at': session['created_at'],
            'expires_at': session['expires_at'],
            'login_number': session.get('login_number', 0),
            'logins_remaining': max(0, get_max_login_uses() - get_login_count()) if get_max_login_uses() > 0 else 'unlimited'
        }
    return None


def reset_login_count():
    """Reset the login count (for admin use)"""
    global _login_count
    _login_count = 0
    _save_session_data()
    logger.info("🔄 Login count reset to 0")


def get_auth_status() -> dict:
    """Get current authentication status"""
    return {
        'security_enabled': is_security_enabled(),
        'localhost_only': is_localhost_only(),
        'allowed_hosts': get_allowed_hosts(),
        'login_count': get_login_count(),
        'max_login_uses': get_max_login_uses(),
        'password_expired': is_password_expired(),
        'session_timeout': get_session_timeout(),
        'active_sessions': len(_active_sessions),
        'has_custom_password': has_custom_password()
    }


# ============================================================================
# SECURE PASSWORD MANAGEMENT (with PIN-protected reset)
# ============================================================================

def _hash_pin(pin: str) -> str:
    """Hash a PIN using SHA-256 with fixed salt"""
    return hashlib.sha256(f"{_PIN_SALT}{pin}".encode()).hexdigest()


def verify_admin_pin(pin: str) -> bool:
    """Verify the admin reset PIN"""
    return _hash_pin(pin) == _ADMIN_RESET_PIN_HASH


def _load_secure_credentials() -> Optional[dict]:
    """Load secure credentials from file"""
    try:
        if SECURE_CREDS_FILE.exists():
            with open(SECURE_CREDS_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load secure credentials: {e}")
    return None


def _save_secure_credentials(creds: dict):
    """Save secure credentials to file"""
    try:
        with open(SECURE_CREDS_FILE, 'w') as f:
            json.dump(creds, f, indent=2)
        logger.info("✅ Secure credentials saved")
    except Exception as e:
        logger.error(f"Failed to save secure credentials: {e}")
        raise


def has_custom_password() -> bool:
    """Check if a custom password has been set"""
    creds = _load_secure_credentials()
    return creds is not None and 'password_hash' in creds


def set_custom_password(new_password: str, current_password: str = None) -> tuple[bool, str]:
    """
    Set a custom permanent password for admin user.

    If no custom password exists, current_password can be the default (admin123).
    If custom password exists, current_password must match.

    Returns:
        Tuple of (success, message)
    """
    # Validate new password
    if len(new_password) < 6:
        return False, "Password must be at least 6 characters long"

    # Check current password
    creds = _load_secure_credentials()

    if creds and 'password_hash' in creds:
        # Custom password exists - verify current password
        if not current_password:
            return False, "Current password required"
        current_hash = hash_password(current_password)
        if current_hash != creds['password_hash']:
            return False, "Current password is incorrect"
    else:
        # No custom password - verify against default
        if current_password and current_password != _DEFAULT_PASSWORD:
            # Also try to verify against default
            if current_password != _DEFAULT_PASSWORD:
                return False, "Current password is incorrect"

    # Hash and save new password
    new_hash = hash_password(new_password)
    new_creds = {
        'password_hash': new_hash,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }

    try:
        _save_secure_credentials(new_creds)

        # Also update the database
        try:
            conn = sqlite3.connect(USERS_DB)
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE users SET password_hash = ?, updated_at = ?
                WHERE username = 'admin'
            """, (new_hash, datetime.now().isoformat()))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to update database password: {e}")

        logger.info("✅ Custom password set successfully")
        return True, "Password changed successfully"
    except Exception as e:
        return False, f"Failed to save password: {str(e)}"


def reset_admin_password_with_pin(pin: str) -> tuple[bool, str]:
    """
    Reset admin password to default using PIN verification.

    This removes the custom password and restores default credentials.

    Returns:
        Tuple of (success, message)
    """
    # Verify PIN
    if not verify_admin_pin(pin):
        logger.warning("❌ Invalid PIN attempt for password reset")
        return False, "Invalid PIN"

    # Remove custom credentials file
    try:
        if SECURE_CREDS_FILE.exists():
            SECURE_CREDS_FILE.unlink()
            logger.info("🔄 Custom credentials removed")

        # Reset database password to default
        default_hash = hash_password(_DEFAULT_PASSWORD)
        try:
            conn = sqlite3.connect(USERS_DB)
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE users SET password_hash = ?, updated_at = ?, login_count = 0
                WHERE username = 'admin'
            """, (default_hash, datetime.now().isoformat()))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to reset database password: {e}")

        # Reset login count
        reset_login_count()

        logger.info("✅ Admin password reset to default")
        return True, f"Password reset to default. Username: {_DEFAULT_USERNAME}, Password: {_DEFAULT_PASSWORD}"
    except Exception as e:
        logger.error(f"Failed to reset password: {e}")
        return False, f"Failed to reset password: {str(e)}"


def validate_credentials_secure(username: str, password: str) -> tuple[bool, str, Optional[dict]]:
    """
    Validate login credentials with custom password support.

    Priority:
    1. Check custom password (if set)
    2. Check database user
    3. Fallback to default credentials

    Returns:
        Tuple of (success, message, user_data)
    """
    # Check if password expired (if using expiration)
    if is_password_expired():
        return False, "Password expired. Please reset using PIN.", None

    # For admin user, check custom password first
    if username == _DEFAULT_USERNAME:
        creds = _load_secure_credentials()
        if creds and 'password_hash' in creds:
            # Custom password exists - verify against it
            if hash_password(password) == creds['password_hash']:
                # Update last login in database
                try:
                    conn = sqlite3.connect(USERS_DB)
                    cursor = conn.cursor()
                    cursor.execute("""
                        UPDATE users SET last_login = ?, login_count = login_count + 1
                        WHERE username = ?
                    """, (datetime.now().isoformat(), username))
                    conn.commit()
                    conn.close()
                except Exception as e:
                    logger.warning(f"Failed to update last_login: {e}")

                return True, "Login successful", {
                    'username': username,
                    'role': 'admin',
                    'id': 1
                }
            else:
                return False, "Invalid password", None

    # Fall through to original validation (database + .env fallback)
    return validate_credentials(username, password)


def get_password_status() -> dict:
    """Get password configuration status (for UI display)"""
    custom = has_custom_password()
    return {
        'has_custom_password': custom,
        'password_type': 'custom' if custom else 'default',
        'default_username': _DEFAULT_USERNAME,
        'can_change_password': True,
        'requires_pin_for_reset': True,
        'message': 'Custom password set (secure hashed)' if custom else 'Using default credentials (admin/admin123)'
    }


# Initialize on module load
_load_session_data()
_init_users_db()
