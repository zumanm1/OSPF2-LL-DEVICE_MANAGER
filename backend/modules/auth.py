"""
Authentication Module for NetMan OSPF Device Manager
Implements session-based authentication with password expiry
"""

import os
import json
import secrets
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict
from pathlib import Path
from .env_config import get_env, load_env_file, reload_env

logger = logging.getLogger(__name__)

# Session storage file (persists login count across restarts)
SESSION_FILE = Path(__file__).parent.parent / "auth_session.json"

# In-memory session store
_active_sessions: Dict[str, dict] = {}
_login_count: int = 0


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
    """Get maximum login uses before password expires (0 = unlimited)"""
    env = load_env_file()
    try:
        return int(env.get('APP_LOGIN_MAX_USES', '10'))
    except ValueError:
        return 10


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


def validate_credentials(username: str, password: str) -> tuple[bool, str]:
    """
    Validate login credentials against .env.local

    Returns:
        Tuple of (success, message)
    """
    env = load_env_file()

    # Check if password expired
    if is_password_expired():
        return False, "Password expired. Please update password in .env.local and restart the application."

    expected_username = env.get('APP_USERNAME', 'admin')
    expected_password = env.get('APP_PASSWORD', '')

    if not expected_password:
        return False, "No password configured in .env.local"

    if username == expected_username and password == expected_password:
        return True, "Login successful"

    return False, "Invalid username or password"


def create_session(username: str) -> str:
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

    # Store session
    _active_sessions[token] = {
        'username': username,
        'created_at': datetime.now().isoformat(),
        'expires_at': (datetime.now() + timedelta(seconds=get_session_timeout())).isoformat(),
        'login_number': _login_count
    }

    logger.info(f"✅ Session created for user '{username}' (login #{_login_count})")

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
        'active_sessions': len(_active_sessions)
    }


# Initialize on module load
_load_session_data()
