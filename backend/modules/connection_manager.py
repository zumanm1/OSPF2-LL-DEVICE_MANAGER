"""
SSH Connection Manager for Network Devices
Uses Netmiko for robust SSH connections to Cisco routers
Supports SSH jump host / bastion host tunneling
"""

import logging
import socket
import json
import os
import threading
import time
from typing import Optional, Dict
from netmiko import ConnectHandler, NetmikoTimeoutException, NetmikoAuthenticationException
from paramiko import SSHClient, AutoAddPolicy, RSAKey
from datetime import datetime
from .env_config import get_router_credentials, get_jumphost_config as get_env_jumphost_config, reload_env
from .audit_logger import AuditLogger, DeviceOperationAudit

logger = logging.getLogger(__name__)

# Jumphost configuration file path (fallback for UI config)
JUMPHOST_CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "jumphost_config.json")

# Default jumphost configuration (no credentials - must be configured)
DEFAULT_JUMPHOST_CONFIG = {
    "enabled": False,
    "host": "",
    "port": 22,
    "username": "",
    "password": ""
}

class DeviceConnectionError(Exception):
    """Custom exception for device connection errors"""
    pass


def load_jumphost_config() -> Dict:
    """
    Load jumphost configuration - PRIORITY ORDER:
    1. JSON file (UI-saved config) - PRIMARY SOURCE
    2. .env.local (fallback for initial setup only)

    This ensures UI changes take effect immediately without server restart.
    """
    # PRIMARY: Check JSON file first (UI saves here)
    try:
        if os.path.exists(JUMPHOST_CONFIG_FILE):
            with open(JUMPHOST_CONFIG_FILE, 'r') as f:
                config = json.load(f)
                # If JSON has a valid config (host is set or explicitly enabled/disabled), use it
                if config.get('host') or 'enabled' in config:
                    merged = {**DEFAULT_JUMPHOST_CONFIG, **config}
                    logger.debug(f"Using jumphost config from JSON: enabled={merged.get('enabled')}, host={merged.get('host')}")
                    return merged
    except Exception as e:
        logger.warning(f"Failed to load jumphost JSON config: {e}")

    # FALLBACK: Check .env.local only if JSON doesn't exist or has no config
    env_config = get_env_jumphost_config()
    if env_config.get('host'):
        logger.debug(f"Using jumphost config from .env.local: {env_config.get('host')}")
        return env_config

    # DEFAULT: Return default config
    logger.debug("Using default jumphost config (disabled)")
    return DEFAULT_JUMPHOST_CONFIG.copy()


def save_jumphost_config(config: Dict) -> bool:
    """Save jumphost configuration to file and invalidate any cached tunnel"""
    try:
        with open(JUMPHOST_CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        logger.info(f"Jumphost config saved: enabled={config.get('enabled')}, host={config.get('host')}")

        # IMPORTANT: Close existing tunnel so next connection uses new config
        # This ensures UI changes take effect immediately
        # Note: connection_manager is defined at module level below, access via globals()
        global connection_manager
        if 'connection_manager' in globals() and connection_manager and connection_manager.jumphost_tunnel:
            logger.info("Closing existing jumphost tunnel due to config change...")
            connection_manager.close_jumphost_tunnel()

        return True
    except Exception as e:
        logger.error(f"Failed to save jumphost config: {e}")
        return False


class JumphostTunnel:
    """Manages SSH tunnel through a jumphost/bastion server"""

    def __init__(self, jumphost_config: Dict):
        self.config = jumphost_config
        self.ssh_client: Optional[SSHClient] = None
        self.transport = None
        self.connect_time: Optional[datetime] = None

    def connect(self) -> bool:
        """Establish connection to the jumphost"""
        try:
            self.ssh_client = SSHClient()
            self.ssh_client.set_missing_host_key_policy(AutoAddPolicy())

            logger.info(f"🔌 Connecting to jumphost {self.config['host']}:{self.config['port']}...")

            self.ssh_client.connect(
                hostname=self.config['host'],
                port=self.config.get('port', 22),
                username=self.config['username'],
                password=self.config['password'],
                timeout=30,
                allow_agent=False,
                look_for_keys=False
            )

            self.transport = self.ssh_client.get_transport()
            self.connect_time = datetime.now()
            logger.info(f"✅ Connected to jumphost {self.config['host']}")

            # Audit log: jumphost connection success
            AuditLogger.log_jumphost_connect(
                self.config['host'], self.config.get('port', 22),
                self.config['username'], success=True
            )
            return True

        except Exception as e:
            logger.error(f"❌ Failed to connect to jumphost: {e}")
            # Audit log: jumphost connection failure
            AuditLogger.log_jumphost_connect(
                self.config['host'], self.config.get('port', 22),
                self.config['username'], success=False, error_message=str(e)
            )
            self.close()
            raise DeviceConnectionError(f"Jumphost connection failed: {e}")

    def create_channel(self, target_host: str, target_port: int = 22) -> socket.socket:
        """Create a tunnel channel to the target device through the jumphost"""
        if not self.transport:
            raise DeviceConnectionError("Jumphost not connected")

        try:
            logger.info(f"🔗 Creating tunnel to {target_host}:{target_port} via jumphost...")

            # Create a direct-tcpip channel (SSH tunnel)
            channel = self.transport.open_channel(
                "direct-tcpip",
                (target_host, target_port),
                ("127.0.0.1", 0)
            )

            if channel is None:
                raise DeviceConnectionError(f"Failed to create tunnel to {target_host}")

            logger.info(f"✅ Tunnel established to {target_host}:{target_port}")
            return channel

        except Exception as e:
            logger.error(f"❌ Failed to create tunnel to {target_host}: {e}")
            raise DeviceConnectionError(f"Tunnel creation failed: {e}")

    def close(self):
        """Close the jumphost connection"""
        if self.ssh_client:
            # Audit log: jumphost disconnection with session duration
            if self.connect_time:
                duration = (datetime.now() - self.connect_time).total_seconds()
                AuditLogger.log_jumphost_disconnect(self.config['host'], duration)

            try:
                self.ssh_client.close()
            except:
                pass
            self.ssh_client = None
            self.transport = None
            self.connect_time = None

class MockConnection:
    """Mock connection for development/demo purposes when real devices are unreachable"""
    def __init__(self, hostname, ip_address):
        self.hostname = hostname
        self.ip_address = ip_address
        
    def find_prompt(self):
        return f"{self.hostname}#"
        
    def send_command(self, command, **kwargs):
        logger.info(f"🔮 Mock execution: {command} on {self.hostname}")
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        if "show process cpu" in command:
            return f"""
CPU utilization for five seconds: 8%/0%; one minute: 8%; five minutes: 7%
 PID Runtime(ms)     Invoked      uSecs   5Sec   1Min   5Min TTY Process 
  88     1234567     1234567       1000  0.00%  0.00%  0.00%   0 Check heaps
"""
        elif "show process memory" in command:
            return f"""
Processor Pool Total: 1000000000 Used: 200000000 Free: 800000000
"""
        elif "show route connected" in command:
            return f"""
C    192.168.1.0/24 is directly connected, GigabitEthernet1
C    10.0.0.0/8 is directly connected, GigabitEthernet2
"""
        elif "show route ospf" in command:
            return f"""
O    172.16.0.0/24 [110/2] via 10.0.0.2, 00:00:12, GigabitEthernet2
"""
        elif "show ospf database" in command:
            return f"""
            OSPF Router with ID ({self.ip_address}) (Process ID 1)

                Router Link States (Area 0)

Link ID         ADV Router      Age         Seq#       Checksum Link count
{self.ip_address}     {self.ip_address}     100         0x80000001 0x0000   2
"""
        elif "show ip ospf neighbor" in command:
            return f"""
Neighbor ID     Pri   State           Dead Time   Address         Interface
172.16.1.1      1     FULL/DR         00:00:35    172.13.0.1      GigabitEthernet0/0/0/0
172.16.2.2      1     FULL/BDR        00:00:38    172.13.0.2      GigabitEthernet0/0/0/1
"""
        elif "show cdp neighbor" in command:
            return f"""
Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge
                  S - Switch, H - Host, I - IGMP, r - Repeater

Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID
neighbor-r1      Gig 0/1           120          R S I     ASR9K     Gig 0/2
"""
        
        return f"Mock output for '{command}' from {self.hostname}"
        
    def disconnect(self):
        pass

class SSHConnectionManager:
    """Manages SSH connections to network devices using Netmiko with optional jumphost support"""

    def __init__(self):
        self.active_connections: Dict[str, ConnectHandler] = {}
        self.jumphost_tunnel: Optional[JumphostTunnel] = None
        self.device_channels: Dict[str, any] = {}  # Track channels per device for cleanup
        self._jumphost_lock = threading.Lock()  # Thread-safe jumphost access
        logger.info("SSHConnectionManager initialized")

    def _ensure_jumphost_connected(self) -> Optional[JumphostTunnel]:
        """Ensure jumphost is connected if enabled, return tunnel or None (thread-safe)"""
        jumphost_config = load_jumphost_config()

        if not jumphost_config.get('enabled', False):
            return None

        with self._jumphost_lock:
            # Reuse existing tunnel if still valid
            if self.jumphost_tunnel and self.jumphost_tunnel.transport:
                if self.jumphost_tunnel.transport.is_active():
                    return self.jumphost_tunnel
                else:
                    logger.warning("Jumphost tunnel expired, reconnecting...")
                    self.jumphost_tunnel.close()

            # Create new tunnel
            self.jumphost_tunnel = JumphostTunnel(jumphost_config)
            self.jumphost_tunnel.connect()
            return self.jumphost_tunnel

    def connect(self, device_id: str, device_info: dict, timeout: int = 5) -> dict:
        """
        Establish SSH connection to a device (MUST go through jumphost when enabled)

        Args:
            device_id: Unique device identifier
            device_info: Dict with ipAddress, username, password, port
            timeout: Connection timeout in seconds

        Returns:
            Dict with connection status and info
        """
        try:
            logger.info(f"🔌 Attempting SSH connection to {device_info['deviceName']} ({device_info['ipAddress']})")

            # SECURITY: Check if jumphost is required
            jumphost_config = load_jumphost_config()
            jumphost_required = jumphost_config.get('enabled', False)

            if jumphost_required:
                # ENFORCE: All connections MUST go through jumphost
                logger.info(f"🔒 Jumphost REQUIRED - all connections must route via {jumphost_config['host']}")

            # Check if jumphost is enabled and connect through it
            jumphost_tunnel = self._ensure_jumphost_connected()
            via_jumphost = jumphost_tunnel is not None

            # SECURITY: Block direct connections when jumphost is required
            if jumphost_required and not via_jumphost:
                raise DeviceConnectionError(
                    f"SECURITY: Jumphost is required but tunnel is not available. "
                    f"Cannot make direct connection to {device_info['ipAddress']}. "
                    f"Check jumphost configuration: {jumphost_config['host']}:{jumphost_config.get('port', 22)}"
                )

            if via_jumphost:
                logger.info(f"🔗 Routing connection via jumphost {jumphost_config['host']}")

            # Determine Netmiko device_type based on software/platform
            netmiko_device_type = 'cisco_ios' # Default
            software = device_info.get('software', '').upper()
            platform = device_info.get('platform', '').upper()

            if 'XR' in software or 'ASR9' in platform:
                netmiko_device_type = 'cisco_xr'
            elif 'NX' in software or 'NEXUS' in platform:
                netmiko_device_type = 'cisco_nxos'
            elif 'XE' in software:
                netmiko_device_type = 'cisco_ios'

            logger.info(f"🔧 Using Netmiko driver: {netmiko_device_type} for {device_info['deviceName']}")

            # Get device credentials:
            # - Username: from device record (defaults to 'cisco')
            # - Password: ALWAYS from jumphost config (all devices share same credentials)
            device_username = device_info.get('username', '').strip() or 'cisco'

            # PASSWORD: Always use jumphost password - all devices share same credentials
            # This matches the real-world scenario where routers and jumphost use identical creds
            device_password = jumphost_config.get('password', '').strip()

            if not device_password:
                # Fallback to .env.local only if jumphost password not configured
                router_creds = get_router_credentials()
                device_password = router_creds.get('password', '')
                logger.info(f"🔑 Using fallback password from .env.local for {device_info['deviceName']}")
            else:
                logger.info(f"🔑 Using jumphost password for {device_info['deviceName']} (shared credentials)")

            # Netmiko device parameters
            device_params = {
                'device_type': netmiko_device_type,
                'host': device_info['ipAddress'],
                'username': device_username,  # Per-device or fallback
                'password': device_password,  # Per-device or fallback
                'port': device_info.get('port', 22),
                'timeout': timeout,
                'session_log': f"logs/{device_id}_session.log",
                'fast_cli': False,
                'global_delay_factor': 2,
                # Add algorithms for legacy/strict devices
                'conn_timeout': timeout + 5,
                'auth_timeout': timeout + 5,
            }

            # If using jumphost, create tunnel channel and pass as socket (thread-safe)
            if via_jumphost:
                with self._jumphost_lock:
                    channel = jumphost_tunnel.create_channel(
                        device_info['ipAddress'],
                        device_info.get('port', 22)
                    )
                    device_params['sock'] = channel
                    self.device_channels[device_id] = channel
                logger.info(f"🔗 Using jumphost tunnel for {device_info['deviceName']}")

            # Establish connection
            connection = ConnectHandler(**device_params)
            
            # Store connection
            self.active_connections[device_id] = connection
            
            # Get device prompt
            prompt = connection.find_prompt()
            
            jumphost_info = None
            if via_jumphost:
                jumphost_config = load_jumphost_config()
                jumphost_info = f"{jumphost_config['host']}:{jumphost_config.get('port', 22)}"

            logger.info(f"✅ Successfully connected to {device_info['deviceName']} - Prompt: {prompt}" +
                        (f" (via jumphost {jumphost_info})" if jumphost_info else ""))

            # Audit log: device connection success
            AuditLogger.log_device_connect(
                device_id, device_info['deviceName'], device_info['ipAddress'],
                via_jumphost=via_jumphost,
                jumphost_host=jumphost_info.split(':')[0] if jumphost_info else None,
                success=True
            )

            return {
                'status': 'connected',
                'device_id': device_id,
                'device_name': device_info['deviceName'],
                'ip_address': device_info['ipAddress'],
                'prompt': prompt,
                'connected_at': datetime.now().isoformat(),
                'via_jumphost': jumphost_info
            }

        except Exception as e:
            # Audit log: device connection failure
            AuditLogger.log_device_connect(
                device_id, device_info.get('deviceName', device_id), device_info.get('ipAddress', 'unknown'),
                via_jumphost=jumphost_config.get('enabled', False) if 'jumphost_config' in dir() else False,
                jumphost_host=jumphost_config.get('host') if 'jumphost_config' in dir() else None,
                success=False, error_message=str(e)
            )

            # NO MOCK FALLBACK - Connection failures should be explicit
            logger.error(f"❌ SSH connection FAILED to {device_info['deviceName']} ({device_info['ipAddress']}): {str(e)}")

            raise DeviceConnectionError(f"SSH connection failed to {device_info['deviceName']} ({device_info['ipAddress']}): {str(e)}")

    def disconnect(self, device_id: str) -> dict:
        """
        Disconnect from a device

        Args:
            device_id: Device to disconnect from

        Returns:
            Dict with disconnection status
        """
        try:
            if device_id not in self.active_connections:
                logger.warning(f"⚠️  Device {device_id} not connected")
                return {'status': 'not_connected', 'device_id': device_id}

            connection = self.active_connections[device_id]
            connection.disconnect()
            del self.active_connections[device_id]

            # Clean up channel if it exists
            if device_id in self.device_channels:
                try:
                    self.device_channels[device_id].close()
                except:
                    pass
                del self.device_channels[device_id]

            logger.info(f"✅ Disconnected from device {device_id}")

            return {
                'status': 'disconnected',
                'device_id': device_id,
                'disconnected_at': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"❌ Error disconnecting from {device_id}: {str(e)}")
            # Remove from active connections anyway
            self.active_connections.pop(device_id, None)
            self.device_channels.pop(device_id, None)
            raise DeviceConnectionError(f"Disconnect error: {str(e)}")

    def is_connected(self, device_id: str) -> bool:
        """Check if device is currently connected"""
        return device_id in self.active_connections

    def get_connection(self, device_id: str) -> Optional[ConnectHandler]:
        """Get active connection for a device"""
        return self.active_connections.get(device_id)

    def disconnect_all(self) -> dict:
        """Disconnect from all devices and close jumphost tunnel"""
        disconnected_count = 0
        errors = []

        for device_id in list(self.active_connections.keys()):
            try:
                self.disconnect(device_id)
                disconnected_count += 1
            except Exception as e:
                errors.append(f"{device_id}: {str(e)}")

        # Close jumphost tunnel if no devices are connected
        if len(self.active_connections) == 0 and self.jumphost_tunnel:
            self.close_jumphost_tunnel()

        logger.info(f"🔌 Disconnected from {disconnected_count} devices")

        return {
            'disconnected_count': disconnected_count,
            'errors': errors if errors else None
        }

    def close_jumphost_tunnel(self):
        """Close the jumphost tunnel"""
        if self.jumphost_tunnel:
            logger.info("🔌 Closing jumphost tunnel...")
            self.jumphost_tunnel.close()
            self.jumphost_tunnel = None

    def get_jumphost_status(self) -> dict:
        """Get current jumphost configuration and connection status"""
        config = load_jumphost_config()
        is_connected = (
            self.jumphost_tunnel is not None and
            self.jumphost_tunnel.transport is not None and
            self.jumphost_tunnel.transport.is_active()
        )

        return {
            'enabled': config.get('enabled', False),
            'host': config.get('host', ''),
            'port': config.get('port', 22),
            'username': config.get('username', ''),
            'connected': is_connected,
            'active_tunnels': len(self.device_channels)
        }

    def get_active_connections(self) -> list:
        """Get list of all active connection IDs"""
        return list(self.active_connections.keys())

# Global connection manager instance
connection_manager = SSHConnectionManager()
