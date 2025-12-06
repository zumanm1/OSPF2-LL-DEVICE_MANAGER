"""
Vault Client for OSPF-LL-DEVICE_MANAGER
Fetches secrets from HashiCorp Vault using AppRole authentication
"""

import os
import json
import time
import urllib.request
import urllib.error
from typing import Optional, Dict, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class VaultConfig:
    jwt_secret: str
    session_secret: str
    environment: str


class VaultClient:
    def __init__(self, address: str, role_id: Optional[str] = None,
                 secret_id: Optional[str] = None, token: Optional[str] = None):
        self.address = address.rstrip('/')
        self.role_id = role_id
        self.secret_id = secret_id
        self.token = token
        self.token_expiry: float = 0

    def _request(self, method: str, path: str, body: Optional[Dict] = None) -> Dict:
        """Make an HTTP request to Vault"""
        url = f"{self.address}{path}"
        headers = {'Content-Type': 'application/json'}

        if self.token:
            headers['X-Vault-Token'] = self.token

        data = json.dumps(body).encode('utf-8') if body else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            try:
                error_json = json.loads(error_body)
                errors = error_json.get('errors', [str(e)])
            except:
                errors = [str(e)]
            raise RuntimeError(f"Vault error: {', '.join(errors)}")
        except Exception as e:
            raise RuntimeError(f"Vault connection error: {e}")

    async def authenticate(self) -> None:
        """Authenticate with Vault using AppRole"""
        if not self.role_id or not self.secret_id:
            raise RuntimeError("AppRole credentials not configured")

        response = self._request('POST', '/v1/auth/approle/login', {
            'role_id': self.role_id,
            'secret_id': self.secret_id
        })

        auth = response.get('auth', {})
        self.token = auth.get('client_token')
        lease_duration = auth.get('lease_duration', 3600)
        self.token_expiry = time.time() + (lease_duration * 0.75)

        logger.info("[Vault] Authenticated successfully")

    async def _ensure_authenticated(self) -> None:
        """Ensure we have a valid token"""
        if not self.token or time.time() > self.token_expiry:
            await self.authenticate()

    async def get_secret(self, path: str) -> Dict[str, str]:
        """Read a secret from Vault KV-V2"""
        await self._ensure_authenticated()
        response = self._request('GET', f'/v1/ospf-device-manager/data/{path}')
        return response.get('data', {}).get('data', {})

    async def get_config(self) -> VaultConfig:
        """Get application configuration from Vault"""
        secret = await self.get_secret('config')
        return VaultConfig(
            jwt_secret=secret.get('jwt_secret', ''),
            session_secret=secret.get('session_secret', ''),
            environment=secret.get('environment', 'production')
        )

    async def is_available(self) -> bool:
        """Check if Vault is available"""
        try:
            self._request('GET', '/v1/sys/health')
            return True
        except:
            return False


# Singleton instance
_vault_client: Optional[VaultClient] = None


def init_vault_client() -> VaultClient:
    global _vault_client
    if _vault_client is None:
        _vault_client = VaultClient(
            address=os.environ.get('VAULT_ADDR', 'http://localhost:9121'),
            role_id=os.environ.get('VAULT_ROLE_ID'),
            secret_id=os.environ.get('VAULT_SECRET_ID'),
            token=os.environ.get('VAULT_TOKEN')
        )
    return _vault_client


def get_vault_client() -> VaultClient:
    if _vault_client is None:
        raise RuntimeError("Vault client not initialized")
    return _vault_client
