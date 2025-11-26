# DATABASE-PER-WEBPAGE ARCHITECTURE - DEEP ANALYSIS

## Overview
The OSPF Network Device Manager uses a **database-per-webpage** architecture where each major phase/page has its own dedicated SQLite database. This ensures data isolation, clear separation of concerns, and independent lifecycle management.

---

## 🗄️ DATABASE MAPPING TO WEBPAGES

### 1. **devices.db** → Device Manager Page (Phase 1)
**Location**: `backend/devices.db`  
**Purpose**: Store network device inventory  
**Webpage**: Device Manager (main page, default view)

**Schema**:
```sql
CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    deviceName TEXT NOT NULL,
    ipAddress TEXT NOT NULL,
    protocol TEXT NOT NULL,  -- 'ssh' or 'telnet'
    port INTEGER NOT NULL,
    username TEXT NOT NULL,
    password TEXT,
    country TEXT NOT NULL,
    deviceType TEXT NOT NULL,  -- 'router', 'switch', 'firewall'
    platform TEXT NOT NULL,    -- 'IOS-XR', 'IOS-XE', 'NX-OS'
    software TEXT NOT NULL,    -- 'v7.3.1', 'v16.12.3'
    tags TEXT DEFAULT '[]'     -- JSON array of tags
);
```

**Data Flow**:
- User adds/edits devices via DeviceFormModal
- CRUD operations via `/api/devices` endpoints
- Data persists across sessions
- Exported as CSV/JSON for backup
- **Used by**: Automation page to select devices for connection

**Key Operations**:
- `GET /api/devices` - List all devices
- `POST /api/devices` - Create device
- `PUT /api/devices/{id}` - Update device
- `DELETE /api/devices/{id}` - Delete device
- `POST /api/devices/bulk-import` - Import CSV/JSON

---

### 2. **automation.db** → Automation Page (Phase 2)
**Location**: `backend/automation.db`  
**Purpose**: Store automation job history and command execution results  
**Webpage**: Automation (Step 2)

**Schema**:
```sql
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,      -- 'running', 'completed', 'failed', 'stopping'
    start_time TEXT NOT NULL,
    end_time TEXT,
    total_devices INTEGER,
    completed_devices INTEGER,
    progress_percent INTEGER,
    device_ids TEXT,           -- JSON array
    results TEXT,              -- JSON object
    errors TEXT,               -- JSON array
    stop_requested INTEGER DEFAULT 0
);

CREATE TABLE command_results (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    device_id TEXT,
    device_name TEXT,
    command TEXT,
    output TEXT,
    execution_time REAL,
    timestamp TEXT,
    status TEXT,               -- 'success', 'failed'
    error TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);
```

**Data Flow**:
1. User selects devices from `devices.db`
2. Connects via SSH/Telnet (connection_manager.py)
3. Executes OSPF commands (command_executor.py)
4. Saves job metadata to `automation.db`
5. Saves command outputs to TEXT files (`data/OUTPUT-Data_save/TEXT/`)
6. **Triggers**: Data Save page to process files

**Key Operations**:
- `POST /api/automation/connect` - Connect to devices
- `POST /api/automation/jobs` - Create automation job
- `GET /api/automation/jobs/{id}` - Get job status
- `POST /api/automation/jobs/{id}/stop` - Stop job (+ disconnect devices)
- `GET /api/automation/status` - Get overall automation status

**Commands Executed** (saved to TEXT files):
- `show process cpu`
- `show process memory`
- `show route connected`
- `show route ospf`
- `show ospf database`
- `show ospf database self-originate`
- `show ip ospf neighbor` ← **NEW: OSPF-only topology**
- `show cdp neighbor` (legacy)

---

### 3. **datasave.db** → Data Save Page (Phase 3)
**Location**: `backend/datasave.db`  
**Purpose**: Track processed files and conversion metadata  
**Webpage**: Data Save (Step 3)

**Schema**:
```sql
CREATE TABLE saved_files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,   -- 'text', 'json'
    device_name TEXT,
    command TEXT,
    timestamp TEXT NOT NULL,
    size_bytes INTEGER,
    checksum TEXT,             -- MD5 hash for deduplication
    source_job_id TEXT,        -- Link to automation.db job
    processed INTEGER DEFAULT 0
);

CREATE TABLE conversion_log (
    id TEXT PRIMARY KEY,
    source_file TEXT,
    target_file TEXT,
    conversion_type TEXT,      -- 'text_to_json', 'json_to_text'
    timestamp TEXT,
    status TEXT,
    error TEXT
);
```

**Data Flow**:
1. Reads TEXT files from `data/OUTPUT-Data_save/TEXT/`
2. Converts to JSON format
3. Saves to `data/OUTPUT-Data_save/JSON/`
4. Tracks file metadata in `datasave.db`
5. **Triggers**: Transformation page to build topology

**Key Operations**:
- `GET /api/automation/files?folder_type=text` - List TEXT files
- `GET /api/automation/files?folder_type=json` - List JSON files
- `GET /api/automation/files/{filename}` - Get file content
- File processing happens in `file_manager.py`

**File Naming Convention**:
```
{device_name}_{command}_{timestamp}.txt
Example: usa-r5_show_ip_ospf_neighbor_2025-11-24_09-18-46.txt
```

---

### 4. **topology.db** → Transformation Page (Phase 4)
**Location**: `backend/topology.db`  
**Purpose**: Store network topology nodes and links  
**Webpage**: Transformation (Step 4)

**Schema**:
```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hostname TEXT,
    country TEXT,
    type TEXT,                 -- 'router', 'switch'
    status TEXT DEFAULT 'active'
);

CREATE TABLE links (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    cost INTEGER DEFAULT 1,
    interface_local TEXT,
    interface_remote TEXT,
    FOREIGN KEY (source) REFERENCES nodes(id),
    FOREIGN KEY (target) REFERENCES nodes(id)
);
```

**Data Flow**:
1. Reads TEXT files from `data/OUTPUT-Data_save/TEXT/`
2. Parses OSPF neighbor data (`show ip ospf neighbor`)
3. Builds topology graph (topology_builder.py)
4. **Filters**:
   - Only devices from `devices.db` (valid_devices)
   - Only latest files per device/command
   - Only OSPF FULL adjacencies
   - No management interfaces (Mgmt, Ma0)
5. Saves to `topology.db` (UPSERT with clear_first=True)
6. Saves JSON snapshot to `data/OUTPUT-Transformation/`
7. Displays in UI with SVG visualization

**Key Operations**:
- `POST /api/transform/topology` - Generate topology
- `GET /api/transform/topology/latest` - Get latest from DB
- `GET /api/transform/history` - List JSON snapshots
- `GET /api/transform/history/{filename}` - Get specific snapshot
- `DELETE /api/transform/history/{filename}` - Delete snapshot
- `DELETE /api/transform/history` - Clear all history

**Topology Metadata**:
```json
{
  "nodes": [...],
  "links": [...],
  "timestamp": "2025-11-24T09:15:41",
  "metadata": {
    "node_count": 10,
    "link_count": 12,
    "data_source": "OSPF",
    "discovery_method": "show ip ospf neighbor"
  }
}
```

---

## 🔄 CROSS-DATABASE DATA FLOW

### Complete Workflow (4 Phases):

```
Phase 1: Device Manager (devices.db)
    ↓ [User selects devices]
    
Phase 2: Automation (automation.db)
    ↓ [Executes commands, saves to TEXT files]
    
Phase 3: Data Save (datasave.db)
    ↓ [Processes files, converts to JSON]
    
Phase 4: Transformation (topology.db)
    ↓ [Builds topology from TEXT files + devices.db]
    
Result: Network Topology Visualization
```

### Key Integration Points:

1. **Automation → Data Save**:
   - Automation creates TEXT files
   - Data Save reads and processes them
   - No direct DB dependency

2. **Devices → Transformation**:
   - Transformation queries `devices.db` for valid_devices
   - Filters topology to only show managed devices
   - **Critical**: Ensures topology matches inventory

3. **Automation → Transformation**:
   - Transformation reads TEXT files created by Automation
   - Parses OSPF neighbor data
   - Builds network graph

---

## 🎯 DATABASE ISOLATION BENEFITS

### 1. **Independent Lifecycle**
- Each database can be cleared/reset independently
- Device inventory persists even if automation data is cleared
- Topology can be regenerated without affecting device list

### 2. **Clear Separation of Concerns**
- Device management logic isolated from automation
- Topology generation doesn't pollute automation DB
- Easier to debug and maintain

### 3. **Scalability**
- Each DB can grow independently
- Can optimize/index each DB for its specific use case
- Can backup/restore individual phases

### 4. **Data Integrity**
- Foreign key constraints within each DB
- No cross-DB transactions (simpler)
- Clear data ownership

---

## 🔧 DATABASE ADMINISTRATION

### Admin Endpoints (All Databases):
```
GET    /api/admin/databases           - List all DBs with stats
POST   /api/admin/database/{name}/clear    - Clear all data
POST   /api/admin/database/{name}/reset    - Drop & recreate schema
GET    /api/admin/database/{name}/export   - Export as SQL
DELETE /api/admin/database/{name}          - Delete DB file
```

### Database Stats Response:
```json
{
  "devices": {
    "path": "/Users/.../backend/devices.db",
    "size_bytes": 12288,
    "size_mb": 0.012,
    "tables": {
      "devices": 10
    },
    "exists": true
  },
  "automation": { ... },
  "topology": { ... },
  "datasave": { ... }
}
```

---

## 🐛 CRITICAL FIXES APPLIED

### 1. Database Location Consolidation (BUG #7)
**Before**: Databases in both root and backend/  
**After**: All in `backend/` with absolute paths  
**Impact**: Consistent access regardless of working directory

### 2. Absolute Path Resolution (BUG #16)
**Before**: Relative paths like `"devices.db"`  
**After**: `os.path.join(BASE_DIR, "devices.db")`  
**Impact**: Works in production deployment

### 3. Topology DB Path Fix
**Before**: `topology.db` with fallback to `backend/topology.db`  
**After**: Direct absolute path to `backend/topology.db`  
**Impact**: No ambiguity, always uses correct file

---

## 📊 DATABASE SIZE EXPECTATIONS

**Typical Sizes** (10 devices, 3 automation runs):
- `devices.db`: 12 KB (static, grows slowly)
- `automation.db`: 16-20 KB (grows with job history)
- `datasave.db`: 20-30 KB (grows with file tracking)
- `topology.db`: 28-40 KB (cleared on each generation)

**Growth Patterns**:
- **devices.db**: Linear with device count
- **automation.db**: Linear with job count (can be pruned)
- **datasave.db**: Linear with file count (can be pruned)
- **topology.db**: Constant (always reflects latest topology)

---

## 🎓 DEEP UNDERSTANDING SUMMARY

### Why Database-Per-Webpage?

1. **Matches User Mental Model**: Each page = distinct phase
2. **Clear Data Ownership**: No ambiguity about where data lives
3. **Independent Operations**: Can work on one phase without affecting others
4. **Easier Debugging**: Know exactly which DB to check for issues
5. **Simpler Backup/Restore**: Backup just the phase you care about

### Trade-offs:

**Pros**:
- ✅ Simple, clear architecture
- ✅ Easy to understand and maintain
- ✅ Independent scaling
- ✅ No complex joins across DBs

**Cons**:
- ⚠️ Some data duplication (device names in multiple DBs)
- ⚠️ No foreign key constraints across DBs
- ⚠️ Must manually ensure consistency

### Best Practices:

1. **Always use `devices.db` as source of truth** for device list
2. **Clear `topology.db` before regeneration** (already implemented)
3. **Prune old automation jobs** periodically
4. **Backup all 4 DBs together** for complete state
5. **Use absolute paths** for all DB access (now fixed)

---

This architecture is **powerful yet simple**, perfectly aligned with the 4-phase workflow and user expectations.
