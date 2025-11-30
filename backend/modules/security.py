"""
Enhanced Security Module for NetMan OSPF Device Manager
Implements comprehensive security measures:
- Rate limiting
- Input validation and sanitization
- SQL injection protection
- Password security
- Audit logging
"""

import re
import hashlib
import secrets
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path
import html
import json

logger = logging.getLogger(__name__)

# ============================================================================
# PASSWORD SECURITY
# ============================================================================

class PasswordPolicy:
    """Password complexity requirements"""
    MIN_LENGTH = 8
    MAX_LENGTH = 128
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGIT = True
    REQUIRE_SPECIAL = True
    SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    
    # Common weak passwords to reject
    WEAK_PASSWORDS = {
        "password", "123456", "12345678", "qwerty", "abc123", "monkey",
        "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master",
        "sunshine", "ashley", "bailey", "passw0rd", "shadow", "123123",
        "654321", "superman", "qazwsx", "michael", "football", "admin",
        "admin123", "administrator", "root", "toor", "cisco", "default"
    }

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets security requirements
    
    Returns:
        (is_valid, error_message)
    """
    if len(password) < PasswordPolicy.MIN_LENGTH:
        return False, f"Password must be at least {PasswordPolicy.MIN_LENGTH} characters long"
    
    if len(password) > PasswordPolicy.MAX_LENGTH:
        return False, f"Password must be at most {PasswordPolicy.MAX_LENGTH} characters long"
    
    if PasswordPolicy.REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if PasswordPolicy.REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if PasswordPolicy.REQUIRE_DIGIT and not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    if PasswordPolicy.REQUIRE_SPECIAL and not re.search(f'[{re.escape(PasswordPolicy.SPECIAL_CHARS)}]', password):
        return False, f"Password must contain at least one special character ({PasswordPolicy.SPECIAL_CHARS})"
    
    # Check against weak passwords
    if password.lower() in PasswordPolicy.WEAK_PASSWORDS:
        return False, "This password is too common and weak. Please choose a stronger password"
    
    return True, ""


def hash_password_secure(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """
    Hash password using PBKDF2 with SHA-256 (more secure than simple SHA-256)
    
    Args:
        password: Password to hash
        salt: Optional salt (generated if not provided)
        
    Returns:
        (hash, salt)
    """
    if salt is None:
        salt = secrets.token_hex(32)
    
    # PBKDF2 with 100,000 iterations
    password_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000  # iterations
    )
    
    return password_hash.hex(), salt


def verify_password_secure(password: str, stored_hash: str, salt: str) -> bool:
    """
    Verify password against stored hash
    
    Args:
        password: Password to verify
        stored_hash: Stored password hash
        salt: Salt used for hashing
        
    Returns:
        True if password matches
    """
    password_hash, _ = hash_password_secure(password, salt)
    return secrets.compare_digest(password_hash, stored_hash)


# ============================================================================
# INPUT VALIDATION & SANITIZATION
# ============================================================================

def sanitize_string(value: str, max_length: int = 255) -> str:
    """
    Sanitize string input to prevent XSS and injection attacks
    
    Args:
        value: Input string
        max_length: Maximum allowed length
        
    Returns:
        Sanitized string
    """
    if not isinstance(value, str):
        return ""
    
    # Truncate to max length
    value = value[:max_length]
    
    # HTML escape to prevent XSS
    value = html.escape(value, quote=True)
    
    # Remove null bytes
    value = value.replace('\x00', '')
    
    return value


def validate_hostname(hostname: str) -> tuple[bool, str]:
    """
    Validate hostname or IP address
    
    Returns:
        (is_valid, error_message)
    """
    if not hostname or len(hostname) > 255:
        return False, "Invalid hostname length"
    
    # Check for valid hostname pattern (RFC 1123)
    hostname_pattern = r'^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))*$'
    
    # Check for valid IPv4
    ipv4_pattern = r'^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
    
    if re.match(hostname_pattern, hostname) or re.match(ipv4_pattern, hostname):
        return True, ""
    
    return False, "Invalid hostname or IP address format"


def validate_username(username: str) -> tuple[bool, str]:
    """
    Validate username format
    
    Returns:
        (is_valid, error_message)
    """
    if not username:
        return False, "Username cannot be empty"
    
    if len(username) < 3:
        return False, "Username must be at least 3 characters"
    
    if len(username) > 32:
        return False, "Username must be at most 32 characters"
    
    # Only allow alphanumeric and underscore
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return False, "Username can only contain letters, numbers, and underscores"
    
    return True, ""


def validate_device_name(device_name: str) -> tuple[bool, str]:
    """
    Validate device name format
    
    Returns:
        (is_valid, error_message)
    """
    if not device_name:
        return False, "Device name cannot be empty"
    
    if len(device_name) > 64:
        return False, "Device name must be at most 64 characters"
    
    # Allow alphanumeric, hyphens, underscores, and dots
    if not re.match(r'^[a-zA-Z0-9\-_.]+$', device_name):
        return False, "Device name can only contain letters, numbers, hyphens, underscores, and dots"
    
    return True, ""


def validate_command(command: str) -> tuple[bool, str]:
    """
    Validate Cisco IOS command (basic validation)
    
    Returns:
        (is_valid, error_message)
    """
    if not command:
        return False, "Command cannot be empty"
    
    if len(command) > 500:
        return False, "Command is too long"
    
    # Block dangerous commands
    dangerous_patterns = [
        r'rm\s+',  # Delete files
        r'format\s+',  # Format filesystem
        r'reload\s+',  # Reload device (use with caution)
        r'write\s+erase',  # Erase startup config
        r'delete\s+',  # Delete files
        r'\|',  # Pipe (potential command injection)
        r';',  # Command separator (potential command injection)
        r'&&',  # Command chaining
        r'\$\(',  # Command substitution
        r'`',  # Command substitution
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, command, re.IGNORECASE):
            return False, f"Command contains potentially dangerous pattern: {pattern}"
    
    return True, ""


# ============================================================================
# SQL INJECTION PROTECTION
# ============================================================================

def sanitize_sql_like_pattern(pattern: str) -> str:
    """
    Sanitize SQL LIKE pattern to prevent injection
    
    Args:
        pattern: User-provided search pattern
        
    Returns:
        Sanitized pattern
    """
    # Escape SQL LIKE wildcards
    pattern = pattern.replace('\\', '\\\\')
    pattern = pattern.replace('%', '\\%')
    pattern = pattern.replace('_', '\\_')
    pattern = pattern.replace('[', '\\[')
    
    return pattern


def validate_sql_identifier(identifier: str) -> tuple[bool, str]:
    """
    Validate SQL identifier (table/column name)
    
    Returns:
        (is_valid, error_message)
    """
    if not identifier:
        return False, "Identifier cannot be empty"
    
    # Only allow alphanumeric and underscore
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', identifier):
        return False, "Invalid SQL identifier format"
    
    # Check against SQL keywords
    sql_keywords = {
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
        'TABLE', 'DATABASE', 'INDEX', 'VIEW', 'TRIGGER', 'PROCEDURE',
        'UNION', 'WHERE', 'FROM', 'JOIN', 'GROUP', 'ORDER', 'HAVING'
    }
    
    if identifier.upper() in sql_keywords:
        return False, f"'{identifier}' is a reserved SQL keyword"
    
    return True, ""


# ============================================================================
# RATE LIMITING
# ============================================================================

class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self._requests: Dict[str, List[datetime]] = {}
        self._blocked: Dict[str, datetime] = {}
    
    def is_rate_limited(self, identifier: str, max_requests: int = 100, window_seconds: int = 60) -> bool:
        """
        Check if identifier is rate limited
        
        Args:
            identifier: Client identifier (IP address, username, etc.)
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds
            
        Returns:
            True if rate limited
        """
        now = datetime.now()
        
        # Check if blocked
        if identifier in self._blocked:
            unblock_time = self._blocked[identifier]
            if now < unblock_time:
                return True
            else:
                del self._blocked[identifier]
        
        # Clean old requests
        if identifier in self._requests:
            cutoff = now - timedelta(seconds=window_seconds)
            self._requests[identifier] = [
                req_time for req_time in self._requests[identifier]
                if req_time > cutoff
            ]
        else:
            self._requests[identifier] = []
        
        # Check rate limit
        if len(self._requests[identifier]) >= max_requests:
            # Block for 5 minutes
            self._blocked[identifier] = now + timedelta(minutes=5)
            logger.warning(f"Rate limit exceeded for {identifier}, blocked for 5 minutes")
            return True
        
        # Add current request
        self._requests[identifier].append(now)
        return False
    
    def reset(self, identifier: str):
        """Reset rate limit for identifier"""
        if identifier in self._requests:
            del self._requests[identifier]
        if identifier in self._blocked:
            del self._blocked[identifier]


# Global rate limiter instance
rate_limiter = RateLimiter()


# ============================================================================
# AUDIT LOGGING
# ============================================================================

class AuditLogger:
    """Security audit logger"""
    
    def __init__(self, log_file: str = "logs/security_audit.log"):
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Create separate audit logger
        self.logger = logging.getLogger("SecurityAudit")
        self.logger.setLevel(logging.INFO)
        
        # File handler for audit log
        handler = logging.handlers.RotatingFileHandler(
            self.log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=10
        )
        handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
        self.logger.addHandler(handler)
    
    def log_event(self, event_type: str, user: str, ip: str, details: Dict[str, Any] = None):
        """
        Log security event
        
        Args:
            event_type: Type of event (login, logout, failed_login, etc.)
            user: Username
            ip: IP address
            details: Additional details
        """
        event = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "user": user,
            "ip": ip,
            "details": details or {}
        }
        
        self.logger.info(json.dumps(event))
    
    def log_login_success(self, user: str, ip: str):
        """Log successful login"""
        self.log_event("login_success", user, ip)
    
    def log_login_failure(self, user: str, ip: str, reason: str = "invalid_credentials"):
        """Log failed login attempt"""
        self.log_event("login_failure", user, ip, {"reason": reason})
    
    def log_logout(self, user: str, ip: str):
        """Log logout"""
        self.log_event("logout", user, ip)
    
    def log_password_change(self, user: str, ip: str, by_user: str):
        """Log password change"""
        self.log_event("password_change", user, ip, {"by_user": by_user})
    
    def log_user_created(self, user: str, ip: str, by_user: str, role: str):
        """Log user creation"""
        self.log_event("user_created", user, ip, {"by_user": by_user, "role": role})
    
    def log_user_deleted(self, user: str, ip: str, by_user: str):
        """Log user deletion"""
        self.log_event("user_deleted", user, ip, {"by_user": by_user})
    
    def log_permission_denied(self, user: str, ip: str, resource: str, action: str):
        """Log permission denied"""
        self.log_event("permission_denied", user, ip, {"resource": resource, "action": action})
    
    def log_suspicious_activity(self, user: str, ip: str, activity: str):
        """Log suspicious activity"""
        self.log_event("suspicious_activity", user, ip, {"activity": activity})


# Global audit logger instance
audit_logger = AuditLogger()


# ============================================================================
# SECURE HEADERS
# ============================================================================

def get_security_headers() -> Dict[str, str]:
    """
    Get recommended security headers
    
    Returns:
        Dictionary of header name: value pairs
    """
    return {
        # Prevent clickjacking
        "X-Frame-Options": "DENY",
        
        # Prevent MIME type sniffing
        "X-Content-Type-Options": "nosniff",
        
        # Enable XSS protection
        "X-XSS-Protection": "1; mode=block",
        
        # Content Security Policy (strict)
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; "
            "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' ws: wss:; "
            "frame-ancestors 'none';"
        ),
        
        # Referrer Policy
        "Referrer-Policy": "strict-origin-when-cross-origin",
        
        # Permissions Policy (restrict features)
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        
        # Remove server header
        "Server": "NetMan-OSPF",
    }


# ============================================================================
# REQUEST VALIDATION
# ============================================================================

def validate_request_size(content_length: Optional[int], max_size: int = 10 * 1024 * 1024) -> tuple[bool, str]:
    """
    Validate request size
    
    Args:
        content_length: Content-Length header value
        max_size: Maximum allowed size in bytes (default 10MB)
        
    Returns:
        (is_valid, error_message)
    """
    if content_length is None:
        return True, ""
    
    if content_length > max_size:
        return False, f"Request too large (max {max_size // 1024 // 1024}MB)"
    
    return True, ""


def validate_json_payload(payload: Any, required_fields: List[str] = None) -> tuple[bool, str]:
    """
    Validate JSON payload structure
    
    Args:
        payload: Parsed JSON payload
        required_fields: List of required field names
        
    Returns:
        (is_valid, error_message)
    """
    if not isinstance(payload, dict):
        return False, "Payload must be a JSON object"
    
    if required_fields:
        missing_fields = [field for field in required_fields if field not in payload]
        if missing_fields:
            return False, f"Missing required fields: {', '.join(missing_fields)}"
    
    return True, ""


# ============================================================================
# SESSION SECURITY
# ============================================================================

def generate_secure_token(length: int = 32) -> str:
    """
    Generate cryptographically secure random token
    
    Args:
        length: Token length in bytes
        
    Returns:
        Hex-encoded token
    """
    return secrets.token_hex(length)


def validate_session_token(token: str) -> bool:
    """
    Validate session token format
    
    Args:
        token: Session token
        
    Returns:
        True if valid format
    """
    if not token:
        return False
    
    # Check length (64 hex characters for 32-byte token)
    if len(token) != 64:
        return False
    
    # Check if hex
    try:
        int(token, 16)
        return True
    except ValueError:
        return False
