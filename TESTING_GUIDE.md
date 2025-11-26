# TESTING GUIDE - Network Automation System

## Quick Test Commands

### 1. Test Backend Health
```bash
curl -s http://localhost:9051/api/health | python3 -m json.tool
```

### 2. Test Automation Status
```bash
curl -s http://localhost:9051/api/automation/status | python3 -m json.tool
```

### 3. Test SSH Connection (usa-r1)
```bash
curl -s -X POST http://localhost:9051/api/automation/connect \
  -H "Content-Type: application/json" \
  -d '{"device_ids": ["r1"]}' | python3 -m json.tool
```

### 4. Execute OSPF Commands
```bash
curl -s -X POST http://localhost:9051/api/automation/execute \
  -H "Content-Type: application/json" \
  -d '{"device_ids": ["r1"]}' | python3 -m json.tool
```

### 5. List Generated Files
```bash
curl -s 'http://localhost:9051/api/automation/files?folder_type=text' | python3 -m json.tool
```

### 6. Disconnect
```bash
curl -s -X POST http://localhost:9051/api/automation/disconnect \
  -H "Content-Type: application/json" \
  -d '{"device_ids": ["r1"]}' | python3 -m json.tool
```

## Verify File Creation
```bash
ls -lh backend/data/IOSXRV-TEXT/
```

## Check Logs
```bash
tail -f backend/logs/app.log
```
