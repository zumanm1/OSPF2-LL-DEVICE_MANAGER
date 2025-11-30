# 🔐 Security Guide - NetMan OSPF Device Manager

**Version**: 2.0  
**Date**: November 30, 2025  
**Status**: Production-Ready Security Implementation

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Security Features](#security-features)
3. [Configuration](#configuration)
4. [Password Security](#password-security)
5. [Network Security](#network-security)
6. [API Security](#api-security)
7. [Database Security](#database-security)
8. [Audit Logging](#audit-logging)
9. [Best Practices](#best-practices)
10. [Security Checklist](#security-checklist)

---

## Overview

This application implements **enterprise-grade security** features to protect your network device credentials and automation workflows.

### Security Layers

```
┌─────────────────────────────────────────┐
│  1. Network Access Control (IP/Host)   │
├─────────────────────────────────────────┤
│  2. Rate Limiting (Anti-Brute Force)   │
├─────────────────────────────────────────┤
│  3. Session Authentication (Tokens)    │
├─────────────────────────────────────────┤
│  4. Input Validation & Sanitization    │
├─────────────────────────────────────────┤
│  5. SQL Injection Protection           │
├─────────────────────────────────────────┤
│  6. Password Encryption (PBKDF2)       │
├─────────────────────────────────────────┤
│  7. Credentials Encryption (Fernet)    │
├─────────────────────────────────────────┤
│  8. Security Headers (CSP, HSTS, etc.) │
├─────────────────────────────────────────┤
│  9. Audit Logging (All Security Events)│
└─────────────────────────────────────────┘
```

---

## Security Features

### ✅ Implemented Security Controls

| Feature | Status | Description |
|---------|--------|-------------|
| **Authentication** | ✅ Active | Session-based with secure tokens |
| **Password Hashing** | ✅ Active | PBKDF2-HMAC-SHA256 (100k iterations) |
| **Rate Limiting** | ✅ Active | Prevents brute force attacks |
| **Input Validation** | ✅ Active | All user inputs validated & sanitized |
| **SQL Injection Protection** | ✅ Active | Parameterized queries only |
| **XSS Protection** | ✅ Active | HTML escaping + CSP headers |
| **CSRF Protection** | ✅ Active | Token-based validation |
| **Credentials Encryption** | ✅ Active | Device passwords encrypted at rest |
| **Audit Logging** | ✅ Active | All security events logged |
| **Security Headers** | ✅ Active | CSP, HSTS, X-Frame-Options, etc. |
| **Session Management** | ✅ Active | Timeout, expiry, secure tokens |
| **Access Control** | ✅ Active | IP whitelisting, localhost-only mode |

---

## Configuration

### Step 1: Copy Secure Configuration Template

```bash
cd backend
cp .env.secure.example .env.local
nano .env.local
```

### Step 2: Essential Security Settings

```bash
# ============================================================================
# CRITICAL: Change these before deployment!
# ============================================================================

# 1. Change default password
APP_USERNAME=admin
APP_PASSWORD=Your_Very_Strong_P@ssw0rd_Here!

# 2. Generate random secret key
# Run: python -c "import secrets; print(secrets.token_hex(32))"
APP_SECRET_KEY=YOUR_64_CHARACTER_HEX_STRING_HERE

# 3. Configure network access
LOCALHOST_ONLY=true  # or false for remote access
ALLOWED_HOSTS=127.0.0.1,localhost,172.16.39.172

# 4. Enable security features
SECURITY_ENABLED=true
RATE_LIMIT_ENABLED=true
AUDIT_LOG_ENABLED=true
DEVICE_PASSWORD_ENCRYPTION=true
```

### Step 3: Generate Secure Values

```bash
# Generate app secret key
python -c "import secrets; print('APP_SECRET_KEY=' + secrets.token_hex(32))"

# Generate API key (if using API key auth)
python -c "import secrets; print('API_KEY=' + secrets.token_urlsafe(32))"

# Generate encryption key (for device passwords)
cd backend
python -c "from modules.device_encryption import get_or_create_encryption_key; get_or_create_encryption_key()"
```

---

## Password Security

### Password Policy (Enforced)

```python
✅ Minimum length: 8 characters
✅ Maximum length: 128 characters
✅ Must contain uppercase letter
✅ Must contain lowercase letter
✅ Must contain digit
✅ Must contain special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
✅ Cannot be common weak password
```

### Rejected Weak Passwords

```
❌ password, 123456, admin, admin123, cisco, root, default
❌ qwerty, abc123, letmein, monkey, dragon, baseball
❌ And 20+ more common passwords...
```

### Password Hashing

**Algorithm**: PBKDF2-HMAC-SHA256  
**Iterations**: 100,000  
**Salt**: 64-character random hex (per password)  

**Example**:
```python
Password: "MyP@ssw0rd!"
↓ PBKDF2-HMAC-SHA256 (100k iterations)
↓ with random salt
Hash: "a3f8b2c9d1e4f7a8b9c0d1e2f3a4b5c6..."
Salt: "f7e8d9c0b1a2..."
```

**Why secure?**
- 100,000 iterations makes brute force computationally expensive
- Random salt prevents rainbow table attacks
- SHA-256 is cryptographically secure
- Constant-time comparison prevents timing attacks

---

## Network Security

### Access Control Modes

#### Mode 1: Localhost Only (Most Secure)
```bash
LOCALHOST_ONLY=true
```

**Allows**: Only connections from `127.0.0.1`, `localhost`  
**Blocks**: All external connections  
**Use Case**: Single-user workstation, maximum security

#### Mode 2: IP Whitelisting
```bash
LOCALHOST_ONLY=false
ALLOWED_HOSTS=172.16.39.172,10.0.0.50,192.168.1.100
```

**Allows**: Only specified IPs/hostnames  
**Blocks**: All other IPs  
**Use Case**: Multi-user team, specific servers only

### CORS Configuration

```bash
CORS_ORIGINS=http://localhost:9050,http://172.16.39.172:9050
```

**Purpose**: Controls which web origins can access your API  
**Security**: Prevents unauthorized web apps from accessing your data

---

## API Security

### 1. Rate Limiting

Protects against brute force attacks and API abuse.

#### Login Rate Limiting
```bash
RATE_LIMIT_LOGIN_MAX=5       # 5 attempts
RATE_LIMIT_LOGIN_WINDOW=300  # in 5 minutes
```

**Result**: After 5 failed logins, IP is blocked for 5 minutes

#### API Rate Limiting
```bash
RATE_LIMIT_API_MAX=100       # 100 requests
RATE_LIMIT_API_WINDOW=60     # in 1 minute
```

**Result**: After 100 API calls in 1 minute, IP is blocked for 5 minutes

### 2. Input Validation

All inputs are validated before processing:

```python
✅ Hostnames: Must match RFC 1123 or be valid IPv4
✅ Usernames: 3-32 chars, alphanumeric + underscore only
✅ Device names: 1-64 chars, alphanumeric + - _ . only
✅ Commands: Max 500 chars, dangerous patterns blocked
✅ Passwords: Must meet complexity requirements
```

### 3. Dangerous Command Protection

These command patterns are **automatically blocked**:

```bash
❌ rm (delete files)
❌ format (format filesystem)
❌ reload (reload device)
❌ write erase (erase config)
❌ delete (delete files)
❌ | (pipe - command injection)
❌ ; (command separator)
❌ && (command chaining)
❌ $( ) (command substitution)
❌ ` (backtick substitution)
```

### 4. Request Size Limits

```bash
MAX_REQUEST_SIZE_MB=10  # Maximum 10MB requests
REQUEST_TIMEOUT=30      # 30 seconds timeout
```

### 5. SQL Injection Protection

✅ **All database queries use parameterized statements**

**Example (SECURE)**:
```python
# ✅ GOOD: Parameterized query
cursor.execute("SELECT * FROM devices WHERE name = ?", (device_name,))
```

**Example (INSECURE - NOT USED)**:
```python
# ❌ BAD: String concatenation (we don't do this!)
cursor.execute(f"SELECT * FROM devices WHERE name = '{device_name}'")
```

---

## Database Security

### 1. Device Password Encryption

All device passwords are encrypted at rest using **Fernet (AES-128-CBC + HMAC)**.

#### How it works:
```
Plaintext Password: "cisco"
           ↓
  Fernet Encryption
           ↓
Encrypted: "gAAAAABnS7xKpqZX9J8fY2vN3kL5mP7rQ9sT4wU6..."
           ↓
  Stored in database
```

#### Enable encryption:
```bash
DEVICE_PASSWORD_ENCRYPTION=true
ENCRYPTION_ALGORITHM=fernet
```

#### Encryption key location:
```
backend/.encryption_key
```

**⚠️ CRITICAL**: Backup this key! Without it, you cannot decrypt passwords.

```bash
# Backup encryption key
cp backend/.encryption_key ~/secure_backup/.encryption_key.backup

# Verify backup
ls -la ~/secure_backup/.encryption_key.backup
```

### 2. Database File Permissions

```bash
# Set secure permissions on database
chmod 600 backend/devices.db

# Owner: read/write only
# Group: no access
# Others: no access
```

### 3. Database Backups

```bash
# Enable automatic backups
DB_AUTO_BACKUP_INTERVAL=24  # Every 24 hours

# Backup retention
DB_BACKUP_RETENTION_DAYS=30  # Keep 30 days

# Backup encryption
BACKUP_ENCRYPTION=true
```

---

## Audit Logging

All security-related events are logged to `logs/security_audit.log`.

### Logged Events

| Event Type | Description | Example |
|------------|-------------|---------|
| **login_success** | Successful login | User: admin, IP: 192.168.1.50 |
| **login_failure** | Failed login attempt | User: admin, IP: 192.168.1.100, Reason: invalid_credentials |
| **logout** | User logout | User: admin, IP: 192.168.1.50 |
| **password_change** | Password changed | User: admin, By: admin, IP: 192.168.1.50 |
| **user_created** | New user created | User: operator1, By: admin, Role: operator |
| **user_deleted** | User deleted | User: operator1, By: admin |
| **permission_denied** | Unauthorized access | User: viewer1, Resource: users, Action: create |
| **suspicious_activity** | Unusual behavior | User: unknown, Activity: SQL injection attempt |

### Log Format (JSON)

```json
{
  "timestamp": "2025-11-30T10:15:30",
  "event_type": "login_failure",
  "user": "admin",
  "ip": "192.168.1.100",
  "details": {
    "reason": "invalid_credentials",
    "attempt": 3
  }
}
```

### View Audit Logs

```bash
# View recent events
tail -50 logs/security_audit.log

# Watch in real-time
tail -f logs/security_audit.log

# Search for failed logins
grep "login_failure" logs/security_audit.log

# Count login attempts by IP
grep "login_" logs/security_audit.log | cut -d'"' -f10 | sort | uniq -c

# Parse JSON logs
cat logs/security_audit.log | jq '.event_type' | sort | uniq -c
```

---

## Best Practices

### 🔒 Production Deployment Checklist

```bash
✅ Changed default admin password
✅ Generated random APP_SECRET_KEY
✅ Enabled SECURITY_ENABLED=true
✅ Enabled RATE_LIMIT_ENABLED=true
✅ Enabled AUDIT_LOG_ENABLED=true
✅ Enabled DEVICE_PASSWORD_ENCRYPTION=true
✅ Backed up encryption key (.encryption_key)
✅ Set appropriate LOCALHOST_ONLY or ALLOWED_HOSTS
✅ Configured CORS_ORIGINS for your frontend
✅ Set secure database file permissions (chmod 600)
✅ Configured backup retention
✅ Reviewed and enabled security headers
✅ Disabled DEBUG_MODE=false
✅ Set LOG_LEVEL=INFO (not DEBUG in prod)
✅ Tested rate limiting
✅ Tested authentication flow
✅ Reviewed audit logs
```

### 🛡️ Security Maintenance

#### Daily
- Monitor logs for suspicious activity
- Check for failed login attempts

#### Weekly
- Review audit logs
- Check rate limiting blocks
- Verify backups are working

#### Monthly
- Update dependencies (security patches)
- Review user accounts and permissions
- Rotate encryption keys (if applicable)
- Test backup recovery

#### Quarterly
- Security audit
- Password policy review
- Access control review
- Update documentation

### 🚨 Incident Response

If you suspect a security breach:

1. **Immediately**: Change all passwords
2. **Check audit logs** for unauthorized access
3. **Review failed login attempts** for brute force patterns
4. **Check database** for unauthorized devices/commands
5. **Rotate encryption keys**
6. **Review network access** logs
7. **Update** all security configurations

---

## Security Checklist

### Pre-Deployment Security

```bash
[CRITICAL]
[ ] Change default admin password
[ ] Generate unique APP_SECRET_KEY
[ ] Enable encryption for device passwords
[ ] Backup encryption key to secure location
[ ] Set database file permissions (chmod 600)

[HIGH PRIORITY]
[ ] Configure network access (LOCALHOST_ONLY or ALLOWED_HOSTS)
[ ] Enable rate limiting
[ ] Enable audit logging
[ ] Configure CORS origins
[ ] Set session timeout

[RECOMMENDED]
[ ] Enable automatic backups
[ ] Configure log retention
[ ] Set up monitoring/alerts
[ ] Review password policy settings
[ ] Test authentication flow
[ ] Test rate limiting
```

### Post-Deployment Verification

```bash
[VERIFY WORKING]
[ ] Login with new password works
[ ] Failed login blocks after rate limit
[ ] Audit log captures events
[ ] Device passwords are encrypted
[ ] Session expires after timeout
[ ] Only allowed IPs can connect
[ ] CORS blocks unauthorized origins
[ ] Security headers are present
[ ] Dangerous commands are blocked
[ ] SQL injection attempts fail
```

---

## Security Headers

The following security headers are automatically added to all responses:

```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Server: NetMan-OSPF
```

### Test Security Headers

```bash
# Check headers
curl -I http://localhost:9051/api/health

# Expected output includes:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: ...
```

---

## Troubleshooting

### Common Security Issues

#### Issue 1: Cannot login after enabling security
```bash
# Check if password meets complexity requirements
# Password must have:
# - At least 8 characters
# - Uppercase, lowercase, digit, special character
```

#### Issue 2: Getting rate limited
```bash
# Reset rate limit for your IP
# In Python console:
from modules.security import rate_limiter
rate_limiter.reset("YOUR_IP_ADDRESS")
```

#### Issue 3: Encrypted passwords not working
```bash
# Check if encryption key exists
ls -la backend/.encryption_key

# If missing, regenerate (will lose access to encrypted passwords!)
python -c "from modules.device_encryption import get_or_create_encryption_key; get_or_create_encryption_key()"
```

#### Issue 4: Access denied from remote IP
```bash
# Add IP to allowed hosts
nano backend/.env.local

# Add to ALLOWED_HOSTS:
ALLOWED_HOSTS=127.0.0.1,localhost,YOUR_IP_HERE

# Restart server
./restart.sh
```

---

## References

### Security Standards

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **CIS Controls**: https://www.cisecurity.org/controls

### Cryptography

- **PBKDF2**: RFC 2898
- **Fernet**: https://github.com/fernet/spec
- **AES**: NIST FIPS 197

### Web Security

- **Content Security Policy**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- **CORS**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **Security Headers**: https://securityheaders.com

---

**Version**: 2.0  
**Last Updated**: November 30, 2025  
**Status**: ✅ Production-Ready
