"""
Audit Logger Module for NetMan OSPF Device Manager
Tracks device connections, commands issued, jumphost usage with timestamps and durations
"""

import os
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from .env_config import load_env_file

# Base directory
BASE_DIR = Path(__file__).parent.parent

# Audit log file
AUDIT_LOG_FILE = BASE_DIR / "logs" / "audit.log"


def is_audit_logging_enabled() -> bool:
    """Check if audit logging is enabled in environment"""
    env = load_env_file()
    return env.get('AUDIT_LOGGING_ENABLED', 'false').lower() == 'true'


def get_audit_log_path() -> Path:
    """Get the audit log file path"""
    env = load_env_file()
    log_file = env.get('AUDIT_LOG_FILE', 'logs/audit.log')
    return BASE_DIR / log_file


def _ensure_log_directory():
    """Ensure the logs directory exists"""
    log_path = get_audit_log_path()
    log_path.parent.mkdir(parents=True, exist_ok=True)


def _write_audit_entry(entry: dict):
    """Write an audit entry to the log file"""
    if not is_audit_logging_enabled():
        return

    _ensure_log_directory()
    log_path = get_audit_log_path()

    try:
        with open(log_path, 'a') as f:
            f.write(json.dumps(entry) + '\n')
    except Exception as e:
        logging.error(f"Failed to write audit log: {e}")


class AuditLogger:
    """
    Audit logger for tracking device operations

    Usage:
        with AuditLogger.device_connection(device_id, device_name, ip_address) as audit:
            # ... connection code ...
            audit.log_command("show version")
    """

    def __init__(self):
        self._operations: Dict[str, dict] = {}

    @classmethod
    def log_jumphost_connect(cls, jumphost_host: str, jumphost_port: int,
                             user: str, success: bool, error_message: Optional[str] = None):
        """Log jumphost connection attempt"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'JUMPHOST_CONNECT',
            'jumphost_host': jumphost_host,
            'jumphost_port': jumphost_port,
            'user': user,
            'success': success,
            'error_message': error_message
        }
        _write_audit_entry(entry)

        if is_audit_logging_enabled():
            status = "SUCCESS" if success else f"FAILED: {error_message}"
            logging.info(f"[AUDIT] Jumphost connection to {jumphost_host}:{jumphost_port} - {status}")

    @classmethod
    def log_jumphost_disconnect(cls, jumphost_host: str, session_duration_seconds: float):
        """Log jumphost disconnection"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'JUMPHOST_DISCONNECT',
            'jumphost_host': jumphost_host,
            'session_duration_seconds': round(session_duration_seconds, 2)
        }
        _write_audit_entry(entry)

        if is_audit_logging_enabled():
            logging.info(f"[AUDIT] Jumphost {jumphost_host} disconnected after {session_duration_seconds:.2f}s")

    @classmethod
    def log_device_connect(cls, device_id: str, device_name: str, ip_address: str,
                           via_jumphost: bool, jumphost_host: Optional[str],
                           success: bool, error_message: Optional[str] = None):
        """Log device connection attempt"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'DEVICE_CONNECT',
            'device_id': device_id,
            'device_name': device_name,
            'ip_address': ip_address,
            'via_jumphost': via_jumphost,
            'jumphost_host': jumphost_host,
            'success': success,
            'error_message': error_message
        }
        _write_audit_entry(entry)

        if is_audit_logging_enabled():
            status = "SUCCESS" if success else f"FAILED: {error_message}"
            route = f" via {jumphost_host}" if via_jumphost else " (direct)"
            logging.info(f"[AUDIT] Device connection to {device_name} ({ip_address}){route} - {status}")

    @classmethod
    def log_device_disconnect(cls, device_id: str, device_name: str,
                              session_duration_seconds: float, commands_executed: int):
        """Log device disconnection"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'DEVICE_DISCONNECT',
            'device_id': device_id,
            'device_name': device_name,
            'session_duration_seconds': round(session_duration_seconds, 2),
            'commands_executed': commands_executed
        }
        _write_audit_entry(entry)

        if is_audit_logging_enabled():
            logging.info(f"[AUDIT] Device {device_name} disconnected after {session_duration_seconds:.2f}s ({commands_executed} commands)")

    @classmethod
    def log_command_execution(cls, device_id: str, device_name: str, command: str,
                              success: bool, duration_seconds: float,
                              error_message: Optional[str] = None,
                              output_lines: Optional[int] = None):
        """Log command execution on a device"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'COMMAND_EXECUTE',
            'device_id': device_id,
            'device_name': device_name,
            'command': command,
            'success': success,
            'duration_seconds': round(duration_seconds, 3),
            'error_message': error_message,
            'output_lines': output_lines
        }
        _write_audit_entry(entry)

        if is_audit_logging_enabled():
            status = "SUCCESS" if success else f"FAILED: {error_message}"
            logging.info(f"[AUDIT] Command on {device_name}: '{command}' - {status} ({duration_seconds:.3f}s)")

    @classmethod
    def log_automation_job_start(cls, job_id: str, device_count: int, command_count: int,
                                  user: Optional[str] = None):
        """Log automation job start"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'AUTOMATION_JOB_START',
            'job_id': job_id,
            'device_count': device_count,
            'command_count': command_count,
            'user': user
        }
        _write_audit_entry(entry)

        if is_audit_logging_enabled():
            logging.info(f"[AUDIT] Automation job {job_id} started - {device_count} devices, {command_count} commands")

    @classmethod
    def log_automation_job_complete(cls, job_id: str, total_duration_seconds: float,
                                     devices_succeeded: int, devices_failed: int,
                                     commands_executed: int, commands_failed: int):
        """Log automation job completion"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'AUTOMATION_JOB_COMPLETE',
            'job_id': job_id,
            'total_duration_seconds': round(total_duration_seconds, 2),
            'devices_succeeded': devices_succeeded,
            'devices_failed': devices_failed,
            'commands_executed': commands_executed,
            'commands_failed': commands_failed
        }
        _write_audit_entry(entry)

        if is_audit_logging_enabled():
            logging.info(f"[AUDIT] Automation job {job_id} complete - {total_duration_seconds:.2f}s, "
                        f"{devices_succeeded}/{devices_succeeded + devices_failed} devices, "
                        f"{commands_executed}/{commands_executed + commands_failed} commands")

    @classmethod
    def log_user_login(cls, username: str, success: bool, ip_address: str,
                       error_message: Optional[str] = None):
        """Log user login attempt"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'USER_LOGIN',
            'username': username,
            'success': success,
            'ip_address': ip_address,
            'error_message': error_message
        }
        _write_audit_entry(entry)

        if is_audit_logging_enabled():
            status = "SUCCESS" if success else f"FAILED: {error_message}"
            logging.info(f"[AUDIT] User login '{username}' from {ip_address} - {status}")

    @classmethod
    def log_user_logout(cls, username: str, session_duration_seconds: float):
        """Log user logout"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'USER_LOGOUT',
            'username': username,
            'session_duration_seconds': round(session_duration_seconds, 2)
        }
        _write_audit_entry(entry)

        if is_audit_logging_enabled():
            logging.info(f"[AUDIT] User '{username}' logged out after {session_duration_seconds:.2f}s")


class DeviceOperationAudit:
    """Context manager for tracking device operation duration"""

    def __init__(self, device_id: str, device_name: str, ip_address: str,
                 via_jumphost: bool = False, jumphost_host: Optional[str] = None):
        self.device_id = device_id
        self.device_name = device_name
        self.ip_address = ip_address
        self.via_jumphost = via_jumphost
        self.jumphost_host = jumphost_host
        self.start_time: Optional[datetime] = None
        self.commands_executed: int = 0
        self.connected: bool = False

    def __enter__(self):
        self.start_time = datetime.now()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.connected and self.start_time:
            duration = (datetime.now() - self.start_time).total_seconds()
            AuditLogger.log_device_disconnect(
                self.device_id, self.device_name, duration, self.commands_executed
            )
        return False

    def log_connect_success(self):
        """Mark connection as successful"""
        self.connected = True
        AuditLogger.log_device_connect(
            self.device_id, self.device_name, self.ip_address,
            self.via_jumphost, self.jumphost_host, success=True
        )

    def log_connect_failure(self, error_message: str):
        """Mark connection as failed"""
        AuditLogger.log_device_connect(
            self.device_id, self.device_name, self.ip_address,
            self.via_jumphost, self.jumphost_host, success=False,
            error_message=error_message
        )

    def log_command(self, command: str, success: bool, duration: float,
                    error_message: Optional[str] = None, output_lines: Optional[int] = None):
        """Log a command execution"""
        self.commands_executed += 1
        AuditLogger.log_command_execution(
            self.device_id, self.device_name, command, success, duration,
            error_message, output_lines
        )


def get_audit_summary(since: Optional[datetime] = None) -> dict:
    """
    Get a summary of audit logs

    Args:
        since: Only include events since this datetime

    Returns:
        Summary statistics
    """
    log_path = get_audit_log_path()

    if not log_path.exists():
        return {'total_events': 0, 'events': []}

    events = []
    try:
        with open(log_path, 'r') as f:
            for line in f:
                try:
                    event = json.loads(line.strip())
                    if since:
                        event_time = datetime.fromisoformat(event['timestamp'])
                        if event_time < since:
                            continue
                    events.append(event)
                except (json.JSONDecodeError, KeyError):
                    continue
    except Exception as e:
        logging.error(f"Failed to read audit log: {e}")
        return {'total_events': 0, 'error': str(e)}

    # Calculate summary
    summary = {
        'total_events': len(events),
        'event_types': {},
        'device_connections': 0,
        'commands_executed': 0,
        'jumphost_connections': 0,
        'user_logins': 0,
        'automation_jobs': 0
    }

    for event in events:
        event_type = event.get('event_type', 'UNKNOWN')
        summary['event_types'][event_type] = summary['event_types'].get(event_type, 0) + 1

        if event_type == 'DEVICE_CONNECT' and event.get('success'):
            summary['device_connections'] += 1
        elif event_type == 'COMMAND_EXECUTE':
            summary['commands_executed'] += 1
        elif event_type == 'JUMPHOST_CONNECT' and event.get('success'):
            summary['jumphost_connections'] += 1
        elif event_type == 'USER_LOGIN' and event.get('success'):
            summary['user_logins'] += 1
        elif event_type == 'AUTOMATION_JOB_START':
            summary['automation_jobs'] += 1

    return summary
