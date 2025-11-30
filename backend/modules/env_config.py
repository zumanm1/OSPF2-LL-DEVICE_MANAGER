"""
Environment Configuration Module
Loads credentials from .env.local file
"""

import os
import logging
from typing import Dict, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# Path to .env.local file (in project root)
ENV_FILE = Path(__file__).parent.parent.parent / ".env.local"

_env_cache: Optional[Dict[str, str]] = None


def load_env_file() -> Dict[str, str]:
    """Load environment variables from .env.local file"""
    global _env_cache
    
    if _env_cache is not None:
        return _env_cache
    
    _env_cache = {}
    
    if not ENV_FILE.exists():
        logger.warning(f"⚠️  Environment file not found: {ENV_FILE}")
        logger.warning("⚠️  Please copy .env.temp to .env.local and configure credentials")
        return _env_cache
    
    try:
        with open(ENV_FILE, 'r') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue
                # Parse KEY=VALUE
                if '=' in line:
                    key, value = line.split('=', 1)
                    _env_cache[key.strip()] = value.strip()
        
        logger.info(f"✅ Loaded environment from {ENV_FILE}")
        logger.info(f"   Router credentials: {'configured' if 'ROUTER_USERNAME' in _env_cache else 'NOT SET'}")
        logger.info(f"   Jumphost: {'enabled' if _env_cache.get('JUMPHOST_ENABLED', '').lower() == 'true' else 'disabled'}")
        
    except Exception as e:
        logger.error(f"❌ Failed to load environment file: {e}")
    
    return _env_cache


def get_env(key: str, default: str = "") -> str:
    """Get an environment variable from .env.local"""
    env = load_env_file()
    return env.get(key, os.environ.get(key, default))


def get_router_credentials() -> Dict[str, str]:
    """Get router SSH credentials from environment"""
    env = load_env_file()
    return {
        'username': env.get('ROUTER_USERNAME', 'cisco'),
        'password': env.get('ROUTER_PASSWORD', 'cisco')
    }


def get_jumphost_config() -> Dict:
    """Get jumphost configuration from environment"""
    env = load_env_file()

    # Support both JUMPHOST_HOST and JUMPHOST_IP for backwards compatibility
    host = env.get('JUMPHOST_HOST', '') or env.get('JUMPHOST_IP', '')

    return {
        'enabled': env.get('JUMPHOST_ENABLED', 'false').lower() == 'true',
        'host': host,
        'port': int(env.get('JUMPHOST_PORT', '22')),
        'username': env.get('JUMPHOST_USERNAME', ''),
        'password': env.get('JUMPHOST_PASSWORD', '')
    }


def reload_env():
    """Force reload of environment file"""
    global _env_cache
    _env_cache = None
    return load_env_file()
