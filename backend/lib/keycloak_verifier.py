"""
Keycloak JWT Token Verifier for OSPF-LL-DEVICE_MANAGER
Validates tokens issued by Keycloak using JWKS
"""

import os
import json
import time
import base64
import urllib.request
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

# Try to import jwt, handle if not installed
try:
    import jwt
    from jwt import PyJWKClient
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    logger.warning("PyJWT not installed - Keycloak verification disabled")


@dataclass
class VerifiedUser:
    id: str
    username: str
    email: Optional[str]
    roles: List[str]
    realm_roles: List[str]
    client_roles: List[str]


class KeycloakVerifier:
    def __init__(self, server_url: str, realm: str, client_id: str):
        self.server_url = server_url.rstrip('/')
        self.realm = realm
        self.client_id = client_id
        self.jwks_cache: Dict[str, str] = {}
        self.jwks_cache_expiry: float = 0
        self.jwks_cache_duration: float = 600  # 10 minutes
        self._jwks_client: Optional[Any] = None

    def _get_jwks_uri(self) -> str:
        return f"{self.server_url}/realms/{self.realm}/protocol/openid-connect/certs"

    def _get_issuer(self) -> str:
        return f"{self.server_url}/realms/{self.realm}"

    def _get_jwks_client(self) -> Any:
        if not JWT_AVAILABLE:
            raise RuntimeError("PyJWT is not installed")

        if self._jwks_client is None or time.time() > self.jwks_cache_expiry:
            self._jwks_client = PyJWKClient(self._get_jwks_uri())
            self.jwks_cache_expiry = time.time() + self.jwks_cache_duration

        return self._jwks_client

    async def verify_token(self, token: str) -> VerifiedUser:
        """Verify a Keycloak JWT token and extract user information"""
        if not JWT_AVAILABLE:
            raise RuntimeError("PyJWT is not installed")

        try:
            # Get signing key
            jwks_client = self._get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            # Verify and decode token
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=self._get_issuer(),
                options={"verify_aud": False}  # Keycloak doesn't always set audience
            )

            # Extract roles
            realm_roles = payload.get('realm_access', {}).get('roles', [])
            client_roles = payload.get('resource_access', {}).get(self.client_id, {}).get('roles', [])

            # Determine app role
            app_role = 'user'
            if 'admin' in realm_roles or 'admin' in client_roles:
                app_role = 'admin'
            elif 'viewer' in realm_roles or 'viewer' in client_roles:
                app_role = 'viewer'

            return VerifiedUser(
                id=payload.get('sub', ''),
                username=payload.get('preferred_username', ''),
                email=payload.get('email'),
                roles=[app_role],
                realm_roles=realm_roles,
                client_roles=client_roles
            )

        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            raise

    async def is_available(self) -> bool:
        """Check if Keycloak is available"""
        try:
            url = self._get_jwks_uri()
            req = urllib.request.Request(url, method='GET')
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status == 200
        except Exception as e:
            logger.debug(f"Keycloak not available: {e}")
            return False


# Singleton instance
_keycloak_verifier: Optional[KeycloakVerifier] = None


def init_keycloak_verifier() -> KeycloakVerifier:
    global _keycloak_verifier
    if _keycloak_verifier is None:
        _keycloak_verifier = KeycloakVerifier(
            server_url=os.environ.get('KEYCLOAK_URL', 'http://localhost:9120'),
            realm=os.environ.get('KEYCLOAK_REALM', 'ospf-device-manager'),
            client_id=os.environ.get('KEYCLOAK_CLIENT_ID', 'device-manager-api')
        )
    return _keycloak_verifier


def get_keycloak_verifier() -> KeycloakVerifier:
    if _keycloak_verifier is None:
        raise RuntimeError("Keycloak verifier not initialized")
    return _keycloak_verifier
