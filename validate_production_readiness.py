#!/usr/bin/env python3
"""
Production Readiness Validation Script
Automatically validates critical issues identified in audit
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple

# Color codes for terminal output
RED = '\033[91m'
YELLOW = '\033[93m'
GREEN = '\033[92m'
BLUE = '\033[94m'
RESET = '\033[0m'

class ProductionValidator:
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.backend_dir = self.base_dir / "backend"
        self.results = []
        self.critical_failures = 0
        self.high_failures = 0
        self.warnings = 0
        self.passes = 0

    def log(self, level: str, title: str, message: str, passed: bool = None):
        """Log a validation result"""
        if level == "CRITICAL":
            icon = f"{RED}🔴{RESET}"
            self.critical_failures += 1
        elif level == "HIGH":
            icon = f"{YELLOW}🟠{RESET}"
            self.high_failures += 1
        elif level == "WARNING":
            icon = f"{YELLOW}🟡{RESET}"
            self.warnings += 1
        elif level == "PASS":
            icon = f"{GREEN}✅{RESET}"
            self.passes += 1
        else:
            icon = f"{BLUE}ℹ️{RESET}"

        result = {
            "level": level,
            "title": title,
            "message": message,
            "passed": passed
        }
        self.results.append(result)
        print(f"{icon} [{level}] {title}")
        print(f"   {message}")
        print()

    def check_file_exists(self, filepath: Path, critical: bool = False) -> bool:
        """Check if a file exists"""
        exists = filepath.exists()
        level = "CRITICAL" if (critical and not exists) else ("PASS" if exists else "WARNING")
        
        if exists:
            size = filepath.stat().st_size
            self.log(level, f"File Check: {filepath.name}", 
                    f"✓ Found at {filepath} ({size} bytes)", passed=True)
        else:
            self.log(level, f"File Check: {filepath.name}",
                    f"✗ NOT FOUND at {filepath}", passed=False)
        
        return exists

    def check_cors_configuration(self) -> bool:
        """Validate CORS configuration is not using wildcards"""
        server_py = self.backend_dir / "server.py"
        
        if not server_py.exists():
            self.log("CRITICAL", "CORS Check", "server.py not found", passed=False)
            return False

        with open(server_py, 'r') as f:
            content = f.read()

        # Check for wildcard CORS
        if 'else [\"*\"]' in content or "else ['*']" in content:
            self.log("CRITICAL", "CORS Configuration",
                    "⚠️ WILDCARD CORS DETECTED: Line contains 'else [\"*\"]' - This allows requests from ANY origin",
                    passed=False)
            return False
        else:
            self.log("PASS", "CORS Configuration",
                    "✓ No wildcard CORS found in server.py", passed=True)
            return True

    def check_env_file(self) -> bool:
        """Check if .env.local exists and has required settings"""
        env_local = self.backend_dir / ".env.local"
        env_example = self.backend_dir / ".env.secure.example"

        if not env_local.exists():
            self.log("HIGH", "Environment Configuration",
                    f"⚠️ .env.local not found. Copy from {env_example} and configure",
                    passed=False)
            return False

        # Read env file
        with open(env_local, 'r') as f:
            env_content = f.read()

        # Check for default/insecure values
        issues = []
        if "CHANGE_THIS" in env_content:
            issues.append("Contains CHANGE_THIS placeholder values")
        if "APP_SECRET_KEY=\n" in env_content or "APP_SECRET_KEY=$" in env_content:
            issues.append("APP_SECRET_KEY not set")
        if "APP_PASSWORD=admin" in env_content or "APP_PASSWORD=password" in env_content:
            issues.append("Using default/weak password")

        if issues:
            self.log("HIGH", "Environment Configuration",
                    f"⚠️ Insecure configuration detected:\n   - " + "\n   - ".join(issues),
                    passed=False)
            return False
        else:
            self.log("PASS", "Environment Configuration",
                    "✓ .env.local exists and basic checks passed", passed=True)
            return True

    def check_encryption_key(self) -> bool:
        """Check encryption key file exists and has proper permissions"""
        enc_key = self.backend_dir / ".encryption_key"

        if not enc_key.exists():
            self.log("WARNING", "Encryption Key",
                    "⚠️ .encryption_key not found - will be generated on first run",
                    passed=True)  # Not critical, auto-generated
            return True

        # Check permissions (Unix only)
        if sys.platform != 'win32':
            stats = enc_key.stat()
            perms = oct(stats.st_mode)[-3:]
            
            if perms != '600':
                self.log("HIGH", "Encryption Key Permissions",
                        f"⚠️ Insecure permissions: {perms} (should be 600)\n   Run: chmod 600 {enc_key}",
                        passed=False)
                return False

        self.log("PASS", "Encryption Key",
                f"✓ Found at {enc_key} with proper permissions", passed=True)
        return True

    def check_database_permissions(self) -> bool:
        """Check database file permissions"""
        db_files = [
            self.backend_dir / "devices.db",
            self.backend_dir / "automation.db",
            self.backend_dir / "topology.db",
            self.backend_dir / "datasave.db"
        ]

        all_good = True
        for db_file in db_files:
            if not db_file.exists():
                continue  # DB files created on first run

            if sys.platform != 'win32':
                stats = db_file.stat()
                perms = oct(stats.st_mode)[-3:]
                
                if perms != '600':
                    self.log("WARNING", f"Database Permissions: {db_file.name}",
                            f"⚠️ Permissions: {perms} (recommended: 600)\n   Run: chmod 600 {db_file}",
                            passed=False)
                    all_good = False

        if all_good:
            self.log("PASS", "Database Permissions",
                    "✓ All database files have secure permissions or don't exist yet", passed=True)
        
        return all_good

    def check_python_dependencies(self) -> bool:
        """Check if all required Python packages are installed"""
        requirements_file = self.backend_dir / "requirements.txt"
        
        if not requirements_file.exists():
            self.log("WARNING", "Python Dependencies",
                    "requirements.txt not found", passed=False)
            return False

        try:
            # Read requirements
            with open(requirements_file, 'r') as f:
                requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]

            # Check if packages are installed
            result = subprocess.run(
                ['pip', 'list', '--format=json'],
                capture_output=True,
                text=True,
                check=True
            )
            installed = {pkg['name'].lower(): pkg['version'] for pkg in json.loads(result.stdout)}

            missing = []
            for req in requirements:
                # Parse package name (before ==, >=, etc.)
                pkg_name = req.split('==')[0].split('>=')[0].split('~=')[0].strip().lower()
                if pkg_name not in installed:
                    missing.append(req)

            if missing:
                self.log("HIGH", "Python Dependencies",
                        f"⚠️ Missing packages:\n   - " + "\n   - ".join(missing) +
                        f"\n   Run: pip install -r {requirements_file}",
                        passed=False)
                return False
            else:
                self.log("PASS", "Python Dependencies",
                        f"✓ All {len(requirements)} required packages installed", passed=True)
                return True

        except Exception as e:
            self.log("WARNING", "Python Dependencies",
                    f"Could not verify dependencies: {str(e)}", passed=False)
            return False

    def check_rate_limiting_implementation(self) -> bool:
        """Check if rate limiting is properly implemented"""
        server_py = self.backend_dir / "server.py"
        
        if not server_py.exists():
            return False

        with open(server_py, 'r') as f:
            content = f.read()

        # Check for slowapi import and usage
        has_import = 'from slowapi import' in content or 'import slowapi' in content
        has_limiter = 'Limiter(' in content
        has_decorator = '@limiter.limit(' in content or '@app_limiter.limit(' in content

        if has_import and has_limiter and has_decorator:
            self.log("PASS", "Rate Limiting",
                    "✓ Rate limiting appears to be implemented", passed=True)
            return True
        else:
            details = []
            if not has_import:
                details.append("slowapi not imported")
            if not has_limiter:
                details.append("Limiter not instantiated")
            if not has_decorator:
                details.append("@limiter.limit() decorator not used on endpoints")
            
            self.log("HIGH", "Rate Limiting",
                    f"⚠️ Rate limiting NOT fully implemented:\n   - " + "\n   - ".join(details),
                    passed=False)
            return False

    def check_telnet_module(self) -> bool:
        """Check if telnet_manager module exists"""
        telnet_module = self.backend_dir / "modules" / "telnet_manager.py"
        
        exists = telnet_module.exists()
        
        if exists:
            self.log("PASS", "Telnet Module",
                    f"✓ telnet_manager.py found", passed=True)
        else:
            # Check if it's referenced in code
            server_py = self.backend_dir / "server.py"
            if server_py.exists():
                with open(server_py, 'r') as f:
                    if 'telnet_manager' in f.read():
                        self.log("CRITICAL", "Telnet Module",
                                "⚠️ telnet_manager.py REFERENCED but NOT FOUND\n   This could cause import errors",
                                passed=False)
                        return False
            
            self.log("WARNING", "Telnet Module",
                    "⚠️ telnet_manager.py not found (may not be needed)", passed=True)
        
        return True

    def check_node_dependencies(self) -> bool:
        """Check if Node.js dependencies are installed"""
        package_json = self.base_dir / "package.json"
        node_modules = self.base_dir / "node_modules"

        if not package_json.exists():
            self.log("CRITICAL", "Node.js Configuration",
                    "package.json not found", passed=False)
            return False

        if not node_modules.exists():
            self.log("HIGH", "Node.js Dependencies",
                    "⚠️ node_modules not found\n   Run: npm install",
                    passed=False)
            return False

        self.log("PASS", "Node.js Dependencies",
                "✓ node_modules directory exists", passed=True)
        return True

    def check_security_modules(self) -> bool:
        """Verify security modules exist and are properly configured"""
        required_modules = [
            "auth.py",
            "security.py",
            "device_encryption.py",
            "audit_logger.py"
        ]

        modules_dir = self.backend_dir / "modules"
        all_exist = True

        for module in required_modules:
            module_path = modules_dir / module
            if not module_path.exists():
                self.log("CRITICAL", f"Security Module: {module}",
                        f"⚠️ MISSING: {module_path}", passed=False)
                all_exist = False

        if all_exist:
            self.log("PASS", "Security Modules",
                    f"✓ All {len(required_modules)} security modules present", passed=True)

        return all_exist

    def generate_report(self):
        """Generate final validation report"""
        print("\n" + "="*80)
        print(f"{BLUE}📊 PRODUCTION READINESS VALIDATION REPORT{RESET}")
        print("="*80 + "\n")

        total_checks = len(self.results)
        
        print(f"Total Checks: {total_checks}")
        print(f"{GREEN}✅ Passed: {self.passes}{RESET}")
        print(f"{YELLOW}🟡 Warnings: {self.warnings}{RESET}")
        print(f"{YELLOW}🟠 High Priority: {self.high_failures}{RESET}")
        print(f"{RED}🔴 Critical: {self.critical_failures}{RESET}")
        print()

        # Overall status
        if self.critical_failures > 0:
            print(f"{RED}❌ PRODUCTION READINESS: FAILED{RESET}")
            print(f"{RED}Critical issues must be fixed before deployment{RESET}")
            status = "FAILED"
        elif self.high_failures > 0:
            print(f"{YELLOW}⚠️ PRODUCTION READINESS: CONDITIONAL{RESET}")
            print(f"{YELLOW}High-priority issues should be addressed{RESET}")
            status = "CONDITIONAL"
        else:
            print(f"{GREEN}✅ PRODUCTION READINESS: PASSED{RESET}")
            print(f"{GREEN}Application ready for production deployment{RESET}")
            status = "PASSED"

        print("\n" + "="*80)

        # Save JSON report
        report = {
            "timestamp": subprocess.run(['date', '+%Y-%m-%d %H:%M:%S'], 
                                      capture_output=True, text=True).stdout.strip(),
            "status": status,
            "summary": {
                "total_checks": total_checks,
                "passed": self.passes,
                "warnings": self.warnings,
                "high_priority": self.high_failures,
                "critical": self.critical_failures
            },
            "results": self.results
        }

        report_file = self.base_dir / "production_validation_report.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Full report saved to: {report_file}")

        return status == "PASSED"

    def run_all_checks(self) -> bool:
        """Run all validation checks"""
        print(f"\n{BLUE}🔍 Starting Production Readiness Validation...{RESET}\n")

        # Critical file checks
        print(f"{BLUE}━━━ Critical Files ━━━{RESET}\n")
        self.check_file_exists(self.backend_dir / "server.py", critical=True)
        self.check_telnet_module()
        self.check_security_modules()

        # Configuration checks
        print(f"\n{BLUE}━━━ Configuration ━━━{RESET}\n")
        self.check_cors_configuration()
        self.check_env_file()
        self.check_encryption_key()
        self.check_database_permissions()

        # Dependencies checks
        print(f"\n{BLUE}━━━ Dependencies ━━━{RESET}\n")
        self.check_python_dependencies()
        self.check_node_dependencies()

        # Security checks
        print(f"\n{BLUE}━━━ Security ━━━{RESET}\n")
        self.check_rate_limiting_implementation()

        # Generate report
        return self.generate_report()


if __name__ == "__main__":
    validator = ProductionValidator()
    passed = validator.run_all_checks()
    
    sys.exit(0 if passed else 1)
