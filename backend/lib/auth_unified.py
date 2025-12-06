"""
Unified Authentication Module for OSPF-LL-DEVICE_MANAGER
Supports both legacy session mode and Auth-Vault (Keycloak) mode
"""

import os
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass

from .keycloak_verifier import init_keycloak_verifier, VerifiedUser
from .vault_client import init_vault_client, VaultConfig

logger = logging.getLogger(__name__)


@dataclass
class AuthenticatedUser:
    user_id: str
    username: str
    email: Optional[str]
    role: str
    auth_source: str  # 'legacy' or 'keycloak'


# Module state
_auth_mode: str = 'legacy'
_keycloak_initialized: bool = False
_vault_initialized: bool = False
_vault_config: Optional[VaultConfig] = None


async def init_auth_vault() -> bool:
    """Initialize auth-vault integration"""
    global _auth_mode, _keycloak_initialized, _vault_initialized, _vault_config

    try:
        logger.info("[Auth] Checking Auth-Vault availability...")

        # Try to initialize Keycloak
        keycloak = init_keycloak_verifier()
        keycloak_available = await keycloak.is_available()

        if keycloak_available:
            keycloak_url = os.environ.get('KEYCLOAK_URL', 'http://localhost:9120')
            logger.info(f"[Auth] Keycloak is available at {keycloak_url}")
            _keycloak_initialized = True
        else:
            logger.info("[Auth] Keycloak not available, will use legacy mode")

        # Try to initialize Vault
        vault_role_id = os.environ.get('VAULT_ROLE_ID')
        vault_secret_id = os.environ.get('VAULT_SECRET_ID')
        vault_token = os.environ.get('VAULT_TOKEN')

        if vault_role_id and vault_secret_id:
            try:
                vault = init_vault_client()
                await vault.authenticate()
                _vault_config = await vault.get_config()
                _vault_initialized = True
                logger.info("[Auth] Vault is available, secrets loaded")
            except Exception as e:
                logger.info(f"[Auth] Vault not available: {e}")
        elif vault_token:
            try:
                vault = init_vault_client()
                _vault_config = await vault.get_config()
                _vault_initialized = True
                logger.info("[Auth] Vault is available (token mode), secrets loaded")
            except Exception as e:
                logger.info(f"[Auth] Vault not available: {e}")

        # Determine auth mode
        if _keycloak_initialized:
            _auth_mode = 'keycloak'
            logger.info("[Auth] Mode: Keycloak (Auth-Vault)")
        else:
            _auth_mode = 'legacy'
            logger.info("[Auth] Mode: Legacy session")

        return _keycloak_initialized or _vault_initialized

    except Exception as e:
        logger.error(f"[Auth] Failed to initialize Auth-Vault: {e}")
        return False


def get_jwt_secret(fallback_secret: str) -> str:
    """Get JWT secret (from Vault or fallback)"""
    if _vault_config and _vault_config.jwt_secret:
        return _vault_config.jwt_secret
    return fallback_secret


def get_auth_mode() -> str:
    """Get current auth mode"""
    return _auth_mode


def is_auth_vault_active() -> bool:
    """Check if auth-vault is active"""
    return _keycloak_initialized or _vault_initialized


async def verify_keycloak_token(token: str) -> Optional[AuthenticatedUser]:
    """Verify a Keycloak token and return user info"""
    if not _keycloak_initialized:
        return None

    try:
        keycloak = init_keycloak_verifier()
        user = await keycloak.verify_token(token)

        return AuthenticatedUser(
            user_id=user.id,
            username=user.username,
            email=user.email,
            role=user.roles[0] if user.roles else 'user',
            auth_source='keycloak'
        )
    except Exception as e:
        logger.debug(f"[Auth] Keycloak token verification failed: {e}")
        return None


def get_auth_config() -> Dict[str, Any]:
    """Get auth configuration for frontend"""
    return {
        'auth_mode': _auth_mode,
        'keycloak': {
            'url': os.environ.get('KEYCLOAK_URL', 'http://localhost:9120'),
            'realm': os.environ.get('KEYCLOAK_REALM', 'ospf-device-manager'),
            'client_id': os.environ.get('KEYCLOAK_CLIENT_ID', 'device-manager-frontend'),
        } if _auth_mode == 'keycloak' else None
    }
