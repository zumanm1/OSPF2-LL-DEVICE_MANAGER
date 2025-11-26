# DATA ISOLATION & EXECUTION REPLAY - Implementation Plan

## Problem Statement

Currently, the application has no isolation between automation executions:
- ❌ All outputs saved to same directory (`data/OUTPUT-Data_save/TEXT/`)
- ❌ Files from different runs are mixed together
- ❌ No way to replay a specific past execution
- ❌ Topology generation uses "latest" files which may span multiple runs
- ❌ No audit trail of which devices were included in each run

## Requirements

1. **Execution Isolation**: Each automation run must store data in unique directory
2. **Metadata Tracking**: Store job details (timestamp, devices, commands, results)
3. **Execution Replay**: User can select and view any past execution
4. **Data Consistency**: Topology generation uses data from SINGLE execution only
5. **No Breaking Changes**: Existing functionality must continue to work

## Proposed Architecture

### Directory Structure

```
backend/data/
├── executions/
│   ├── exec_2025-11-24_194401_a1b2c3d4/
│   │   ├── metadata.json           # Execution details
│   │   ├── devices.json            # Device list snapshot
│   │   ├── TEXT/                   # Command outputs (text)
│   │   │   ├── zwe-r1_show_ospf_neighbor.txt
│   │   │   ├── zwe-r1_show_ospf_database.txt
│   │   │   └── ...
│   │   ├── JSON/                   # Command outputs (JSON)
│   │   └── topology.json           # Generated topology
│   ├── exec_2025-11-24_204530_e5f6g7h8/
│   └── ...
└── current -> executions/exec_2025-11-24_194401_a1b2c3d4/  (symlink)
```

### Metadata Format

```json
{
  "execution_id": "exec_2025-11-24_194401_a1b2c3d4",
  "job_id": "9fc949be-f104-4712-9ac8-5e69eead1a21",
  "timestamp": "2025-11-24T19:44:01.123456",
  "status": "completed",
  "devices": [
    {"id": "r1", "name": "zwe-r1", "ip": "172.20.0.11"},
    {"id": "r2", "name": "zwe-r2", "ip": "172.20.0.12"}
  ],
  "commands": [
    "show ospf neighbor",
    "show ospf database"
  ],
  "results": {
    "total_devices": 10,
    "completed_devices": 10,
    "total_commands": 90,
    "successful_commands": 90,
    "failed_commands": 0
  },
  "files": {
    "text_files": 19,
    "json_files": 19,
    "total_size_mb": 0.15
  }
}
```

## Implementation Steps

### Phase 1: Backend Changes (command_executor.py)

**Current Code** (line 244-280):
```python
# Save to fixed directory
output_file = os.path.join(output_dir, filename)
```

**New Code**:
```python
# Create execution directory
execution_id = f"exec_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}_{job_id[:8]}"
execution_dir = os.path.join(BASE_DIR, "data", "executions", execution_id)
os.makedirs(os.path.join(execution_dir, "TEXT"), exist_ok=True)
os.makedirs(os.path.join(execution_dir, "JSON"), exist_ok=True)

# Save to execution-specific directory
output_file = os.path.join(execution_dir, "TEXT", filename)

# Save metadata
metadata = {
    "execution_id": execution_id,
    "job_id": job_id,
    "timestamp": datetime.now().isoformat(),
    "devices": device_list,
    # ... other details
}
with open(os.path.join(execution_dir, "metadata.json"), 'w') as f:
    json.dump(metadata, f, indent=2)

# Update 'current' symlink
current_link = os.path.join(BASE_DIR, "data", "current")
if os.path.lexists(current_link):
    os.unlink(current_link)
os.symlink(execution_dir, current_link)
```

### Phase 2: API Endpoints (server.py)

**New Endpoints**:

```python
@app.get("/api/automation/executions")
async def list_executions():
    """List all past executions"""
    executions_dir = os.path.join(BASE_DIR, "data", "executions")
    executions = []

    for dirname in os.listdir(executions_dir):
        metadata_file = os.path.join(executions_dir, dirname, "metadata.json")
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
                executions.append({
                    "execution_id": dirname,
                    "timestamp": metadata.get("timestamp"),
                    "devices": len(metadata.get("devices", [])),
                    "status": metadata.get("status"),
                    "files": metadata.get("files", {})
                })

    return sorted(executions, key=lambda x: x['timestamp'], reverse=True)


@app.get("/api/automation/executions/{execution_id}")
async def get_execution(execution_id: str):
    """Get specific execution details"""
    metadata_file = os.path.join(BASE_DIR, "data", "executions", execution_id, "metadata.json")

    if not os.path.exists(metadata_file):
        raise HTTPException(status_code=404, detail="Execution not found")

    with open(metadata_file, 'r') as f:
        return json.load(f)


@app.post("/api/transform/topology")
async def generate_topology(execution_id: Optional[str] = None):
    """Generate topology from specific execution (or current)"""
    if execution_id is None:
        # Use current execution
        current_link = os.path.join(BASE_DIR, "data", "current")
        if os.path.exists(current_link):
            execution_id = os.path.basename(os.readlink(current_link))
        else:
            # Fallback to old behavior
            text_dir = os.path.join(BASE_DIR, "data", "OUTPUT-Data_save", "TEXT")
    else:
        text_dir = os.path.join(BASE_DIR, "data", "executions", execution_id, "TEXT")

    # Rest of topology generation logic...
```

### Phase 3: Frontend Changes

**Automation Page** (pages/Automation.tsx):
- After job completes, display execution ID
- Provide link to view execution in Data Save page

**Data Save Page** (pages/DataSave.tsx):
- Add execution selector dropdown at top
- List all executions with timestamp and device count
- Load files from selected execution

**Transformation Page** (pages/Transformation.tsx):
- Add execution selector dropdown
- Generate topology from selected execution only

**Example UI**:
```typescript
// Execution Selector Component
const ExecutionSelector = () => {
  const [executions, setExecutions] = useState([]);
  const [selectedExecution, setSelectedExecution] = useState(null);

  useEffect(() => {
    fetch('/api/automation/executions')
      .then(res => res.json())
      .then(data => {
        setExecutions(data);
        setSelectedExecution(data[0]?.execution_id); // Select latest
      });
  }, []);

  return (
    <select value={selectedExecution} onChange={e => setSelectedExecution(e.target.value)}>
      {executions.map(exec => (
        <option key={exec.execution_id} value={exec.execution_id}>
          {exec.timestamp} - {exec.devices} devices
        </option>
      ))}
    </select>
  );
};
```

## Migration Strategy

### Backward Compatibility

1. **Keep old directory structure**: `data/OUTPUT-Data_save/TEXT/` remains for legacy support
2. **Symlink 'current'**: Points to latest execution for default behavior
3. **API accepts null execution_id**: Falls back to current execution
4. **Gradual migration**: Old files remain accessible until manually cleaned

### Data Migration Script

```python
# migrate_old_data.py
import os
import shutil
from datetime import datetime

OLD_DIR = "data/OUTPUT-Data_save/TEXT"
EXECUTIONS_DIR = "data/executions"

# Group old files by timestamp range
file_groups = group_files_by_timestamp(OLD_DIR)

for timestamp, files in file_groups.items():
    # Create execution for each group
    exec_id = f"exec_legacy_{timestamp}_migrated"
    exec_dir = os.path.join(EXECUTIONS_DIR, exec_id)
    os.makedirs(os.path.join(exec_dir, "TEXT"), exist_ok=True)

    # Move files
    for file in files:
        shutil.copy2(
            os.path.join(OLD_DIR, file),
            os.path.join(exec_dir, "TEXT", file)
        )

    # Create metadata
    metadata = {
        "execution_id": exec_id,
        "timestamp": timestamp,
        "migrated": True
    }
    with open(os.path.join(exec_dir, "metadata.json"), 'w') as f:
        json.dump(metadata, f, indent=2)
```

## Testing Plan

1. **Unit Tests**:
   - Test execution directory creation
   - Test metadata generation
   - Test symlink updates

2. **Integration Tests**:
   - Run automation twice, verify separate directories
   - Verify no file conflicts
   - Test execution selector API

3. **E2E Tests** (Puppeteer):
   - Run automation job 1, verify execution ID shown
   - Run automation job 2, verify different execution ID
   - Navigate to Data Save, select job 1, verify correct files
   - Navigate to Transformation, select job 1, verify topology from job 1 only

## Benefits

1. **Data Integrity**: Each execution is isolated and immutable
2. **Audit Trail**: Complete history of all automation runs
3. **Debugging**: Can replay past executions to investigate issues
4. **Comparison**: Compare topologies between different runs
5. **Rollback**: If bad data collected, use previous execution
6. **Testing**: Can have test executions without affecting production data

## Timeline Estimate

- Phase 1 (Backend): 4-6 hours
- Phase 2 (API): 2-3 hours
- Phase 3 (Frontend): 4-6 hours
- Testing: 2-3 hours
- **Total**: 12-18 hours of development time

## Priority

**Importance**: HIGH
- Prevents data corruption between runs
- Essential for production use
- Enables proper auditing and replay

**Urgency**: MEDIUM
- Current system works but not production-ready
- Should be implemented before adding more users
- Not blocking current functionality

## Next Steps

1. Review and approve this proposal
2. Create feature branch for implementation
3. Implement Phase 1 (Backend isolation)
4. Add API endpoints (Phase 2)
5. Update frontend (Phase 3)
6. Comprehensive testing with Puppeteer
7. Deploy to production

---

**Author**: Network Automation Engineer
**Date**: 2025-11-24
**Status**: PROPOSED - Awaiting Approval
