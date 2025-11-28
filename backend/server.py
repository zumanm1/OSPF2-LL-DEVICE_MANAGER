from fastapi import FastAPI, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import asyncio
from typing import List, Optional
import sqlite3
import json
import uuid
from contextlib import contextmanager
import logging
from logging.handlers import RotatingFileHandler
import time
from datetime import datetime
import os

# Define Base Directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

# Create logs directory if it doesn't exist
import os
if not os.path.exists('logs'):
    os.makedirs('logs')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Create logger
logger = logging.getLogger("NetworkDeviceManager")
logger.setLevel(logging.DEBUG)

# Console handler (INFO and above)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
console_handler.setFormatter(console_formatter)

# File handler with rotation (DEBUG and above) - 10MB max, keep 5 backup files
file_handler = RotatingFileHandler(
    'logs/app.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
file_handler.setFormatter(file_formatter)

# Error file handler (ERROR and above only)
error_handler = RotatingFileHandler(
    'logs/error.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(file_formatter)

# Add handlers to logger
logger.addHandler(console_handler)
logger.addHandler(file_handler)
logger.addHandler(error_handler)

logger.info("="*80)
logger.info("Network Device Manager API - Logging Initialized")
logger.info("="*80)

# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

app = FastAPI(title="Network Device Manager API", version="1.0.0")

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests and responses"""
    start_time = time.time()

    # Log incoming request
    logger.info(f"➡️  {request.method} {request.url.path} - Client: {request.client.host if request.client else 'Unknown'}")
    logger.debug(f"Request headers: {dict(request.headers)}")

    try:
        response = await call_next(request)
        process_time = time.time() - start_time

        # Log response
        logger.info(
            f"⬅️  {request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.3f}s"
        )

        # Add custom header with processing time
        response.headers["X-Process-Time"] = str(process_time)

        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f"❌ {request.method} {request.url.path} - "
            f"Error: {str(e)} - "
            f"Time: {process_time:.3f}s",
            exc_info=True
        )
        raise

# ============================================================================
# AUTHENTICATION & SECURITY MIDDLEWARE
# ============================================================================

# Public endpoints that don't require authentication
PUBLIC_ENDPOINTS = [
    "/",
    "/api/health",
    "/api/auth/login",
    "/api/auth/status",
    "/api/auth/password-status",
    "/api/auth/change-password",
    "/api/auth/reset-password-with-pin",
    "/docs",
    "/openapi.json",
    "/redoc",
]

@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """
    Security middleware that enforces:
    1. Localhost-only access (when enabled)
    2. Session-based authentication (when enabled)
    """
    from modules.auth import (
        is_security_enabled, is_localhost_only, get_allowed_hosts,
        validate_session
    )

    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path

    # === LOCALHOST RESTRICTION ===
    if is_localhost_only():
        allowed = get_allowed_hosts()
        if client_ip not in allowed and client_ip != "127.0.0.1":
            logger.warning(f"🚫 Access denied from {client_ip} - localhost only mode")
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. This application only accepts local connections."}
            )

    # === AUTHENTICATION CHECK ===
    if is_security_enabled():
        # Skip auth for public endpoints
        is_public = any(path == ep or path.startswith(ep + "/") for ep in PUBLIC_ENDPOINTS)

        if not is_public:
            # Check for session token in cookie or header
            token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")

            if not token:
                logger.debug(f"🔒 No session token for {path}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication required", "login_url": "/api/auth/login"}
                )

            valid, session = validate_session(token)
            if not valid:
                logger.debug(f"🔒 Invalid/expired session for {path}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Session expired or invalid", "login_url": "/api/auth/login"}
                )

            # Add session info to request state for use in endpoints
            request.state.session = session
            request.state.username = session.get('username')

    return await call_next(request)

# CORS middleware - restrict origins based on localhost_only setting
from modules.auth import is_localhost_only, get_allowed_hosts

cors_origins = ["http://localhost:9050", "http://127.0.0.1:9050"] if is_localhost_only() else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database file paths (absolute paths in backend directory)
DEVICES_DB = os.path.join(BASE_DIR, "devices.db")
AUTOMATION_DB = os.path.join(BASE_DIR, "automation.db")
TOPOLOGY_DB = os.path.join(BASE_DIR, "topology.db")
DATASAVE_DB = os.path.join(BASE_DIR, "datasave.db")

DB_PATHS = {
    "devices": DEVICES_DB,
    "automation": AUTOMATION_DB,
    "topology": TOPOLOGY_DB,
    "datasave": DATASAVE_DB
}

@contextmanager
def get_db(db_name: str = "devices"):
    """Context manager for database connections"""
    if db_name not in DB_PATHS:
        raise ValueError(f"Unknown database: {db_name}")

    db_path = DB_PATHS[db_name]
    logger.debug(f"📂 Opening database connection: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    # Enable foreign key constraints for data integrity
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    except Exception as e:
        logger.error(f"❌ Database error ({db_name}): {str(e)}", exc_info=True)
        raise
    finally:
        conn.close()
        logger.debug(f"📂 Database connection closed ({db_name})")

# Pydantic models
class Device(BaseModel):
    id: str
    deviceName: str
    ipAddress: str
    protocol: str
    port: int
    username: str
    password: Optional[str] = None
    country: str
    deviceType: str
    platform: str
    software: str
    tags: List[str] = []

class BulkDeleteRequest(BaseModel):
    ids: List[str]

class DbActionRequest(BaseModel):
    action: str # 'reset', 'seed'

# Schema Validation & Auto-Recovery
def ensure_schema(db_name: str):
    """Ensure database schema exists, recreate if missing (WITHOUT seeding data)"""
    logger.debug(f"🔍 Validating schema for {db_name}")
    try:
        with get_db(db_name) as conn:
            cursor = conn.cursor()
            
            # Check if any tables exist
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            
            if not tables:
                logger.warning(f"⚠️  No tables found in {db_name}, recreating schema...")
                # Recreate schema ONLY (no seeding) based on database type
                if db_name == "devices":
                    create_devices_schema()
                elif db_name == "automation":
                    create_automation_schema()
                elif db_name == "topology":
                    create_topology_schema()
                elif db_name == "datasave":
                    create_datasave_schema()
                logger.info(f"✅ Empty schema recreated for {db_name}")
            else:
                logger.debug(f"✅ Schema valid for {db_name} ({len(tables)} tables)")
    except Exception as e:
        logger.error(f"❌ Schema validation failed for {db_name}: {str(e)}")
        raise

def validate_table_exists(db_name: str, table_name: str) -> bool:
    """Check if a specific table exists in database"""
    try:
        with get_db(db_name) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name=?
            """, (table_name,))
            return cursor.fetchone() is not None
    except Exception:
        return False

# Initialize databases
def create_devices_schema():
    """Create devices table schema (without seeding)"""
    logger.debug("📐 Creating devices table schema...")
    with get_db("devices") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                deviceName TEXT NOT NULL,
                ipAddress TEXT NOT NULL,
                protocol TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                password TEXT,
                country TEXT NOT NULL,
                deviceType TEXT NOT NULL,
                platform TEXT NOT NULL,
                software TEXT NOT NULL,
                tags TEXT DEFAULT '[]'
            )
        """)

def init_devices_db():
    """Initialize devices database with schema and default data"""
    logger.info("🔧 Initializing devices database...")
    try:
        create_devices_schema()
        
        with get_db("devices") as conn:
            cursor = conn.cursor()
            # Check if empty
            cursor.execute("SELECT COUNT(*) as count FROM devices")
            count = cursor.fetchone()[0]
            
            if count == 0:
                seed_devices_db()

    except Exception as e:
        logger.error(f"❌ Devices DB initialization failed: {str(e)}", exc_info=True)
        raise

def seed_devices_db():
    """Seed devices database with default data"""
    logger.info("📥 Seeding devices database...")
    with get_db("devices") as conn:
        cursor = conn.cursor()
        real_devices = [
            ('r1', 'zwe-hra-pop-p01', '172.20.0.11', 'SSH', 22, 'cisco', 'cisco', 'Zimbabwe', 'P', 'ASR9905', 'IOS XR', '["backbone"]'),
            ('r2', 'zwe-hra-pop-p02', '172.20.0.12', 'SSH', 22, 'cisco', 'cisco', 'Zimbabwe', 'P', 'ASR9905', 'IOS XR', '["backbone"]'),
            ('r3', 'zwe-bul-pop-p03', '172.20.0.13', 'SSH', 22, 'cisco', 'cisco', 'Zimbabwe', 'P', 'ASR9905', 'IOS XR', '["latam"]'),
            ('r4', 'zwe-bul-pop-p04', '172.20.0.14', 'SSH', 22, 'cisco', 'cisco', 'Zimbabwe', 'P', 'ASR9905', 'IOS XR', '["africa"]'),
            ('r5', 'usa-nyc-dc1-pe05', '172.20.0.15', 'SSH', 22, 'cisco', 'cisco', 'United States', 'PE', 'ASR9905', 'IOS XR', '["backbone", "edge"]'),
            ('r6', 'deu-ber-bes-p06', '172.20.0.16', 'SSH', 22, 'cisco', 'cisco', 'Germany', 'P', 'ASR9905', 'IOS XR', '["europe"]'),
            ('r7', 'gbr-ldn-wst-p07', '172.20.0.17', 'SSH', 22, 'cisco', 'cisco', 'United Kingdom', 'P', 'ASR9905', 'IOS XR', '["europe", "core"]'),
            ('r8', 'usa-nyc-dc1-rr08', '172.20.0.18', 'SSH', 22, 'cisco', 'cisco', 'United States', 'RR', 'ASR9905', 'IOS XR', '["backbone", "rr"]'),
            ('r9', 'gbr-ldn-wst-pe09', '172.20.0.19', 'SSH', 22, 'cisco', 'cisco', 'United Kingdom', 'PE', 'ASR9905', 'IOS XR', '["europe", "edge"]'),
            ('r10', 'deu-ber-bes-pe10', '172.20.0.20', 'SSH', 22, 'cisco', 'cisco', 'Germany', 'PE', 'ASR9905', 'IOS XR', '["europe", "edge"]'),
        ]
        cursor.executemany("""
            INSERT INTO devices (id, deviceName, ipAddress, protocol, port, username, password, country, deviceType, platform, software, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, real_devices)
        conn.commit()
        logger.info(f"✅ Seeded {len(real_devices)} devices")

def create_automation_schema():
    """Create automation tables schema (without seeding)"""
    logger.debug("📐 Creating automation tables schema...")
    with get_db("automation") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                status TEXT,
                start_time TEXT,
                end_time TEXT,
                total_devices INTEGER,
                completed_devices INTEGER,
                progress_percent INTEGER,
                error TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS job_results (
                job_id TEXT,
                device_id TEXT,
                status TEXT,
                output TEXT,
                error TEXT,
                FOREIGN KEY(job_id) REFERENCES jobs(id)
            )
        """)

def init_automation_db():
    """Initialize automation database"""
    logger.info("🔧 Initializing automation database...")
    try:
        create_automation_schema()
    except Exception as e:
        logger.error(f"❌ Automation DB initialization failed: {str(e)}", exc_info=True)

def create_topology_schema():
    """Create topology tables schema (without seeding)"""
    logger.debug("📐 Creating topology tables schema...")
    with get_db("topology") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                hostname TEXT,
                country TEXT,
                type TEXT,
                UNIQUE(name, hostname)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS links (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                cost INTEGER,
                interface_local TEXT,
                interface_remote TEXT,
                UNIQUE(source, target, interface_local, interface_remote)
            )
        """)
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
        # ===== NEW: Interface Capacity Table (Step 2.7c) =====
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
        # ===== NEW: CDP Physical Topology Table =====
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
        # ===== NEW: OSPF Design Drafts Table (Persist across restarts) =====
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ospf_drafts (
                id TEXT PRIMARY KEY,
                name TEXT DEFAULT 'default',
                nodes_json TEXT NOT NULL,
                links_json TEXT NOT NULL,
                updated_links_json TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(name)
            )
        """)

def init_topology_db():
    """Initialize topology database"""
    logger.info("🔧 Initializing topology database...")
    try:
        create_topology_schema()
    except Exception as e:
        logger.error(f"❌ Topology DB initialization failed: {str(e)}", exc_info=True)

def create_datasave_schema():
    """Create datasave tables schema (without seeding)"""
    logger.debug("📐 Creating datasave tables schema...")
    with get_db("datasave") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                file_type TEXT NOT NULL,
                device_name TEXT,
                command TEXT,
                size_bytes INTEGER,
                created_at TEXT,
                job_id TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operations (
                id TEXT PRIMARY KEY,
                operation_type TEXT NOT NULL,
                target TEXT,
                timestamp TEXT,
                user_note TEXT
            )
        """)

def init_datasave_db():
    """Initialize data save database for file tracking"""
    logger.info("🔧 Initializing data save database...")
    try:
        create_datasave_schema()
    except Exception as e:
        logger.error(f"❌ Data Save DB initialization failed: {str(e)}", exc_info=True)

def init_all_dbs():
    init_devices_db()
    init_automation_db()
    init_topology_db()
    init_datasave_db()

# Helper function to convert row to dict
def row_to_device(row: sqlite3.Row) -> dict:
    """Convert database row to Device dict"""
    return {
        "id": row["id"],
        "deviceName": row["deviceName"],
        "ipAddress": row["ipAddress"],
        "protocol": row["protocol"],
        "port": row["port"],
        "username": row["username"],
        "password": row["password"],
        "country": row["country"],
        "deviceType": row["deviceType"],
        "platform": row["platform"],
        "software": row["software"],
        "tags": json.loads(row["tags"] or "[]")
    }

# API Routes

@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    logger.info("="*80)
    logger.info("🚀 Starting Network Device Manager API...")
    logger.info(f"📅 Startup time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"🐍 Python version: {os.sys.version.split()[0]}")
    logger.info("="*80)
    init_all_dbs()

    # Initialize WebSocket manager with event loop for thread-safe broadcasting
    from modules.websocket_manager import websocket_manager
    websocket_manager.set_event_loop(asyncio.get_event_loop())
    logger.info("🔌 WebSocket manager initialized")

    logger.info("📡 API server ready - Listening for requests")

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Network Device Manager API", "version": "1.0.0"}

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "OK", "database": "connected"}

# ============================================================================
# WEBSOCKET ENDPOINT FOR REAL-TIME UPDATES
# ============================================================================

@app.websocket("/ws/jobs/{job_id}")
async def websocket_job_updates(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time job status updates.
    Connect to /ws/jobs/{job_id} to receive updates for a specific job.
    Connect to /ws/jobs/all to receive all job updates.
    """
    from modules.websocket_manager import websocket_manager

    await websocket_manager.connect(websocket, job_id if job_id != "all" else None)

    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": f"Connected to job updates" + (f" for job {job_id}" if job_id != "all" else ""),
            "job_id": job_id
        })

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages (heartbeat or commands)
                data = await websocket.receive_text()
                message = json.loads(data)

                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message.get("type") == "subscribe":
                    new_job_id = message.get("job_id")
                    if new_job_id:
                        websocket_manager.subscribe_to_job(websocket, new_job_id)
                        await websocket.send_json({
                            "type": "subscribed",
                            "job_id": new_job_id
                        })
            except json.JSONDecodeError:
                pass  # Ignore invalid JSON

    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
        logger.info(f"🔌 WebSocket client disconnected from job {job_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        websocket_manager.disconnect(websocket)

@app.get("/api/ws/status")
async def websocket_status():
    """Get WebSocket connection status"""
    from modules.websocket_manager import websocket_manager
    return {
        "active_connections": websocket_manager.connection_count,
        "status": "operational"
    }

# ============================================================================
# AUTHENTICATION API ENDPOINTS
# ============================================================================

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    status: str
    message: str
    username: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[list] = None
    session_token: Optional[str] = None
    logins_remaining: Optional[int] = None

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest, response: Response):
    """
    Authenticate user and create session.
    Returns session token in cookie and response body.
    """
    from modules.auth import (
        validate_credentials, create_session, is_password_expired,
        get_login_count, get_max_login_uses, is_security_enabled
    )

    logger.info(f"🔐 Login attempt for user: {request.username}")

    # Check if security is enabled
    if not is_security_enabled():
        logger.info("🔓 Security disabled - auto-login")
        return LoginResponse(
            status="success",
            message="Security disabled - access granted",
            username=request.username
        )

    # Check password expiry first
    if is_password_expired():
        logger.warning(f"🔒 Password expired for user: {request.username}")
        return LoginResponse(
            status="error",
            message=f"Password expired after {get_max_login_uses()} logins. Please update password in .env.local and restart the application."
        )

    # Validate credentials (returns valid, message, user_data)
    valid, message, user_data = validate_credentials(request.username, request.password)

    if not valid:
        logger.warning(f"❌ Login failed for user: {request.username} - {message}")
        # Audit log: user login failure
        from modules.audit_logger import AuditLogger
        AuditLogger.log_user_login(request.username, success=False, ip_address="127.0.0.1", error_message=message)
        return LoginResponse(status="error", message=message)

    # Get user role from authentication result
    user_role = user_data.get('role', 'viewer') if user_data else 'viewer'

    # Create session with role
    token = create_session(request.username, role=user_role)

    # Calculate remaining logins
    max_uses = get_max_login_uses()
    current_count = get_login_count()
    logins_remaining = max_uses - current_count if max_uses > 0 else None

    # Set session cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=3600  # 1 hour
    )

    logger.info(f"✅ Login successful for user: {request.username} (role: {user_role}, login #{current_count})")

    # Audit log: user login success
    from modules.audit_logger import AuditLogger
    AuditLogger.log_user_login(request.username, success=True, ip_address="127.0.0.1")

    # Get permissions for the user's role
    from modules.auth import get_role_permissions
    permissions = get_role_permissions(user_role)

    return LoginResponse(
        status="success",
        message="Login successful",
        username=request.username,
        role=user_role,
        permissions=permissions,
        session_token=token,
        logins_remaining=logins_remaining
    )

@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and invalidate session"""
    from modules.auth import invalidate_session

    token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")

    if token:
        invalidate_session(token)

    # Clear session cookie
    response.delete_cookie("session_token")

    logger.info("🚪 User logged out")

    return {"status": "success", "message": "Logged out successfully"}

@app.get("/api/auth/status")
async def auth_status(request: Request):
    """Get current authentication status"""
    from modules.auth import (
        is_security_enabled, is_localhost_only, get_auth_status,
        validate_session, get_session_info
    )

    status = get_auth_status()

    # Check if user is currently authenticated
    token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
    session_info = None

    if token:
        valid, session = validate_session(token)
        if valid:
            session_info = get_session_info(token)

    return {
        **status,
        "authenticated": session_info is not None,
        "session": session_info
    }

@app.post("/api/auth/reset-login-count")
async def reset_login_count(request: Request):
    """Reset login count (admin only - requires valid session)"""
    from modules.auth import reset_login_count, get_login_count

    # Note: Authentication middleware will block if not logged in
    reset_login_count()
    logger.info("🔄 Login count reset by admin")

    return {
        "status": "success",
        "message": "Login count reset to 0",
        "current_count": get_login_count()
    }


# ============================================================================
# SECURE PASSWORD MANAGEMENT API
# ============================================================================

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ResetPasswordRequest(BaseModel):
    pin: str

@app.get("/api/auth/password-status")
async def password_status():
    """Get password configuration status (custom vs default)"""
    from modules.auth import get_password_status

    return get_password_status()

@app.post("/api/auth/change-password")
async def change_password(request: Request, body: ChangePasswordRequest):
    """
    Change admin password permanently.
    Requires current password for verification.
    New password is securely hashed and cannot be reverse-engineered.
    """
    from modules.auth import set_custom_password

    success, message = set_custom_password(
        new_password=body.new_password,
        current_password=body.current_password
    )

    if success:
        logger.info("🔐 Admin password changed successfully")
        return {"status": "success", "message": message}
    else:
        logger.warning(f"🔐 Password change failed: {message}")
        raise HTTPException(status_code=400, detail=message)

@app.post("/api/auth/reset-password-with-pin")
async def reset_password_with_pin(body: ResetPasswordRequest):
    """
    Reset admin password to default using secure PIN.
    This is the ONLY way to reset a custom password.
    PIN is verified against pre-hashed value.
    """
    from modules.auth import reset_admin_password_with_pin

    success, message = reset_admin_password_with_pin(body.pin)

    if success:
        logger.info("🔐 Admin password reset to default via PIN")
        return {"status": "success", "message": message}
    else:
        logger.warning(f"🔐 Password reset failed: {message}")
        raise HTTPException(status_code=400, detail=message)


# ============================================================================
# USER MANAGEMENT API - Role-based access control
# ============================================================================

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "viewer"

class UpdateUserRequest(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


def require_permission(permission: str):
    """Decorator factory to check if user has permission"""
    def decorator(func):
        async def wrapper(request: Request, *args, **kwargs):
            from modules.auth import validate_session, has_permission

            token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
            if not token:
                raise HTTPException(status_code=401, detail="Authentication required")

            valid, session = validate_session(token)
            if not valid:
                raise HTTPException(status_code=401, detail="Invalid session")

            user_role = session.get('role', 'viewer')
            if not has_permission(user_role, permission):
                raise HTTPException(status_code=403, detail=f"Permission denied: {permission} required")

            return await func(request, *args, **kwargs)
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator


@app.get("/api/users")
async def get_users(request: Request):
    """Get all users (admin only)"""
    from modules.auth import validate_session, has_permission, get_all_users

    # Check permission
    token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
    if token:
        valid, session = validate_session(token)
        if valid:
            user_role = session.get('role', 'viewer')
            if not has_permission(user_role, 'users.list'):
                raise HTTPException(status_code=403, detail="Permission denied: users.list required")
        else:
            raise HTTPException(status_code=401, detail="Invalid session")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    users = get_all_users()
    return {"status": "success", "users": users, "count": len(users)}


@app.post("/api/users")
async def create_new_user(request: Request, user_request: CreateUserRequest):
    """Create a new user (admin only)"""
    from modules.auth import validate_session, has_permission, create_user

    # Check permission
    token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
    if token:
        valid, session = validate_session(token)
        if valid:
            user_role = session.get('role', 'viewer')
            if not has_permission(user_role, 'users.create'):
                raise HTTPException(status_code=403, detail="Permission denied: users.create required")
        else:
            raise HTTPException(status_code=401, detail="Invalid session")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    success, message = create_user(user_request.username, user_request.password, user_request.role)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    logger.info(f"✅ User '{user_request.username}' created by admin")
    return {"status": "success", "message": message}


@app.put("/api/users/{username}")
async def update_existing_user(request: Request, username: str, user_request: UpdateUserRequest):
    """Update a user (admin only)"""
    from modules.auth import validate_session, has_permission, update_user

    # Check permission
    token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
    if token:
        valid, session = validate_session(token)
        if valid:
            user_role = session.get('role', 'viewer')
            if not has_permission(user_role, 'users.update'):
                raise HTTPException(status_code=403, detail="Permission denied: users.update required")
        else:
            raise HTTPException(status_code=401, detail="Invalid session")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    success, message = update_user(
        username,
        password=user_request.password,
        role=user_request.role,
        is_active=user_request.is_active
    )

    if not success:
        raise HTTPException(status_code=400, detail=message)

    logger.info(f"✅ User '{username}' updated by admin")
    return {"status": "success", "message": message}


@app.delete("/api/users/{username}")
async def delete_existing_user(request: Request, username: str):
    """Delete a user (admin only)"""
    from modules.auth import validate_session, has_permission, delete_user

    # Check permission
    token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
    if token:
        valid, session = validate_session(token)
        if valid:
            user_role = session.get('role', 'viewer')
            if not has_permission(user_role, 'users.delete'):
                raise HTTPException(status_code=403, detail="Permission denied: users.delete required")
        else:
            raise HTTPException(status_code=401, detail="Invalid session")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    success, message = delete_user(username)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    logger.info(f"✅ User '{username}' deleted by admin")
    return {"status": "success", "message": message}


@app.get("/api/roles")
async def get_roles(request: Request):
    """Get available roles and their permissions"""
    from modules.auth import ROLE_PERMISSIONS, UserRole

    roles = {}
    for role in UserRole:
        roles[role.value] = {
            "name": role.value,
            "permissions": ROLE_PERMISSIONS.get(role, [])
        }

    return {"status": "success", "roles": roles}


@app.get("/api/devices", response_model=List[Device])
async def get_all_devices():
    """Get all devices"""
    logger.debug("📋 Fetching all devices from database")
    try:
        # Ensure schema exists (auto-recover if tables were deleted)
        ensure_schema("devices")
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM devices ORDER BY deviceName")
            rows = cursor.fetchall()
            devices = [row_to_device(row) for row in rows]
            logger.info(f"✅ Retrieved {len(devices)} devices")
            return devices
    except Exception as e:
        logger.error(f"❌ Failed to fetch devices: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch devices: {str(e)}")

@app.get("/api/devices/{device_id}", response_model=Device)
async def get_device(device_id: str):
    """Get single device by ID"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM devices WHERE id = ?", (device_id,))
            row = cursor.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Device not found")

            return row_to_device(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch device: {str(e)}")

@app.post("/api/devices", response_model=Device, status_code=201)
async def create_device(device: Device):
    """Create a new device"""
    logger.info(f"➕ Creating new device: {device.deviceName} (ID: {device.id})")
    logger.debug(f"Device details: IP={device.ipAddress}, Type={device.deviceType}, Country={device.country}")
    try:
        # Ensure schema exists (auto-recover if tables were deleted)
        ensure_schema("devices")
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO devices (id, deviceName, ipAddress, protocol, port, username, password, country, deviceType, platform, software, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                device.id,
                device.deviceName,
                device.ipAddress,
                device.protocol,
                device.port,
                device.username,
                device.password,
                device.country,
                device.deviceType,
                device.platform,
                device.software,
                json.dumps(device.tags)
            ))
            conn.commit()
            logger.info(f"✅ Device created successfully: {device.deviceName}")
            return device
    except sqlite3.IntegrityError as e:
        logger.warning(f"⚠️  Duplicate device ID attempted: {device.id}")
        raise HTTPException(status_code=400, detail="Device with this ID already exists")
    except Exception as e:
        logger.error(f"❌ Failed to create device {device.deviceName}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create device: {str(e)}")

@app.post("/api/devices/upsert", response_model=Device)
async def upsert_device(device: Device):
    """Create or update device based on hostname and IP (prevents duplicates)"""
    logger.info(f"🔄 Upserting device: {device.deviceName} @ {device.ipAddress}")
    try:
        # Ensure schema exists (auto-recover if tables were deleted)
        ensure_schema("devices")
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if device exists by hostname AND IP (unique identifier)
            cursor.execute("""
                SELECT id FROM devices 
                WHERE deviceName = ? AND ipAddress = ?
            """, (device.deviceName, device.ipAddress))
            
            existing = cursor.fetchone()
            
            if existing:
                # UPDATE existing device
                existing_id = existing[0]
                logger.info(f"📝 Updating existing device: {device.deviceName} (ID: {existing_id})")
                cursor.execute("""
                    UPDATE devices 
                    SET protocol = ?, port = ?, username = ?, password = ?, 
                        country = ?, deviceType = ?, platform = ?, software = ?, tags = ?
                    WHERE id = ?
                """, (
                    device.protocol,
                    device.port,
                    device.username,
                    device.password,
                    device.country,
                    device.deviceType,
                    device.platform,
                    device.software,
                    json.dumps(device.tags),
                    existing_id
                ))
                device.id = existing_id  # Use existing ID
            else:
                # INSERT new device
                logger.info(f"➕ Creating new device: {device.deviceName}")
                cursor.execute("""
                    INSERT INTO devices (id, deviceName, ipAddress, protocol, port, username, password, country, deviceType, platform, software, tags)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    device.id,
                    device.deviceName,
                    device.ipAddress,
                    device.protocol,
                    device.port,
                    device.username,
                    device.password,
                    device.country,
                    device.deviceType,
                    device.platform,
                    device.software,
                    json.dumps(device.tags)
                ))
            
            conn.commit()
            logger.info(f"✅ Device upserted successfully: {device.deviceName}")
            return device
    except Exception as e:
        logger.error(f"❌ Failed to upsert device {device.deviceName}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to upsert device: {str(e)}")


@app.put("/api/devices/{device_id}", response_model=Device)
async def update_device(device_id: str, device: Device):
    """Update an existing device"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE devices
                SET deviceName=?, ipAddress=?, protocol=?, port=?, username=?, password=?, country=?, deviceType=?, platform=?, software=?, tags=?
                WHERE id=?
            """, (
                device.deviceName,
                device.ipAddress,
                device.protocol,
                device.port,
                device.username,
                device.password,
                device.country,
                device.deviceType,
                device.platform,
                device.software,
                json.dumps(device.tags),
                device_id
            ))

            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Device not found")

            conn.commit()
            return device
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update device: {str(e)}")

@app.delete("/api/devices/{device_id}")
async def delete_device(device_id: str):
    """Delete a device"""
    logger.info(f"🗑️  Deleting device ID: {device_id}")
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM devices WHERE id = ?", (device_id,))

            if cursor.rowcount == 0:
                logger.warning(f"⚠️  Device not found for deletion: {device_id}")
                raise HTTPException(status_code=404, detail="Device not found")

            conn.commit()
            logger.info(f"✅ Device deleted successfully: {device_id}")
            return {"message": "Device deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete device {device_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete device: {str(e)}")

@app.post("/api/devices/bulk-delete")
async def bulk_delete_devices(request: BulkDeleteRequest):
    """Bulk delete devices"""
    logger.info(f"🗑️  Bulk delete requested for {len(request.ids)} devices")
    logger.debug(f"Device IDs to delete: {request.ids}")
    try:
        if not request.ids:
            logger.warning("⚠️  Bulk delete called with no device IDs")
            raise HTTPException(status_code=400, detail="No device IDs provided")

        with get_db() as conn:
            cursor = conn.cursor()
            placeholders = ','.join('?' * len(request.ids))
            cursor.execute(f"DELETE FROM devices WHERE id IN ({placeholders})", request.ids)
            deleted_count = cursor.rowcount
            conn.commit()

            logger.info(f"✅ Bulk delete completed: {deleted_count} devices deleted")
            return {"message": f"{deleted_count} devices deleted successfully", "count": deleted_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Bulk delete failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete devices: {str(e)}")

@app.post("/api/devices/bulk-import", status_code=201)
async def bulk_import_devices(devices: List[Device]):
    """Bulk import devices - continues on individual errors"""
    logger.info(f"📥 Bulk import requested for {len(devices)} devices")
    logger.debug(f"Device names to import: {[d.deviceName for d in devices]}")
    try:
        if not devices:
            logger.warning("⚠️  Bulk import called with no devices")
            raise HTTPException(status_code=400, detail="No devices provided")

        imported_count = 0
        skipped_count = 0
        errors = []

        with get_db() as conn:
            cursor = conn.cursor()

            for device in devices:
                try:
                    logger.debug(f"Importing device: {device.deviceName} (ID: {device.id})")
                    cursor.execute("""
                        INSERT INTO devices (id, deviceName, ipAddress, protocol, port, username, password, country, deviceType, platform, software, tags)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        device.id,
                        device.deviceName,
                        device.ipAddress,
                        device.protocol,
                        device.port,
                        device.username,
                        device.password,
                        device.country,
                        device.deviceType,
                        device.platform,
                        device.software,
                        json.dumps(device.tags)
                    ))
                    imported_count += 1
                except sqlite3.IntegrityError as e:
                    # Skip duplicates but continue with remaining devices
                    skipped_count += 1
                    errors.append(f"{device.deviceName}: duplicate ID or constraint violation")
                    logger.warning(f"⚠️  Skipped {device.deviceName}: {str(e)}")

            conn.commit()

        message = f"{imported_count} devices imported successfully"
        if skipped_count > 0:
            message += f", {skipped_count} skipped (duplicates)"

        logger.info(f"✅ Bulk import completed: {imported_count} imported, {skipped_count} skipped")
        return {
            "message": message,
            "count": imported_count,
            "skipped": skipped_count,
            "errors": errors if errors else None
        }
    except Exception as e:
        logger.error(f"❌ Bulk import failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to import devices: {str(e)}")

# ============================================================================
# AUTOMATION API ENDPOINTS (Step 1)
# ============================================================================

class AutomationConnectRequest(BaseModel):
    device_ids: List[str]
    connection_mode: Optional[str] = "parallel"  # PHASE 2: parallel or sequential

class AutomationExecuteRequest(BaseModel):
    device_ids: List[str]
    commands: Optional[List[str]] = None  # If None, uses OSPF commands
    batch_size: Optional[int] = 10  # Number of devices to process per batch (0 = no batching)
    devices_per_hour: Optional[int] = 0  # Rate limiting (0 = no limit)

@app.post("/api/automation/connect")
async def automation_connect(request: AutomationConnectRequest):
    """Connect to multiple devices for automation - PARALLEL IMPLEMENTATION"""
    logger.info(f"🔌 Automation connect request for {len(request.device_ids)} devices")

    try:
        from modules.connection_manager import connection_manager, DeviceConnectionError
        from concurrent.futures import ThreadPoolExecutor, as_completed

        results = []
        success_count = 0
        error_count = 0
        
        # PHASE 2: Support parallel or sequential connection mode
        connection_mode = request.connection_mode or "parallel"
        logger.info(f"🔌 Connection mode: {connection_mode.upper()}")

        # PARALLEL CONNECTION - Fix for timeout issue
        max_workers = min(10, len(request.device_ids)) if connection_mode == "parallel" else 1
        logger.info(f"🚀 Using {max_workers} {'parallel' if connection_mode == 'parallel' else 'sequential'} worker(s) for connections")

        def connect_single_device(device_id):
            """Connect to a single device - runs in thread pool"""
            try:
                # Get device info from database
                with get_db() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM devices WHERE id = ?", (device_id,))
                    row = cursor.fetchone()

                    if not row:
                        return {
                            'device_id': device_id,
                            'status': 'error',
                            'error': 'Device not found in database'
                        }

                    device_info = row_to_device(row)

                # Attempt connection with 10s timeout (increased from 5s)
                result = connection_manager.connect(device_id, device_info, timeout=10)
                return result

            except DeviceConnectionError as e:
                logger.error(f"Connection failed for {device_id}: {str(e)}")
                return {
                    'device_id': device_id,
                    'status': 'error',
                    'error': str(e)
                }
            except Exception as e:
                logger.error(f"Unexpected error connecting to {device_id}: {str(e)}")
                return {
                    'device_id': device_id,
                    'status': 'error',
                    'error': str(e)
                }

        # Execute connections in parallel
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all connection tasks
            future_to_device = {executor.submit(connect_single_device, device_id): device_id 
                               for device_id in request.device_ids}
            
            # Collect results as they complete
            for future in as_completed(future_to_device):
                device_id = future_to_device[future]
                try:
                    result = future.result()
                    results.append(result)
                    
                    if result['status'] == 'connected':
                        success_count += 1
                    else:
                        error_count += 1
                        
                except Exception as e:
                    logger.error(f"Future exception for {device_id}: {str(e)}")
                    results.append({
                        'device_id': device_id,
                        'status': 'error',
                        'error': str(e)
                    })
                    error_count += 1

        logger.info(f"✅ Connection batch complete: {success_count} succeeded, {error_count} failed")

        return {
            'total_devices': len(request.device_ids),
            'success_count': success_count,
            'error_count': error_count,
            'results': results
        }

    except Exception as e:
        logger.error(f"❌ Automation connect failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@app.post("/api/automation/execute")
async def automation_execute(request: AutomationExecuteRequest):
    """Execute commands on connected devices"""
    logger.info(f"⚡ Automation execute request for {len(request.device_ids)} devices")

    try:
        from modules.command_executor import command_executor, OSPF_COMMANDS
        from modules.connection_manager import connection_manager

        # Use OSPF commands if none specified
        commands = request.commands if request.commands else OSPF_COMMANDS

        # Build device list with names
        device_list = []
        for device_id in request.device_ids:
            # Get device name from database
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT deviceName FROM devices WHERE id = ?", (device_id,))
                row = cursor.fetchone()

                if row:
                    device_list.append({
                        'device_id': device_id,
                        'device_name': row['deviceName']
                    })

        # Execute commands on all devices
        result = command_executor.execute_on_multiple_devices(device_list, commands)

        logger.info(f"✅ Automation execution complete: {result['total_commands_success']} commands succeeded")

        return result

    except Exception as e:
        logger.error(f"❌ Automation execute failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")

@app.post("/api/automation/jobs")
async def start_automation_job(request: AutomationExecuteRequest):
    """Start an asynchronous automation job with optional batch processing"""
    logger.info(f"🚀 Starting automation job for {len(request.device_ids)} devices (batch_size: {request.batch_size}, rate: {request.devices_per_hour}/hr)")
    try:
        from modules.command_executor import command_executor, OSPF_COMMANDS
        
        # Use OSPF commands if none specified
        commands = request.commands if request.commands else OSPF_COMMANDS
        
        # Build device list with FULL CREDENTIALS for lazy connection
        device_list = []
        for device_id in request.device_ids:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM devices WHERE id = ?", (device_id,))
                row = cursor.fetchone()
                if row:
                    # Pass FULL device info including credentials for on-demand connection
                    device_info = row_to_device(row)
                    # Add device_id and device_name for command_executor compatibility
                    device_info['device_id'] = device_info['id']
                    device_info['device_name'] = device_info['deviceName']
                    device_list.append(device_info)
        
        # Start job with batch processing
        job_id = command_executor.start_automation_job(
            device_list, 
            commands,
            batch_size=request.batch_size or 10,  # Default to 10 if not specified
            devices_per_hour=request.devices_per_hour or 0
        )
        
        # Calculate batch information
        batch_size = request.batch_size or 10
        total_batches = 1 if batch_size == 0 else (len(device_list) + batch_size - 1) // batch_size
        
        return {
            "job_id": job_id,
            "status": "started",
            "total_devices": len(device_list),
            "batch_size": batch_size,
            "total_batches": total_batches
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to start job: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start job: {str(e)}")

@app.get("/api/automation/jobs/latest")
async def get_latest_automation_job():
    """Get the latest automation job"""
    try:
        from modules.command_executor import job_manager
        job = job_manager.get_latest_job()
        if not job:
            return {"status": "no_jobs", "message": "No jobs have been run"}
        return job
    except Exception as e:
        logger.error(f"❌ Failed to get latest job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get latest job: {str(e)}")

@app.get("/api/automation/jobs/{job_id}")
async def get_automation_job(job_id: str):
    """Get status of an automation job"""
    try:
        from modules.command_executor import job_manager
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get job status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")

@app.post("/api/automation/jobs/{job_id}/stop")
async def stop_automation_job(job_id: str):
    """Stop a running automation job and disconnect devices"""
    try:
        from modules.command_executor import job_manager
        from modules.connection_manager import connection_manager
        
        # Get job to find connected devices
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Stop the job
        job_manager.stop_job(job_id)
        
        # Disconnect all devices that were part of this job
        disconnected = []
        if "device_ids" in job:
            for device_id in job["device_ids"]:
                try:
                    connection_manager.disconnect(device_id)
                    disconnected.append(device_id)
                    logger.info(f"🔌 Disconnected {device_id} after job stop")
                except Exception as e:
                    logger.warning(f"Failed to disconnect {device_id}: {e}")
        
        return {
            "message": "Job stopped and connections cleaned up",
            "job_id": job_id,
            "disconnected_devices": disconnected
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to stop job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to stop job: {str(e)}")

@app.post("/api/automation/disconnect")
async def automation_disconnect(request: AutomationConnectRequest):
    """Disconnect from devices"""
    logger.info(f"🔌 Automation disconnect request for {len(request.device_ids)} devices")

    try:
        from modules.connection_manager import connection_manager

        results = []
        success_count = 0

        for device_id in request.device_ids:
            try:
                result = connection_manager.disconnect(device_id)
                results.append(result)
                if result['status'] == 'disconnected':
                    success_count += 1
            except Exception as e:
                logger.error(f"Error disconnecting {device_id}: {str(e)}")
                results.append({
                    'device_id': device_id,
                    'status': 'error',
                    'error': str(e)
                })

        return {
            'total_devices': len(request.device_ids),
            'disconnected_count': success_count,
            'results': results
        }

    except Exception as e:
        logger.error(f"❌ Automation disconnect failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Disconnect failed: {str(e)}")

@app.get("/api/automation/status")
async def automation_status():
    """Get automation system status"""
    try:
        from modules.connection_manager import connection_manager
        from modules.file_manager import get_file_manager

        active_connections = connection_manager.get_active_connections()
        fm = get_file_manager()  # Fresh instance using 'current' symlink
        dir_stats = fm.get_directory_stats()

        return {
            'active_connections': len(active_connections),
            'connected_devices': active_connections,
            'file_statistics': dir_stats,
            'status': 'operational'
        }

    except Exception as e:
        logger.error(f"❌ Status check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


# ============== ENVIRONMENT CONFIGURATION ENDPOINTS ==============

@app.get("/api/settings/env")
async def get_env_config():
    """Get environment configuration status (credentials from .env.local)"""
    try:
        from modules.env_config import load_env_file, get_router_credentials, get_jumphost_config

        env = load_env_file()
        router_creds = get_router_credentials()
        jumphost_config = get_jumphost_config()

        return {
            'env_loaded': bool(env),
            'router_credentials': {
                'username': router_creds.get('username', ''),
                'password_set': bool(router_creds.get('password', ''))
            },
            'jumphost': {
                'enabled': jumphost_config.get('enabled', False),
                'host': jumphost_config.get('host', ''),
                'port': jumphost_config.get('port', 22),
                'username': jumphost_config.get('username', ''),
                'password_set': bool(jumphost_config.get('password', ''))
            },
            'source': '.env.local'
        }

    except Exception as e:
        logger.error(f"❌ Get env config failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Get env config failed: {str(e)}")


# ============== JUMPHOST CONFIGURATION ENDPOINTS ==============

@app.get("/api/settings/jumphost")
async def get_jumphost_config():
    """Get current jumphost configuration"""
    try:
        from modules.connection_manager import load_jumphost_config, connection_manager

        config = load_jumphost_config()
        status = connection_manager.get_jumphost_status()

        return {
            'enabled': config.get('enabled', False),
            'host': config.get('host', ''),
            'port': config.get('port', 22),
            'username': config.get('username', ''),
            'password': '********' if config.get('password') else '',  # Mask password
            'connected': status.get('connected', False),
            'active_tunnels': status.get('active_tunnels', 0)
        }

    except Exception as e:
        logger.error(f"❌ Get jumphost config failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Get jumphost config failed: {str(e)}")


class JumphostConfigRequest(BaseModel):
    enabled: bool
    host: str
    port: int = 22
    username: str
    password: str


@app.post("/api/settings/jumphost")
async def save_jumphost_config(config: JumphostConfigRequest):
    """Save jumphost configuration"""
    try:
        from modules.connection_manager import save_jumphost_config, connection_manager

        # Check if automation is running and warn (but allow change)
        active_connections = connection_manager.get_active_connections()
        if len(active_connections) > 0:
            logger.warning(f"⚠️ Jumphost config changed while {len(active_connections)} device(s) connected - disconnecting all")
            # Disconnect all devices first to prevent connection issues
            connection_manager.disconnect_all()

        # Validate host is not empty when enabled
        if config.enabled and not config.host.strip():
            raise HTTPException(status_code=400, detail="Jumphost host is required when enabled")

        # Build config dict
        config_dict = {
            'enabled': config.enabled,
            'host': config.host.strip(),
            'port': config.port,
            'username': config.username.strip(),
            'password': config.password  # Store password securely
        }

        # Save config (this also closes any existing tunnel)
        if save_jumphost_config(config_dict):
            # ALWAYS close existing tunnel when config changes
            # This ensures next connection uses the NEW jumphost settings
            connection_manager.close_jumphost_tunnel()
            logger.info(f"✅ Jumphost config saved: enabled={config.enabled}, host={config.host}")

            return {
                'status': 'saved',
                'enabled': config.enabled,
                'host': config.host,
                'port': config.port,
                'username': config.username,
                'message': 'Jumphost configuration saved successfully'
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save jumphost configuration")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Save jumphost config failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Save jumphost config failed: {str(e)}")


@app.post("/api/settings/jumphost/test")
async def test_jumphost_connection():
    """Test jumphost connection"""
    try:
        from modules.connection_manager import load_jumphost_config, JumphostTunnel

        config = load_jumphost_config()

        if not config.get('enabled'):
            return {
                'status': 'skipped',
                'message': 'Jumphost is not enabled'
            }

        # Test connection
        tunnel = JumphostTunnel(config)
        tunnel.connect()
        tunnel.close()

        return {
            'status': 'success',
            'message': f"Successfully connected to jumphost {config['host']}:{config.get('port', 22)}"
        }

    except Exception as e:
        logger.error(f"❌ Jumphost test failed: {str(e)}")
        return {
            'status': 'failed',
            'message': str(e)
        }


@app.get("/api/automation/files")
async def automation_files(folder_type: str = "text", device_name: Optional[str] = None):
    """List automation output files"""
    try:
        from modules.file_manager import get_file_manager

        fm = get_file_manager()  # Fresh instance using 'current' symlink
        files = fm.list_files(folder_type, device_name)

        return {
            'folder_type': folder_type,
            'device_filter': device_name,
            'file_count': len(files),
            'files': files
        }

    except Exception as e:
        logger.error(f"❌ File listing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File listing failed: {str(e)}")

@app.get("/api/automation/files/{filename}")
async def automation_file_content(filename: str, folder_type: str = "text"):
    """Get content of a specific file"""
    try:
        # Security: Prevent path traversal attacks
        if '..' in filename or '/' in filename or '\\' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename: path traversal not allowed")

        # Additional sanitization: use only basename
        safe_filename = os.path.basename(filename)
        if safe_filename != filename:
            raise HTTPException(status_code=400, detail="Invalid filename format")

        from modules.file_manager import get_file_manager

        fm = get_file_manager()  # Fresh instance using 'current' symlink
        file_data = fm.get_file_content(safe_filename, folder_type)

        return file_data

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"❌ File read failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File read failed: {str(e)}")

@app.get("/api/automation/executions")
async def list_executions():
    """List all past executions"""
    try:
        executions_dir = os.path.join(BASE_DIR, "data", "executions")

        if not os.path.exists(executions_dir):
            return []

        executions = []

        for dirname in os.listdir(executions_dir):
            exec_path = os.path.join(executions_dir, dirname)
            if not os.path.isdir(exec_path):
                continue

            metadata_file = os.path.join(exec_path, "metadata.json")
            if os.path.exists(metadata_file):
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                    executions.append({
                        "execution_id": dirname,
                        "timestamp": metadata.get("timestamp"),
                        "devices": len(metadata.get("devices", [])),
                        "status": metadata.get("status"),
                        "job_id": metadata.get("job_id")
                    })

        # Sort by timestamp descending (newest first)
        return sorted(executions, key=lambda x: x.get('timestamp', ''), reverse=True)

    except Exception as e:
        logger.error(f"❌ List executions failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list executions: {str(e)}")

@app.get("/api/automation/executions/{execution_id}")
async def get_execution(execution_id: str):
    """Get specific execution details"""
    try:
        # Security: Prevent path traversal attacks
        if '..' in execution_id or '/' in execution_id or '\\' in execution_id:
            raise HTTPException(status_code=400, detail="Invalid execution_id: path traversal not allowed")

        metadata_file = os.path.join(BASE_DIR, "data", "executions", execution_id, "metadata.json")

        if not os.path.exists(metadata_file):
            raise HTTPException(status_code=404, detail="Execution not found")

        with open(metadata_file, 'r') as f:
            metadata = json.load(f)

        # Add file counts
        text_dir = os.path.join(BASE_DIR, "data", "executions", execution_id, "TEXT")
        json_dir = os.path.join(BASE_DIR, "data", "executions", execution_id, "JSON")

        text_files = len([f for f in os.listdir(text_dir) if os.path.isfile(os.path.join(text_dir, f))]) if os.path.exists(text_dir) else 0
        json_files = len([f for f in os.listdir(json_dir) if os.path.isfile(os.path.join(json_dir, f))]) if os.path.exists(json_dir) else 0

        metadata['file_counts'] = {
            'text': text_files,
            'json': json_files
        }

        return metadata

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get execution failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get execution: {str(e)}")

# ============================================================================
# TRANSFORMATION API ENDPOINTS (Step 3)
# ============================================================================

@app.post("/api/transform/topology")
async def generate_topology():
    """Generate network topology from collected data"""
    logger.info("🔄 Topology generation requested")
    try:
        from modules.topology_builder import TopologyBuilder
        from modules.file_manager import get_current_data_dirs

        # Use 'current' symlink to read from latest execution
        text_dir, _ = get_current_data_dirs()
        output_dir = os.path.join(BASE_DIR, "data", "OUTPUT-Transformation")
        logger.info(f"📂 Topology using text_dir: {text_dir}")
        
        topology_builder = TopologyBuilder(text_dir=text_dir, output_dir=output_dir)
        
        # Get valid devices from Device Manager DB
        valid_devices = []
        try:
            with get_db("devices") as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT deviceName FROM devices")
                rows = cursor.fetchall()
                valid_devices = [row['deviceName'] for row in rows]
                logger.info(f"📋 Found {len(valid_devices)} managed devices: {valid_devices}")
        except Exception as e:
            logger.error(f"⚠️ Failed to fetch devices from DB, proceeding with all files: {e}")
            valid_devices = None
        
        topology = topology_builder.build_topology(valid_devices=valid_devices)
        return topology
        
    except Exception as e:
        logger.error(f"❌ Topology generation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Topology generation failed: {str(e)}")

@app.get("/api/transform/topology/latest")
async def get_latest_topology():
    """Get the most recently generated topology from database"""
    try:
        # Ensure schema exists
        ensure_schema("topology")
        
        with get_db("topology") as conn:
            cursor = conn.cursor()
            
            # Fetch Nodes
            cursor.execute("SELECT * FROM nodes")
            nodes_rows = cursor.fetchall()
            nodes = []
            for row in nodes_rows:
                nodes.append({
                    "id": row['id'],
                    "name": row['name'],
                    "hostname": row['hostname'],
                    "country": row['country'],
                    "node_type": row['type'],
                    "status": "up" # Default status
                })
                
            # Fetch Links (directional)
            cursor.execute("SELECT * FROM links")
            links_rows = cursor.fetchall()
            links = []
            for row in links_rows:
                links.append({
                    "id": row['id'],
                    "source": row['source'],
                    "target": row['target'],
                    "cost": row['cost'],
                    "source_interface": row['interface_local'],
                    "target_interface": row['interface_remote'],
                    "status": "up"
                })

            # Fetch Physical Links (bidirectional with both costs)
            physical_links = []
            try:
                cursor.execute("SELECT * FROM physical_links")
                plinks_rows = cursor.fetchall()
                for row in plinks_rows:
                    physical_links.append({
                        "id": row['id'],
                        "router_a": row['router_a'],
                        "router_b": row['router_b'],
                        "cost_a_to_b": row['cost_a_to_b'],
                        "cost_b_to_a": row['cost_b_to_a'],
                        "interface_a": row['interface_a'],
                        "interface_b": row['interface_b'],
                        "is_asymmetric": bool(row['is_asymmetric']),
                        "status": row['status']
                    })
            except Exception as e:
                logger.warning(f"physical_links table not found, skipping: {e}")

            asymmetric_count = len([pl for pl in physical_links if pl['is_asymmetric']])

            return {
                "nodes": nodes,
                "links": links,
                "physical_links": physical_links,
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "source": "database",
                    "node_count": len(nodes),
                    "link_count": len(links),
                    "physical_link_count": len(physical_links),
                    "asymmetric_count": asymmetric_count
                }
            }
            
    except Exception as e:
        logger.error(f"❌ Failed to retrieve topology from DB: {str(e)}")
        # Fallback to JSON if DB fails?
        # For now, let's stick to DB as primary.
        raise HTTPException(status_code=500, detail=f"Failed to retrieve topology: {str(e)}")


@app.get("/api/transform/topology/netviz-pro")
async def get_topology_netviz_pro():
    """
    Get topology in NetViz Pro compatible format.

    This endpoint transforms the current topology data into a format
    compatible with the NetViz Pro visualization application.

    NetViz Pro format includes:
    - nodes: id, name, hostname, loopback_ip, country, is_active, node_type
    - links: source, target, interfaces, forward/reverse costs, capacity, traffic
    - metadata: export info
    - traffic_snapshots: for time-series traffic data
    """
    logger.info("🔄 NetViz Pro topology export requested")
    try:
        from modules.topology_builder import TopologyBuilder

        # Ensure schema exists
        ensure_schema("topology")

        with get_db("topology") as conn:
            cursor = conn.cursor()

            # Fetch Nodes
            cursor.execute("SELECT * FROM nodes")
            nodes_rows = cursor.fetchall()
            nodes = []
            for row in nodes_rows:
                nodes.append({
                    "id": row['id'],
                    "name": row['name'],
                    "hostname": row['hostname'],
                    "country": row['country'],
                    "type": row['type'],
                    "status": "active"
                })

            # Fetch Physical Links (bidirectional with both costs)
            physical_links = []
            try:
                cursor.execute("SELECT * FROM physical_links")
                plinks_rows = cursor.fetchall()
                for row in plinks_rows:
                    physical_links.append({
                        "id": row['id'],
                        "router_a": row['router_a'],
                        "router_b": row['router_b'],
                        "cost_a_to_b": row['cost_a_to_b'],
                        "cost_b_to_a": row['cost_b_to_a'],
                        "interface_a": row['interface_a'],
                        "interface_b": row['interface_b'],
                        "is_asymmetric": bool(row['is_asymmetric']),
                        "status": row['status']
                    })
            except Exception as e:
                logger.warning(f"physical_links table not found: {e}")
                raise HTTPException(status_code=404, detail="No physical links data available. Generate topology first.")

            if not nodes or not physical_links:
                raise HTTPException(status_code=404, detail="No topology data available. Generate topology first.")

            # Build our internal topology format
            internal_topology = {
                "nodes": nodes,
                "physical_links": physical_links
            }

            # Transform to NetViz Pro format
            topology_builder = TopologyBuilder()
            netviz_topology = topology_builder.transform_to_netviz_pro(internal_topology)

            logger.info(f"✅ NetViz Pro export complete: {len(netviz_topology['nodes'])} nodes, {len(netviz_topology['links'])} links")
            return netviz_topology

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ NetViz Pro export failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"NetViz Pro export failed: {str(e)}")


@app.get("/api/ospf/interface-costs")
async def get_ospf_interface_costs():
    """Get all OSPF interface costs (Step 2.5b) - shows cost per interface per router"""
    try:
        ensure_schema("topology")

        with get_db("topology") as conn:
            cursor = conn.cursor()

            # Get directional links (each represents one OSPF interface)
            cursor.execute("SELECT * FROM links ORDER BY source, interface_local")
            links_rows = cursor.fetchall()

            # Get physical links to determine asymmetric status
            physical_links_map = {}
            try:
                cursor.execute("SELECT * FROM physical_links")
                plinks_rows = cursor.fetchall()
                for row in plinks_rows:
                    key_ab = (row['router_a'], row['router_b'])
                    key_ba = (row['router_b'], row['router_a'])
                    physical_links_map[key_ab] = {
                        'cost_a_to_b': row['cost_a_to_b'],
                        'cost_b_to_a': row['cost_b_to_a'],
                        'is_asymmetric': bool(row['is_asymmetric'])
                    }
                    physical_links_map[key_ba] = {
                        'cost_a_to_b': row['cost_b_to_a'],
                        'cost_b_to_a': row['cost_a_to_b'],
                        'is_asymmetric': bool(row['is_asymmetric'])
                    }
            except Exception as e:
                logger.warning(f"Could not load physical_links: {e}")

            interfaces = []
            for row in links_rows:
                source = row['source']
                target = row['target']

                # Get asymmetric info from physical_links
                plink_info = physical_links_map.get((source, target), {})
                is_asymmetric = plink_info.get('is_asymmetric', False)
                reverse_cost = plink_info.get('cost_b_to_a')

                interfaces.append({
                    "router": source,
                    "interface": row['interface_local'] or 'unknown',
                    "neighbor_router": target,
                    "cost": row['cost'],
                    "cost_source": "database",
                    "is_asymmetric": is_asymmetric,
                    "reverse_cost": reverse_cost
                })

            asymmetric_count = len([i for i in interfaces if i['is_asymmetric']])

            return {
                "interfaces": interfaces,
                "total": len(interfaces),
                "asymmetric_count": asymmetric_count,
                "symmetric_count": len(interfaces) - asymmetric_count
            }

    except Exception as e:
        logger.error(f"❌ Failed to get interface costs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get interface costs: {str(e)}")


@app.get("/api/transform/history")
async def list_topology_history():
    """List available topology snapshots"""
    try:
        topology_dir = os.path.join(BASE_DIR, "data", "OUTPUT-Transformation")
        if not os.path.exists(topology_dir):
            return []
            
        files = [f for f in os.listdir(topology_dir) if f.endswith(".json")]
        files.sort(reverse=True) # Newest first
        
        history = []
        for f in files:
            filepath = os.path.join(topology_dir, f)
            size = os.path.getsize(filepath)
            timestamp = f.replace("network_topology_", "").replace(".json", "")
            history.append({
                "filename": f,
                "timestamp": timestamp,
                "size": size
            })
            
        return history
    except Exception as e:
        logger.error(f"❌ Failed to list history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transform/history/{filename}")
async def get_topology_snapshot(filename: str):
    """Get a specific topology snapshot"""
    try:
        topology_dir = os.path.join(BASE_DIR, "data", "OUTPUT-Transformation")
        filepath = os.path.join(topology_dir, filename)
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Snapshot not found")
            
        with open(filepath, 'r') as f:
            return json.load(f)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to read snapshot: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/transform/history/{filename}")
async def delete_topology_snapshot(filename: str):
    """Delete a specific topology snapshot"""
    try:
        topology_dir = os.path.join(BASE_DIR, "data", "OUTPUT-Transformation")
        filepath = os.path.join(topology_dir, filename)
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Snapshot not found")
            
        os.remove(filepath)
        logger.info(f"🗑️ Deleted topology snapshot: {filename}")
        return {"status": "deleted", "filename": filename}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete snapshot: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/transform/history")
async def clear_topology_history():
    """Delete all topology snapshots"""
    try:
        topology_dir = os.path.join(BASE_DIR, "data", "OUTPUT-Transformation")
        if not os.path.exists(topology_dir):
            return {"status": "cleared", "count": 0}
            
        files = [f for f in os.listdir(topology_dir) if f.endswith(".json")]
        count = 0
        for f in files:
            os.remove(os.path.join(topology_dir, f))
            count += 1
            
        logger.info(f"🗑️ Cleared all topology history ({count} files)")
        return {"status": "cleared", "count": count}
    except Exception as e:
        logger.error(f"❌ Failed to clear history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# INTERFACE CAPACITY & TRAFFIC ANALYSIS ENDPOINTS (Step 2.7c)
# ============================================================================

@app.post("/api/transform/interfaces")
async def transform_interfaces():
    """Transform collected interface data into capacity database"""
    logger.info("🔄 Interface transformation requested")
    try:
        from modules.interface_transformer import get_interface_transformer

        transformer = get_interface_transformer()

        # Get valid devices from Device Manager DB
        valid_devices = []
        try:
            with get_db("devices") as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT deviceName FROM devices")
                rows = cursor.fetchall()
                valid_devices = [row['deviceName'] for row in rows]
        except Exception as e:
            logger.warning(f"Could not fetch device list: {e}")
            valid_devices = None

        result = transformer.transform_interfaces(valid_devices=valid_devices)
        return result

    except Exception as e:
        logger.error(f"❌ Interface transformation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Interface transformation failed: {str(e)}")

@app.get("/api/interface-capacity")
async def get_interface_capacity():
    """Get all interface capacity data"""
    logger.info("📊 Interface capacity data requested")
    try:
        ensure_schema("topology")

        with get_db("topology") as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT ic.*, n.country as router_country
                FROM interface_capacity ic
                LEFT JOIN nodes n ON ic.router = n.name
                ORDER BY ic.router, ic.interface
            """)

            interfaces = []
            for row in cursor.fetchall():
                interfaces.append({
                    "id": row["id"],
                    "router": row["router"],
                    "interface": row["interface"],
                    "description": row["description"],
                    "admin_status": row["admin_status"],
                    "line_protocol": row["line_protocol"],
                    "bw_kbps": row["bw_kbps"],
                    "capacity_class": row["capacity_class"],
                    "input_rate_bps": row["input_rate_bps"],
                    "output_rate_bps": row["output_rate_bps"],
                    "input_utilization_pct": row["input_utilization_pct"],
                    "output_utilization_pct": row["output_utilization_pct"],
                    "is_physical": bool(row["is_physical"]),
                    "parent_interface": row["parent_interface"],
                    "neighbor_router": row["neighbor_router"],
                    "neighbor_interface": row["neighbor_interface"],
                    "router_country": row["router_country"],
                    "updated_at": row["updated_at"]
                })

            return {
                "interfaces": interfaces,
                "total": len(interfaces),
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error(f"❌ Failed to get interface capacity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/interface-capacity/summary")
async def get_interface_capacity_summary():
    """Get interface capacity summary statistics"""
    try:
        from modules.interface_transformer import get_interface_transformer

        transformer = get_interface_transformer()
        summary = transformer.get_interface_summary()
        return summary

    except Exception as e:
        logger.error(f"❌ Failed to get interface summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/interface-capacity/traffic-matrix")
async def get_traffic_matrix():
    """Get traffic matrix showing traffic flow between routers/countries"""
    try:
        from modules.interface_transformer import get_interface_transformer

        transformer = get_interface_transformer()
        matrix = transformer.get_traffic_matrix()
        return matrix

    except Exception as e:
        logger.error(f"❌ Failed to get traffic matrix: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/interface-capacity/by-router/{router_name}")
async def get_interfaces_by_router(router_name: str):
    """Get all interfaces for a specific router"""
    try:
        ensure_schema("topology")

        with get_db("topology") as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT * FROM interface_capacity
                WHERE router = ?
                ORDER BY interface
            """, (router_name,))

            interfaces = []
            for row in cursor.fetchall():
                interfaces.append(dict(row))

            return {
                "router": router_name,
                "interfaces": interfaces,
                "total": len(interfaces)
            }

    except Exception as e:
        logger.error(f"❌ Failed to get interfaces for {router_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cdp-neighbors")
async def get_cdp_neighbors():
    """Get all CDP neighbors (physical topology)"""
    try:
        ensure_schema("topology")

        with get_db("topology") as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM cdp_neighbors ORDER BY local_router, local_interface")

            neighbors = []
            for row in cursor.fetchall():
                neighbors.append({
                    "id": row["id"],
                    "local_router": row["local_router"],
                    "local_interface": row["local_interface"],
                    "remote_router": row["remote_router"],
                    "remote_interface": row["remote_interface"],
                    "remote_platform": row["remote_platform"],
                    "remote_ip": row["remote_ip"],
                    "updated_at": row["updated_at"]
                })

            return {
                "neighbors": neighbors,
                "total": len(neighbors),
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error(f"❌ Failed to get CDP neighbors: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/physical-topology")
async def get_physical_topology():
    """Get physical topology based on CDP neighbors (distinct from OSPF logical topology)"""
    try:
        ensure_schema("topology")

        with get_db("topology") as conn:
            cursor = conn.cursor()

            # Get unique nodes from CDP neighbors
            cursor.execute("""
                SELECT DISTINCT local_router as router FROM cdp_neighbors
                UNION
                SELECT DISTINCT remote_router as router FROM cdp_neighbors
            """)
            nodes = [{"id": row["router"], "name": row["router"]} for row in cursor.fetchall()]

            # Get links from CDP (deduplicated)
            cursor.execute("""
                SELECT DISTINCT
                    local_router, local_interface, remote_router, remote_interface
                FROM cdp_neighbors
            """)

            links = []
            seen_links = set()
            for row in cursor.fetchall():
                # Create bidirectional key to avoid duplicates
                key = tuple(sorted([row["local_router"], row["remote_router"]]))
                if key not in seen_links:
                    seen_links.add(key)
                    links.append({
                        "source": row["local_router"],
                        "target": row["remote_router"],
                        "source_interface": row["local_interface"],
                        "target_interface": row["remote_interface"]
                    })

            return {
                "nodes": nodes,
                "links": links,
                "node_count": len(nodes),
                "link_count": len(links),
                "source": "CDP",
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error(f"❌ Failed to get physical topology: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# OSPF DESIGN & ANALYSIS ENDPOINTS (Step 4)
# ============================================================================

# Database-backed draft storage (replaces in-memory DRAFT_TOPOLOGIES)
# This persists drafts across server restarts

class OSPFLinkUpdate(BaseModel):
    source: str
    target: str
    cost: int
    interface: str

def _get_draft_from_db(name: str = "default") -> dict | None:
    """Get draft from database"""
    ensure_schema("topology")
    with get_db("topology") as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ospf_drafts WHERE name = ?", (name,))
        row = cursor.fetchone()
        if row:
            return {
                "nodes": json.loads(row["nodes_json"]),
                "links": json.loads(row["links_json"]),
                "updated_links": json.loads(row["updated_links_json"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            }
    return None

def _save_draft_to_db(name: str, nodes: list, links: list, updated_links: list):
    """Save draft to database (upsert)"""
    ensure_schema("topology")
    now = datetime.now().isoformat()
    draft_id = f"draft_{name}"

    with get_db("topology") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO ospf_drafts (id, name, nodes_json, links_json, updated_links_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                nodes_json = excluded.nodes_json,
                links_json = excluded.links_json,
                updated_links_json = excluded.updated_links_json,
                updated_at = excluded.updated_at
        """, (draft_id, name, json.dumps(nodes), json.dumps(links), json.dumps(updated_links), now, now))
        conn.commit()

@app.post("/api/ospf/design/draft")
async def create_design_draft():
    """Initialize a new design draft from current topology (persisted to DB)"""
    logger.info("🎨 Creating new OSPF design draft (database-backed)")
    try:
        # Get current topology from DB
        ensure_schema("topology")
        with get_db("topology") as conn:
            cursor = conn.cursor()

            # Fetch Nodes
            cursor.execute("SELECT * FROM nodes")
            nodes = [dict(row) for row in cursor.fetchall()]

            # Fetch Links
            cursor.execute("SELECT * FROM links")
            links = [dict(row) for row in cursor.fetchall()]

        # Save to database (persists across restarts!)
        _save_draft_to_db("default", nodes, links, [])

        return {"status": "success", "message": "Draft created and persisted to database", "node_count": len(nodes), "link_count": len(links)}

    except Exception as e:
        logger.error(f"❌ Failed to create draft: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ospf/design/draft")
async def get_design_draft():
    """Get current draft topology from database"""
    draft = _get_draft_from_db("default")
    if not draft:
        raise HTTPException(status_code=404, detail="No active draft. Create one first.")
    return draft

@app.post("/api/ospf/design/update-cost")
async def update_draft_cost(update: OSPFLinkUpdate):
    """Update a link cost in the draft (persisted to DB)"""
    draft = _get_draft_from_db("default")
    if not draft:
        raise HTTPException(status_code=404, detail="No active draft")

    links = draft["links"]
    updated_links = draft["updated_links"]

    # Find and update link (Directional)
    updated = False
    for link in links:
        if link["source"] == update.source and link["target"] == update.target and link["interface_local"] == update.interface:
            old_cost = link["cost"]
            link["cost"] = update.cost
            updated = True

            # Track change
            updated_links.append({
                "source": update.source,
                "target": update.target,
                "interface": update.interface,
                "old_cost": old_cost,
                "new_cost": update.cost
            })
            break

    if not updated:
         raise HTTPException(status_code=404, detail="Link not found in draft")

    # Persist changes to database
    _save_draft_to_db("default", draft["nodes"], links, updated_links)

    return {"status": "success", "message": "Cost updated and persisted", "updated_link": update}

@app.get("/api/ospf/analyze/impact")
async def analyze_impact():
    """Run impact analysis: Draft vs Baseline"""
    draft = _get_draft_from_db("default")
    if not draft:
        raise HTTPException(status_code=404, detail="No active draft")

    try:
        from modules.ospf_analyzer import OSPFAnalyzer

        # 1. Get Baseline (Current DB)
        with get_db("topology") as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM nodes")
            base_nodes = [dict(row) for row in cursor.fetchall()]
            cursor.execute("SELECT * FROM links")
            base_links = [dict(row) for row in cursor.fetchall()]

        # 2. Initialize Analyzers
        baseline_analyzer = OSPFAnalyzer(base_nodes, base_links)
        draft_analyzer = OSPFAnalyzer(draft["nodes"], draft["links"])

        # 3. Run Analysis
        impact = draft_analyzer.analyze_impact(baseline_analyzer)

        # 4. Add metadata
        impact["changes_count"] = len(draft["updated_links"])
        impact["changes"] = draft["updated_links"]

        return impact

    except Exception as e:
        logger.error(f"❌ Impact analysis failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/ospf/design/draft")
async def delete_design_draft():
    """Delete the current draft from database"""
    ensure_schema("topology")
    with get_db("topology") as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ospf_drafts WHERE name = ?", ("default",))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No draft to delete")
    return {"status": "success", "message": "Draft deleted"}

# ============================================================================
# TOPOLOGY UPSERT ENDPOINTS (Prevent Duplicates)
# ============================================================================

class TopologyNode(BaseModel):
    id: str
    name: str
    hostname: Optional[str] = None
    country: Optional[str] = None
    type: Optional[str] = None

class TopologyLink(BaseModel):
    id: str
    source: str
    target: str
    cost: Optional[int] = 0
    interface_local: Optional[str] = None
    interface_remote: Optional[str] = None

@app.post("/api/topology/nodes/upsert")
async def upsert_topology_node(node: TopologyNode):
    """Upsert topology node (prevents duplicates based on name+hostname)"""
    try:
        with get_db("topology") as conn:
            cursor = conn.cursor()
            
            # Check if exists
            cursor.execute("""
                SELECT id FROM nodes 
                WHERE name = ? AND (hostname = ? OR (hostname IS NULL AND ? IS NULL))
            """, (node.name, node.hostname, node.hostname))
            
            existing = cursor.fetchone()
            
            if existing:
                # UPDATE
                cursor.execute("""
                    UPDATE nodes 
                    SET country = ?, type = ?, hostname = ?
                    WHERE id = ?
                """, (node.country, node.type, node.hostname, existing[0]))
                node.id = existing[0]
            else:
                # INSERT
                cursor.execute("""
                    INSERT OR IGNORE INTO nodes (id, name, hostname, country, type)
                    VALUES (?, ?, ?, ?, ?)
                """, (node.id, node.name, node.hostname, node.country, node.type))
            
            conn.commit()
            return {"status": "success", "node": node}
    except Exception as e:
        logger.error(f"❌ Failed to upsert node: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topology/links/upsert")
async def upsert_topology_link(link: TopologyLink):
    """Upsert topology link (prevents duplicates based on source+target+interfaces)"""
    try:
        with get_db("topology") as conn:
            cursor = conn.cursor()
            
            # Check if exists
            cursor.execute("""
                SELECT id FROM links 
                WHERE source = ? AND target = ? 
                AND (interface_local = ? OR (interface_local IS NULL AND ? IS NULL))
                AND (interface_remote = ? OR (interface_remote IS NULL AND ? IS NULL))
            """, (link.source, link.target, link.interface_local, link.interface_local, 
                  link.interface_remote, link.interface_remote))
            
            existing = cursor.fetchone()
            
            if existing:
                # UPDATE
                cursor.execute("""
                    UPDATE links 
                    SET cost = ?
                    WHERE id = ?
                """, (link.cost, existing[0]))
                link.id = existing[0]
            else:
                # INSERT
                cursor.execute("""
                    INSERT OR IGNORE INTO links (id, source, target, cost, interface_local, interface_remote)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (link.id, link.source, link.target, link.cost, link.interface_local, link.interface_remote))
            
            conn.commit()
            return {"status": "success", "link": link}
    except Exception as e:
        logger.error(f"❌ Failed to upsert link: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# DATABASE ADMINISTRATION ENDPOINTS
# ============================================================================

@app.get("/api/admin/databases")
async def list_databases():
    """List all databases and their stats"""
    try:
        stats = {}
        for db_name, db_path in DB_PATHS.items():
            if os.path.exists(db_path):
                size = os.path.getsize(db_path)
                with get_db(db_name) as conn:
                    cursor = conn.cursor()
                    # Get table list
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                    tables = [row[0] for row in cursor.fetchall()]
                    
                    # Get row counts
                    table_counts = {}
                    for table in tables:
                        cursor.execute(f"SELECT COUNT(*) FROM {table}")
                        table_counts[table] = cursor.fetchone()[0]
                    
                stats[db_name] = {
                    "path": db_path,
                    "size_bytes": size,
                    "size_mb": round(size / (1024 * 1024), 3),
                    "tables": table_counts,
                    "exists": True
                }
            else:
                stats[db_name] = {"exists": False, "path": db_path}
        
        return stats
    except Exception as e:
        logger.error(f"❌ Failed to list databases: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/database/{db_name}/clear")
async def clear_database(db_name: str):
    """Clear all data from a specific database"""
    if db_name not in DB_PATHS:
        raise HTTPException(status_code=404, detail=f"Database {db_name} not found")
    
    try:
        with get_db(db_name) as conn:
            cursor = conn.cursor()
            # Get all tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            # Delete all data from each table
            for table in tables:
                cursor.execute(f"DELETE FROM {table}")
            
            conn.commit()
            logger.info(f"🗑️ Cleared all data from {db_name}")
            
            return {
                "status": "cleared",
                "database": db_name,
                "tables_cleared": tables,
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.error(f"❌ Failed to clear {db_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/database/{db_name}/reset")
async def reset_database(db_name: str):
    """Reset database to default state"""
    if db_name not in DB_PATHS:
        raise HTTPException(status_code=404, detail=f"Database {db_name} not found")
    
    try:
        # Clear first
        with get_db(db_name) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            for table in tables:
                cursor.execute(f"DELETE FROM {table}")
            conn.commit()
        
        # Re-seed if it's devices database
        if db_name == "devices":
            seed_devices_db()
            return {
                "status": "reset",
                "database": db_name,
                "action": "reseeded with 10 default devices",
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "status": "reset",
                "database": db_name,
                "action": "cleared (no default data)",
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.error(f"❌ Failed to reset {db_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/database/{db_name}/export")
async def export_database(db_name: str):
    """Export database as JSON"""
    if db_name not in DB_PATHS:
        raise HTTPException(status_code=404, detail=f"Database {db_name} not found")
    
    try:
        export_data = {}
        with get_db(db_name) as conn:
            cursor = conn.cursor()
            # Get all tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            for table in tables:
                cursor.execute(f"SELECT * FROM {table}")
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                
                export_data[table] = [
                    dict(zip(columns, row)) for row in rows
                ]
        
        return {
            "database": db_name,
            "exported_at": datetime.now().isoformat(),
            "data": export_data
        }
    except Exception as e:
        logger.error(f"❌ Failed to export {db_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/admin/database/{db_name}")
async def delete_database_file(db_name: str):
    """Delete database file completely"""
    if db_name not in DB_PATHS:
        raise HTTPException(status_code=404, detail=f"Database {db_name} not found")
    
    try:
        db_path = DB_PATHS[db_name]
        if os.path.exists(db_path):
            os.remove(db_path)
            logger.info(f"🗑️ Deleted database file: {db_path}")
            return {
                "status": "deleted",
                "database": db_name,
                "path": db_path,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "status": "not_found",
                "database": db_name,
                "message": "Database file does not exist"
            }
    except Exception as e:
        logger.error(f"❌ Failed to delete {db_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    logger.info("="*80)
    logger.info("🛑 Shutting down Network Device Manager API...")
    logger.info(f"📅 Shutdown time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Disconnect all active SSH connections
    try:
        from modules.connection_manager import connection_manager
        result = connection_manager.disconnect_all()
        logger.info(f"🔌 Disconnected {result['disconnected_count']} active connections")
    except Exception as e:
        logger.error(f"Error disconnecting devices: {str(e)}")

    logger.info("="*80)

if __name__ == "__main__":
    import uvicorn
    from modules.auth import is_localhost_only

    # Determine host binding based on security settings
    host = "127.0.0.1" if is_localhost_only() else "0.0.0.0"

    logger.info(f"🔒 Security: localhost_only={is_localhost_only()}, binding to {host}")

    # Run with custom log configuration
    uvicorn.run(
        app,
        host=host,
        port=9051,
        log_level="info",
        access_log=True
    )
