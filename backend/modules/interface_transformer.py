"""
Interface Transformer Module (Step 2.7c)
Parses collected interface data and builds interface capacity/traffic database.
Also correlates CDP neighbors for physical topology discovery.
"""

import os
import re
import json
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import sqlite3

logger = logging.getLogger(__name__)

# Backend directory
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOPOLOGY_DB = os.path.join(BACKEND_DIR, "topology.db")

# Interface name normalization mappings (full form → abbreviated form)
# This ensures that "GigabitEthernet0/0/0/0" and "Gi0/0/0/0" are treated as the same interface
INTERFACE_NORMALIZATION_MAP = {
    "GIGABITETHERNET": "Gi",
    "TENGIGABITETHERNET": "Te",
    "TENGIGE": "Te",
    "HUNDREDGIGE": "Hu",
    "FORTYGIGE": "Fo",
    "TWENTYFIVEGIGE": "Tf",
    "FASTETHERNET": "Fa",
    "LOOPBACK": "Lo",
    "MGMTETH": "Mg",
    "BUNDLE-ETHER": "BE",
    "NULL": "Nu",
}


class InterfaceTransformer:
    """Transforms raw interface data into structured capacity/traffic database"""

    def __init__(self, text_dir: str = None, json_dir: str = None):
        """
        Initialize transformer with data directories.

        Args:
            text_dir: Directory containing TEXT output files
            json_dir: Directory containing JSON output files
        """
        if text_dir and json_dir:
            self.text_dir = text_dir
            self.json_dir = json_dir
        else:
            # Auto-detect from 'current' symlink
            from .file_manager import get_current_data_dirs
            self.text_dir, self.json_dir = get_current_data_dirs()

        # Bundle data lookup: (device_name, bundle_name) -> bundle_info
        self.bundle_data = {}

        logger.info(f"InterfaceTransformer initialized - JSON: {self.json_dir}")

    def transform_interfaces(self, valid_devices: List[str] = None) -> Dict:
        """
        Transform collected interface data into database.

        Args:
            valid_devices: List of device names to process (None = all)

        Returns:
            Dict with transformation results
        """
        logger.info("🔄 Starting interface transformation...")

        results = {
            "interfaces_processed": 0,
            "cdp_neighbors_processed": 0,
            "devices_processed": [],
            "errors": [],
            "timestamp": datetime.now().isoformat()
        }

        try:
            # Find all JSON files with interface data
            interface_files = self._find_interface_files()
            ospf_interface_files = self._find_ospf_interface_files()
            cdp_files = self._find_cdp_files()
            bundle_files = self._find_bundle_files()

            logger.info(f"📂 Found {len(interface_files)} interface files, {len(ospf_interface_files)} OSPF interface files, {len(cdp_files)} CDP files, {len(bundle_files)} bundle files")

            # Load bundle data FIRST so we can determine LAG capacity
            self._load_bundle_data(bundle_files)
            logger.info(f"📦 Loaded bundle data for {len(self.bundle_data)} LAG interfaces")

            # Process interface files
            all_interfaces = []

            # First try full interface files
            for filepath in interface_files:
                try:
                    device_name = self._extract_device_name(filepath)
                    if valid_devices and device_name not in valid_devices:
                        continue

                    interfaces = self._parse_interface_file(filepath, device_name)
                    all_interfaces.extend(interfaces)

                    if device_name not in results["devices_processed"]:
                        results["devices_processed"].append(device_name)

                except Exception as e:
                    logger.error(f"Error processing {filepath}: {e}")
                    results["errors"].append(f"{filepath}: {str(e)}")

            # If no interface data found, use OSPF interface brief as fallback
            if not all_interfaces and ospf_interface_files:
                logger.info("🔄 No full interface files found, using OSPF interface brief as fallback...")
                results["source"] = "ospf_interface_brief_fallback"

                for filepath in ospf_interface_files:
                    try:
                        device_name = self._extract_device_name(filepath)
                        if valid_devices and device_name not in valid_devices:
                            continue

                        interfaces = self._parse_ospf_interface_file(filepath, device_name)
                        all_interfaces.extend(interfaces)

                        if device_name not in results["devices_processed"]:
                            results["devices_processed"].append(device_name)

                    except Exception as e:
                        logger.error(f"Error processing OSPF interface {filepath}: {e}")
                        results["errors"].append(f"OSPF {filepath}: {str(e)}")

            # Process CDP files
            all_cdp_neighbors = []
            for filepath in cdp_files:
                try:
                    device_name = self._extract_device_name(filepath)
                    if valid_devices and device_name not in valid_devices:
                        continue

                    neighbors = self._parse_cdp_file(filepath, device_name)
                    all_cdp_neighbors.extend(neighbors)

                except Exception as e:
                    logger.error(f"Error processing CDP {filepath}: {e}")
                    results["errors"].append(f"CDP {filepath}: {str(e)}")

            # Correlate interfaces with CDP neighbors
            self._correlate_interfaces_with_cdp(all_interfaces, all_cdp_neighbors)

            # Save to database
            self._save_interfaces_to_db(all_interfaces)
            self._save_cdp_to_db(all_cdp_neighbors)

            results["interfaces_processed"] = len(all_interfaces)
            results["cdp_neighbors_processed"] = len(all_cdp_neighbors)

            logger.info(f"✅ Interface transformation complete: {len(all_interfaces)} interfaces, {len(all_cdp_neighbors)} CDP neighbors")

            return results

        except Exception as e:
            logger.error(f"❌ Interface transformation failed: {e}", exc_info=True)
            results["errors"].append(str(e))
            return results

    def _find_interface_files(self) -> List[str]:
        """Find JSON files containing interface data"""
        files = []
        if not os.path.exists(self.json_dir):
            return files

        for filename in os.listdir(self.json_dir):
            if filename.endswith(".json"):
                # Match: show_interface_*.json or show_int_*.json (full interface data)
                if "show_interface" in filename or "show_int" in filename:
                    # Exclude show_ospf_interface_brief - handle separately
                    if "show_ospf_interface" not in filename:
                        files.append(os.path.join(self.json_dir, filename))

        return files

    def _find_ospf_interface_files(self) -> List[str]:
        """Find JSON files containing OSPF interface brief data (fallback source)"""
        files = []
        if not os.path.exists(self.json_dir):
            return files

        for filename in os.listdir(self.json_dir):
            if filename.endswith(".json") and "show_ospf_interface_brief" in filename:
                files.append(os.path.join(self.json_dir, filename))

        return files

    def _find_cdp_files(self) -> List[str]:
        """Find JSON files containing CDP data"""
        files = []
        if not os.path.exists(self.json_dir):
            return files

        for filename in os.listdir(self.json_dir):
            if filename.endswith(".json") and "show_cdp" in filename:
                files.append(os.path.join(self.json_dir, filename))

        return files

    def _find_bundle_files(self) -> List[str]:
        """Find JSON files containing bundle (LAG) data"""
        files = []
        if not os.path.exists(self.json_dir):
            return files

        for filename in os.listdir(self.json_dir):
            if filename.endswith(".json") and "show_bundle" in filename:
                files.append(os.path.join(self.json_dir, filename))

        return files

    def _load_bundle_data(self, bundle_files: List[str]):
        """
        Load bundle data from JSON files to determine LAG capacity.
        Stores bundle info keyed by (device_name, bundle_name).
        """
        self.bundle_data = {}

        for filepath in bundle_files:
            try:
                device_name = self._extract_device_name(filepath)

                with open(filepath, 'r') as f:
                    data = json.load(f)

                parsed = data.get("parsed_data", {})
                bundles = parsed.get("bundles", [])

                for bundle in bundles:
                    bundle_name = bundle.get("bundle_name", "")
                    if not bundle_name:
                        continue

                    # Normalize bundle name (Bundle-Ether200 or BE200 -> both keys)
                    # Store by both full name and short name for lookup flexibility
                    bundle_info = {
                        "capacity_class": bundle.get("capacity_class", "LAG"),
                        "active_bandwidth_kbps": bundle.get("active_bandwidth_kbps", 0),
                        "members": bundle.get("members", []),
                        "status": bundle.get("status", "Unknown"),
                        "active_links": bundle.get("active_links", 0)
                    }

                    # Store with full name
                    self.bundle_data[(device_name, bundle_name.upper())] = bundle_info

                    # Also store with alternate naming
                    if bundle_name.upper().startswith("BUNDLE-ETHER"):
                        # Also key by BE<num>
                        num = bundle_name.upper().replace("BUNDLE-ETHER", "")
                        self.bundle_data[(device_name, f"BE{num}")] = bundle_info
                    elif bundle_name.upper().startswith("BE"):
                        # Also key by Bundle-Ether<num>
                        num = bundle_name.upper().replace("BE", "")
                        self.bundle_data[(device_name, f"BUNDLE-ETHER{num}")] = bundle_info

                    logger.debug(f"Loaded bundle {bundle_name} for {device_name}: {bundle_info['capacity_class']}")

            except Exception as e:
                logger.error(f"Error loading bundle data from {filepath}: {e}")

    def _get_bundle_capacity(self, device_name: str, interface: str) -> Optional[str]:
        """
        Get capacity class for a Bundle-Ether interface from loaded bundle data.
        Returns None if no bundle data is found.
        """
        intf_upper = interface.upper()

        # Handle subinterfaces (e.g., BE200.100 -> BE200)
        if "." in intf_upper:
            intf_upper = intf_upper.split(".")[0]

        key = (device_name, intf_upper)
        if key in self.bundle_data:
            return self.bundle_data[key]["capacity_class"]

        return None

    def _extract_device_name(self, filepath: str) -> str:
        """Extract device name from filename"""
        filename = os.path.basename(filepath)
        # Format: devicename_command_timestamp.json
        parts = filename.split("_")
        if parts:
            return parts[0]
        return "unknown"

    def _normalize_interface_name(self, interface: str) -> str:
        """
        Normalize interface name to canonical abbreviated form.

        This ensures that "GigabitEthernet0/0/0/0" and "Gi0/0/0/0" are stored
        as the same interface, preventing duplicates in the database.

        Also cleans garbage like "\nHoldtime" from CDP parsing issues.

        Examples:
            GigabitEthernet0/0/0/0 → Gi0/0/0/0
            Loopback0 → Lo0
            MgmtEth0/RP0/CPU0/0 → Mg0/RP0/CPU0/0
            Bundle-Ether400 → BE400
            Null0 → Nu0
            FastEthernet1/0\nHoldtime → Fa1/0
        """
        if not interface:
            return interface

        # CRITICAL: Clean garbage from interface names (CDP parsing issues)
        # Remove newlines, carriage returns, tabs
        interface = interface.replace('\n', '').replace('\r', '').replace('\t', '')

        # Remove "Holdtime" and other CDP garbage that might leak through
        interface = re.sub(r'Holdtime.*', '', interface, flags=re.IGNORECASE)
        interface = re.sub(r'Capability.*', '', interface, flags=re.IGNORECASE)

        # Remove extra spaces between interface type and number
        interface = re.sub(r'\s+', '', interface)

        # Strip leading/trailing whitespace
        interface = interface.strip()

        if not interface:
            return ""

        # Handle subinterfaces by normalizing the parent part
        subintf_suffix = ""
        if "." in interface:
            parts = interface.split(".", 1)
            interface = parts[0]
            subintf_suffix = "." + parts[1]

        # Check against normalization map (case-insensitive)
        intf_upper = interface.upper()

        for full_form, abbrev in INTERFACE_NORMALIZATION_MAP.items():
            if intf_upper.startswith(full_form):
                # Replace the full form with abbreviated form
                remainder = interface[len(full_form):]
                return abbrev + remainder + subintf_suffix

        # Return original if no normalization needed
        return interface + subintf_suffix

    def _parse_interface_file(self, filepath: str, device_name: str) -> List[Dict]:
        """Parse interface JSON file and extract interface data"""
        interfaces = []

        try:
            with open(filepath, 'r') as f:
                data = json.load(f)

            parsed = data.get("parsed_data", {})
            if not parsed.get("parsed"):
                return interfaces

            raw_interfaces = parsed.get("interfaces", [])

            for intf in raw_interfaces:
                # Determine if physical or logical
                intf_name = intf.get("interface", "")
                # Normalize interface name to prevent duplicates (e.g., Gi0/0/0/0 vs GigabitEthernet0/0/0/0)
                intf_name = self._normalize_interface_name(intf_name)
                is_physical = self._is_physical_interface(intf_name)
                parent = self._get_parent_interface(intf_name) if not is_physical else None

                # Determine capacity class
                # For Bundle-Ether (LAG), check bundle data first for actual capacity
                hw_interface = parent if parent else intf_name
                if hw_interface.upper().startswith(("BUNDLE-ETHER", "BE")):
                    bundle_capacity = self._get_bundle_capacity(device_name, hw_interface)
                    if bundle_capacity:
                        capacity_class = bundle_capacity
                    else:
                        capacity_class = "LAG"  # No bundle data available
                else:
                    capacity_class = intf.get("capacity_class", self._determine_capacity_class(intf.get("bw_kbps", 0), intf_name))

                interface_record = {
                    "id": str(uuid.uuid4()),
                    "router": device_name,
                    "interface": intf_name,
                    "description": intf.get("description", ""),
                    "admin_status": intf.get("admin_status", intf.get("state", "unknown")),
                    "line_protocol": intf.get("line_protocol", intf.get("protocol", "unknown")),
                    "bw_kbps": intf.get("bw_kbps", 0),
                    "capacity_class": capacity_class,
                    "input_rate_bps": intf.get("input_rate_bps", 0),
                    "output_rate_bps": intf.get("output_rate_bps", 0),
                    "input_utilization_pct": intf.get("input_utilization_pct", 0),
                    "output_utilization_pct": intf.get("output_utilization_pct", 0),
                    "mac_address": intf.get("mac_address", ""),
                    "mtu": intf.get("mtu", 0),
                    "encapsulation": intf.get("encap", ""),
                    "is_physical": 1 if is_physical else 0,
                    "parent_interface": parent,
                    "updated_at": datetime.now().isoformat()
                }

                interfaces.append(interface_record)

        except Exception as e:
            logger.error(f"Error parsing {filepath}: {e}")

        return interfaces

    def _parse_ospf_interface_file(self, filepath: str, device_name: str) -> List[Dict]:
        """Parse OSPF interface brief JSON file (fallback source for basic interface data)"""
        interfaces = []

        try:
            with open(filepath, 'r') as f:
                data = json.load(f)

            # Parse from raw_output since parsed_data is usually empty
            raw_output = data.get("raw_output", "")
            if not raw_output:
                return interfaces

            # Parse OSPF interface brief format:
            # Interface          PID   Area            IP Address/Mask    Cost  State Nbrs F/C
            # Lo0                1     0               172.16.10.10/32    1     LOOP  0/0
            # Gi0/0/0/1          1     0               172.13.0.37/30     600   DR    1/1

            lines = raw_output.strip().split('\n')
            for line in lines:
                # Skip header and empty lines
                if not line.strip() or 'Interface' in line and 'PID' in line:
                    continue
                if line.startswith('*') or line.startswith('-'):
                    continue

                # Parse the interface line using regex
                # Format: Interface(space)PID(space)Area(space)IP/Mask(space)Cost(space)State(space)Nbrs
                match = re.match(
                    r'^(\S+)\s+(\d+)\s+(\S+)\s+(\d+\.\d+\.\d+\.\d+/\d+)\s+(\d+)\s+(\S+)\s+(\d+/\d+)',
                    line.strip()
                )
                if match:
                    intf_name = match.group(1)
                    # Normalize interface name to prevent duplicates (e.g., Gi0/0/0/0 vs GigabitEthernet0/0/0/0)
                    intf_name = self._normalize_interface_name(intf_name)
                    ip_mask = match.group(4)
                    cost = int(match.group(5))
                    state = match.group(6)

                    is_physical = self._is_physical_interface(intf_name)
                    parent = self._get_parent_interface(intf_name) if not is_physical else None

                    # Get capacity from HARDWARE interface type (NOT from OSPF cost)
                    # For subinterfaces, use parent physical interface type
                    hw_interface = parent if parent else intf_name

                    # For Bundle-Ether (LAG), check bundle data first for actual capacity
                    # based on active member physical interfaces
                    if hw_interface.upper().startswith(("BUNDLE-ETHER", "BE")):
                        bundle_capacity = self._get_bundle_capacity(device_name, hw_interface)
                        if bundle_capacity:
                            capacity_class = bundle_capacity
                        else:
                            # No bundle data available - mark as LAG (unknown)
                            capacity_class = "LAG"
                    else:
                        capacity_class = self._get_capacity_from_interface_type(hw_interface)

                    hw_bw_kbps = self._get_hardware_interface_bandwidth(hw_interface)

                    interface_record = {
                        "id": str(uuid.uuid4()),
                        "router": device_name,
                        "interface": intf_name,
                        "description": f"OSPF Area {match.group(3)} - {ip_mask}",
                        "admin_status": "up" if state != "DOWN" else "down",
                        "line_protocol": "up" if state in ("DR", "BDR", "DROTHER", "P2P", "LOOP", "WAIT") else "down",
                        "bw_kbps": hw_bw_kbps,
                        "capacity_class": capacity_class,
                        "input_rate_bps": 0,  # Not available from OSPF brief
                        "output_rate_bps": 0,  # Not available from OSPF brief
                        "input_utilization_pct": 0,
                        "output_utilization_pct": 0,
                        "mac_address": "",
                        "mtu": 0,
                        "encapsulation": "",
                        "is_physical": 1 if is_physical else 0,
                        "parent_interface": parent,
                        "ospf_cost": cost,  # Extra: store OSPF cost
                        "ip_address": ip_mask.split('/')[0],
                        "updated_at": datetime.now().isoformat()
                    }

                    interfaces.append(interface_record)

            logger.info(f"Parsed {len(interfaces)} interfaces from OSPF brief: {device_name}")

        except Exception as e:
            logger.error(f"Error parsing OSPF interface file {filepath}: {e}")

        return interfaces

    def _parse_cdp_file(self, filepath: str, device_name: str) -> List[Dict]:
        """Parse CDP JSON file and extract neighbor data"""
        neighbors = []

        try:
            with open(filepath, 'r') as f:
                data = json.load(f)

            parsed = data.get("parsed_data", {})

            # Check for detailed CDP neighbors first
            raw_neighbors = parsed.get("cdp_neighbors", parsed.get("neighbors", []))

            # If parsed_data is empty, try to parse from raw_output
            if not raw_neighbors and data.get("raw_output"):
                raw_neighbors = self._parse_cdp_raw_output(data.get("raw_output", ""))

            for nbr in raw_neighbors:
                neighbor_record = {
                    "id": str(uuid.uuid4()),
                    "local_router": device_name,
                    # Normalize interface names to ensure CDP correlation works with deduplicated interfaces
                    "local_interface": self._normalize_interface_name(nbr.get("local_interface", "")),
                    "remote_router": nbr.get("device_id", "").split(".")[0],  # Remove domain
                    "remote_interface": self._normalize_interface_name(nbr.get("remote_interface", "")),
                    "remote_platform": nbr.get("platform", ""),
                    "remote_ip": nbr.get("ip_address", ""),
                    "updated_at": datetime.now().isoformat()
                }

                neighbors.append(neighbor_record)

        except Exception as e:
            logger.error(f"Error parsing CDP {filepath}: {e}")

        return neighbors

    def _parse_cdp_raw_output(self, raw_output: str) -> List[Dict]:
        """Parse CDP neighbors from raw command output"""
        neighbors = []
        lines = raw_output.splitlines()

        for line in lines:
            # Skip header lines
            if "Device ID" in line or "Capability" in line or not line.strip():
                continue
            # Check for interface patterns
            if any(x in line for x in ["Gi", "Te", "Hu", "Fa", "Eth", "Ten", "Gig", "Fast"]):
                parts = line.split()
                if len(parts) >= 6:
                    neighbors.append({
                        "device_id": parts[0],
                        "local_interface": parts[1],
                        "remote_interface": parts[-1]
                    })

        return neighbors

    def _is_physical_interface(self, interface: str) -> bool:
        """Check if interface is physical (not subinterface/bundle member)"""
        # Subinterfaces contain "."
        if "." in interface:
            return False
        # Bundle-Ether members
        if interface.startswith("BE") and "/" in interface:
            return False
        return True

    def _get_parent_interface(self, interface: str) -> Optional[str]:
        """Get parent interface for subinterfaces"""
        if "." in interface:
            return interface.split(".")[0]
        return None

    def _get_capacity_from_interface_type(self, interface: str) -> str:
        """
        Get capacity class DIRECTLY from IOS-XR interface type designation.

        Uses interface naming convention - no bandwidth calculations:
        - HundredGigE / Hu = 100G
        - TenGigE / Te = 10G
        - GigabitEthernet / Gi = 1G
        - FastEthernet / Fa = 100M
        - Bundle-Ether / BE = 10G (default for LAG)
        """
        intf = interface.upper()

        # 100 Gigabit Ethernet (HundredGigE, Hu)
        if intf.startswith(("HUNDREDGIGE", "HU")):
            return "100G"

        # 40 Gigabit Ethernet (FortyGigE, Fo)
        elif intf.startswith(("FORTYGIGE", "FO")):
            return "40G"

        # 25 Gigabit Ethernet (TwentyFiveGigE, Tf)
        elif intf.startswith(("TWENTYFIVEGIGE", "TF")):
            return "25G"

        # 10 Gigabit Ethernet (TenGigE, Te)
        elif intf.startswith(("TENGIGE", "TE", "TENGIGABITETHERNET")):
            return "10G"

        # 1 Gigabit Ethernet (GigabitEthernet, Gi)
        elif intf.startswith(("GIGABITETHERNET", "GI")):
            return "1G"

        # Fast Ethernet (FastEthernet, Fa)
        elif intf.startswith(("FASTETHERNET", "FA")):
            return "100M"

        # Bundle-Ether (BE) - LAG aggregate
        # Actual capacity = sum of member physical interfaces
        # Without show bundle data, mark as "LAG" (unknown aggregate)
        elif intf.startswith(("BUNDLE-ETHER", "BE")):
            return "LAG"

        # Loopback (Lo)
        elif intf.startswith(("LOOPBACK", "LO")):
            return "1G"

        # Unknown type defaults to 1G
        else:
            return "1G"

    def _get_hardware_interface_bandwidth(self, interface: str) -> int:
        """Get bandwidth in kbps based on interface type designation."""
        capacity = self._get_capacity_from_interface_type(interface)
        bandwidth_map = {
            "100G": 100000000,
            "40G": 40000000,
            "25G": 25000000,
            "10G": 10000000,
            "1G": 1000000,
            "100M": 100000,
            "10M": 10000,
            "LAG": 0,  # LAG bandwidth unknown without show bundle data
        }
        return bandwidth_map.get(capacity, 1000000)

    def _get_capacity_class_from_bandwidth(self, bw_kbps: int) -> str:
        """Convert bandwidth to capacity class (fallback method)."""
        if bw_kbps >= 100000000:
            return "100G"
        elif bw_kbps >= 40000000:
            return "40G"
        elif bw_kbps >= 10000000:
            return "10G"
        elif bw_kbps >= 1000000:
            return "1G"
        elif bw_kbps >= 100000:
            return "100M"
        return "1G"

    def _determine_capacity_class(self, bw_kbps: int, interface_name: str = "") -> str:
        """
        Determine capacity class from interface type designation.
        For subinterfaces, uses parent physical interface type.
        """
        if interface_name:
            # For subinterfaces, use parent interface type
            if "." in interface_name:
                parent = interface_name.split(".")[0]
                return self._get_capacity_from_interface_type(parent)
            return self._get_capacity_from_interface_type(interface_name)

        return self._get_capacity_class_from_bandwidth(bw_kbps)

    def _correlate_interfaces_with_cdp(self, interfaces: List[Dict], cdp_neighbors: List[Dict]):
        """Correlate interfaces with their CDP-discovered neighbors"""
        # Build lookup: (router, interface) -> CDP neighbor
        cdp_lookup = {}
        for nbr in cdp_neighbors:
            key = (nbr["local_router"], nbr["local_interface"])
            cdp_lookup[key] = nbr

        # Update interfaces with neighbor info
        for intf in interfaces:
            key = (intf["router"], intf["interface"])
            if key in cdp_lookup:
                nbr = cdp_lookup[key]
                intf["neighbor_router"] = nbr["remote_router"]
                intf["neighbor_interface"] = nbr["remote_interface"]

    def _save_interfaces_to_db(self, interfaces: List[Dict]):
        """Save interfaces to database"""
        conn = sqlite3.connect(TOPOLOGY_DB)
        conn.execute("PRAGMA foreign_keys = ON")
        cursor = conn.cursor()

        # Ensure table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS interface_capacity (
                id TEXT PRIMARY KEY,
                router TEXT NOT NULL,
                interface TEXT NOT NULL,
                description TEXT,
                admin_status TEXT,
                line_protocol TEXT,
                bw_kbps INTEGER DEFAULT 0,
                capacity_class TEXT,
                input_rate_bps INTEGER DEFAULT 0,
                output_rate_bps INTEGER DEFAULT 0,
                input_utilization_pct REAL DEFAULT 0,
                output_utilization_pct REAL DEFAULT 0,
                mac_address TEXT,
                mtu INTEGER,
                encapsulation TEXT,
                is_physical INTEGER DEFAULT 1,
                parent_interface TEXT,
                neighbor_router TEXT,
                neighbor_interface TEXT,
                updated_at TEXT,
                UNIQUE(router, interface)
            )
        """)

        for intf in interfaces:
            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO interface_capacity
                    (id, router, interface, description, admin_status, line_protocol,
                     bw_kbps, capacity_class, input_rate_bps, output_rate_bps,
                     input_utilization_pct, output_utilization_pct, mac_address, mtu,
                     encapsulation, is_physical, parent_interface, neighbor_router,
                     neighbor_interface, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    intf["id"], intf["router"], intf["interface"],
                    intf.get("description"), intf.get("admin_status"), intf.get("line_protocol"),
                    intf.get("bw_kbps", 0), intf.get("capacity_class"),
                    intf.get("input_rate_bps", 0), intf.get("output_rate_bps", 0),
                    intf.get("input_utilization_pct", 0), intf.get("output_utilization_pct", 0),
                    intf.get("mac_address"), intf.get("mtu"),
                    intf.get("encapsulation"), intf.get("is_physical", 1),
                    intf.get("parent_interface"), intf.get("neighbor_router"),
                    intf.get("neighbor_interface"), intf.get("updated_at")
                ))
            except Exception as e:
                logger.error(f"Error saving interface {intf['router']}/{intf['interface']}: {e}")

        conn.commit()
        conn.close()

    def _save_cdp_to_db(self, cdp_neighbors: List[Dict]):
        """Save CDP neighbors to database"""
        conn = sqlite3.connect(TOPOLOGY_DB)
        conn.execute("PRAGMA foreign_keys = ON")
        cursor = conn.cursor()

        # Ensure table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cdp_neighbors (
                id TEXT PRIMARY KEY,
                local_router TEXT NOT NULL,
                local_interface TEXT NOT NULL,
                remote_router TEXT NOT NULL,
                remote_interface TEXT,
                remote_platform TEXT,
                remote_ip TEXT,
                updated_at TEXT,
                UNIQUE(local_router, local_interface, remote_router)
            )
        """)

        for nbr in cdp_neighbors:
            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO cdp_neighbors
                    (id, local_router, local_interface, remote_router, remote_interface,
                     remote_platform, remote_ip, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    nbr["id"], nbr["local_router"], nbr["local_interface"],
                    nbr["remote_router"], nbr.get("remote_interface"),
                    nbr.get("remote_platform"), nbr.get("remote_ip"),
                    nbr.get("updated_at")
                ))
            except Exception as e:
                logger.error(f"Error saving CDP neighbor {nbr['local_router']}/{nbr['local_interface']}: {e}")

        conn.commit()
        conn.close()

    def get_interface_summary(self) -> Dict:
        """Get summary of interface capacity data"""
        conn = sqlite3.connect(TOPOLOGY_DB)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        summary = {
            "total_interfaces": 0,
            "physical_interfaces": 0,
            "logical_interfaces": 0,
            "by_capacity_class": {},
            "by_router": {},
            "high_utilization": [],
            "timestamp": datetime.now().isoformat()
        }

        try:
            # Total counts
            cursor.execute("SELECT COUNT(*) FROM interface_capacity")
            summary["total_interfaces"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM interface_capacity WHERE is_physical = 1")
            summary["physical_interfaces"] = cursor.fetchone()[0]

            summary["logical_interfaces"] = summary["total_interfaces"] - summary["physical_interfaces"]

            # By capacity class
            cursor.execute("""
                SELECT capacity_class, COUNT(*) as count
                FROM interface_capacity
                GROUP BY capacity_class
            """)
            for row in cursor.fetchall():
                summary["by_capacity_class"][row["capacity_class"] or "Unknown"] = row["count"]

            # By router
            cursor.execute("""
                SELECT router, COUNT(*) as count
                FROM interface_capacity
                GROUP BY router
            """)
            for row in cursor.fetchall():
                summary["by_router"][row["router"]] = row["count"]

            # High utilization interfaces (>50%)
            cursor.execute("""
                SELECT router, interface, input_utilization_pct, output_utilization_pct, bw_kbps
                FROM interface_capacity
                WHERE input_utilization_pct > 50 OR output_utilization_pct > 50
                ORDER BY (input_utilization_pct + output_utilization_pct) DESC
                LIMIT 20
            """)
            for row in cursor.fetchall():
                summary["high_utilization"].append({
                    "router": row["router"],
                    "interface": row["interface"],
                    "input_pct": row["input_utilization_pct"],
                    "output_pct": row["output_utilization_pct"],
                    "bw_kbps": row["bw_kbps"]
                })

        except Exception as e:
            logger.error(f"Error getting interface summary: {e}")

        conn.close()
        return summary

    def get_traffic_matrix(self) -> Dict:
        """Build traffic matrix between countries/routers based on interface data"""
        conn = sqlite3.connect(TOPOLOGY_DB)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        traffic_matrix = {
            "links": [],
            "by_country": {},
            "total_traffic_bps": 0,
            "timestamp": datetime.now().isoformat()
        }

        try:
            # Get all interfaces with neighbors
            cursor.execute("""
                SELECT ic.router, ic.interface, ic.neighbor_router, ic.neighbor_interface,
                       ic.input_rate_bps, ic.output_rate_bps, ic.bw_kbps, ic.capacity_class,
                       n1.country as source_country, n2.country as target_country
                FROM interface_capacity ic
                LEFT JOIN nodes n1 ON ic.router = n1.name
                LEFT JOIN nodes n2 ON ic.neighbor_router = n2.name
                WHERE ic.neighbor_router IS NOT NULL AND ic.neighbor_router != ''
            """)

            for row in cursor.fetchall():
                link = {
                    "source_router": row["router"],
                    "source_interface": row["interface"],
                    "target_router": row["neighbor_router"],
                    "target_interface": row["neighbor_interface"],
                    "source_country": row["source_country"] or "Unknown",
                    "target_country": row["target_country"] or "Unknown",
                    "input_bps": row["input_rate_bps"],
                    "output_bps": row["output_rate_bps"],
                    "capacity_kbps": row["bw_kbps"],
                    "capacity_class": row["capacity_class"]
                }
                traffic_matrix["links"].append(link)
                traffic_matrix["total_traffic_bps"] += row["input_rate_bps"] + row["output_rate_bps"]

                # Aggregate by country pair
                src_country = row["source_country"] or "Unknown"
                tgt_country = row["target_country"] or "Unknown"
                country_key = f"{src_country}->{tgt_country}"

                if country_key not in traffic_matrix["by_country"]:
                    traffic_matrix["by_country"][country_key] = {
                        "source": src_country,
                        "target": tgt_country,
                        "total_input_bps": 0,
                        "total_output_bps": 0,
                        "link_count": 0
                    }

                traffic_matrix["by_country"][country_key]["total_input_bps"] += row["input_rate_bps"]
                traffic_matrix["by_country"][country_key]["total_output_bps"] += row["output_rate_bps"]
                traffic_matrix["by_country"][country_key]["link_count"] += 1

        except Exception as e:
            logger.error(f"Error building traffic matrix: {e}")

        conn.close()
        return traffic_matrix


# Module-level helper
def get_interface_transformer():
    """Get a fresh InterfaceTransformer instance"""
    return InterfaceTransformer()
