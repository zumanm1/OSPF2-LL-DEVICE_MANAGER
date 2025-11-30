# 📖 OSPF Network Device Manager - User Manual

**Version**: 1.0.0  
**Date**: November 29, 2025  
**Status**: Production-Ready  

---

## 🎯 Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [User Interface Overview](#3-user-interface-overview)
4. [Device Management](#4-device-management)
5. [Network Automation](#5-network-automation)
6. [Jumphost Configuration](#6-jumphost-configuration)
7. [OSPF Topology Visualization](#7-ospf-topology-visualization)
8. [Data Management & Export](#8-data-management--export)
9. [User Administration](#9-user-administration)
10. [Troubleshooting](#10-troubleshooting)
11. [Best Practices](#11-best-practices)
12. [Advanced Features](#12-advanced-features)
13. [Appendix](#13-appendix)

---

## 1. Introduction

### 1.1 What is OSPF Network Device Manager?

OSPF Network Device Manager is a **modern, web-based application** for automating network device management tasks with a focus on OSPF (Open Shortest Path First) protocol operations. Built with React 19 and Python FastAPI, it provides an intuitive interface for managing Cisco routers, executing commands, and visualizing network topology.

### 1.2 Key Features

- ✅ **Multi-Device Management**: Add, configure, and organize network devices
- ✅ **Real-Time Automation**: Execute commands on multiple devices simultaneously
- ✅ **Jumphost Support**: Secure access via SSH bastion hosts
- ✅ **Live Progress Tracking**: WebSocket-based real-time job monitoring
- ✅ **OSPF Topology Visualization**: Interactive network diagrams
- ✅ **Data Collection & Export**: Save command outputs in TEXT/JSON/CSV formats
- ✅ **Role-Based Access Control**: Admin, Operator, and Viewer roles
- ✅ **Password Encryption**: Fernet (AES-128) encryption for device credentials
- ✅ **Beautiful UI**: Modern glassmorphism design with React 19

### 1.3 System Requirements

**Minimum Requirements:**
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Network**: Access to target network devices
- **SSH**: Port 22 accessible to devices/jumphost

**Server Requirements (for hosting):**
- **OS**: Ubuntu 20.04+, macOS 11+, Windows 10+
- **Python**: 3.9 or higher
- **Node.js**: 18.0 or higher
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 1GB minimum

### 1.4 Supported Devices

**Cisco Platforms:**
- IOS XR (ASR9000, NCS5000, CRS, XR12000)
- IOS (Catalyst, ISR, ASR1000)
- IOS-XE (CSR1000v, ASR1000)
- NX-OS (Nexus Series)

**Other Vendors:**
- Juniper JUNOS
- Arista EOS
- Generic SSH/Telnet devices

---

## 2. Getting Started

### 2.1 Accessing the Application

#### Option A: Local Deployment
```
URL: http://localhost:9050
```

#### Option B: Remote Server
```
URL: http://172.16.39.172:9050  (replace with your server IP)
```

### 2.2 First Time Login

1. **Navigate** to the application URL in your browser
2. **Default Credentials:**
   - Username: `admin`
   - Password: `admin` (or configured password)
3. Click **Login**

> **⚠️ Security Notice**: Change the default password immediately after first login!

### 2.3 User Interface Orientation

Upon successful login, you'll see the main dashboard with 5 primary sections:

1. **Device Manager** 🖥️ - Manage network devices
2. **Automation** ⚡ - Execute commands and jobs
3. **Topology** 🌐 - Visualize OSPF network
4. **Data Save** 💾 - Browse collected data
5. **Admin** 👤 - User management (admin only)

---

## 3. User Interface Overview

### 3.1 Navigation Bar

Located at the top of the application:

```
┌─────────────────────────────────────────────────────────────┐
│ 🌐 OSPF Manager  │ Devices │ Automation │ Topology │ Data │
│                  │ Admin │ Logout │ User: admin (Admin) │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Page Layouts

#### Device Manager Page
```
┌──────────────────────────────────────────────────────┐
│  🔍 Search  │  ➕ Add Device  │  🗑️ Delete Selected  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📋 Device List (Table View)                        │
│  ┌───┬────────────┬──────────┬────────┬─────────┐  │
│  │ ☑ │ Name       │ IP       │ Type   │ Actions │  │
│  ├───┼────────────┼──────────┼────────┼─────────┤  │
│  │ ☐ │ router-01  │ 10.0.0.1 │ PE     │ ✏️ 🗑️  │  │
│  │ ☐ │ router-02  │ 10.0.0.2 │ P      │ ✏️ 🗑️  │  │
│  └───┴────────────┴──────────┴────────┴─────────┘  │
│                                                      │
│  Showing 1-10 of 25 devices │ [1] 2 3 ...         │
└──────────────────────────────────────────────────────┘
```

#### Automation Page
```
┌──────────────────────────────────────────────────────┐
│  Step 1: Select Devices (10 selected)               │
│  Step 2: Select Commands (5 OSPF commands)          │
│  Step 3: Execute                                     │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🔌 Connect Devices                          │   │
│  │ ⚡ Start Automation                         │   │
│  │ 🔌 Disconnect All                           │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  📊 Live Progress:                                  │
│  ████████████░░░░░░░░ 65% (13/20 devices)          │
│                                                      │
│  📝 Recent Jobs:                                    │
│  [Job #12345] 15:30 - Completed - 20 devices       │
└──────────────────────────────────────────────────────┘
```

### 3.3 Design Elements

**Color Scheme:**
- **Primary**: Blue gradient (`#3b82f6` → `#2563eb`)
- **Success**: Green (`#10b981`)
- **Error**: Red (`#ef4444`)
- **Warning**: Yellow (`#f59e0b`)

**Visual Effects:**
- **Glassmorphism**: Translucent panels with blur
- **Hover States**: Smooth animations on interactive elements
- **Loading Indicators**: Spinner animations during operations
- **Toast Notifications**: Top-right corner alerts

---

## 4. Device Management

### 4.1 Adding a Device

**Step-by-Step:**

1. Click **➕ Add Device** button (top-right)
2. Fill in the device form:

```
┌─────────────────────────────────────────┐
│         Add New Device                  │
├─────────────────────────────────────────┤
│ Device Name: * ___________________      │
│ IP Address: * ___________________       │
│ Protocol: * [SSH ▼]                     │
│ Port: * [22____]                        │
│ Username: * ___________________          │
│ Password: * ___________________          │
│ Country: * [Select ▼]                   │
│ Device Type: * [PE ▼]                   │
│ Platform: * [ASR9000 ▼]                 │
│ Software: * [IOS XR ▼]                  │
│ Tags: [Optional] ___________________    │
│                                         │
│  [Cancel]  [Save Device]                │
└─────────────────────────────────────────┘
```

3. Click **Save Device**
4. Device appears in the device list

**Field Descriptions:**

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| Device Name | Unique hostname | Yes | `zwe-hra-pop-p01` |
| IP Address | Management IP | Yes | `172.20.0.11` |
| Protocol | Connection method | Yes | SSH, Telnet |
| Port | Service port | Yes | 22 (SSH), 23 (Telnet) |
| Username | Login username | Yes* | `cisco` |
| Password | Login password | Yes* | `cisco` |
| Country | Geographic location | Yes | Zimbabwe, USA, etc. |
| Device Type | Router role | Yes | PE, P, RR |
| Platform | Hardware model | Yes | ASR9903, CSR1000v |
| Software | Operating system | Yes | IOS XR, IOS, NX-OS |
| Tags | Metadata labels | No | `backbone`, `core` |

> **Note**: *Username/Password can be left empty if using jumphost credentials

### 4.2 Editing a Device

1. Locate device in list
2. Click **✏️ Edit** icon
3. Modify fields
4. Click **Save**

### 4.3 Deleting Devices

**Single Device:**
1. Click **🗑️ Delete** icon next to device
2. Confirm deletion

**Bulk Delete:**
1. Select multiple devices using checkboxes
2. Click **🗑️ Delete Selected** button
3. Confirm bulk deletion

### 4.4 Searching & Filtering

**Search Bar:**
```
🔍 Search by name, IP, country...
```

- Type to filter devices in real-time
- Searches: Name, IP, Country, Device Type, Tags

**Filters:**
- **Country**: Dropdown filter by country
- **Device Type**: Filter by PE, P, RR
- **Software**: Filter by IOS XR, IOS, NX-OS

### 4.5 Importing Devices (Bulk)

**CSV Import:**
1. Prepare CSV file with columns:
   ```csv
   deviceName,ipAddress,protocol,port,username,password,country,deviceType,platform,software,tags
   router-01,172.20.0.11,SSH,22,cisco,cisco,Zimbabwe,PE,ASR9903,IOS XR,"backbone,core"
   ```

2. Click **Import** button
3. Select CSV file
4. Review preview
5. Click **Import Devices**

**JSON Import:**
```json
[
  {
    "id": "r1",
    "deviceName": "router-01",
    "ipAddress": "172.20.0.11",
    "protocol": "SSH",
    "port": 22,
    "username": "cisco",
    "password": "cisco",
    "country": "Zimbabwe",
    "deviceType": "PE",
    "platform": "ASR9903",
    "software": "IOS XR",
    "tags": ["backbone", "core"]
  }
]
```

### 4.6 Exporting Devices

**Export Options:**
- **CSV**: Excel-compatible format
- **JSON**: API-compatible format
- **PDF**: Printable device inventory

**Steps:**
1. Click **Export** button
2. Select format (CSV/JSON/PDF)
3. File downloads automatically

---

## 5. Network Automation

### 5.1 Automation Workflow

The automation process follows 3 simple steps:

```
1. Select Devices → 2. Choose Commands → 3. Execute & Monitor
```

### 5.2 Selecting Devices

**Method 1: Individual Selection**
- Check boxes next to desired devices

**Method 2: Bulk Selection**
- Click **Select All** to select all devices
- Click **Select by Country** for geographic filtering
- Click **Select by Type** for role-based filtering

**Selection Counter:**
```
✅ 10 devices selected
```

### 5.3 Choosing Commands

**Pre-Configured Command Sets:**

#### OSPF Commands (Default)
- `show version`
- `show running-config`
- `show ip ospf neighbor`
- `show ip ospf database`
- `show ip ospf interface brief`
- `show mpls ldp neighbor`
- `show bgp summary`

#### Interface Commands
- `show ip interface brief`
- `show interface description`
- `show interface status`

#### Routing Commands
- `show ip route`
- `show ip route summary`
- `show ip protocols`

**Custom Commands:**
1. Click **➕ Add Custom Command**
2. Enter command text
3. Click **Add**

Example custom commands:
```
show logging
show clock
show processes cpu
show memory summary
```

### 5.4 Connection Management

#### Connect to Devices

1. Select devices (checkboxes)
2. Click **🔌 Connect Devices**
3. Watch connection status:

```
┌─────────────────────────────────────┐
│  Connecting to devices...           │
│  ████████████░░░░░░░░ 65% (13/20)  │
│                                     │
│  ✅ router-01 (172.20.0.11)        │
│  ✅ router-02 (172.20.0.12)        │
│  ⏳ router-03 (172.20.0.13)        │
│  ❌ router-04 (connection failed)  │
└─────────────────────────────────────┘
```

**Connection Modes:**
- **Parallel** (Default): Connect to all devices simultaneously (faster)
- **Sequential**: Connect one-by-one (safer, slower)

#### Disconnect from Devices

- **Single Device**: Click disconnect icon next to connected device
- **All Devices**: Click **🔌 Disconnect All** button

### 5.5 Executing Automation Jobs

**Start Automation:**
1. Ensure devices are connected (green status)
2. Select commands to execute
3. Click **⚡ Start Automation**

**Job Configuration:**

```
┌────────────────────────────────────┐
│  Batch Size: [10____] devices      │
│  Rate Limit: [0_____] dev/hour     │
│  (0 = no limit)                    │
│                                    │
│  [Start Automation]                │
└────────────────────────────────────┘
```

- **Batch Size**: Number of devices per batch (0 = no batching)
- **Rate Limit**: Maximum devices per hour (0 = unlimited)

### 5.6 Monitoring Job Progress

**Real-Time Progress Bar:**
```
📊 Job Progress:
████████████████████ 100% (20/20 devices)

⏱️ Elapsed Time: 00:03:45
🎯 Completed: 20/20 devices
✅ Success: 18
❌ Failed: 2
```

**Live Log Stream:**
```
[15:30:01] 🔌 Connecting to router-01 (172.20.0.11)...
[15:30:02] ✅ Connected to router-01
[15:30:02] 📡 Executing: show version
[15:30:05] ✅ Command completed (3.2s)
[15:30:05] 💾 Saved to: router-01_show_version_20251129_153005.txt
```

**Job Status Indicators:**
- 🟢 **Running**: Job in progress
- 🔵 **Queued**: Waiting in batch queue
- ✅ **Completed**: Job finished successfully
- ❌ **Failed**: Job encountered errors
- ⏸️ **Paused**: Job manually paused
- 🛑 **Stopped**: Job manually stopped

### 5.7 Stopping/Pausing Jobs

**Stop Job:**
1. Click **🛑 Stop** button during execution
2. Confirm stop action
3. Devices disconnect automatically

**Pause Job:**
1. Click **⏸️ Pause** button
2. Resume with **▶️ Resume** button

### 5.8 Job History

**View Past Jobs:**
```
┌──────────────────────────────────────────────────┐
│  📝 Job History (Last 30 days)                   │
├──────────────────────────────────────────────────┤
│  Job #12345 │ Nov 29, 15:30 │ ✅ Completed      │
│  Devices: 20 │ Commands: 5 │ Duration: 3m 45s  │
│  [View Details] [Download Results] [Re-run]      │
│──────────────────────────────────────────────────│
│  Job #12344 │ Nov 29, 14:15 │ ✅ Completed      │
│  Job #12343 │ Nov 29, 12:00 │ ❌ Failed         │
└──────────────────────────────────────────────────┘
```

**Job Details:**
- Click **View Details** to see:
  - Complete command output for each device
  - Per-device execution time
  - Error messages (if any)
  - Downloaded file paths

---

## 6. Jumphost Configuration

### 6.1 What is a Jumphost?

A **jumphost** (also called bastion host) is an intermediate server used to access network devices in secure/isolated networks.

**Use Case:**
```
Your Computer → Internet → Jumphost → Private Network → Routers
```

Example:
```
MacBook (192.168.1.100)
    ↓
VM173 Jumphost (172.16.39.173) ← SSH Gateway
    ↓
Router Network (172.20.0.11-20) ← Accessible only via jumphost
```

### 6.2 Configuring Jumphost

**Navigate to Automation Page → Jumphost Section:**

```
┌─────────────────────────────────────────────┐
│  SSH Jumphost / Bastion Configuration      │
├─────────────────────────────────────────────┤
│  ☑ Enable Jumphost                         │
│                                             │
│  Host: * [172.16.39.173_______________]     │
│  Port: * [22___]                            │
│  Username: * [cisco_______________]         │
│  Password: * [••••••••••••]                 │
│                                             │
│  [Test Connection]  [Save Configuration]    │
└─────────────────────────────────────────────┘
```

**Steps:**
1. Check **☑ Enable Jumphost**
2. Enter jumphost details:
   - **Host**: IP address or hostname
   - **Port**: SSH port (usually 22)
   - **Username**: SSH username
   - **Password**: SSH password
3. Click **Test Connection** to verify
4. Click **Save Configuration**

### 6.3 Testing Jumphost Connection

Click **Test Connection** button:

**Success:**
```
✅ Jumphost connection successful
Connected to 172.16.39.173:22
Authentication: OK
```

**Failure:**
```
❌ Jumphost connection failed
Error: Connection timeout
Please check:
- Host IP/hostname is correct
- Port 22 is open
- Credentials are valid
- Network connectivity exists
```

### 6.4 How Jumphost Works

**Normal Connection (Without Jumphost):**
```
Application → Router (Direct SSH)
```

**With Jumphost:**
```
Application → Jumphost (SSH Tunnel) → Router (SSH via tunnel)
```

**Credential Inheritance:**
- If device has no username/password configured, it uses jumphost credentials
- Useful when all routers share same credentials as jumphost

---

## 7. OSPF Topology Visualization

### 7.1 Generating Topology

**Steps:**
1. Navigate to **Topology** page
2. Click **Generate Topology** button
3. Wait for processing (10-30 seconds)
4. Interactive topology diagram appears

**Topology Builder Process:**
```
1. Parsing command outputs ───→ 2. Extract OSPF neighbors
                                      ↓
4. Render interactive graph ←─── 3. Build node/link data
```

### 7.2 Topology Visualization

**Interactive Features:**

```
┌─────────────────────────────────────────────┐
│  🔍 Zoom │ 🔄 Reset │ 💾 Export │ 🎨 Layout │
├─────────────────────────────────────────────┤
│                                             │
│         ⚫ router-01 (PE)                   │
│        /  \                                 │
│       /    \                                │
│  ⚫ r-02   ⚫ r-03                          │
│   (P)      (P)                              │
│     \      /                                │
│      \    /                                 │
│       ⚫ r-04 (RR)                          │
│                                             │
│  Legend:                                    │
│  ⚫ PE (Provider Edge)                      │
│  ⚫ P  (Provider Core)                      │
│  ⚫ RR (Route Reflector)                    │
│  ─── OSPF Adjacency                        │
└─────────────────────────────────────────────┘
```

**Mouse Controls:**
- **Click & Drag Node**: Move node position
- **Mouse Wheel**: Zoom in/out
- **Click Node**: Show device details
- **Hover Link**: Show OSPF cost

**Keyboard Shortcuts:**
- **R**: Reset view
- **F**: Fit to screen
- **+/-**: Zoom in/out
- **Spacebar**: Pause/resume force simulation

### 7.3 Topology Layouts

**Available Layouts:**

1. **Force-Directed** (Default)
   - Automatic node positioning
   - Physics-based simulation
   - Best for organic layouts

2. **Hierarchical**
   - Top-down tree structure
   - Clear parent-child relationships
   - Best for hierarchical networks

3. **Circular**
   - Nodes arranged in circle
   - Equal spacing
   - Best for ring topologies

4. **Grid**
   - Regular grid pattern
   - Predictable positioning
   - Best for documentation

### 7.4 Node Information

**Click on a node to view:**
```
┌──────────────────────────────┐
│  router-01 (zwe-hra-pop-p01) │
├──────────────────────────────┤
│  Type: PE (Provider Edge)    │
│  IP: 172.20.0.11             │
│  Country: Zimbabwe           │
│  Platform: ASR9903           │
│  Software: IOS XR            │
│                              │
│  OSPF Neighbors: 3           │
│  - router-02 (cost: 10)      │
│  - router-03 (cost: 20)      │
│  - router-04 (cost: 15)      │
│                              │
│  [View Device] [SSH Connect] │
└──────────────────────────────┘
```

### 7.5 Exporting Topology

**Export Options:**
- **PNG**: Image file
- **SVG**: Vector graphics
- **JSON**: Raw topology data
- **PDF**: Printable diagram

**Steps:**
1. Click **💾 Export** button
2. Select format
3. File downloads automatically

---

## 8. Data Management & Export

### 8.1 Browsing Collected Data

**Navigate to Data Save Page:**

```
┌────────────────────────────────────────────────┐
│  📁 Collected Data                             │
├────────────────────────────────────────────────┤
│  [TEXT Files]  [JSON Files]  [All Executions] │
│                                                │
│  Filter by Device: [Select Device ▼]          │
│  Filter by Command: [Select Command ▼]        │
│                                                │
│  📄 router-01_show_version_20251129_153005.txt │
│  📄 router-01_show_ospf_neighbor_...txt       │
│  📄 router-02_show_version_...txt             │
│                                                │
│  Showing 1-50 of 245 files                    │
│  [1] 2 3 4 ... 5 [Next]                       │
└────────────────────────────────────────────────┘
```

### 8.2 File Organization

**Directory Structure:**
```
data/
├── executions/
│   ├── 20251129_153005/  ← Execution timestamp
│   │   ├── TEXT/
│   │   │   ├── router-01_show_version.txt
│   │   │   ├── router-01_show_ospf_neighbor.txt
│   │   │   └── ...
│   │   ├── JSON/
│   │   │   ├── router-01_show_version.json
│   │   │   └── ...
│   │   └── metadata.json  ← Job metadata
│   └── current → 20251129_153005/  ← Symlink to latest
└── OUTPUT-Transformation/
    └── topology_data.json
```

**File Naming Convention:**
```
{deviceName}_{commandName}_{timestamp}.{ext}

Example:
zwe-hra-pop-p01_show_version_20251129_153005.txt
```

### 8.3 Viewing File Content

**Click on a file to view:**

```
┌────────────────────────────────────────────────┐
│  📄 router-01_show_version_20251129_153005.txt │
├────────────────────────────────────────────────┤
│  Device: router-01 (172.20.0.11)               │
│  Command: show version                         │
│  Timestamp: 2025-11-29 15:30:05                │
│  Size: 2.3 KB                                  │
│                                                │
│  [Download] [Copy] [Share] [Delete]            │
├────────────────────────────────────────────────┤
│  Cisco IOS XR Software, Version 7.3.2          │
│  Copyright (c) 2013-2021 by Cisco Systems, Inc│
│                                                │
│  ROM: GRUB 2.02                                │
│                                                │
│  zwe-hra-pop-p01 uptime is 45 weeks, 3 days... │
│  System image file is "disk0:asr9k-os-..."    │
│  ...                                           │
└────────────────────────────────────────────────┘
```

**File Actions:**
- **Download**: Save file to local computer
- **Copy**: Copy content to clipboard
- **Share**: Generate shareable link
- **Delete**: Remove file permanently

### 8.4 Searching Files

**Search Options:**
- **By Device Name**: `zwe-hra-pop-p01`
- **By Command**: `show version`
- **By Date Range**: `2025-11-01` to `2025-11-30`
- **By File Size**: Larger than `1 MB`

### 8.5 Exporting Data

**Bulk Export:**
1. Select files (checkboxes)
2. Click **Export Selected**
3. Choose format:
   - **ZIP**: Compressed archive
   - **TAR.GZ**: Compressed tarball
   - **Single PDF**: Merged document

**Full Export:**
1. Click **Export All**
2. Select execution folder
3. Downloads complete execution data

### 8.6 Data Retention

**Default Retention:** 90 days

**Manual Cleanup:**
1. Navigate to Data Save page
2. Click **Cleanup** button
3. Select retention period:
   - Delete files older than 30 days
   - Delete files older than 60 days
   - Delete files older than 90 days
4. Confirm cleanup

---

## 9. User Administration

### 9.1 User Roles

**Three Role Levels:**

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, devices, jobs, settings |
| **Operator** | Execute automation, view devices, cannot delete |
| **Viewer** | Read-only access, view dashboards and data |

**Detailed Permissions:**

```
Admin Permissions:
✅ users.* (create, update, delete, list)
✅ devices.* (create, update, delete, list)
✅ automation.* (connect, execute, disconnect, jobs)
✅ topology.* (generate, view, export)
✅ files.* (view, download, delete)
✅ settings.* (jumphost, environment)

Operator Permissions:
✅ devices.list, devices.view
✅ automation.* (full automation access)
✅ topology.view
✅ files.view, files.download

Viewer Permissions:
✅ devices.list, devices.view
✅ topology.view
✅ files.view
```

### 9.2 Managing Users (Admin Only)

**Navigate to Admin → Users:**

```
┌─────────────────────────────────────────────┐
│  👥 User Management                         │
├─────────────────────────────────────────────┤
│  [➕ Create User]                           │
│                                             │
│  Username  │ Role     │ Status  │ Actions  │
│  ─────────────────────────────────────────  │
│  admin     │ Admin    │ Active  │ ✏️ 🗑️   │
│  operator1 │ Operator │ Active  │ ✏️ 🗑️   │
│  viewer1   │ Viewer   │ Inactive│ ✏️ 🗑️   │
└─────────────────────────────────────────────┘
```

### 9.3 Creating a User

**Steps:**
1. Click **➕ Create User**
2. Fill user form:

```
┌───────────────────────────────┐
│  Create New User              │
├───────────────────────────────┤
│  Username: * _____________    │
│  Password: * _____________    │
│  Role: * [Operator ▼]         │
│  Email: (optional) ________   │
│                               │
│  [Cancel] [Create User]       │
└───────────────────────────────┘
```

3. Click **Create User**

### 9.4 Editing Users

1. Click **✏️ Edit** icon
2. Modify fields (username cannot be changed)
3. Click **Save**

### 9.5 Deleting Users

1. Click **🗑️ Delete** icon
2. Confirm deletion
3. User removed (cannot delete yourself!)

### 9.6 Password Management

**Change Your Password:**
1. Click username in navbar
2. Select **Change Password**
3. Enter current password
4. Enter new password (twice)
5. Click **Change Password**

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

---

## 10. Troubleshooting

### 10.1 Common Issues

#### Issue: Cannot Login

**Symptoms:**
- "Invalid credentials" error
- Login button unresponsive

**Solutions:**
1. Verify credentials (default: admin/admin)
2. Check CAPS LOCK is off
3. Clear browser cache and cookies
4. Try incognito/private mode
5. Contact administrator for password reset

#### Issue: Devices Won't Connect

**Symptoms:**
- "Connection timeout" error
- "Authentication failed" error

**Solutions:**
1. **Check Network Connectivity:**
   ```
   ping 172.20.0.11
   ```

2. **Verify SSH Access:**
   ```
   ssh cisco@172.20.0.11
   ```

3. **Check Jumphost Configuration** (if enabled):
   - Test jumphost connection
   - Verify jumphost credentials
   - Ensure jumphost can reach devices

4. **Verify Device Credentials:**
   - Username/password correct
   - Account not locked
   - SSH enabled on device

5. **Check Firewall Rules:**
   - Port 22 open
   - No IP blocking

#### Issue: Automation Jobs Fail

**Symptoms:**
- Jobs stuck at "Running"
- "Command execution failed" errors

**Solutions:**
1. **Check Device Connection:**
   - Ensure devices are connected (green status)
   - Try disconnecting and reconnecting

2. **Verify Command Syntax:**
   - Test commands manually via SSH
   - Check for typos in custom commands

3. **Review Job Logs:**
   - Click job in history
   - Check error messages
   - Look for timeout errors

4. **Increase Timeout:**
   - Edit backend settings
   - Increase command timeout value

#### Issue: Topology Not Generating

**Symptoms:**
- "Topology generation failed" error
- Empty topology diagram

**Solutions:**
1. **Ensure Data Collected:**
   - Run automation first
   - Collect OSPF neighbor data
   - Verify files in Data Save

2. **Check Required Commands:**
   - `show ip ospf neighbor`
   - `show ospf neighbor` (IOS XR)
   - At least 2 devices with OSPF data

3. **Review Parser Logs:**
   - Check backend logs
   - Look for parsing errors

4. **Regenerate Topology:**
   - Click **Generate Topology** again
   - Wait for completion

### 10.2 Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `Connection timeout` | Cannot reach device | Check network/firewall |
| `Authentication failed` | Wrong credentials | Verify username/password |
| `Permission denied` | Insufficient privileges | Check user role |
| `Command not found` | Invalid command | Verify command syntax |
| `Session expired` | Login timeout | Re-login to application |
| `Database error` | Backend issue | Contact administrator |

### 10.3 Browser Compatibility

**Recommended Browsers:**
- ✅ Chrome 90+ (Best experience)
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Known Issues:**
- ❌ Internet Explorer (Not supported)
- ⚠️ Safari < 14 (WebSocket issues)
- ⚠️ Chrome < 80 (CSS grid issues)

**Browser Cache Issues:**
1. Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac) to hard refresh
2. Clear browser cache completely
3. Open in incognito/private mode

### 10.4 Performance Issues

**Symptoms:**
- Slow page loading
- Laggy interface
- Jobs taking too long

**Solutions:**

1. **Check System Resources:**
   - Close unnecessary browser tabs
   - Restart browser
   - Check RAM usage

2. **Optimize Job Settings:**
   - Reduce batch size
   - Enable rate limiting
   - Run jobs during off-peak hours

3. **Network Optimization:**
   - Use wired connection (not Wi-Fi)
   - Check network latency
   - Avoid VPN if possible

4. **Database Maintenance:**
   - Clear old job history
   - Delete unused files
   - Compact database

---

## 11. Best Practices

### 11.1 Device Management Best Practices

✅ **Use Descriptive Device Names**
```
Good: zwe-hra-pop-p01, usa-nyc-dc1-pe05
Bad: router1, r1, test
```

✅ **Consistent Tagging**
```
Tags: backbone, core, edge, customer-facing
```

✅ **Regular Device Inventory Updates**
- Remove decommissioned devices
- Update IP addresses when changed
- Keep platform/software versions current

✅ **Credential Management**
- Use jumphost for centralized credentials
- Encrypt passwords (enabled by default)
- Rotate passwords regularly

### 11.2 Automation Best Practices

✅ **Start Small, Scale Up**
```
1. Test with 1-2 devices first
2. Then 5-10 devices
3. Finally run on all devices
```

✅ **Use Batch Processing for Large Networks**
```
Batch Size: 10 devices
Rate Limit: 60 devices/hour
```

✅ **Schedule Heavy Jobs During Maintenance Windows**
- Avoid production hours
- Run during low-traffic periods
- Notify team before large jobs

✅ **Monitor Job Progress**
- Watch real-time logs
- Check for errors immediately
- Stop job if issues detected

### 11.3 Data Management Best Practices

✅ **Regular Data Export**
- Weekly exports for important data
- Monthly full backups
- Store backups off-system

✅ **Organized File Naming**
- Use automatic timestamps
- Include device name in filename
- Consistent format

✅ **Data Retention Policy**
- Keep last 90 days of data
- Archive older data externally
- Delete unnecessary files

### 11.4 Security Best Practices

✅ **Strong Passwords**
```
❌ Bad: admin, password123
✅ Good: aX9#mK2$pL7!nQ5
```

✅ **Regular Password Changes**
- Admin: Every 30 days
- Operators: Every 60 days
- Viewers: Every 90 days

✅ **Role-Based Access**
- Give minimum necessary permissions
- Review user access quarterly
- Remove inactive users

✅ **Audit Logs**
- Review logs regularly
- Monitor failed login attempts
- Track device changes

### 11.5 Network Best Practices

✅ **Use Jumphost for Production Networks**
- Never expose management IPs
- Centralized access control
- Better security posture

✅ **Parallel vs Sequential Connection**
```
Parallel: 10 devices simultaneously (fast, more load)
Sequential: 1 device at a time (slow, gentle)
```

✅ **Connection Pooling**
- Keep connections alive between jobs
- Reuse connections when possible
- Disconnect when not needed

---

## 12. Advanced Features

### 12.1 API Access

**REST API Endpoint:**
```
Base URL: http://localhost:9051/api
```

**Authentication:**
```bash
curl -X POST http://localhost:9051/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```

**Common API Endpoints:**

```
GET    /api/devices           # List all devices
POST   /api/devices           # Create device
PUT    /api/devices/{id}      # Update device
DELETE /api/devices/{id}      # Delete device

POST   /api/automation/connect    # Connect to devices
POST   /api/automation/jobs       # Start automation job
GET    /api/automation/jobs/{id}  # Get job status

GET    /api/topology/latest       # Get topology data
POST   /api/transform/topology    # Generate topology
```

**API Documentation:**
```
http://localhost:9051/docs  (Swagger UI)
```

### 12.2 WebSocket Integration

**Connect to Real-Time Updates:**
```javascript
const ws = new WebSocket('ws://localhost:9051/ws/jobs/all');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Job update:', data);
};
```

**Event Types:**
- `connected`: WebSocket connection established
- `job_started`: Automation job started
- `job_progress`: Job progress update
- `job_completed`: Job finished
- `device_connected`: Device connection successful
- `device_error`: Device connection/execution error

### 12.3 Custom Command Sets

**Create Reusable Command Sets:**

1. Navigate to Automation page
2. Click **Command Sets** tab
3. Click **➕ Create Set**
4. Name and add commands:

```
Set Name: BGP Diagnostics
Commands:
- show bgp summary
- show bgp neighbors
- show bgp vpnv4 unicast summary
- show route-policy
```

5. Save set
6. Select from dropdown during automation

### 12.4 Scheduled Automation

**Set up Recurring Jobs:**

1. Create automation job
2. Click **Schedule** button
3. Configure schedule:

```
┌────────────────────────────┐
│  Schedule Job              │
├────────────────────────────┤
│  Frequency: [Daily ▼]      │
│  Time: [02:00___]          │
│  Days: ☑ Mon ☑ Tue ☐ Wed  │
│  Enabled: ☑                │
│                            │
│  [Cancel] [Save Schedule]  │
└────────────────────────────┘
```

4. Job runs automatically

### 12.5 Email Notifications

**Configure Email Alerts:**

1. Navigate to Settings → Notifications
2. Enable email notifications
3. Configure SMTP settings:

```
SMTP Server: smtp.gmail.com
Port: 587
Username: alerts@company.com
Password: ••••••••••
```

4. Set notification triggers:
   - Job completed
   - Job failed
   - Device unreachable
   - Daily summary

### 12.6 Custom Plugins

**Extend Functionality:**

**Parser Plugins:**
```python
# custom_parser.py
def parse_custom_output(text):
    # Custom parsing logic
    return parsed_data
```

**Export Plugins:**
```python
# custom_exporter.py
def export_to_format(data, format):
    # Custom export logic
    return exported_file
```

---

## 13. Appendix

### 13.1 Glossary

| Term | Definition |
|------|------------|
| **OSPF** | Open Shortest Path First - Link-state routing protocol |
| **PE** | Provider Edge - Router at customer edge |
| **P** | Provider - Core router in backbone |
| **RR** | Route Reflector - BGP route distribution |
| **Jumphost** | Intermediate server for secure access |
| **WebSocket** | Full-duplex communication protocol |
| **Batch Processing** | Processing devices in groups |
| **Rate Limiting** | Throttling request frequency |

### 13.2 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current form |
| `Ctrl+F` | Focus search box |
| `Ctrl+A` | Select all devices |
| `Esc` | Close modal/dialog |
| `Alt+D` | Go to Devices page |
| `Alt+A` | Go to Automation page |
| `Alt+T` | Go to Topology page |
| `Alt+S` | Go to Data Save page |

### 13.3 Default Ports

| Service | Port | Protocol |
|---------|------|----------|
| Frontend | 9050 | HTTP |
| Backend API | 9051 | HTTP |
| SSH | 22 | TCP |
| Telnet | 23 | TCP |

### 13.4 File Formats

**Supported Import Formats:**
- CSV (Comma-separated values)
- JSON (JavaScript Object Notation)
- Excel (XLSX)

**Supported Export Formats:**
- TEXT (Plain text)
- JSON (Structured data)
- CSV (Spreadsheet)
- PDF (Document)
- PNG/SVG (Images - topology)

### 13.5 Configuration Files

**Backend Configuration:**
```bash
backend/.env.local
```

**Frontend Configuration:**
```bash
src/config.ts
```

**Database Files:**
```bash
backend/devices.db
backend/automation.db
backend/topology.db
backend/datasave.db
```

### 13.6 Log Files

**Application Logs:**
```bash
logs/app.log         # Main application log
logs/error.log       # Errors only
logs/backend.log     # Backend API log
logs/frontend.log    # Frontend dev server log
```

### 13.7 Support & Resources

**Documentation:**
- User Manual: `USER_MANUAL.md`
- Production Guide: `PRODUCTION_READY_IMPLEMENTATION.md`
- Code Review: `ULTRA_DEEP_CODE_REVIEW_2025-11-29.md`

**Community:**
- GitHub Issues: Report bugs
- GitHub Discussions: Ask questions
- Stack Overflow: Tag `ospf-device-manager`

**Commercial Support:**
- Email: support@company.com
- Phone: +1-800-XXX-XXXX
- Hours: 9 AM - 5 PM EST

### 13.8 Changelog

**Version 1.0.0 (2025-11-29)**
- ✅ Initial production release
- ✅ Password encryption (Fernet/AES-128)
- ✅ API rate limiting
- ✅ Production CORS configuration
- ✅ Comprehensive documentation
- ✅ Real network E2E tests

**Upcoming Features (v1.1.0):**
- 🚧 Multi-vendor support expansion
- 🚧 Advanced topology editing
- 🚧 Custom dashboards
- 🚧 Mobile app
- 🚧 RBAC enhancements

---

## 📞 Getting Help

**Need Assistance?**

1. **Check this manual** - Most questions answered here
2. **Review logs** - `logs/error.log` for errors
3. **Search documentation** - Use Ctrl+F in this document
4. **Contact support** - support@company.com

**Before Contacting Support, Have Ready:**
- Application version
- Browser and OS version
- Error messages (screenshots)
- Steps to reproduce issue
- Log files (if applicable)

---

**Thank you for using OSPF Network Device Manager!** 🎉

**Version**: 1.0.0  
**Last Updated**: November 29, 2025  
**Document Revision**: 1.0

---

*This manual is subject to change. Check for updates regularly.*
