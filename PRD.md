# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## OSPF-LL Network Device Manager & Automation Platform

**Version**: 2.0
**Date**: 2025-11-22
**Status**: In Development
**Tech Stack**:
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Backend**: Python 3.11 + FastAPI + SQLite
- **Network Automation**: Netmiko + pyATS/Genie

---

## 🎯 PRODUCT VISION

A comprehensive network device management and automation platform that enables network engineers to:
1. Manage network device inventory (CRUD operations)
2. Automate data collection from Cisco routers via SSH
3. Store and view collected data (text and structured JSON)
4. Transform OSPF network data into network topology visualizations

---

## 📊 FEATURE BREAKDOWN

### **STEP 0: Device Manager** (Current - Needs Fixes)
**Status**: 80% Complete
**Priority**: HIGH (Foundation for all other features)

#### Functionality
- CRUD operations for network devices
- Device attributes:
  - Device Name (country-code naming convention)
  - IP Address (172.20.0.11-20)
  - Protocol: SSH only
  - Port: 22
  - Username: "cisco"
  - Password: "cisco"
  - Country: USA, Brazil, Zimbabwe, Germany, UK
  - Device Type: PE, P, RR, Management
  - Platform: ISR4000
  - Software: IOS XE
  - Tags: Custom labels

#### Real Production Devices
Replace mock data with 10 actual routers:

| Router | Hostname  | Management IP | Country        |
|--------|-----------|---------------|----------------|
| R1     | usa-r1    | 172.20.0.11   | United States  |
| R2     | usa-r2    | 172.20.0.12   | United States  |
| R3     | bra-r3    | 172.20.0.13   | Brazil         |
| R4     | zim-r4    | 172.20.0.14   | Zimbabwe       |
| R5     | usa-r5    | 172.20.0.15   | United States  |
| R6     | deu-r6    | 172.20.0.16   | Germany        |
| R7     | gbr-r7    | 172.20.0.17   | United Kingdom |
| R8     | usa-r8    | 172.20.0.18   | United States  |
| R9     | gbr-r9    | 172.20.0.19   | United Kingdom |
| R10    | deu-r10   | 172.20.0.20   | Germany        |

**All devices**: SSH, cisco/cisco credentials

#### Critical Fixes Needed
1. ✅ Remove duplicate backend (server.ts, db.ts)
2. ✅ Replace mock devices with real 10 routers
3. ⏳ Add React Error Boundary
4. ⏳ Fix state persistence to sync with backend
5. ⏳ Fix CORS (remove port 3000)
6. ⏳ Add password encryption (bcrypt)

---

### **STEP 1: Automation - Data Collection** (NEW)
**Status**: 0% Complete
**Priority**: CRITICAL (Core value proposition)

#### Objective
Connect to selected devices and execute show commands to collect network state data.

#### Technology Stack
- **Netmiko**: For text-based command execution and output
- **pyATS/Genie**: For structured JSON data extraction

#### Commands to Execute

```python
COMMANDS = [
    "terminal length 0",           # Disable pagination
    "show process cpu",            # CPU utilization
    "show process memory",         # Memory usage
    "show route connected",        # Connected routes
    "show route ospf",             # OSPF routes
    "show ospf database",          # OSPF LSA database
    "show ospf database self-originate",  # Self-originated LSAs
    "show cdp neighbor"            # CDP neighbors
]
```

####Output Storage Structure

```
/IOSXRV-TEXT/              # Raw text outputs
  ├── usa-r1_show_process_cpu_2025-11-22_14-30-15.txt
  ├── usa-r1_show_process_memory_2025-11-22_14-30-16.txt
  ├── usa-r1_show_route_connected_2025-11-22_14-30-17.txt
  ├── usa-r1_show_route_ospf_2025-11-22_14-30-18.txt
  ├── usa-r1_show_ospf_database_2025-11-22_14-30-19.txt
  ├── usa-r1_show_ospf_database_self-originate_2025-11-22_14-30-20.txt
  └── usa-r1_show_cdp_neighbor_2025-11-22_14-30-21.txt

/IOSXRV-JSON/              # Structured JSON outputs (pyATS parsed)
  ├── usa-r1_show_process_cpu_2025-11-22_14-30-15.json
  ├── usa-r1_show_process_memory_2025-11-22_14-30-16.json
  ├── usa-r1_show_route_connected_2025-11-22_14-30-17.json
  ├── usa-r1_show_route_ospf_2025-11-22_14-30-18.json
  ├── usa-r1_show_ospf_database_2025-11-22_14-30-19.json
  ├── usa-r1_show_ospf_database_self-originate_2025-11-22_14-30-20.json
  └── usa-r1_show_cdp_neighbor_2025-11-22_14-30-21.json
```

#### User Interface (Automation Page)

**Page Location**: Navigation → "Automation"

**UI Components**:
1. **Device Selection Panel**
   - Multi-select checkbox list of devices from Device Manager
   - "Select All" / "Select None" buttons
   - Show connection status (Connected/Disconnected)

2. **Command Execution Panel**
   - "Execute All Commands" button (runs all 7 commands)
   - Individual command buttons (for single command execution)
   - Progress indicator (X/Y devices completed)
   - Real-time output log viewer

3. **Results Panel**
   - Success/Failure summary per device
   - Download links for generated files
   - View button to open file viewer modal

#### Backend API Endpoints

```python
POST /api/automation/connect/{device_id}
POST /api/automation/execute
  {
    "device_ids": ["usa-r1", "usa-r2"],
    "commands": ["show process cpu", "show process memory"]
  }

GET  /api/automation/status/{session_id}
GET  /api/automation/files?device={device_id}&type=text|json
GET  /api/automation/download/{filename}
POST /api/automation/disconnect/{device_id}
```

#### File Processing Workflow

```
1. User selects devices → Frontend
2. User clicks "Execute All Commands" → API Call
3. Backend connects via Netmiko → SSH Connection
4. Execute each command → Capture output
5. Save text output → IOSXRV-TEXT/{device}_{command}_{timestamp}.txt
6. Parse with pyATS/Genie → Structured data
7. Save JSON output → IOSXRV-JSON/{device}_{command}_{timestamp}.json
8. Return success/failure per device → Frontend updates UI
9. User can download or view files
```

---

### **STEP 2: Data Save & Viewing** (NEW)
**Status**: 0% Complete
**Priority**: HIGH

#### Objective
Provide a web-based interface to browse, view, and download collected data files.

#### Features

1. **File Browser**
   - Tree view of IOSXRV-TEXT and IOSXRV-JSON folders
   - Filter by: Device, Command, Date, Type
   - Sort by: Timestamp, Device Name, File Size
   - Search functionality

2. **File Viewer**
   - **Text Files**: Syntax-highlighted code viewer
   - **JSON Files**: Collapsible JSON tree viewer (like JSON.stringify with pretty print)
   - Side-by-side comparison view (compare two files)
   - Export to CSV for structured data

3. **Download Options**
   - Download individual file
   - Download all files for a device (ZIP)
   - Download all files for a time range (ZIP)

#### UI Location
**Page**: Navigation → "Data Save"

**Layout**:
```
+------------------+-------------------------+
| File Tree        | File Viewer             |
| [IOSXRV-TEXT]    | [Content Display]       |
|  └─ usa-r1       |                         |
|     ├─ cpu.txt   | Code/JSON viewer        |
|     ├─ mem.txt   | with syntax highlight   |
| [IOSXRV-JSON]    |                         |
|  └─ usa-r1       | Download button         |
|     ├─ cpu.json  | Compare button          |
+------------------+-------------------------+
```

#### Backend API Endpoints

```python
GET  /api/files/list?folder=text|json&device={device}
GET  /api/files/view/{filename}
GET  /api/files/download/{filename}
POST /api/files/download/bulk
  {
    "files": ["file1.txt", "file2.json"],
    "format": "zip"
  }
GET  /api/files/compare?file1={}&file2={}
```

---

### **STEP 3: Data Transformation - Network Topology** (NEW)
**Status**: 0% Complete
**Priority**: HIGH

#### Objective
Transform raw OSPF data into a structured network topology JSON for visualization.

#### Input Data Sources
- `show ospf database` (all LSAs)
- `show cdp neighbor` (physical connections)
- `show ospf neighbor` (OSPF adjacencies)

#### Output Format

**Target JSON Structure**:
```json
{
  "nodes": [
    {
      "id": "usa-r1",
      "name": "usa-r1",
      "hostname": "usa-r1",
      "loopback_ip": "172.16.1.1",
      "country": "USA",
      "is_active": true,
      "node_type": "router",
      "neighbor_count": 4
    }
  ],
  "links": [
    {
      "source": "usa-r1",
      "target": "usa-r2",
      "source_interface": "FastEthernet0/1",
      "target_interface": "FastEthernet0/1",
      "cost": 10,
      "original_cost": 10,
      "status": "up",
      "index": 0
    }
  ],
  "timestamp": "2025-11-22T14:30:15.123Z",
  "metadata": {
    "node_count": 10,
    "edge_count": 28,
    "data_source": "pyats",
    "snapshot_timestamp": "2025-11-22T14:30:15.123Z",
    "layout_algorithm": "force_directed"
  }
}
```

#### Processing Steps

1. **Parse OSPF Database**
   - Extract Router LSAs (Type 1)
   - Extract Network LSAs (Type 2)
   - Build router list with Router IDs

2. **Parse CDP/OSPF Neighbors**
   - Identify direct connections
   - Map interface to interface relationships
   - Extract OSPF cost metrics

3. **Build Node List**
   - Router ID → Hostname mapping
   - Extract loopback IPs
   - Country from hostname prefix (usa-, deu-, gbr-, etc.)
   - Count neighbors per node

4. **Build Link List**
   - Source/Target router pairs
   - Interface names on both ends
   - OSPF cost (for link weight)
   - Link status (up/down)

5. **Generate Topology JSON**
   - Combine nodes + links
   - Add metadata (timestamp, counts, data source)
   - Save to file: `network_topology_{timestamp}.json`

#### UI Location
**Page**: Navigation → "Transformation"

**Features**:
- **Input Selection**: Select data collection session to transform
- **Transformation Options**:
  - Include inactive nodes (yes/no)
  - Filter by country
  - Minimum link cost threshold
- **Output Preview**: JSON viewer with collapsible tree
- **Download Button**: Save topology JSON
- **Visualize Button**: Opens D3.js force-directed graph (future enhancement)

#### Backend API Endpoints

```python
POST /api/transform/topology
  {
    "session_id": "2025-11-22_14-30",
    "options": {
      "include_inactive": false,
      "filter_countries": ["USA", "GBR"],
      "min_link_cost": 10
    }
  }

GET  /api/transform/topology/{topology_id}
GET  /api/transform/topologies (list all generated topologies)
```

---

## 🏗️ TECHNICAL ARCHITECTURE

### Frontend Pages (React Components)

```
src/
├── App.tsx                          # Main app with routing
├── pages/
│   ├── DeviceManager.tsx            # Step 0 (existing)
│   ├── Automation.tsx               # Step 1 (NEW)
│   ├── DataSave.tsx                 # Step 2 (NEW)
│   ├── Transformation.tsx           # Step 3 (NEW)
│   └── About.tsx
├── components/
│   ├── DeviceTable.tsx              # (existing)
│   ├── AutomationPanel.tsx          # (NEW)
│   ├── CommandExecutor.tsx          # (NEW)
│   ├── FileTree.tsx                 # (NEW)
│   ├── FileViewer.tsx               # (NEW)
│   ├── TopologyViewer.tsx           # (NEW)
│   └── ErrorBoundary.tsx            # (NEW - critical fix)
```

### Backend Structure (Python FastAPI)

```
backend/
├── server.py                        # Main FastAPI app
├── requirements.txt
├── devices.db                       # SQLite database
├── modules/
│   ├── connection_manager.py        # Netmiko SSH connections (NEW)
│   ├── command_executor.py          # Execute commands (NEW)
│   ├── file_manager.py              # File save/retrieve (NEW)
│   ├── topology_builder.py          # OSPF → Topology JSON (NEW)
│   └── pyats_parser.py              # pyATS/Genie parsing (NEW)
├── data/
│   ├── IOSXRV-TEXT/                 # Text outputs
│   └── IOSXRV-JSON/                 # Structured JSON
└── logs/
    ├── app.log
    └── error.log
```

### Dependencies

**Python** (`requirements.txt`):
```
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
bcrypt==4.1.1
netmiko==4.3.0         # SSH for text extraction
pyats==23.11           # Network data parsing
genie==23.11           # pyATS parsers
```

**Node.js** (`package.json` - frontend only):
```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^6.20.0"  // For multi-page routing
  }
}
```

---

## 🎯 SUCCESS CRITERIA

### Step 0: Device Manager
- ✅ CRUD operations work flawlessly
- ✅ All 10 real routers loaded in database
- ✅ No crashes (Error Boundary in place)
- ✅ State persistence syncs with backend
- ✅ Passwords encrypted with bcrypt

### Step 1: Automation
- ✅ Successfully connect to all 10 routers via SSH
- ✅ Execute all 7 commands on selected devices
- ✅ Generate text files in IOSXRV-TEXT folder
- ✅ Generate JSON files in IOSXRV-JSON folder
- ✅ Handle connection failures gracefully
- ✅ Progress indicator shows real-time status
- ✅ Can execute on multiple devices in parallel

### Step 2: Data Save
- ✅ File browser shows all collected files
- ✅ Can view text files with syntax highlighting
- ✅ Can view JSON files with tree viewer
- ✅ Download individual files
- ✅ Download bulk files as ZIP
- ✅ Search and filter work correctly

### Step 3: Transformation
- ✅ Parse OSPF data into topology JSON
- ✅ Topology matches sample format exactly
- ✅ All nodes have correct attributes
- ✅ All links have correct source/target/cost
- ✅ Can download generated topology JSON
- ✅ Preview shows valid JSON structure

---

## 📅 IMPLEMENTATION TIMELINE

### Phase 1: Foundation (Week 1)
- Day 1-2: Fix Step 0 critical issues
  - Remove duplicate backend
  - Replace mock devices with real 10 routers
  - Add Error Boundary
  - Fix state persistence
  - Add password encryption

### Phase 2: Automation (Week 1-2)
- Day 3-4: Implement Netmiko SSH connections
  - connection_manager.py
  - command_executor.py
  - Backend API endpoints
- Day 5-6: Implement pyATS/Genie parsing
  - pyats_parser.py
  - JSON file generation
- Day 7-8: Build Automation UI
  - Automation.tsx page
  - Device selection panel
  - Command execution interface
  - Progress tracking

### Phase 3: Data Save (Week 2)
- Day 9-10: Implement file management
  - file_manager.py
  - File listing API
  - File download API
- Day 11-12: Build Data Save UI
  - DataSave.tsx page
  - FileTree component
  - FileViewer component
  - Download functionality

### Phase 4: Transformation (Week 3)
- Day 13-14: Implement topology builder
  - topology_builder.py
  - Parse OSPF database
  - Parse CDP/OSPF neighbors
  - Generate topology JSON
- Day 15-16: Build Transformation UI
  - Transformation.tsx page
  - TopologyViewer component
  - Download functionality

### Phase 5: Testing & Polish (Week 3-4)
- Day 17-18: End-to-end testing
  - Test all workflows
  - Fix bugs
  - Performance optimization
- Day 19-20: Documentation & Deployment
  - Update README
  - Write user guide
  - Deploy to production

---

## 🔒 SECURITY CONSIDERATIONS

1. **Password Storage**: Use bcrypt for device passwords
2. **SSH Key Authentication**: Future enhancement (instead of password)
3. **File Access Control**: Validate file paths to prevent directory traversal
4. **Input Validation**: Sanitize all user inputs
5. **Rate Limiting**: Prevent API abuse
6. **HTTPS**: Enable TLS in production
7. **Authentication**: Add user login (future enhancement)

---

## 📈 FUTURE ENHANCEMENTS (Post-MVP)

1. **Real-time Topology Visualization**: D3.js force-directed graph
2. **Scheduled Automation**: Cron jobs for regular data collection
3. **Alerting**: Email/Slack notifications on device failures
4. **Historical Data**: Track topology changes over time
5. **Multi-vendor Support**: Add support for Juniper, Arista, etc.
6. **API for External Integration**: RESTful API for third-party tools
7. **Network Configuration**: Push config changes to devices
8. **Compliance Checking**: Validate device configurations

---

## ✅ ACCEPTANCE CRITERIA

**Definition of Done**:
- All features implemented and tested
- No critical bugs
- Documentation complete
- Code reviewed and approved
- Deployed to production environment
- User training completed

---

**PRD Approved By**: Network Engineering Team
**Implementation Start**: 2025-11-22
**Target Completion**: 2025-12-13 (3 weeks)

