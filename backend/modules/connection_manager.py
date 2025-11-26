"""
SSH Connection Manager for Network Devices
Uses Netmiko for robust SSH connections to Cisco routers
"""

import logging
from typing import Optional, Dict
from netmiko import ConnectHandler, NetmikoTimeoutException, NetmikoAuthenticationException
from datetime import datetime

logger = logging.getLogger(__name__)

class DeviceConnectionError(Exception):
    """Custom exception for device connection errors"""
    pass

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
    """Manages SSH connections to network devices using Netmiko"""

    def __init__(self):
        self.active_connections: Dict[str, ConnectHandler] = {}
        logger.info("SSHConnectionManager initialized")

    def connect(self, device_id: str, device_info: dict, timeout: int = 5) -> dict:
        """
        Establish SSH connection to a device
        
        Args:
            device_id: Unique device identifier
            device_info: Dict with ipAddress, username, password, port
            timeout: Connection timeout in seconds
            
        Returns:
            Dict with connection status and info
        """
        try:
            logger.info(f"🔌 Attempting SSH connection to {device_info['deviceName']} ({device_info['ipAddress']})")

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

            # Netmiko device parameters
            device_params = {
                'device_type': netmiko_device_type,
                'host': device_info['ipAddress'],
                'username': device_info['username'],
                'password': device_info['password'],
                'port': device_info.get('port', 22),
                'timeout': timeout,
                'session_log': f"logs/{device_id}_session.log",
                'fast_cli': False,
                'global_delay_factor': 2,
                # Add algorithms for legacy/strict devices
                'conn_timeout': timeout + 5,
                'auth_timeout': timeout + 5,
            }

            # Establish connection
            connection = ConnectHandler(**device_params)
            
            # Store connection
            self.active_connections[device_id] = connection
            
            # Get device prompt
            prompt = connection.find_prompt()
            
            logger.info(f"✅ Successfully connected to {device_info['deviceName']} - Prompt: {prompt}")

            return {
                'status': 'connected',
                'device_id': device_id,
                'device_name': device_info['deviceName'],
                'ip_address': device_info['ipAddress'],
                'prompt': prompt,
                'connected_at': datetime.now().isoformat()
            }

        except Exception as e:
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
            raise DeviceConnectionError(f"Disconnect error: {str(e)}")

    def is_connected(self, device_id: str) -> bool:
        """Check if device is currently connected"""
        return device_id in self.active_connections

    def get_connection(self, device_id: str) -> Optional[ConnectHandler]:
        """Get active connection for a device"""
        return self.active_connections.get(device_id)

    def disconnect_all(self) -> dict:
        """Disconnect from all devices"""
        disconnected_count = 0
        errors = []

        for device_id in list(self.active_connections.keys()):
            try:
                self.disconnect(device_id)
                disconnected_count += 1
            except Exception as e:
                errors.append(f"{device_id}: {str(e)}")

        logger.info(f"🔌 Disconnected from {disconnected_count} devices")

        return {
            'disconnected_count': disconnected_count,
            'errors': errors if errors else None
        }

    def get_active_connections(self) -> list:
        """Get list of all active connection IDs"""
        return list(self.active_connections.keys())

# Global connection manager instance
connection_manager = SSHConnectionManager()
