#!/usr/bin/env python3
"""
NetMan OSPF Device Manager - Service Manager
Cross-platform Python script for managing the application
Optimized for Ubuntu 24.04

Usage:
    python3 netman.py install    # Install dependencies
    python3 netman.py start      # Start services
    python3 netman.py stop       # Stop services
    python3 netman.py restart    # Restart services
    python3 netman.py status     # Check service status
    python3 netman.py logs       # View logs
"""

import os
import sys
import subprocess
import signal
import socket
import time
import json
import argparse
from pathlib import Path

# Configuration
SCRIPT_DIR = Path(__file__).parent.absolute()
BACKEND_DIR = SCRIPT_DIR / "backend"
LOGS_DIR = SCRIPT_DIR / "logs"
PID_FILE_BACKEND = SCRIPT_DIR / ".backend.pid"
PID_FILE_FRONTEND = SCRIPT_DIR / ".frontend.pid"
BACKEND_PORT = 9051
FRONTEND_PORT = 9050

# Colors for terminal output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color

def print_color(text, color=Colors.NC):
    print(f"{color}{text}{Colors.NC}")

def print_header(title):
    print_color("=" * 60, Colors.BLUE)
    print_color(f"  {title}", Colors.BLUE)
    print_color("=" * 60, Colors.BLUE)

def is_port_in_use(port):
    """Check if a port is in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def get_pid_by_port(port):
    """Get PID of process using a port"""
    try:
        if sys.platform == "darwin":  # macOS
            result = subprocess.run(
                ['lsof', '-ti', f':{port}'],
                capture_output=True, text=True
            )
        else:  # Linux
            result = subprocess.run(
                ['fuser', f'{port}/tcp'],
                capture_output=True, text=True, stderr=subprocess.DEVNULL
            )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split()[0]
    except Exception:
        pass
    return None

def kill_process_on_port(port):
    """Kill process on a given port"""
    pid = get_pid_by_port(port)
    if pid:
        try:
            os.kill(int(pid), signal.SIGKILL)
            time.sleep(1)
            return True
        except Exception as e:
            print_color(f"  Error killing process: {e}", Colors.RED)
    return False

def read_pid_file(pid_file):
    """Read PID from file"""
    try:
        if pid_file.exists():
            return int(pid_file.read_text().strip())
    except Exception:
        pass
    return None

def write_pid_file(pid_file, pid):
    """Write PID to file"""
    pid_file.write_text(str(pid))

def is_process_running(pid):
    """Check if process is running"""
    try:
        os.kill(pid, 0)
        return True
    except (OSError, TypeError):
        return False

def check_dependencies():
    """Check if required dependencies are available"""
    issues = []

    # Check Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            issues.append("Node.js not found")
    except FileNotFoundError:
        issues.append("Node.js not installed")

    # Check Python
    try:
        result = subprocess.run(['python3', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            issues.append("Python3 not found")
    except FileNotFoundError:
        issues.append("Python3 not installed")

    # Check npm
    try:
        result = subprocess.run(['npm', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            issues.append("npm not found")
    except FileNotFoundError:
        issues.append("npm not installed")

    return issues

def check_python_package(package_name, venv_python):
    """Check if a Python package is installed in venv"""
    try:
        result = subprocess.run(
            [str(venv_python), '-c', f'import {package_name}'],
            capture_output=True, text=True
        )
        return result.returncode == 0
    except Exception:
        return False


def install(force=False):
    """Install all dependencies (smart - skips already installed)"""
    print_header("NetMan OSPF Device Manager - Smart Installation")

    installed_count = 0
    skipped_count = 0

    # Step 1: Check system dependencies
    print("\n[1/6] Checking system dependencies...")
    issues = check_dependencies()
    if issues:
        print_color("\n  Missing dependencies:", Colors.RED)
        for issue in issues:
            print_color(f"    - {issue}", Colors.RED)
        print_color("\n  On Ubuntu 24.04, install with:", Colors.YELLOW)
        print_color("    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -", Colors.CYAN)
        print_color("    sudo apt-get install -y nodejs python3 python3-pip python3-venv", Colors.CYAN)
        return False
    print_color("  ✓ All system dependencies found!", Colors.GREEN)

    # Step 2: Check and install frontend dependencies
    print("\n[2/6] Frontend dependencies (npm)...")
    os.chdir(SCRIPT_DIR)
    node_modules = SCRIPT_DIR / "node_modules"
    package_lock = node_modules / ".package-lock.json"

    if node_modules.exists() and package_lock.exists() and not force:
        # Count packages
        pkg_count = len(list(node_modules.iterdir()))
        if pkg_count > 100:  # Should have >100 packages
            print_color(f"  ○ node_modules exists ({pkg_count} packages) - skipped", Colors.YELLOW)
            skipped_count += 1
        else:
            print("  Updating npm packages...")
            result = subprocess.run(['npm', 'install'], capture_output=True, text=True)
            if result.returncode == 0:
                print_color("  ✓ npm packages updated", Colors.GREEN)
                installed_count += 1
            else:
                print_color(f"  ✗ npm install failed", Colors.RED)
    else:
        print("  Installing npm packages...")
        result = subprocess.run(['npm', 'install'], capture_output=True, text=True)
        if result.returncode != 0:
            print_color(f"  ✗ Error: {result.stderr[:200]}", Colors.RED)
            return False
        pkg_count = len(list(node_modules.iterdir())) if node_modules.exists() else 0
        print_color(f"  ✓ npm packages installed ({pkg_count} packages)", Colors.GREEN)
        installed_count += 1

    # Step 3: Setup Python virtual environment
    print("\n[3/6] Python virtual environment...")
    venv_dir = BACKEND_DIR / "venv"

    if sys.platform == "win32":
        venv_python = venv_dir / "Scripts" / "python"
        pip_path = venv_dir / "Scripts" / "pip"
    else:
        venv_python = venv_dir / "bin" / "python"
        pip_path = venv_dir / "bin" / "pip"

    if venv_dir.exists() and venv_python.exists() and not force:
        print_color(f"  ○ Virtual environment exists - skipped", Colors.YELLOW)
        skipped_count += 1
    else:
        print("  Creating virtual environment...")
        subprocess.run([sys.executable, '-m', 'venv', str(venv_dir)], check=True)
        print_color("  ✓ Virtual environment created", Colors.GREEN)
        installed_count += 1

    # Step 4: Install Python dependencies (smart check)
    print("\n[4/6] Python dependencies (pip)...")

    # Check if key packages are already installed
    core_packages = ['fastapi', 'uvicorn', 'netmiko', 'pydantic']
    all_installed = all(check_python_package(pkg, venv_python) for pkg in core_packages)

    if all_installed and not force:
        print_color(f"  ○ Core packages installed (fastapi, uvicorn, netmiko, pydantic) - skipped", Colors.YELLOW)
        skipped_count += 1
    else:
        print("  Installing Python packages...")
        # Upgrade pip first
        subprocess.run([str(pip_path), 'install', '--upgrade', 'pip', '-q'], capture_output=True)

        requirements = BACKEND_DIR / "requirements.txt"
        result = subprocess.run(
            [str(pip_path), 'install', '-r', str(requirements)],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print_color(f"  ✗ pip install failed: {result.stderr[:200]}", Colors.RED)
            return False
        print_color("  ✓ Python packages installed", Colors.GREEN)
        installed_count += 1

    # Step 5: Configuration files
    print("\n[5/6] Configuration files...")
    env_file = BACKEND_DIR / ".env.local"
    if not env_file.exists():
        env_content = """# NetMan OSPF Device Manager - Configuration
# Security Settings
SECURITY_ENABLED=true
APP_ADMIN_USERNAME=netviz_admin
APP_ADMIN_PASSWORD=V3ry$trongAdm1n!2025
APP_LOGIN_MAX_USES=10
APP_SESSION_TIMEOUT=3600
APP_SECRET_KEY=change-this-to-a-random-secret-key

# Access Control
LOCALHOST_ONLY=true
ALLOWED_HOSTS=127.0.0.1,localhost

# Jumphost Configuration (optional)
JUMPHOST_ENABLED=false
JUMPHOST_IP=
JUMPHOST_USERNAME=
JUMPHOST_PASSWORD=
"""
        env_file.write_text(env_content)
        print_color("  ✓ Created .env.local with defaults", Colors.GREEN)
        installed_count += 1
    else:
        print_color("  ○ .env.local exists - skipped", Colors.YELLOW)
        skipped_count += 1

    # Create directories
    LOGS_DIR.mkdir(exist_ok=True)
    (BACKEND_DIR / "data" / "executions").mkdir(parents=True, exist_ok=True)

    # Step 6: Validation
    print("\n[6/6] Installation validation...")
    validation_passed = True

    # Validate node_modules
    if node_modules.exists() and len(list(node_modules.iterdir())) > 100:
        print_color("  ✓ Frontend packages: OK", Colors.GREEN)
    else:
        print_color("  ✗ Frontend packages: MISSING", Colors.RED)
        validation_passed = False

    # Validate venv
    if venv_python.exists():
        print_color("  ✓ Python venv: OK", Colors.GREEN)
    else:
        print_color("  ✗ Python venv: MISSING", Colors.RED)
        validation_passed = False

    # Validate Python packages
    if all(check_python_package(pkg, venv_python) for pkg in core_packages):
        print_color("  ✓ Python packages: OK", Colors.GREEN)
    else:
        print_color("  ✗ Python packages: MISSING", Colors.RED)
        validation_passed = False

    # Validate config
    if env_file.exists():
        print_color("  ✓ Configuration: OK", Colors.GREEN)
    else:
        print_color("  ○ Configuration: Using defaults", Colors.YELLOW)

    # Summary
    print("\n" + "=" * 60)
    print(f"  Installed: {installed_count}")
    print(f"  Skipped:   {skipped_count}")
    print("=" * 60)

    if validation_passed:
        print_color("\n  Installation Complete!", Colors.GREEN)
        print("\nQuick Start:")
        print_color("  ./start.sh              Start application", Colors.CYAN)
        print_color("  python3 netman.py start Start (Python)", Colors.CYAN)
        print("\nDefault Credentials:")
        print_color("  Username: netviz_admin", Colors.GREEN)
        print_color("  Password: V3ry$trongAdm1n!2025", Colors.GREEN)
        print("\nAccess URLs:")
        print_color("  Frontend: http://localhost:9050", Colors.CYAN)
        print_color("  Backend:  http://localhost:9051", Colors.CYAN)
    else:
        print_color("\n  Installation Failed - check errors above", Colors.RED)
        return False

    return True

def start():
    """Start all services"""
    print_header("NetMan OSPF Device Manager - Starting")

    # Check if already running
    if is_port_in_use(BACKEND_PORT):
        print_color(f"\n  Warning: Backend port {BACKEND_PORT} is in use", Colors.YELLOW)
        response = input("  Stop existing and start fresh? (y/n): ")
        if response.lower() == 'y':
            stop(quiet=True)
            time.sleep(2)
        else:
            return False

    if is_port_in_use(FRONTEND_PORT):
        print_color(f"\n  Warning: Frontend port {FRONTEND_PORT} is in use", Colors.YELLOW)
        response = input("  Stop existing and start fresh? (y/n): ")
        if response.lower() == 'y':
            stop(quiet=True)
            time.sleep(2)
        else:
            return False

    LOGS_DIR.mkdir(exist_ok=True)

    # Start backend
    print(f"\n1. Starting Backend (port {BACKEND_PORT})...")

    if sys.platform == "win32":
        python_path = BACKEND_DIR / "venv" / "Scripts" / "python"
    else:
        python_path = BACKEND_DIR / "venv" / "bin" / "python"

    if not python_path.exists():
        print_color("  Error: Virtual environment not found. Run: python3 netman.py install", Colors.RED)
        return False

    backend_log = LOGS_DIR / "backend.log"
    with open(backend_log, 'w') as log_file:
        backend_proc = subprocess.Popen(
            [str(python_path), 'server.py'],
            cwd=str(BACKEND_DIR),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True
        )

    write_pid_file(PID_FILE_BACKEND, backend_proc.pid)
    print_color(f"   Backend PID: {backend_proc.pid}", Colors.GREEN)

    # Wait for backend to start
    time.sleep(3)
    if not is_port_in_use(BACKEND_PORT):
        print_color("  Error: Backend failed to start. Check logs/backend.log", Colors.RED)
        return False

    # Start frontend
    print(f"\n2. Starting Frontend (port {FRONTEND_PORT})...")

    frontend_log = LOGS_DIR / "frontend.log"
    with open(frontend_log, 'w') as log_file:
        frontend_proc = subprocess.Popen(
            ['npm', 'run', 'dev'],
            cwd=str(SCRIPT_DIR),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True
        )

    write_pid_file(PID_FILE_FRONTEND, frontend_proc.pid)
    print_color(f"   Frontend PID: {frontend_proc.pid}", Colors.GREEN)

    # Wait for frontend
    time.sleep(3)

    print_color("\n" + "=" * 60, Colors.GREEN)
    print_color("  Application Started Successfully!", Colors.GREEN)
    print_color("=" * 60, Colors.GREEN)
    print(f"\n  Backend:  http://localhost:{BACKEND_PORT}")
    print(f"  Frontend: http://localhost:{FRONTEND_PORT}")
    print("\n  Default credentials:")
    print("    Username: netviz_admin")
    print("    Password: V3ry$trongAdm1n!2025")
    print("\n  Logs: ./logs/")
    print("\n  To stop: python3 netman.py stop")
    return True

def stop(quiet=False):
    """Stop all services"""
    if not quiet:
        print_header("NetMan OSPF Device Manager - Stopping")

    stopped = False

    # Stop backend
    pid = read_pid_file(PID_FILE_BACKEND)
    if pid and is_process_running(pid):
        if not quiet:
            print(f"\n  Stopping Backend (PID: {pid})...")
        try:
            os.kill(pid, signal.SIGTERM)
            time.sleep(1)
            if is_process_running(pid):
                os.kill(pid, signal.SIGKILL)
            stopped = True
        except Exception:
            pass
    PID_FILE_BACKEND.unlink(missing_ok=True)

    # Stop frontend
    pid = read_pid_file(PID_FILE_FRONTEND)
    if pid and is_process_running(pid):
        if not quiet:
            print(f"  Stopping Frontend (PID: {pid})...")
        try:
            os.kill(pid, signal.SIGTERM)
            time.sleep(1)
            if is_process_running(pid):
                os.kill(pid, signal.SIGKILL)
            stopped = True
        except Exception:
            pass
    PID_FILE_FRONTEND.unlink(missing_ok=True)

    # Clean up by port
    if is_port_in_use(BACKEND_PORT):
        kill_process_on_port(BACKEND_PORT)
        stopped = True

    if is_port_in_use(FRONTEND_PORT):
        kill_process_on_port(FRONTEND_PORT)
        stopped = True

    if not quiet:
        print_color("\n  All services stopped!", Colors.GREEN)

    return stopped

def restart():
    """Restart all services"""
    print_header("NetMan OSPF Device Manager - Restarting")
    stop(quiet=True)
    time.sleep(2)
    return start()

def status():
    """Check service status"""
    print_header("NetMan OSPF Device Manager - Status")

    # Backend status
    backend_running = is_port_in_use(BACKEND_PORT)
    backend_pid = read_pid_file(PID_FILE_BACKEND)

    print(f"\n  Backend (port {BACKEND_PORT}):")
    if backend_running:
        print_color(f"    Status: RUNNING", Colors.GREEN)
        if backend_pid:
            print(f"    PID: {backend_pid}")
    else:
        print_color(f"    Status: STOPPED", Colors.RED)

    # Frontend status
    frontend_running = is_port_in_use(FRONTEND_PORT)
    frontend_pid = read_pid_file(PID_FILE_FRONTEND)

    print(f"\n  Frontend (port {FRONTEND_PORT}):")
    if frontend_running:
        print_color(f"    Status: RUNNING", Colors.GREEN)
        if frontend_pid:
            print(f"    PID: {frontend_pid}")
    else:
        print_color(f"    Status: STOPPED", Colors.RED)

    print()
    return backend_running and frontend_running

def logs(follow=False, service='all'):
    """View service logs"""
    backend_log = LOGS_DIR / "backend.log"
    frontend_log = LOGS_DIR / "frontend.log"

    if follow:
        # Use tail -f for following logs
        if service == 'backend' and backend_log.exists():
            subprocess.run(['tail', '-f', str(backend_log)])
        elif service == 'frontend' and frontend_log.exists():
            subprocess.run(['tail', '-f', str(frontend_log)])
        else:
            print("Following all logs (Ctrl+C to exit)...")
            subprocess.run(['tail', '-f', str(backend_log), str(frontend_log)])
    else:
        if service in ['all', 'backend'] and backend_log.exists():
            print_color("\n=== Backend Logs ===", Colors.BLUE)
            print(backend_log.read_text()[-5000:])  # Last 5000 chars

        if service in ['all', 'frontend'] and frontend_log.exists():
            print_color("\n=== Frontend Logs ===", Colors.BLUE)
            print(frontend_log.read_text()[-5000:])


def reset(target='all', force=False):
    """Reset database and/or authentication state"""
    print_header("NetMan OSPF Device Manager - Reset")

    if target == 'all':
        targets = ['db', 'auth', 'users', 'logs']
    else:
        targets = [target]

    print("\nThis will reset:")
    for t in targets:
        if t == 'db':
            print("  - Device database")
        elif t == 'auth':
            print("  - Authentication state (login count, sessions)")
        elif t == 'users':
            print("  - Users database (will recreate admin)")
        elif t == 'logs':
            print("  - Log files")

    if not force:
        response = input("\nAre you sure? (y/n): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return False

    # Stop services first
    print("\nStopping services...")
    stop(quiet=True)

    print("\nResetting...")

    if 'db' in targets:
        print_color("  Resetting device database...", Colors.YELLOW)
        (BACKEND_DIR / "devices.db").unlink(missing_ok=True)
        for db_file in (BACKEND_DIR / "data").glob("*.db"):
            db_file.unlink(missing_ok=True)
        (BACKEND_DIR / "data" / "current").unlink(missing_ok=True)
        print_color("  ✓ Device database reset", Colors.GREEN)

    if 'auth' in targets:
        print_color("  Resetting authentication state...", Colors.YELLOW)
        (BACKEND_DIR / "auth_session.json").unlink(missing_ok=True)
        print_color("  ✓ Authentication state reset", Colors.GREEN)

    if 'users' in targets:
        print_color("  Resetting users database...", Colors.YELLOW)
        (BACKEND_DIR / "users.db").unlink(missing_ok=True)
        print_color("  ✓ Users database reset", Colors.GREEN)

    if 'logs' in targets:
        print_color("  Clearing logs...", Colors.YELLOW)
        for log_file in LOGS_DIR.glob("*.log"):
            log_file.unlink(missing_ok=True)
        print_color("  ✓ Logs cleared", Colors.GREEN)

    # Clear PID files
    PID_FILE_BACKEND.unlink(missing_ok=True)
    PID_FILE_FRONTEND.unlink(missing_ok=True)

    print_color("\n  Reset complete!", Colors.GREEN)
    print("\nTo start the application: python3 netman.py start")
    return True


def check():
    """Check system requirements and installation status"""
    print_header("NetMan OSPF Device Manager - System Check")

    all_ok = True

    # Check Node.js
    print("\n1. Checking Node.js...")
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            print_color(f"   ✓ Node.js: {version}", Colors.GREEN)
        else:
            print_color("   ✗ Node.js not working", Colors.RED)
            all_ok = False
    except FileNotFoundError:
        print_color("   ✗ Node.js not installed", Colors.RED)
        all_ok = False

    # Check npm
    print("\n2. Checking npm...")
    try:
        result = subprocess.run(['npm', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print_color(f"   ✓ npm: {result.stdout.strip()}", Colors.GREEN)
        else:
            print_color("   ✗ npm not working", Colors.RED)
            all_ok = False
    except FileNotFoundError:
        print_color("   ✗ npm not installed", Colors.RED)
        all_ok = False

    # Check Python
    print("\n3. Checking Python...")
    try:
        result = subprocess.run(['python3', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print_color(f"   ✓ {result.stdout.strip()}", Colors.GREEN)
        else:
            print_color("   ✗ Python not working", Colors.RED)
            all_ok = False
    except FileNotFoundError:
        print_color("   ✗ Python3 not installed", Colors.RED)
        all_ok = False

    # Check Git
    print("\n4. Checking Git...")
    try:
        result = subprocess.run(['git', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print_color(f"   ✓ {result.stdout.strip()}", Colors.GREEN)
        else:
            print_color("   ✗ Git not working", Colors.RED)
    except FileNotFoundError:
        print_color("   ✗ Git not installed (optional)", Colors.YELLOW)

    # Check virtual environment
    print("\n5. Checking Python virtual environment...")
    venv_dir = BACKEND_DIR / "venv"
    if venv_dir.exists():
        print_color(f"   ✓ Virtual environment exists", Colors.GREEN)
    else:
        print_color("   ✗ Virtual environment not found (run: python3 netman.py install)", Colors.RED)
        all_ok = False

    # Check node_modules
    print("\n6. Checking Node modules...")
    node_modules = SCRIPT_DIR / "node_modules"
    if node_modules.exists():
        print_color(f"   ✓ Node modules installed", Colors.GREEN)
    else:
        print_color("   ✗ Node modules not found (run: python3 netman.py install)", Colors.RED)
        all_ok = False

    # Check ports
    print("\n7. Checking ports...")
    if is_port_in_use(BACKEND_PORT):
        print_color(f"   ✓ Backend port {BACKEND_PORT}: IN USE", Colors.GREEN)
    else:
        print_color(f"   ○ Backend port {BACKEND_PORT}: FREE", Colors.YELLOW)

    if is_port_in_use(FRONTEND_PORT):
        print_color(f"   ✓ Frontend port {FRONTEND_PORT}: IN USE", Colors.GREEN)
    else:
        print_color(f"   ○ Frontend port {FRONTEND_PORT}: FREE", Colors.YELLOW)

    # Summary
    print("\n" + "=" * 50)
    if all_ok:
        print_color("  System check PASSED - Ready to run!", Colors.GREEN)
    else:
        print_color("  System check FAILED - Run install first", Colors.RED)
    print("=" * 50)

    return all_ok

def main():
    parser = argparse.ArgumentParser(
        description='NetMan OSPF Device Manager - Service Manager',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  check       Check system requirements
  install     Install all dependencies
  start       Start all services
  stop        Stop all services
  restart     Restart all services
  status      Check service status
  reset       Reset database/auth (use --target)
  logs        View logs (use -f to follow)

Examples:
  python3 netman.py check
  python3 netman.py install
  python3 netman.py start
  python3 netman.py reset --target auth
  python3 netman.py logs -f backend
        """
    )

    parser.add_argument('command', choices=['check', 'install', 'start', 'stop', 'restart', 'status', 'reset', 'logs'],
                        help='Command to execute')
    parser.add_argument('-f', '--follow', action='store_true', help='Follow logs in real-time')
    parser.add_argument('-s', '--service', choices=['all', 'backend', 'frontend'], default='all',
                        help='Service to target (for logs)')
    parser.add_argument('-t', '--target', choices=['all', 'db', 'auth', 'users', 'logs'], default='all',
                        help='Target for reset (default: all)')
    parser.add_argument('-y', '--yes', action='store_true', help='Skip confirmation prompts')
    parser.add_argument('--force', action='store_true', help='Force reinstall all components')

    args = parser.parse_args()

    if args.command == 'check':
        success = check()
    elif args.command == 'install':
        success = install(force=args.force)
    elif args.command == 'start':
        success = start()
    elif args.command == 'stop':
        success = stop()
    elif args.command == 'restart':
        success = restart()
    elif args.command == 'reset':
        success = reset(target=args.target, force=args.yes)
    elif args.command == 'status':
        success = status()
    elif args.command == 'logs':
        logs(follow=args.follow, service=args.service)
        success = True

    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
