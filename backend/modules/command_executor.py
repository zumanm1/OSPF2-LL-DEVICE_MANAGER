"""
Command Executor for Network Devices
Executes show commands and saves output to files
"""

import logging
import os
import re
import threading
import uuid
import time
import json
from datetime import datetime
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from .connection_manager import connection_manager, DeviceConnectionError
from .audit_logger import AuditLogger
from .websocket_manager import websocket_manager

logger = logging.getLogger(__name__)

# Standard OSPF data collection commands
OSPF_COMMANDS = [
    "terminal length 0",  # Disable pagination
    "show process cpu",
    "show process memory",
    "show route connected",
    "show route ospf",
    "show ospf database",
    "show ospf database self-originate",
    "show ospf database router",      # IOS-XR: OSPF Router LSAs with link costs
    "show ospf database network",     # IOS-XR: OSPF Network LSAs (DR/BDR info)
    "show ospf interface brief",      # IOS-XR: Interface-specific OSPF costs (operational)
    "show ospf neighbor",             # IOS-XR: OSPF neighbor adjacencies
    "show running-config router ospf", # IOS-XR: OSPF config with explicit interface costs
    "show cdp neighbor",              # Physical topology discovery
    "show cdp neighbor detail",       # CDP details with platform/port info
    # ===== NEW: Interface Capacity & Traffic Commands (Step 2.7c) =====
    "show interface description",     # Interface descriptions & admin/line status
    "show interface brief",           # BW, MTU, encapsulation summary
    "show ipv4 interface brief",      # IP addressing per interface
    "show interface",                 # Full interface details: BW, traffic rates, errors
    "show bundle",                    # Bundle-Ether (LAG) member interfaces and status
]

# Dynamic timeout mapping for different command types (in seconds)
# Longer timeouts for commands that may return large output
COMMAND_TIMEOUTS = {
    "show running-config": 180,       # Full running config can be large
    "show ospf database": 120,        # OSPF LSA database can be extensive
    "show interface": 120,            # Full interface details across all interfaces
    "show cdp neighbor detail": 90,   # CDP details for many neighbors
    "terminal length 0": 10,          # Quick config command
}
DEFAULT_TIMEOUT = 60  # Default timeout for other commands

def get_command_timeout(command: str) -> int:
    """Get appropriate timeout for a command based on its type."""
    cmd_lower = command.lower().strip()
    for pattern, timeout in COMMAND_TIMEOUTS.items():
        if cmd_lower.startswith(pattern.lower()):
            return timeout
    return DEFAULT_TIMEOUT

class JobManager:
    """Manages background automation jobs"""
    def __init__(self):
        self.jobs = {}
        self.lock = threading.Lock()

    def _broadcast_job_state(self, job_id: str, event_type: str = "update"):
        """Broadcast job state via WebSocket (must be called with lock held)"""
        job = self.jobs.get(job_id)
        if not job:
            return

        # Create a snapshot of job state for broadcast
        broadcast_data = {
            "event": event_type,
            "job_id": job_id,
            "status": job.get("status"),
            "progress_percent": job.get("progress_percent", 0),
            "total_devices": job.get("total_devices", 0),
            "completed_devices": job.get("completed_devices", 0),
            "current_device": job.get("current_device"),
            "device_progress": job.get("device_progress", {}),
            "country_stats": job.get("country_stats", {}),
            "errors": job.get("errors", [])
        }

        # Broadcast using thread-safe sync method
        websocket_manager.broadcast_job_update_sync(job_id, broadcast_data)

    def create_job(self, device_list: List[Dict]) -> str:
        job_id = str(uuid.uuid4())
        with self.lock:
            # Initialize device progress structure
            device_progress = {}
            country_stats = {}
            
            for device in device_list:
                device_id = device['device_id']
                country = device.get('country', 'Unknown')
                
                # Initialize device progress
                device_progress[device_id] = {
                    "device_name": device['device_name'],
                    "country": country,
                    "status": "pending",
                    "completed_commands": 0,
                    "total_commands": 0, # Will be set when commands are known
                    "commands": []
                }
                
                # Initialize country stats
                if country not in country_stats:
                    country_stats[country] = {
                        "total_devices": 0,
                        "completed_devices": 0,
                        "running_devices": 0,
                        "failed_devices": 0,
                        "pending_devices": 0,
                        "total_commands": 0,
                        "completed_commands": 0,
                        "start_time": None,
                        "end_time": None,
                        "elapsed_seconds": 0
                    }
                country_stats[country]["total_devices"] += 1
                country_stats[country]["pending_devices"] += 1

            self.jobs[job_id] = {
                "id": job_id,
                "status": "running",
                "start_time": datetime.now().isoformat(),
                "total_devices": len(device_list),
                "completed_devices": 0,
                "progress_percent": 0,
                "results": {},
                "errors": [],
                "stop_requested": False,
                # New tracking fields
                "device_progress": device_progress,
                "country_stats": country_stats,
                "current_device": None,
                "execution_id": None  # Will be set by start_automation_job
            }
            # Broadcast job created event
            self._broadcast_job_state(job_id, "job_created")
        return job_id

    def get_job(self, job_id: str) -> Optional[Dict]:
        with self.lock:
            return self.jobs.get(job_id)

    def get_latest_job(self) -> Optional[Dict]:
        with self.lock:
            if not self.jobs:
                return None
            # Sort jobs by start_time descending
            sorted_jobs = sorted(
                self.jobs.values(),
                key=lambda x: x.get("start_time", ""),
                reverse=True
            )
            return sorted_jobs[0]

    def update_job_progress(self, job_id: str, device_id: str, result: Dict):
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                return

            job["completed_devices"] += 1
            job["progress_percent"] = int((job["completed_devices"] / job["total_devices"]) * 100)
            job["results"][device_id] = result

            # Update device status to completed/failed
            if device_id in job["device_progress"]:
                job["device_progress"][device_id]["status"] = result.get("status", "completed")

            if job["completed_devices"] == job["total_devices"]:
                job["status"] = "completed"
                job["end_time"] = datetime.now().isoformat()
                job["current_device"] = None  # Clear current device

            self._update_country_stats(job)

            # Broadcast progress update
            event_type = "job_completed" if job["status"] == "completed" else "progress_update"
            self._broadcast_job_state(job_id, event_type)

    def update_current_execution(self, job_id: str, current_device: Dict):
        """Update currently executing device and command"""
        with self.lock:
            job = self.jobs.get(job_id)
            if job:
                job["current_device"] = current_device
                # Broadcast execution update
                self._broadcast_job_state(job_id, "execution_update")

    def set_execution_id(self, job_id: str, execution_id: str):
        """Set execution ID for a job"""
        with self.lock:
            job = self.jobs.get(job_id)
            if job:
                job["execution_id"] = execution_id

    def init_device_commands(self, job_id: str, device_id: str, commands: List[str]):
        """Initialize commands list for a device"""
        with self.lock:
            job = self.jobs.get(job_id)
            if not job or device_id not in job["device_progress"]:
                return
            
            progress = job["device_progress"][device_id]
            progress["total_commands"] = len(commands)
            progress["commands"] = [
                {
                    "command": cmd,
                    "status": "pending",
                    "percent": 0
                } for cmd in commands
            ]
            
            # Update country total commands
            country = progress["country"]
            if country in job["country_stats"]:
                job["country_stats"][country]["total_commands"] += len(commands)

    def update_device_command_status(
        self, 
        job_id: str, 
        device_id: str, 
        command_index: int, 
        status: str,
        execution_time: float = None,
        error: str = None
    ):
        """Update specific command status for a device"""
        with self.lock:
            job = self.jobs.get(job_id)
            if not job or device_id not in job["device_progress"]:
                return
            
            device_progress = job["device_progress"][device_id]
            
            # Update command status
            if command_index < len(device_progress["commands"]):
                cmd = device_progress["commands"][command_index]
                cmd["status"] = status
                
                if status == "success":
                    cmd["percent"] = 100
                elif status == "running":
                    cmd["percent"] = 0 # Will be updated by frontend based on time? Or we can simulate
                elif status == "failed":
                    cmd["percent"] = 0
                
                if execution_time is not None:
                    cmd["execution_time"] = execution_time
                if error:
                    cmd["error"] = error
            
            # Update completed count
            if status in ["success", "failed"]:
                device_progress["completed_commands"] += 1
                # Update country completed commands
                country = device_progress["country"]
                if country in job["country_stats"]:
                    job["country_stats"][country]["completed_commands"] += 1
            
            # Update device status
            if status == "running":
                device_progress["status"] = "running"
            
            # Update device percent
            if device_progress["total_commands"] > 0:
                device_progress["percent"] = int((device_progress["completed_commands"] / device_progress["total_commands"]) * 100)

            self._update_country_stats(job)

            # Broadcast command status update
            self._broadcast_job_state(job_id, "command_update")
    
    def _update_country_stats(self, job: Dict):
        """Recalculate country-level statistics"""
        current_time = datetime.now()

        # Reset counts
        for stats in job["country_stats"].values():
            stats["completed_devices"] = 0
            stats["running_devices"] = 0
            stats["failed_devices"] = 0
            stats["pending_devices"] = 0

        for progress in job["device_progress"].values():
            country = progress.get("country", "Unknown")
            if country in job["country_stats"]:
                stats = job["country_stats"][country]
                if progress["status"] == "completed":
                    stats["completed_devices"] += 1
                elif progress["status"] == "running":
                    stats["running_devices"] += 1
                    # Mark country start time when first device starts running
                    if stats.get("start_time") is None:
                        stats["start_time"] = current_time.isoformat()
                elif progress["status"] == "failed":
                    stats["failed_devices"] += 1
                elif progress["status"] in ["connecting", "connected", "executing", "disconnecting"]:
                    stats["running_devices"] += 1
                    # Mark country start time when first device starts
                    if stats.get("start_time") is None:
                        stats["start_time"] = current_time.isoformat()
                else:
                    stats["pending_devices"] += 1

                # Calculate percentages
                if stats["total_devices"] > 0:
                    stats["device_percent"] = int((stats["completed_devices"] / stats["total_devices"]) * 100)
                if stats["total_commands"] > 0:
                    stats["command_percent"] = int((stats["completed_commands"] / stats["total_commands"]) * 100)

                # Overall country percent (average of device and command? or just command?)
                # Let's use command percent as it is more granular
                stats["percent"] = stats.get("command_percent", 0)

                # Update elapsed time if started
                if stats.get("start_time"):
                    start = datetime.fromisoformat(stats["start_time"])
                    stats["elapsed_seconds"] = (current_time - start).total_seconds()

                # Mark end time when all devices are done (completed + failed = total)
                if stats["completed_devices"] + stats["failed_devices"] == stats["total_devices"]:
                    if stats.get("end_time") is None and stats.get("start_time"):
                        stats["end_time"] = current_time.isoformat()

    def fail_job(self, job_id: str, error: str):
        with self.lock:
            job = self.jobs.get(job_id)
            if job:
                job["status"] = "failed"
                job["error"] = error
                job["end_time"] = datetime.now().isoformat()
                job["current_device"] = None
                # Broadcast job failed event
                self._broadcast_job_state(job_id, "job_failed")

    def stop_job(self, job_id: str):
        with self.lock:
            job = self.jobs.get(job_id)
            if job and job["status"] == "running":
                job["stop_requested"] = True
                job["status"] = "stopping"
                # Broadcast job stopping event
                self._broadcast_job_state(job_id, "job_stopping")

    def is_stop_requested(self, job_id: str) -> bool:
        with self.lock:
            job = self.jobs.get(job_id)
            return job.get("stop_requested", False) if job else False
    
    def update_device_status(self, job_id: str, device_id: str, status: str, error: str = None):
        """Update device connection/execution status"""
        with self.lock:
            job = self.jobs.get(job_id)
            if not job or device_id not in job.get("device_progress", {}):
                return

            device_progress = job["device_progress"][device_id]
            device_progress["status"] = status

            if error:
                if "errors" not in device_progress:
                    device_progress["errors"] = []
                device_progress["errors"].append(error)

            # Update current device if status is active
            if status in ["connecting", "connected", "executing"]:
                job["current_device"] = {
                    "device_id": device_id,
                    "device_name": device_progress["device_name"],
                    "country": device_progress["country"],
                    "status": status
                }
            elif status in ["completed", "failed", "disconnected"]:
                # Clear current device if this was the active one
                if job.get("current_device", {}).get("device_id") == device_id:
                    job["current_device"] = None

            # Broadcast device status update
            self._broadcast_job_state(job_id, "device_status_update")

job_manager = JobManager()

class CommandExecutor:
    """Executes commands on connected network devices"""

    def __init__(self, text_output_dir: str = "data/OUTPUT-Data_save/TEXT", json_output_dir: str = "data/OUTPUT-Data_save/JSON", execution_id: str = None):
        # Support execution-based isolation
        if execution_id:
            # Use execution-specific directory
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            exec_dir = os.path.join(base_dir, "data", "executions", execution_id)
            self.text_output_dir = os.path.join(exec_dir, "TEXT")
            self.json_output_dir = os.path.join(exec_dir, "JSON")
            self.execution_id = execution_id
            self.execution_dir = exec_dir
        else:
            # Legacy: use provided directories
            self.text_output_dir = text_output_dir
            self.json_output_dir = json_output_dir
            self.execution_id = None
            self.execution_dir = None

        # Ensure output directories exist
        os.makedirs(self.text_output_dir, exist_ok=True)
        os.makedirs(self.json_output_dir, exist_ok=True)

        logger.info(f"CommandExecutor initialized - Execution: {execution_id or 'legacy'}, Text: {self.text_output_dir}")

    def check_device_health(self, device_id: str, device_name: str) -> Dict:
        """
        Check CPU and Memory usage. Returns {'healthy': bool, 'reason': str}
        """
        try:
            # CPU Check
            cpu_res = self.execute_command(device_id, device_name, "show process cpu")
            if cpu_res['status'] != 'success':
                return {'healthy': False, 'reason': f"Failed to check CPU: {cpu_res.get('error')}"}
            
            # Parse CPU (Example: "one minute: 8%;")
            cpu_match = re.search(r'one minute: (\d+)%', cpu_res['output'])
            if cpu_match:
                cpu_usage = int(cpu_match.group(1))
                if cpu_usage > 70:
                    return {'healthy': False, 'reason': f"High CPU usage: {cpu_usage}% (>70%)"}
            
            # Memory Check
            mem_res = self.execute_command(device_id, device_name, "show process memory")
            if mem_res['status'] != 'success':
                return {'healthy': False, 'reason': f"Failed to check Memory: {mem_res.get('error')}"}
            
            # Parse Memory (Example: "Total: 1000, Used: 800, ...")
            # Looking for generic Cisco output or similar
            # Simplistic check: look for "Used" and "Total" or calculate from output
            # Regex for "Processor Pool Total: 12345 Used: 1234"
            mem_match = re.search(r'Total: (\d+).*Used: (\d+)', mem_res['output'], re.IGNORECASE)
            if mem_match:
                total = int(mem_match.group(1))
                used = int(mem_match.group(2))
                if total > 0:
                    mem_usage = (used / total) * 100
                    if mem_usage > 70:
                        return {'healthy': False, 'reason': f"High Memory usage: {mem_usage:.1f}% (>70%)"}

            return {'healthy': True, 'reason': "OK"}

        except Exception as e:
            return {'healthy': False, 'reason': f"Health check error: {str(e)}"}

    def _parse_output_to_json(self, command: str, output: str) -> Dict:
        """Parse raw text output into structured JSON based on command type"""
        parsed_data = {}
        
        if "show process cpu" in command:
            # Parse CPU: "one minute: 8%;"
            match = re.search(r'one minute: (\d+)%', output)
            if match:
                parsed_data["cpu_1min"] = int(match.group(1))
            match_5min = re.search(r'five minutes: (\d+)%', output)
            if match_5min:
                parsed_data["cpu_5min"] = int(match_5min.group(1))
                
        elif "show process memory" in command:
            # Parse Memory: "Total: 12345678, Used: 1234567"
            match = re.search(r'Total: (\d+).*Used: (\d+).*Free: (\d+)', output, re.IGNORECASE)
            if match:
                parsed_data["total"] = int(match.group(1))
                parsed_data["used"] = int(match.group(2))
                parsed_data["free"] = int(match.group(3))
                
        elif "show ospf database" in command:
            # Parse OSPF: Extract LSAs
            lsas = []
            # Basic regex for LSA lines (Link ID, ADV Router, Age, Seq, Checksum, Link count)
            pattern = r'(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s+(0x[0-9a-fA-F]+)\s+(0x[0-9a-fA-F]+)\s+(\d+)'
            matches = re.findall(pattern, output)
            for m in matches:
                lsas.append({
                    "link_id": m[0],
                    "adv_router": m[1],
                    "age": int(m[2]),
                    "seq": m[3],
                    "checksum": m[4],
                    "link_count": int(m[5])
                })
            parsed_data["lsas"] = lsas
            parsed_data["lsa_count"] = len(lsas)
            
        elif "show cdp neighbor detail" in command:
            # Parse CDP detail: Extract full neighbor info for physical topology
            neighbors = []
            current_neighbor = {}
            for line in output.splitlines():
                if "Device ID:" in line:
                    if current_neighbor:
                        neighbors.append(current_neighbor)
                    current_neighbor = {"device_id": line.split(":")[-1].strip()}
                elif "Platform:" in line:
                    # Platform: cisco XRv9000, Capabilities: Router
                    parts = line.split(",")
                    platform = parts[0].replace("Platform:", "").strip() if parts else ""
                    current_neighbor["platform"] = platform
                elif "Interface:" in line:
                    # Interface: GigabitEthernet0/0/0/1, Port ID (outgoing port): GigabitEthernet0/0/0/1
                    match = re.search(r'Interface:\s+(\S+),.*Port ID.*:\s+(\S+)', line)
                    if match:
                        current_neighbor["local_interface"] = match.group(1)
                        current_neighbor["remote_interface"] = match.group(2)
                elif "IP address:" in line:
                    current_neighbor["ip_address"] = line.split(":")[-1].strip()
            if current_neighbor:
                neighbors.append(current_neighbor)
            parsed_data["cdp_neighbors"] = neighbors
            parsed_data["neighbor_count"] = len(neighbors)

        elif "show cdp neighbor" in command:
            # Parse CDP: Extract neighbors (basic)
            # IOS-XR format: Device ID | Local Intrfce | Holdtme | Capability | Platform | Port ID
            # Example: deu-r6.cisco.lo Gi0/0/0/4        164     R          IOS-XRv 9 Gi0/0/0/4
            neighbors = []
            lines = output.splitlines()
            for line in lines:
                # Match lines with interface patterns (Gi, Te, Hu, Fa, Eth, etc.)
                # Skip header lines containing "Device ID"
                if "Device ID" in line or "Capability" in line:
                    continue
                # Check for interface abbreviations (both full and short forms)
                if any(x in line for x in ["Gi", "Te", "Hu", "Fa", "Eth", "Ten", "Gig", "Fast"]):
                    parts = line.split()
                    if len(parts) >= 6:
                        # parts[0] = Device ID, parts[1] = Local Interface, last = Remote Interface (Port ID)
                        neighbors.append({
                            "device_id": parts[0],
                            "local_interface": parts[1],
                            "remote_interface": parts[-1]  # Port ID is the last column
                        })
            parsed_data["neighbors"] = neighbors
            parsed_data["neighbor_count"] = len(neighbors)

        elif "show interface brief" in command:
            # Parse interface brief: BW, MTU, Status
            # Format: Intf Name | Intf State | LineP State | Encap Type | MTU | BW(Kbps)
            interfaces = []
            lines = output.splitlines()
            for line in lines:
                # Match interface lines (Gi, Te, Hu, Be, Lo, Mg, etc.)
                match = re.match(r'\s*((?:Gi|Te|Hu|Be|Lo|Mg|Nu)\S*)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d+)', line)
                if match:
                    intf_name = match.group(1)
                    bw_kbps = int(match.group(6))
                    # Determine capacity class
                    capacity_class = "Unknown"
                    if bw_kbps >= 100000000:
                        capacity_class = "100G"
                    elif bw_kbps >= 40000000:
                        capacity_class = "40G"
                    elif bw_kbps >= 10000000:
                        capacity_class = "10G"
                    elif bw_kbps >= 1000000:
                        capacity_class = "1G"
                    elif bw_kbps >= 100000:
                        capacity_class = "100M"
                    elif bw_kbps > 0:
                        capacity_class = f"{bw_kbps}K"

                    interfaces.append({
                        "interface": intf_name,
                        "state": match.group(2),
                        "line_protocol": match.group(3),
                        "encap": match.group(4),
                        "mtu": int(match.group(5)),
                        "bw_kbps": bw_kbps,
                        "capacity_class": capacity_class
                    })
            parsed_data["interfaces"] = interfaces
            parsed_data["interface_count"] = len(interfaces)

        elif "show interface description" in command:
            # Parse interface descriptions
            interfaces = []
            lines = output.splitlines()
            for line in lines:
                match = re.match(r'(\S+)\s+(up|down|admin-down)\s+(up|down|admin-down)\s*(.*)', line, re.IGNORECASE)
                if match:
                    interfaces.append({
                        "interface": match.group(1),
                        "status": match.group(2),
                        "protocol": match.group(3),
                        "description": match.group(4).strip() if match.group(4) else ""
                    })
            parsed_data["interfaces"] = interfaces
            parsed_data["interface_count"] = len(interfaces)

        elif command == "show interface" or command.startswith("show interface "):
            # Parse full interface output: BW, traffic rates, errors
            interfaces = []
            current_intf = None

            for line in output.splitlines():
                # Interface header: "GigabitEthernet0/0/0/1 is up, line protocol is up"
                intf_match = re.match(r'^(\S+) is ([\w-]+), line protocol is ([\w-]+)', line)
                if intf_match:
                    if current_intf:
                        interfaces.append(current_intf)
                    current_intf = {
                        "interface": intf_match.group(1),
                        "admin_status": intf_match.group(2),
                        "line_protocol": intf_match.group(3),
                        "bw_kbps": 0,
                        "input_rate_bps": 0,
                        "output_rate_bps": 0,
                        "input_rate_pps": 0,
                        "output_rate_pps": 0,
                        "capacity_class": "Unknown"
                    }
                elif current_intf:
                    # BW line: "MTU 1514 bytes, BW 1000000 Kbit"
                    bw_match = re.search(r'BW\s+(\d+)\s+Kbit', line)
                    if bw_match:
                        bw = int(bw_match.group(1))
                        current_intf["bw_kbps"] = bw
                        # Determine capacity class
                        if bw >= 100000000:
                            current_intf["capacity_class"] = "100G"
                        elif bw >= 40000000:
                            current_intf["capacity_class"] = "40G"
                        elif bw >= 10000000:
                            current_intf["capacity_class"] = "10G"
                        elif bw >= 1000000:
                            current_intf["capacity_class"] = "1G"
                        elif bw >= 100000:
                            current_intf["capacity_class"] = "100M"
                        elif bw > 0:
                            current_intf["capacity_class"] = f"{bw}K"

                    # Input rate: "5 minute input rate 1000 bits/sec, 2 packets/sec"
                    input_match = re.search(r'input rate\s+(\d+)\s+bits/sec,\s+(\d+)\s+packets/sec', line)
                    if input_match:
                        current_intf["input_rate_bps"] = int(input_match.group(1))
                        current_intf["input_rate_pps"] = int(input_match.group(2))

                    # Output rate: "5 minute output rate 2000 bits/sec, 3 packets/sec"
                    output_match = re.search(r'output rate\s+(\d+)\s+bits/sec,\s+(\d+)\s+packets/sec', line)
                    if output_match:
                        current_intf["output_rate_bps"] = int(output_match.group(1))
                        current_intf["output_rate_pps"] = int(output_match.group(2))

                    # MAC address
                    mac_match = re.search(r'address is\s+([0-9a-fA-F.]+)', line)
                    if mac_match:
                        current_intf["mac_address"] = mac_match.group(1)

                    # Description
                    desc_match = re.search(r'Description:\s+(.+)', line)
                    if desc_match:
                        current_intf["description"] = desc_match.group(1).strip()

            if current_intf:
                interfaces.append(current_intf)

            # Calculate utilization percentages
            for intf in interfaces:
                if intf["bw_kbps"] > 0:
                    bw_bps = intf["bw_kbps"] * 1000
                    intf["input_utilization_pct"] = round((intf["input_rate_bps"] / bw_bps) * 100, 2)
                    intf["output_utilization_pct"] = round((intf["output_rate_bps"] / bw_bps) * 100, 2)
                else:
                    intf["input_utilization_pct"] = 0
                    intf["output_utilization_pct"] = 0

            parsed_data["interfaces"] = interfaces
            parsed_data["interface_count"] = len(interfaces)

        elif "show bundle" in command:
            # Parse IOS-XR show bundle output for LAG member interfaces
            # Example output:
            # Bundle-Ether200
            #   Status:                                    Up
            #   Local links <active/standby/configured>:   2 / 0 / 2
            #   ...
            #   Port             (speed)      State      Port ID
            #   --------------- ------------- ---------- ----------------
            #   Gi0/0/0/1       1G            Active     0x8000, 0x0001
            bundles = []
            current_bundle = None
            in_member_section = False

            for line in output.splitlines():
                # Match bundle header: "Bundle-Ether200" or "BE200"
                bundle_match = re.match(r'^(Bundle-Ether\d+|BE\d+)', line)
                if bundle_match:
                    if current_bundle:
                        bundles.append(current_bundle)
                    current_bundle = {
                        "bundle_name": bundle_match.group(1),
                        "status": "Unknown",
                        "members": [],
                        "total_bandwidth_kbps": 0
                    }
                    in_member_section = False
                elif current_bundle:
                    # Status line
                    status_match = re.search(r'Status:\s+(\S+)', line)
                    if status_match:
                        current_bundle["status"] = status_match.group(1)

                    # Local links line: "Local links <active/standby/configured>:   2 / 0 / 2"
                    links_match = re.search(r'Local links.*:\s+(\d+)\s*/\s*(\d+)\s*/\s*(\d+)', line)
                    if links_match:
                        current_bundle["active_links"] = int(links_match.group(1))
                        current_bundle["standby_links"] = int(links_match.group(2))
                        current_bundle["configured_links"] = int(links_match.group(3))

                    # Bandwidth line: "Local bandwidth <effective/available>:     2000000 (2000000) kbps"
                    bw_match = re.search(r'bandwidth.*:\s+(\d+)', line, re.IGNORECASE)
                    if bw_match:
                        current_bundle["total_bandwidth_kbps"] = int(bw_match.group(1))

                    # Check for member section header (Port ... State ...)
                    if re.search(r'Port\s+.*State', line, re.IGNORECASE):
                        in_member_section = True
                        continue

                    # Member interface line format (IOS-XR):
                    # Port                  Device           State        Port ID         B/W, kbps
                    # Gi0/0/0/5             Local            Active       0x8000, 0x0002     1000000
                    if in_member_section:
                        # Skip separator lines (----)
                        if line.strip().startswith('-'):
                            continue
                        # Skip "Link is Active" info lines
                        if 'Link is' in line:
                            continue

                        # Match: interface, device, state, port_id (0xNNNN, 0xNNNN), bandwidth(kbps)
                        member_match = re.match(
                            r'\s*((?:Gi|Te|Hu|GigabitEthernet|TenGigE|HundredGigE)\S*)\s+'  # Interface
                            r'(\w+)\s+'  # Device (Local/Remote)
                            r'(\w+)\s+'  # State (Active/Standby)
                            r'\S+,\s+\S+\s+'  # Port ID (0x8000, 0x0002)
                            r'(\d+)',  # Bandwidth in kbps at end
                            line
                        )
                        if member_match:
                            member_intf = member_match.group(1)
                            member_device = member_match.group(2)
                            member_state = member_match.group(3)
                            speed_kbps = int(member_match.group(4))  # Already in kbps

                            current_bundle["members"].append({
                                "interface": member_intf,
                                "device": member_device,
                                "speed_kbps": speed_kbps,
                                "state": member_state
                            })

            if current_bundle:
                bundles.append(current_bundle)

            # Calculate total capacity from active members for each bundle
            for bundle in bundles:
                active_bw = sum(m["speed_kbps"] for m in bundle["members"] if m["state"].lower() == "active")
                bundle["active_bandwidth_kbps"] = active_bw
                # Determine capacity class - show actual aggregated capacity for LAGs
                if active_bw >= 1000000:
                    # Calculate Gbps and show as XG (e.g., 2G, 10G, 40G)
                    gbps = active_bw // 1000000
                    bundle["capacity_class"] = f"{gbps}G"
                elif active_bw >= 100000:
                    bundle["capacity_class"] = "100M"
                elif active_bw > 0:
                    bundle["capacity_class"] = f"{active_bw}K"
                else:
                    bundle["capacity_class"] = "LAG"  # Unknown if no active members

            parsed_data["bundles"] = bundles
            parsed_data["bundle_count"] = len(bundles)

        # Always include raw output lines if parsing failed or was minimal,
        # or just return empty dict if we want to rely on raw_output in parent
        if not parsed_data:
            parsed_data["parsed"] = False
        else:
            parsed_data["parsed"] = True

        return parsed_data

    def execute_command(self, device_id: str, device_name: str, command: str) -> dict:
        """
        Execute a single command on a device
        
        Args:
            device_id: Device identifier
            device_name: Device hostname for file naming
            command: Command to execute
            
        Returns:
            Dict with command output and execution info
        """
        try:
            # Get active connection
            connection = connection_manager.get_connection(device_id)
            if not connection:
                raise DeviceConnectionError(f"Device {device_id} not connected")

            logger.info(f"⚡ Executing on {device_name}: {command}")

            # Execute command with dynamic timeout based on command type
            timeout = get_command_timeout(command)
            start_time = datetime.now()
            output = connection.send_command(command, read_timeout=timeout)
            end_time = datetime.now()
            execution_time = (end_time - start_time).total_seconds()

            # Save output to file
            timestamp = start_time.strftime("%Y-%m-%d_%H-%M-%S")
            command_filename = command.replace(" ", "_").replace("/", "-")
            filename = f"{device_name}_{command_filename}_{timestamp}.txt"
            filepath = os.path.join(self.text_output_dir, filename)

            with open(filepath, 'w') as f:
                f.write(f"# Command: {command}\n")
                f.write(f"# Device: {device_name} ({device_id})\n")
                f.write(f"# Timestamp: {start_time.isoformat()}\n")
                f.write(f"# Execution Time: {execution_time:.2f}s\n")
                f.write("#" + "="*78 + "\n\n")
                f.write(output)
                # Ensure data is flushed to disk for safety
                f.flush()
                os.fsync(f.fileno())

            logger.info(f"✅ Command executed in {execution_time:.2f}s - Output saved to {filename}")

            # Save output to JSON (FIXED)
            json_data = {
                "command": command,
                "device_id": device_id,
                "device_name": device_name,
                "timestamp": start_time.isoformat(),
                "execution_time_seconds": execution_time,
                "parsed_data": self._parse_output_to_json(command, output),
                "raw_output": output
            }
            
            json_filename = f"{device_name}_{command_filename}_{timestamp}.json"
            json_filepath = os.path.join(self.json_output_dir, json_filename)
            
            with open(json_filepath, 'w') as f:
                json.dump(json_data, f, indent=2)
                # Ensure data is flushed to disk for safety
                f.flush()
                os.fsync(f.fileno())

            logger.info(f"✅ JSON saved to {json_filename}")

            # Audit log: command execution success
            output_lines = len(output.split('\n')) if output else 0
            AuditLogger.log_command_execution(
                device_id, device_name, command, success=True,
                duration_seconds=execution_time, output_lines=output_lines
            )

            return {
                'status': 'success',
                'command': command,
                'device_id': device_id,
                'device_name': device_name,
                'output': output,
                'output_length': len(output),
                'execution_time_seconds': execution_time,
                'filename': filename,
                'filepath': filepath,
                'timestamp': start_time.isoformat()
            }

        except DeviceConnectionError as e:
            logger.error(f"❌ Connection error executing '{command}' on {device_name}: {str(e)}")
            # Audit log: command execution failure
            AuditLogger.log_command_execution(
                device_id, device_name, command, success=False,
                duration_seconds=0, error_message=str(e)
            )
            return {
                'status': 'error',
                'command': command,
                'device_id': device_id,
                'device_name': device_name,
                'error': str(e),
                'error_type': 'connection_error'
            }

        except Exception as e:
            logger.error(f"❌ Error executing '{command}' on {device_name}: {str(e)}", exc_info=True)
            # Audit log: command execution failure
            AuditLogger.log_command_execution(
                device_id, device_name, command, success=False,
                duration_seconds=0, error_message=str(e)
            )
            return {
                'status': 'error',
                'command': command,
                'device_id': device_id,
                'device_name': device_name,
                'error': str(e),
                'error_type': 'execution_error'
            }

    def execute_on_multiple_devices(self, device_list: List[dict], commands: List[str]) -> dict:
        """
        Execute commands on multiple connected devices synchronously.

        Args:
            device_list: List of dicts with 'device_id' and 'device_name'
            commands: List of commands to execute

        Returns:
            Dict with execution results
        """
        results = []
        total_success = 0
        total_errors = 0

        logger.info(f"⚡ Executing {len(commands)} commands on {len(device_list)} devices")

        for device in device_list:
            device_id = device.get('device_id')
            device_name = device.get('device_name', device_id)
            device_results = {
                'device_id': device_id,
                'device_name': device_name,
                'commands': []
            }

            for command in commands:
                result = self.execute_command(device_id, device_name, command)
                device_results['commands'].append(result)

                if result.get('status') == 'success':
                    total_success += 1
                else:
                    total_errors += 1

            results.append(device_results)

        return {
            'status': 'completed',
            'total_devices': len(device_list),
            'total_commands': len(commands) * len(device_list),
            'total_commands_success': total_success,
            'total_commands_error': total_errors,
            'results': results
        }

    def execute_job_async(self, job_id: str, device_list: List[dict], commands: List[str] = None, batch_size: int = 10, devices_per_hour: int = 0, execution_id: str = None):
        """Background thread function to run the job with batching and rate limiting"""
        if commands is None:
            commands = OSPF_COMMANDS

        logger.info(f"🚀 Starting async job {job_id} (execution: {execution_id}) on {len(device_list)} devices. Batch size: {batch_size}, Rate: {devices_per_hour}/hr")

        # Create execution-specific CommandExecutor instance
        executor = None
        execution_dir = None
        metadata_file = None
        if execution_id:
            # Create new executor with execution_id for isolated directory structure
            executor = CommandExecutor(execution_id=execution_id)
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            execution_dir = os.path.join(backend_dir, "data", "executions", execution_id)
            metadata_file = os.path.join(execution_dir, "metadata.json")

            # Create initial metadata
            metadata = {
                "execution_id": execution_id,
                "job_id": job_id,
                "timestamp": datetime.now().isoformat(),
                "status": "running",
                "devices": [{"id": d['device_id'], "name": d['device_name'], "ip": d.get('management_ip')} for d in device_list],
                "commands": commands,
                "total_devices": len(device_list)
            }

            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)

            logger.info(f"📁 Created execution directory: {execution_dir}")
        else:
            # Use the current executor instance (legacy)
            executor = self

        # Calculate delay between batches if rate limiting is active
        batch_delay = 0
        if devices_per_hour > 0 and batch_size > 0:
            # Time to process 'batch_size' devices at 'devices_per_hour' rate
            # e.g. 10 devices at 20/hr = 0.5 hours = 1800 seconds
            # We want to space out batches.
            # Rate = devices / time -> time = devices / rate
            # time_per_batch = batch_size / devices_per_hour (hours)
            # time_per_batch_seconds = time_per_batch * 3600
            batch_delay = (batch_size / devices_per_hour) * 3600
            logger.info(f"⏱️ Rate limiting active: {devices_per_hour} dev/hr. Delay between batches: {batch_delay:.2f}s")

        # Split into batches
        batches = [device_list[i:i + batch_size] for i in range(0, len(device_list), batch_size)]
        
        for batch_idx, batch in enumerate(batches):
            # Check stop request
            if job_manager.is_stop_requested(job_id):
                logger.warning(f"🛑 Job {job_id} stopped by user")
                job_manager.update_job_progress(job_id, "SYSTEM", {"status": "stopped"})
                return

            logger.info(f"📦 Processing Batch {batch_idx + 1}/{len(batches)} with {len(batch)} devices")

            # Process batch using the executor instance (with correct output dirs)
            executor._process_batch(job_id, batch, commands)
            
            # Delay before next batch (if not last batch)
            if batch_idx < len(batches) - 1 and batch_delay > 0:
                logger.info(f"⏳ Waiting {batch_delay:.2f}s before next batch...")
                # Sleep in chunks to allow stopping
                sleep_chunk = 1
                total_slept = 0
                while total_slept < batch_delay:
                    if job_manager.is_stop_requested(job_id):
                        return
                    time.sleep(sleep_chunk)
                    total_slept += sleep_chunk

        # After all batches complete: Update final metadata and create symlink
        if execution_id and metadata_file:
            job = job_manager.get_job(job_id)
            if job:
                # Update metadata with final results
                metadata = {
                    "execution_id": execution_id,
                    "job_id": job_id,
                    "timestamp": datetime.now().isoformat(),
                    "start_time": job.get("start_time"),
                    "end_time": job.get("end_time"),
                    "status": job.get("status", "completed"),
                    "devices": [{"id": d['device_id'], "name": d['device_name'], "ip": d.get('management_ip')} for d in device_list],
                    "commands": commands,
                    "results": {
                        "total_devices": job.get("total_devices", 0),
                        "completed_devices": job.get("completed_devices", 0),
                        "progress_percent": job.get("progress_percent", 0)
                    },
                    "files": {
                        "text_dir": os.path.join(execution_dir, "TEXT"),
                        "json_dir": os.path.join(execution_dir, "JSON")
                    }
                }

                with open(metadata_file, 'w') as f:
                    json.dump(metadata, f, indent=2)

                # Update 'current' symlink to point to this execution
                backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                current_link = os.path.join(backend_dir, "data", "current")

                # Remove existing symlink if it exists
                if os.path.lexists(current_link):
                    os.unlink(current_link)

                # Create new symlink
                os.symlink(execution_dir, current_link)

                logger.info(f"✅ Execution complete: {execution_id}")
                logger.info(f"📁 Data saved to: {execution_dir}")
                logger.info(f"🔗 Updated 'current' symlink")

    def _process_batch(self, job_id: str, batch: List[dict], commands: List[str]):
        """Process a single batch of devices"""
        
        def process_device(device):
            # Check if stop requested
            if job_manager.is_stop_requested(job_id):
                return

            device_id = device['device_id']
            device_name = device['device_name']
            country = device.get('country', 'Unknown')
            
            # Initialize commands for tracking
            job_manager.init_device_commands(job_id, device_id, commands)
            
            device_result = {'device_id': device_id, 'device_name': device_name, 'commands': []}

            try:
                # 1. LAZY CONNECTION: Connect on-demand if not already connected
                if not connection_manager.is_connected(device_id):
                    logger.info(f"🔌 Connecting to {device_name} on demand...")
                    job_manager.update_device_status(job_id, device_id, "connecting")
                    
                    try:
                        # Connect with full credentials (now available in device dict)
                        connection_manager.connect(device_id, device, timeout=10)
                        job_manager.update_device_status(job_id, device_id, "connected")
                        logger.info(f"✅ Connected to {device_name}")
                    except Exception as e:
                        logger.error(f"❌ Connection failed for {device_name}: {str(e)}")
                        device_result['status'] = 'failed'
                        device_result['error'] = f'Connection failed: {str(e)}'
                        job_manager.update_job_progress(job_id, device_id, device_result)
                        job_manager.update_device_status(job_id, device_id, "connection_failed", error=str(e))
                        return

                # Verify connection established
                if not connection_manager.is_connected(device_id):
                    device_result['status'] = 'failed'
                    device_result['error'] = 'Device not connected'
                    job_manager.update_job_progress(job_id, device_id, device_result)
                    job_manager.update_device_status(job_id, device_id, "connection_failed", error="Not connected")
                    return

                # 2. Health Check (CPU/Mem)
                # We can track health check as a "hidden" command or just do it
                health = self.check_device_health(device_id, device_name)
                if not health['healthy']:
                    device_result['status'] = 'failed'
                    device_result['error'] = health['reason']
                    job_manager.update_job_progress(job_id, device_id, device_result)
                    return

                # 3. Execute Commands
                success_count = 0
                error_count = 0
                
                for i, cmd in enumerate(commands):
                    if job_manager.is_stop_requested(job_id):
                        break

                    # Update current execution
                    job_manager.update_current_execution(job_id, {
                        "device_id": device_id,
                        "device_name": device_name,
                        "country": country,
                        "current_command": cmd,
                        "command_index": i + 1,
                        "total_commands": len(commands),
                        "command_percent": 0, # Will be updated
                        "command_elapsed_time": 0
                    })
                    
                    # Mark command running
                    job_manager.update_device_command_status(job_id, device_id, i, "running")
                    
                    cmd_start = time.time()
                    res = self.execute_command(device_id, device_name, cmd)
                    cmd_end = time.time()
                    execution_time = cmd_end - cmd_start
                    
                    device_result['commands'].append(res)
                    
                    if res['status'] == 'success':
                        success_count += 1
                        job_manager.update_device_command_status(job_id, device_id, i, "success", execution_time)
                    else:
                        error_count += 1
                        job_manager.update_device_command_status(job_id, device_id, i, "failed", execution_time, res.get('error'))

                device_result['status'] = 'success' if error_count == 0 else 'partial_success' if success_count > 0 else 'failed'
                device_result['summary'] = f"{success_count}/{len(commands)} commands success"
                
                job_manager.update_job_progress(job_id, device_id, device_result)
                
                # Disconnect after processing (as per requirement)
                # connection_manager.disconnect(device_id) 
                # Commented out to keep connections for now as re-connecting might be slow/complex without full credentials here

            except Exception as e:
                logger.error(f"❌ Unexpected error in job {job_id} for {device_name}: {str(e)}")
                device_result['status'] = 'error'
                device_result['error'] = str(e)
                job_manager.update_job_progress(job_id, device_id, device_result)

        # Parallel execution within batch
        max_workers = min(10, len(batch)) if len(batch) > 0 else 1
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(process_device, device): device for device in batch}
            for future in as_completed(futures):
                pass
        
        # AUTO-DISCONNECT: Disconnect all devices in batch after completion
        logger.info(f"🔌 Disconnecting {len(batch)} devices from batch...")
        for device in batch:
            device_id = device['device_id']
            device_name = device.get('device_name', device_id)
            
            try:
                if connection_manager.is_connected(device_id):
                    job_manager.update_device_status(job_id, device_id, "disconnecting")
                    connection_manager.disconnect(device_id)
                    job_manager.update_device_status(job_id, device_id, "disconnected")
                    logger.info(f"✅ Disconnected from {device_name}")
            except Exception as e:
                logger.warning(f"⚠️  Disconnect error for {device_name}: {str(e)}")
        
        logger.info(f"✅ Batch complete and disconnected")

    def start_automation_job(self, device_list: List[dict], commands: List[str] = None, batch_size: int = 10, devices_per_hour: int = 0) -> str:
        """Start an async automation job with batching and execution isolation"""
        # Create job first to get job_id
        job_id = job_manager.create_job(device_list)

        # Generate unique execution_id
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        execution_id = f"exec_{timestamp}_{job_id[:8]}"

        # Store execution_id in job
        job_manager.set_execution_id(job_id, execution_id)

        logger.info(f"🆔 Created execution: {execution_id}")

        # Start background thread with execution_id
        thread = threading.Thread(target=self.execute_job_async, args=(job_id, device_list, commands, batch_size, devices_per_hour, execution_id))
        thread.daemon = True
        thread.start()

        return job_id

# Global command executor instance
command_executor = CommandExecutor()
