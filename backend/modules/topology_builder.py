"""
Topology Builder for Network Visualization
Parses OSPF and CDP data to build a network topology JSON
Supports asymmetric OSPF costs from running-config and operational data
"""

import logging
import os
import json
import re
from typing import List, Dict, Optional, Set, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

# NOTE: Topology is built DYNAMICALLY from OSPF neighbor data
# No hardcoded links or router patterns - supports any IOS-XR topology
# Country code is extracted from first 3 characters of hostname (ISO 3166-1 alpha-3)

# Default OSPF cost for GigabitEthernet interfaces
DEFAULT_OSPF_COST = 1

def get_current_data_dirs():
    """
    Get the current data directories, preferring the 'current' symlink
    which points to the latest automation execution.

    Returns:
        tuple: (text_dir, json_dir) paths
    """
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    current_link = os.path.join(backend_dir, "data", "current")

    # If 'current' symlink exists and is valid, use it
    if os.path.exists(current_link) and os.path.islink(current_link):
        target = os.path.realpath(current_link)
        if os.path.exists(target):
            text_dir = os.path.join(target, "TEXT")
            json_dir = os.path.join(target, "JSON")

            # Only use if directories exist
            if os.path.exists(text_dir) and os.path.exists(json_dir):
                logger.info(f"📁 TopologyBuilder using 'current' symlink: {target}")
                return text_dir, json_dir

    # Fallback to legacy OUTPUT-Data_save (for backwards compatibility)
    legacy_text = os.path.join(backend_dir, "data", "OUTPUT-Data_save", "TEXT")
    legacy_json = os.path.join(backend_dir, "data", "OUTPUT-Data_save", "JSON")
    logger.info(f"📁 TopologyBuilder using legacy data path: OUTPUT-Data_save")
    return legacy_text, legacy_json

class TopologyBuilder:
    """Builds network topology from parsed device data"""

    def __init__(self, text_dir: str = None, output_dir: str = "data/OUTPUT-Transformation"):
        # Convert to absolute paths to avoid working directory issues
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        # Use provided text_dir or auto-detect from 'current' symlink
        if text_dir:
            if not os.path.isabs(text_dir):
                self.text_dir = os.path.join(backend_dir, text_dir)
            else:
                self.text_dir = text_dir
        else:
            # Auto-detect: prefer 'current' symlink, fallback to legacy
            self.text_dir, _ = get_current_data_dirs()

        if not os.path.isabs(output_dir):
            self.output_dir = os.path.join(backend_dir, output_dir)
        else:
            self.output_dir = output_dir

        # Ensure output directory exists
        os.makedirs(self.output_dir, exist_ok=True)

        logger.info(f"TopologyBuilder initialized - Source: {self.text_dir}, Output: {self.output_dir}")

    def _parse_cdp_neighbors(self, content: str) -> List[Dict]:
        """
        Parse 'show cdp neighbors' output to find direct links

        Sample Output (IOS-XR):
        Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID
        usa-r2          Gig 0/0/0/0       179        R I       ASR9K     Gig 0/0/0/0

        Sample Output (IOS):
        Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID
        zim-r2           Fas 0/1          165              R S   C3725     Fas 0/1
        """
        links = []
        lines = content.splitlines()

        # Regex to match CDP neighbor lines (simplified for common Cisco output)
        # Matches: DeviceID, LocalInt, Platform, PortID
        # Note: This is a basic parser. pyATS would be better for production.

        start_parsing = False
        for line in lines:
            if "Device ID" in line:
                start_parsing = True
                continue

            if not start_parsing or not line.strip():
                continue

            # Skip continuation lines (lines that start with spaces - wrapped output)
            if line.startswith(' ') or line.startswith('\t'):
                continue

            parts = line.split()
            if len(parts) >= 5:
                # Heuristic parsing based on column spacing
                # Assuming Device ID is first, Local Int is second, Port ID is last
                neighbor_id = parts[0].strip()

                # Clean neighbor ID - remove domain suffix if present
                if '.' in neighbor_id:
                    neighbor_id = neighbor_id.split('.')[0]

                local_int = parts[1] + (parts[2] if len(parts) > 2 and parts[2][0].isdigit() else "")

                # Extract Port ID (usually at the end)
                # This is tricky with split(), let's look for interface patterns
                remote_int_match = re.search(r'(Gig|Fast|Ten|Et|Hu|Fo)[a-zA-Z]*\s?[\d/]+', line.split("  ")[-1])
                remote_int = remote_int_match.group(0).strip() if remote_int_match else "Unknown"

                # CRITICAL: Clean any garbage from interface names (e.g., \nHoldtime)
                # Remove any newlines, carriage returns, or "Holdtime" text
                local_int = self._clean_interface_name(local_int)
                remote_int = self._clean_interface_name(remote_int)

                links.append({
                    "neighbor_id": neighbor_id,
                    "local_interface": local_int,
                    "remote_interface": remote_int
                })

        return links

    def _clean_interface_name(self, interface: str) -> str:
        """
        Clean interface name by removing garbage characters and text.

        Fixes issues like:
        - "FastEthernet1/0\nHoldtime" -> "FastEthernet1/0"
        - "Gig 0/0/0/0 " -> "Gig0/0/0/0"
        """
        if not interface:
            return "Unknown"

        # Remove newlines, carriage returns, tabs
        interface = interface.replace('\n', '').replace('\r', '').replace('\t', '')

        # Remove "Holdtime" and other CDP garbage that might leak through
        interface = re.sub(r'Holdtime.*', '', interface, flags=re.IGNORECASE)
        interface = re.sub(r'Capability.*', '', interface, flags=re.IGNORECASE)

        # Remove extra spaces
        interface = re.sub(r'\s+', '', interface)

        # Strip leading/trailing whitespace
        interface = interface.strip()

        return interface if interface else "Unknown"

    def _parse_ospf_database(self, content: str) -> List[str]:
        """
        Parse 'show ospf database' to get Router IDs
        """
        router_ids = set()
        lines = content.splitlines()

        for line in lines:
            # Match Router Link States (Area 0)
            # Link State ID   ADV Router      Age         Seq#       Checksum Link count
            # 1.1.1.1         1.1.1.1         1234        0x80000001 0x1234   2
            match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
            if match:
                router_ids.add(match.group(1))

        return list(router_ids)

    def _parse_ospf_database_router_lsa(self, content: str, source_router_id: str) -> Dict[str, int]:
        """
        Parse 'show ip ospf database router' or 'show ospf database router' to extract link costs.

        Returns a dict mapping: {neighbor_router_id: ospf_cost}

        Sample Output (IOS):
            Link connected to: a Transit Network
             (Link ID) Designated Router address: 192.168.14.10
             (Link Data) Router Interface address: 192.168.14.9
              Number of TOS metrics: 0
               TOS 0 Metrics: 3450

        Sample Output (IOS-XR):
            Links connected to: a Transit Network
             (Link ID) Designated Router address: 172.13.0.10
             (Link Data) Router Interface address: 172.13.0.9
              TOS 0 metric: 100
        """
        link_costs = {}
        lines = content.splitlines()

        current_router_id = None
        current_link_id = None

        i = 0
        while i < len(lines):
            line = lines[i]

            # Match Router ID being advertised
            router_id_match = re.search(r'Link State ID:\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
            if router_id_match:
                current_router_id = router_id_match.group(1)
                i += 1
                continue

            # Match "Advertising Router" (more reliable)
            adv_router_match = re.search(r'Advertising Router:\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
            if adv_router_match:
                current_router_id = adv_router_match.group(1)
                i += 1
                continue

            # Only parse links from the source router (our device)
            if current_router_id != source_router_id:
                i += 1
                continue

            # Match Transit Network link (point-to-point OSPF adjacency)
            if "Link connected to: a Transit Network" in line or "Links connected to: a Transit Network" in line:
                # Next few lines contain Link ID and cost
                j = i + 1
                link_id = None
                cost = None

                while j < min(i + 10, len(lines)):  # Look ahead up to 10 lines
                    next_line = lines[j]

                    # Extract Designated Router address (Link ID)
                    link_id_match = re.search(r'\(Link ID\)\s+Designated Router address:\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', next_line)
                    if link_id_match:
                        link_id = link_id_match.group(1)

                    # Extract OSPF cost (TOS 0 Metrics or TOS 0 metric)
                    cost_match = re.search(r'TOS 0 [Mm]etrics?:\s+(\d+)', next_line)
                    if cost_match:
                        cost = int(cost_match.group(1))
                        break

                    j += 1

                # Store the link_id -> cost mapping (we'll resolve to neighbor later)
                if link_id and cost:
                    link_costs[link_id] = cost
                    logger.debug(f"Extracted OSPF cost: Link ID {link_id} -> cost {cost} (from router {source_router_id})")

                i = j
            else:
                i += 1

        return link_costs

    def _parse_ospf_network_lsa(self, content: str) -> Dict[str, List[str]]:
        """
        Parse 'show ip ospf database network' to map Link IDs to attached routers.

        Returns: {link_id (DR address): [list of attached router IDs]}

        Sample:
          Link State ID: 192.168.14.2 (address of Designated Router)
          Advertising Router: 172.16.2.2
          Attached Router: 172.16.2.2
          Attached Router: 172.16.1.1
        """
        network_map = {}
        lines = content.splitlines()

        current_link_id = None
        i = 0

        while i < len(lines):
            line = lines[i]

            # Match Link State ID (this is the DR address / link identifier)
            link_id_match = re.search(r'Link State ID:\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
            if link_id_match:
                current_link_id = link_id_match.group(1)
                network_map[current_link_id] = []
                i += 1
                continue

            # Match Attached Routers
            if current_link_id and "Attached Router:" in line:
                router_match = re.search(r'Attached Router:\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
                if router_match:
                    router_id = router_match.group(1)
                    network_map[current_link_id].append(router_id)

            i += 1

        return network_map

    def _parse_ospf_interface_brief(self, content: str) -> Dict[str, int]:
        """
        Parse 'show ip ospf interface brief' to get interface-specific OSPF costs.

        Returns: {interface_name: ospf_cost}

        Sample Output:
        Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C
        Fa2/0        1     0               192.168.14.45/30   900   BDR   1/1
        Fa0/1        1     0               192.168.14.42/30   7500  BDR   1/1
        """
        interface_costs = {}
        lines = content.splitlines()

        start_parsing = False
        for line in lines:
            if "Interface" in line and "Cost" in line:
                start_parsing = True
                continue

            if not start_parsing or not line.strip():
                continue

            parts = line.split()
            if len(parts) >= 5:
                interface = parts[0]
                try:
                    cost = int(parts[4])
                    interface_costs[interface] = cost
                    logger.debug(f"Parsed interface cost: {interface} -> {cost}")
                except (ValueError, IndexError):
                    pass

        return interface_costs

    def _parse_running_config_router_ospf(self, content: str) -> Dict[str, int]:
        """
        Parse 'show running-config router ospf' to extract explicitly configured OSPF interface costs.

        Returns: {interface_name: configured_cost}

        Sample IOS-XR Output:
            router ospf 1
             area 0
              interface GigabitEthernet0/0/0/1
               cost 200
              !
              interface GigabitEthernet0/0/0/2.300
               cost 1000
              !
        """
        configured_costs = {}
        lines = content.splitlines()

        current_interface = None
        in_ospf_area = False

        for line in lines:
            stripped = line.strip()

            # Track when we're in OSPF area configuration
            if stripped.startswith('area '):
                in_ospf_area = True
                continue

            # Track interface context
            if in_ospf_area and stripped.startswith('interface '):
                current_interface = stripped.replace('interface ', '').strip()
                continue

            # Extract cost if we're in an interface context
            if current_interface and 'cost ' in stripped:
                cost_match = re.search(r'cost\s+(\d+)', stripped)
                if cost_match:
                    cost = int(cost_match.group(1))
                    configured_costs[current_interface] = cost
                    logger.debug(f"Parsed configured cost: {current_interface} -> {cost}")

            # Exit interface context on '!'
            if stripped == '!':
                current_interface = None

        return configured_costs

    def _normalize_interface_name(self, interface: str) -> str:
        """
        Normalize interface names for matching.
        Handles abbreviated names from 'show ospf interface brief' vs full names from config.
        Supports ALL IOS-XR interface types dynamically.

        Examples:
            Gi0/0/0/1 -> GigabitEthernet0/0/0/1
            BE200 -> Bundle-Ether200
            Te0/0/0/0 -> TenGigE0/0/0/0
            Hu0/0/0/0 -> HundredGigE0/0/0/0
        """
        # IOS-XR interface abbreviation to full name mapping
        # Ordered by specificity (longer abbreviations first)
        IOSXR_INTERFACE_MAP = [
            ('HundredGigE', 'HundredGigE'),  # Full name passthrough
            ('FortyGigE', 'FortyGigE'),
            ('TwentyFiveGigE', 'TwentyFiveGigE'),
            ('TenGigE', 'TenGigE'),
            ('GigabitEthernet', 'GigabitEthernet'),
            ('Bundle-Ether', 'Bundle-Ether'),
            ('Loopback', 'Loopback'),
            ('MgmtEth', 'MgmtEth'),
            ('BVI', 'BVI'),
            ('tunnel-ip', 'tunnel-ip'),
            ('tunnel-te', 'tunnel-te'),
            ('NVE', 'NVE'),
            # Abbreviations
            ('Hu', 'HundredGigE'),
            ('Fo', 'FortyGigE'),
            ('Tf', 'TwentyFiveGigE'),
            ('Te', 'TenGigE'),
            ('Gi', 'GigabitEthernet'),
            ('BE', 'Bundle-Ether'),
            ('Lo', 'Loopback'),
            ('Mg', 'MgmtEth'),
        ]

        # Check if already a full name
        for full_name, _ in IOSXR_INTERFACE_MAP[:12]:  # First 12 are full names
            if interface.startswith(full_name):
                return interface

        # Try to expand abbreviation
        for abbrev, full_name in IOSXR_INTERFACE_MAP[12:]:  # Rest are abbreviations
            if interface.startswith(abbrev):
                return interface.replace(abbrev, full_name, 1)

        # Return as-is if no match (supports any future interface type)
        return interface

    def _shorten_interface_name(self, interface: str) -> str:
        """
        Shorten interface name for use in IDs (dynamic - supports any IOS-XR interface).
        Examples:
            GigabitEthernet0/0/0/1 -> Gi0001
            TenGigE0/0/0/0 -> Te0000
            HundredGigE0/0/0/0 -> Hu0000
            Bundle-Ether200 -> BE200
        """
        # Interface type to abbreviation mapping
        SHORTEN_MAP = [
            ('HundredGigE', 'Hu'),
            ('FortyGigE', 'Fo'),
            ('TwentyFiveGigE', 'Tf'),
            ('TenGigE', 'Te'),
            ('GigabitEthernet', 'Gi'),
            ('Bundle-Ether', 'BE'),
            ('Loopback', 'Lo'),
            ('MgmtEth', 'Mg'),
            ('BVI', 'BVI'),
            ('tunnel-ip', 'tip'),
            ('tunnel-te', 'tte'),
            ('NVE', 'NVE'),
        ]

        result = interface
        for full_name, abbrev in SHORTEN_MAP:
            if interface.startswith(full_name):
                result = interface.replace(full_name, abbrev, 1)
                break

        # Remove slashes for cleaner IDs
        result = result.replace('/', '')
        return result

    def build_topology(self, valid_devices: List[str] = None) -> Dict:
        """
        Parse text files and build network topology.
        
        Args:
            valid_devices: Optional list of device names to filter by. 
                           If provided, only files for these devices are processed.
        """
        nodes = {}
        links = []
        
        try:
            if not os.path.exists(self.text_dir):
                logger.warning(f"Text directory not found: {self.text_dir}")
                return {"nodes": [], "links": []}

            # 1. Scan text directory for relevant files
            files = os.listdir(self.text_dir)
            
            # Group files by device and command, keeping only the latest
            device_latest_files: Dict[str, Dict[str, Tuple[str, str]]] = {}
            
            for filename in files:
                if not filename.endswith(".txt"):
                    continue
                    
                # Filename format: {device_name}_{command}_{timestamp}.txt
                parts = filename.split('_show_')
                if len(parts) < 2:
                    continue
                    
                device_name = parts[0]
                
                # Filter by valid devices if provided
                if valid_devices and device_name not in valid_devices:
                    continue
                    
                # Extract timestamp
                try:
                    import re
                    match = re.search(r'(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})', filename)
                    if not match:
                        continue
                    timestamp = match.group(1)
                except:
                    continue
                
                command_type = ""
                if "cdp_neighbor" in filename:
                    command_type = "cdp"
                elif "ospf_neighbor" in filename:  # Matches both 'show ospf neighbor' and old 'show ip ospf neighbor'
                    command_type = "ospf_neighbor"
                elif "ospf_database_router" in filename:
                    command_type = "ospf_db_router"
                elif "ospf_database_network" in filename:
                    command_type = "ospf_db_network"
                elif "ospf_interface" in filename:
                    command_type = "ospf_interface"
                elif "running-config_router_ospf" in filename:
                    command_type = "ospf_config"  # NEW: Configured OSPF costs from running-config
                elif "ospf_database" in filename:
                    command_type = "ospf_db"
                else:
                    continue
                    
                if device_name not in device_latest_files:
                    device_latest_files[device_name] = {}
                    
                # Compare timestamps - keep latest
                if command_type not in device_latest_files[device_name] or timestamp > device_latest_files[device_name][command_type][0]:
                    device_latest_files[device_name][command_type] = (timestamp, os.path.join(self.text_dir, filename))

            # Read content of latest files
            device_files: Dict[str, Dict[str, str]] = {}
            for device, commands in device_latest_files.items():
                device_files[device] = {}
                for cmd_type, (_, filepath) in commands.items():
                    try:
                        with open(filepath, 'r') as f:
                            device_files[device][cmd_type] = f.read()
                    except Exception as e:
                        logger.error(f"Failed to read file {filepath}: {e}")

            # 2. Build Nodes
            for device_name, data in device_files.items():
                # Extract country code from first 3 characters of hostname (ISO 3166-1 alpha-3)
                # Examples: zwe-r1 -> ZWE, usarouter1 -> USA, deu-r10 -> DEU
                country = "UNK"  # Default unknown country
                if len(device_name) >= 3:
                    country_code = device_name[:3].upper()
                    # Validate it's alphabetic (proper country code)
                    if country_code.isalpha():
                        country = country_code
                
                loopback_ip = "0.0.0.0"
                if 'ospf_db' in data:
                    match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', data['ospf_db'])
                    if match:
                        loopback_ip = match.group(1)

                nodes[device_name] = {
                    "id": device_name,
                    "name": device_name,
                    "hostname": loopback_ip,
                    "country": country,
                    "type": "router",
                    "status": "active"
                }

            # 3. Build a mapping of Router IDs to device names from OSPF database
            router_id_to_device: Dict[str, str] = {}
            device_to_router_id: Dict[str, str] = {}

            for device_name, data in device_files.items():
                # Try multiple sources to find Router ID
                router_id = None

                # Try OSPF database
                if 'ospf_db' in data:
                    match = re.search(r'OSPF Router with ID \((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)', data['ospf_db'])
                    if match:
                        router_id = match.group(1)

                # Try OSPF database router LSA
                if not router_id and 'ospf_db_router' in data:
                    match = re.search(r'OSPF Router with ID \((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)', data['ospf_db_router'])
                    if match:
                        router_id = match.group(1)

                # Try OSPF neighbor output
                if not router_id and 'ospf_neighbor' in data:
                    match = re.search(r'OSPF Router with ID \((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)', data['ospf_neighbor'])
                    if match:
                        router_id = match.group(1)

                if router_id:
                    router_id_to_device[router_id] = device_name
                    device_to_router_id[device_name] = router_id
                    logger.debug(f"Mapped Router ID {router_id} <-> {device_name}")

            # 3b. Fallback: Infer Router ID mappings for devices with MOCK/missing data
            # Pattern: 172.16.X.X -> device with rX in name (e.g., 172.16.2.2 -> *-r2)
            for device_name in device_files.keys():
                if device_name not in device_to_router_id:
                    # Extract router number from device name (e.g., "zwe-r2" -> 2)
                    router_num_match = re.search(r'-r(\d+)$', device_name)
                    if router_num_match:
                        router_num = router_num_match.group(1)
                        inferred_router_id = f"172.16.{router_num}.{router_num}"
                        router_id_to_device[inferred_router_id] = device_name
                        device_to_router_id[device_name] = inferred_router_id
                        logger.info(f"Inferred Router ID {inferred_router_id} <-> {device_name} (fallback for MOCK data)")

            # 4. Parse OSPF Database Network LSAs (to map Link IDs to neighbor Router IDs)
            # Aggregate network LSAs from all devices
            global_network_map: Dict[str, List[str]] = {}
            for device_name, data in device_files.items():
                if 'ospf_db_network' in data:
                    network_map = self._parse_ospf_network_lsa(data['ospf_db_network'])
                    global_network_map.update(network_map)
                    logger.debug(f"Parsed {len(network_map)} network LSAs from {device_name}")

            # 5. Build Links from OSPF Neighbors with REAL COSTS
            link_id_counter = 1
            links_created = {}  # Track: {(source, target, interface): link}

            for device_name, data in device_files.items():
                if 'ospf_neighbor' not in data:
                    continue

                source_router_id = device_to_router_id.get(device_name)
                if not source_router_id:
                    logger.warning(f"Could not find Router ID for {device_name}, skipping")
                    continue

                # Parse OSPF database router LSAs to get link costs
                link_costs = {}
                if 'ospf_db_router' in data:
                    link_costs = self._parse_ospf_database_router_lsa(data['ospf_db_router'], source_router_id)

                # Parse OSPF interface costs (operational - from 'show ospf interface brief')
                interface_costs = {}
                if 'ospf_interface' in data:
                    interface_costs = self._parse_ospf_interface_brief(data['ospf_interface'])

                # Parse configured OSPF costs (from 'show running-config router ospf')
                # These take PRIORITY over operational costs as they reflect admin intent
                configured_costs = {}
                if 'ospf_config' in data:
                    configured_costs = self._parse_running_config_router_ospf(data['ospf_config'])
                    logger.info(f"Parsed {len(configured_costs)} configured OSPF costs from {device_name}")

                # Parse OSPF neighbor output
                lines = data['ospf_neighbor'].split('\n')
                start_parsing = False

                for line in lines:
                    if "Neighbor ID" in line:
                        start_parsing = True
                        continue

                    if not start_parsing or not line.strip():
                        continue

                    parts = line.split()
                    if len(parts) >= 6:
                        neighbor_id = parts[0]  # Router ID
                        state = parts[2]  # OSPF State
                        interface = parts[5] if len(parts) > 5 else "unknown"

                        # Only include FULL adjacencies
                        if "FULL" not in state:
                            continue

                        # Filter Management Interfaces
                        if "Mgmt" in interface or "Management" in interface or "Ma0" in interface:
                            continue

                        # Map Router ID to device name
                        neighbor_name = router_id_to_device.get(neighbor_id, neighbor_id)

                        # STRICT FILTER: Only include neighbors in valid_devices
                        if valid_devices and neighbor_name not in valid_devices:
                            logger.debug(f"Skipping neighbor {neighbor_name} (not in valid_devices)")
                            continue

                        # Avoid self-loops
                        if neighbor_name == device_name:
                            continue

                        # Find OSPF cost for this link
                        # Priority: configured_costs > interface_costs > link_costs (LSA) > default
                        ospf_cost = None
                        cost_source = None

                        # Normalize interface name for matching
                        normalized_interface = self._normalize_interface_name(interface)

                        # Method 1 (HIGHEST PRIORITY): Configured cost from 'show running-config router ospf'
                        if normalized_interface in configured_costs:
                            ospf_cost = configured_costs[normalized_interface]
                            cost_source = "configured"
                            logger.debug(f"Using CONFIGURED cost: {device_name}[{interface}] -> {neighbor_name} = {ospf_cost}")

                        # Method 2: Try interface cost from 'show ospf interface brief'
                        if not ospf_cost:
                            # Try both original and normalized interface names
                            if interface in interface_costs:
                                ospf_cost = interface_costs[interface]
                                cost_source = "operational"
                            elif normalized_interface in interface_costs:
                                ospf_cost = interface_costs[normalized_interface]
                                cost_source = "operational"
                            if ospf_cost:
                                logger.debug(f"Using operational interface cost: {device_name}[{interface}] -> {neighbor_name} = {ospf_cost}")

                        # Method 3: Try link_costs from OSPF database router LSA
                        if not ospf_cost:
                            for link_id, cost in link_costs.items():
                                if link_id in global_network_map:
                                    attached_routers = global_network_map[link_id]
                                    if source_router_id in attached_routers and neighbor_id in attached_routers:
                                        ospf_cost = cost
                                        cost_source = "lsa"
                                        logger.debug(f"Found OSPF cost via LSA: {device_name} -> {neighbor_name} = {cost}")
                                        break

                        # Method 4: Default to 1 if no cost found
                        if not ospf_cost:
                            ospf_cost = DEFAULT_OSPF_COST
                            cost_source = "default"
                            logger.warning(f"No OSPF cost found for {device_name} -> {neighbor_name} via {interface}, using default {DEFAULT_OSPF_COST}")

                        # Create link (DO NOT DEDUPLICATE - allow multiple adjacencies)
                        # Each direction is a separate link
                        link_key = f"{device_name}-{neighbor_name}-{link_id_counter}"

                        links.append({
                            "id": link_key,
                            "source": device_name,
                            "target": neighbor_name,
                            "cost": ospf_cost,
                            "cost_source": cost_source,  # Track where cost came from
                            "source_interface": interface,
                            "target_interface": "unknown",
                            "status": "up"
                        })

                        links_created[(device_name, neighbor_name, interface)] = link_id_counter
                        link_id_counter += 1

                        logger.info(f"Created OSPF link: {device_name}[{interface}] -> {neighbor_name} (cost={ospf_cost}, source={cost_source})")

            # Count cost sources for metadata
            cost_source_counts = {"configured": 0, "operational": 0, "lsa": 0, "default": 0}
            for link in links:
                src = link.get("cost_source", "unknown")
                if src in cost_source_counts:
                    cost_source_counts[src] += 1

            # Get unique costs
            unique_costs = sorted(set(link["cost"] for link in links))

            # Create consolidated physical links with asymmetric cost support
            # Two-pass approach to correctly pair bidirectional links
            # Pass 1: Collect all A->B links (where source is the lower-sorted router)
            # Pass 2: Match B->A links to their corresponding A->B links
            physical_links = {}

            # Pass 1: Process A->B links first
            for link in links:
                router_a, router_b = sorted([link["source"], link["target"]])

                if link["source"] == router_a:
                    # This is an A->B link - create entry keyed by interface_a
                    interface_a = link["source_interface"]
                    key = (router_a, router_b, interface_a)

                    if key not in physical_links:
                        physical_links[key] = {
                            "router_a": router_a,
                            "router_b": router_b,
                            "cost_a_to_b": link["cost"],
                            "cost_b_to_a": None,
                            "interface_a": interface_a,
                            "interface_b": None,
                            "cost_source_a": link.get("cost_source", "unknown"),
                            "cost_source_b": None,
                        }

            # Pass 2: Process B->A links and match to existing entries
            for link in links:
                router_a, router_b = sorted([link["source"], link["target"]])

                if link["source"] == router_b:
                    # This is a B->A link - find matching A->B entry
                    interface_b = link["source_interface"]

                    # Find an entry for this router pair that doesn't have interface_b set yet
                    # or has matching interface names (same interface on both ends is common)
                    matched_key = None
                    for key, plink in physical_links.items():
                        if key[0] == router_a and key[1] == router_b:
                            # Prefer matching interface names (e.g., Gi0/0/0/1 on both sides)
                            if plink["interface_a"] == interface_b and plink["interface_b"] is None:
                                matched_key = key
                                break
                            # Otherwise, find an entry without interface_b set
                            elif plink["interface_b"] is None:
                                matched_key = key

                    if matched_key:
                        physical_links[matched_key]["cost_b_to_a"] = link["cost"]
                        physical_links[matched_key]["interface_b"] = interface_b
                        physical_links[matched_key]["cost_source_b"] = link.get("cost_source", "unknown")
                    else:
                        # No matching entry found - create new one (orphan B->A link)
                        key = (router_a, router_b, f"B2A-{interface_b}")
                        physical_links[key] = {
                            "router_a": router_a,
                            "router_b": router_b,
                            "cost_a_to_b": None,
                            "cost_b_to_a": link["cost"],
                            "interface_a": None,
                            "interface_b": interface_b,
                            "cost_source_a": None,
                            "cost_source_b": link.get("cost_source", "unknown"),
                        }

            # Convert to list and add asymmetric flag
            consolidated_links = []
            asymmetric_count = 0
            for key, plink in physical_links.items():
                cost_a = plink["cost_a_to_b"]
                cost_b = plink["cost_b_to_a"]
                is_asymmetric = cost_a is not None and cost_b is not None and cost_a != cost_b
                if is_asymmetric:
                    asymmetric_count += 1

                # Generate unique ID including interface for parallel links
                intf_suffix = ""
                if plink["interface_a"]:
                    # Use dynamic interface shortening (supports all IOS-XR interface types)
                    intf_suffix = "-" + self._shorten_interface_name(plink["interface_a"])

                consolidated_links.append({
                    "id": f"{plink['router_a']}-{plink['router_b']}{intf_suffix}",
                    "router_a": plink["router_a"],
                    "router_b": plink["router_b"],
                    "cost_a_to_b": cost_a,
                    "cost_b_to_a": cost_b,
                    "interface_a": plink["interface_a"],
                    "interface_b": plink["interface_b"],
                    "cost_source_a": plink["cost_source_a"],
                    "cost_source_b": plink["cost_source_b"],
                    "is_asymmetric": is_asymmetric,
                    "status": "up"
                })

            logger.info(f"📊 Consolidated {len(links)} directional links into {len(consolidated_links)} physical links ({asymmetric_count} asymmetric)")

            topology = {
                "nodes": list(nodes.values()),
                "links": links,  # Keep directional links for compatibility
                "physical_links": consolidated_links,  # NEW: Consolidated with both costs
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "source": "database",
                    "node_count": len(nodes),
                    "link_count": len(links),
                    "physical_link_count": len(consolidated_links),
                    "asymmetric_link_count": asymmetric_count,
                    "unique_costs": unique_costs,
                    "data_source": "OSPF",
                    "discovery_method": "OSPF Neighbor + running-config + interface brief + Router LSA + Network LSA",
                    "cost_extraction": {
                        "priority": ["configured (running-config)", "operational (interface brief)", "lsa (database router)", "default"],
                        "sources": cost_source_counts
                    }
                }
            }
            
            # Save to file
            output_filename = f"network_topology_{datetime.now().strftime('%Y-%m-%d')}.json"
            output_path = os.path.join(self.output_dir, output_filename)
            
            with open(output_path, 'w') as f:
                json.dump(topology, f, indent=2)
                
            logger.info(f"✅ Topology built: {len(nodes)} nodes, {len(links)} links. Saved to {output_filename}")
            
            # Save to Database (Clear & Insert)
            self.save_to_db(topology, clear_first=True)
            
            return topology

        except Exception as e:
            logger.error(f"❌ Error building topology: {str(e)}", exc_info=True)
            raise

    def save_to_db(self, topology: Dict, clear_first: bool = False):
        """Save topology nodes and links to SQLite database"""
        import sqlite3
        
        # Use absolute path to backend/topology.db
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(backend_dir, "topology.db")
            
        logger.info(f"💾 Saving topology to database: {db_path} (Clear first: {clear_first})")
        
        try:
            conn = sqlite3.connect(db_path)
            conn.execute("PRAGMA foreign_keys = ON")
            cursor = conn.cursor()

            if clear_first:
                cursor.execute("DELETE FROM nodes")
                cursor.execute("DELETE FROM links")
                cursor.execute("DELETE FROM physical_links")

            # Ensure physical_links table exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS physical_links (
                    id TEXT PRIMARY KEY,
                    router_a TEXT NOT NULL,
                    router_b TEXT NOT NULL,
                    cost_a_to_b INTEGER,
                    cost_b_to_a INTEGER,
                    interface_a TEXT,
                    interface_b TEXT,
                    is_asymmetric INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'up',
                    UNIQUE(router_a, router_b, interface_a)
                )
            """)

            # 1. Upsert Nodes
            for node in topology['nodes']:
                cursor.execute("""
                    INSERT OR REPLACE INTO nodes (id, name, hostname, country, type)
                    VALUES (?, ?, ?, ?, ?)
                """, (node['id'], node['name'], node['hostname'], node['country'], node['type']))

            # 2. Upsert Links (directional)
            for link in topology['links']:
                link_id = f"{link['source']}-{link['target']}-{link['id']}" # Use link['id'] from the new structure
                cursor.execute("""
                    INSERT OR REPLACE INTO links (id, source, target, cost, interface_local, interface_remote)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (link_id, link['source'], link['target'], link['cost'], link['source_interface'], link['target_interface']))

            # 3. Upsert Physical Links (bidirectional with both costs)
            for plink in topology.get('physical_links', []):
                cursor.execute("""
                    INSERT OR REPLACE INTO physical_links
                    (id, router_a, router_b, cost_a_to_b, cost_b_to_a, interface_a, interface_b, is_asymmetric, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    plink['id'],
                    plink['router_a'],
                    plink['router_b'],
                    plink['cost_a_to_b'],
                    plink['cost_b_to_a'],
                    plink.get('interface_a', ''),
                    plink.get('interface_b', ''),
                    1 if plink.get('is_asymmetric') else 0,
                    plink.get('status', 'up')
                ))

            conn.commit()
            conn.close()
            logger.info(f"✅ Topology saved to database: {len(topology['nodes'])} nodes, {len(topology['links'])} links, {len(topology.get('physical_links', []))} physical links")
            
        except Exception as e:
            logger.error(f"❌ Failed to save topology to DB: {str(e)}", exc_info=True)

    def transform_to_netviz_pro(self, topology: Dict) -> Dict:
        """
        Transform our topology format to NetViz Pro compatible format.

        Our format:
        - nodes: id, name, hostname (loopback), country, type, status
        - physical_links: router_a, router_b, cost_a_to_b, cost_b_to_a, interface_a, interface_b, is_asymmetric

        NetViz Pro format:
        - nodes: id, name, hostname, loopback_ip, country, is_active, node_type
        - links: source, target, source_interface, target_interface, forward_cost, reverse_cost, cost,
                 status, source_capacity, target_capacity, traffic
        """
        logger.info("🔄 Transforming topology to NetViz Pro format")

        # Transform nodes
        netviz_nodes = []
        for node in topology.get('nodes', []):
            netviz_nodes.append({
                "id": node.get('id', ''),
                "name": node.get('name', ''),
                "hostname": node.get('name', ''),  # Use name as hostname
                "loopback_ip": node.get('hostname', '0.0.0.0'),  # Our hostname is actually loopback_ip
                "country": node.get('country', 'UNK'),
                "is_active": node.get('status', 'active') == 'active',
                "node_type": node.get('type', 'router')
            })

        # Transform physical_links to links
        netviz_links = []
        for plink in topology.get('physical_links', []):
            # Derive interface capacity from interface name
            source_capacity = self._derive_interface_capacity(plink.get('interface_a', ''))
            target_capacity = self._derive_interface_capacity(plink.get('interface_b', ''))

            # Determine edge type
            edge_type = "backbone"
            if plink.get('is_asymmetric'):
                edge_type = "asymmetric"

            netviz_links.append({
                "source": plink.get('router_a', ''),
                "target": plink.get('router_b', ''),
                "source_interface": plink.get('interface_a', 'Unknown'),
                "target_interface": plink.get('interface_b', 'Unknown'),
                "forward_cost": plink.get('cost_a_to_b', 1),
                "reverse_cost": plink.get('cost_b_to_a', 1),
                "cost": plink.get('cost_a_to_b', 1),  # Legacy field
                "status": plink.get('status', 'up'),
                "edge_type": edge_type,
                "is_asymmetric": plink.get('is_asymmetric', False),
                "source_capacity": source_capacity,
                "target_capacity": target_capacity,
                "traffic": {
                    "forward_traffic_mbps": 0,
                    "forward_utilization_pct": 0,
                    "reverse_traffic_mbps": 0,
                    "reverse_utilization_pct": 0
                }
            })

        # Build result
        result = {
            "nodes": netviz_nodes,
            "links": netviz_links,
            "metadata": {
                "export_timestamp": datetime.now().isoformat(),
                "node_count": len(netviz_nodes),
                "edge_count": len(netviz_links),
                "asymmetric_count": len([l for l in netviz_links if l.get('is_asymmetric')]),
                "description": f"Network topology with {len(netviz_nodes)} nodes and {len(netviz_links)} links",
                "data_source": "OSPF-LL-DEVICE_MANAGER",
                "format_version": "netviz-pro-1.0"
            },
            "traffic_snapshots": [],
            "current_snapshot_id": "baseline"
        }

        logger.info(f"✅ Transformed to NetViz Pro format: {len(netviz_nodes)} nodes, {len(netviz_links)} links")
        return result

    def _derive_interface_capacity(self, interface_name: str) -> Dict:
        """
        Derive interface capacity from interface name.

        Interface naming conventions:
        - GigabitEthernet*, Gi* -> 1G
        - TenGigE*, Te* -> 10G
        - TwentyFiveGigE*, Tf* -> 25G
        - FortyGigE*, Fo* -> 40G
        - HundredGigE*, Hu* -> 100G
        - Bundle-Ether*, BE* -> derived from bundle info or default to 10G
        """
        if not interface_name:
            return {
                "speed": "1G",
                "is_bundle": False,
                "total_capacity_mbps": 1000
            }

        # Normalize interface name for matching
        name_upper = interface_name.upper()
        name_lower = interface_name.lower()

        # Check for bundle interfaces
        if 'bundle-ether' in name_lower or name_upper.startswith('BE'):
            # Extract bundle number for potential lookup
            # For now, default to 10G total for bundles (can be enhanced with actual bundle data)
            return {
                "speed": "10G",
                "is_bundle": True,
                "bundle_type": "bundle-ethernet",
                "member_count": 2,  # Default assumption
                "member_speed": "1G",
                "total_capacity_mbps": 2000
            }

        # Check for HundredGigE (100G)
        if 'hundredgige' in name_lower or name_upper.startswith('HU'):
            return {
                "speed": "100G",
                "is_bundle": False,
                "total_capacity_mbps": 100000
            }

        # Check for FortyGigE (40G)
        if 'fortygige' in name_lower or name_upper.startswith('FO'):
            return {
                "speed": "40G",
                "is_bundle": False,
                "total_capacity_mbps": 40000
            }

        # Check for TwentyFiveGigE (25G)
        if 'twentyfivegige' in name_lower or name_upper.startswith('TF'):
            return {
                "speed": "25G",
                "is_bundle": False,
                "total_capacity_mbps": 25000
            }

        # Check for TenGigE (10G)
        if 'tengige' in name_lower or name_upper.startswith('TE'):
            return {
                "speed": "10G",
                "is_bundle": False,
                "total_capacity_mbps": 10000
            }

        # Default: GigabitEthernet (1G)
        return {
            "speed": "1G",
            "is_bundle": False,
            "total_capacity_mbps": 1000
        }


# Global instance
topology_builder = TopologyBuilder()
