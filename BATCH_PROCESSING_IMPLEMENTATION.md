# BATCH PROCESSING IMPLEMENTATION PLAN

## 🎯 REQUIREMENT ANALYSIS

### Current Problem:
- App connects to ALL selected devices simultaneously
- No batch size control
- Will not scale beyond 10-20 routers
- Resource exhaustion risk with 20+ simultaneous SSH connections

### User Requirements:
1. **Batch Size Control**: Process 10 routers at a time (configurable)
2. **Sequential Batches**: Process batch 1, then batch 2, etc.
3. **On-Demand Connection**: Don't maintain permanent connections
4. **Scalability**: Support 20+ routers without overwhelming system
5. **User Control**: UI option to set batch size

---

## 🏗️ SOLUTION ARCHITECTURE

### Design Principles:
1. **Simple & Powerful**: Minimal code changes, maximum impact
2. **No Code Duplication**: Reuse existing connection/execution logic
3. **Backward Compatible**: Works with existing 10-router setups
4. **User-Friendly**: Clear UI for batch configuration

### Implementation Strategy:

```
┌─────────────────────────────────────────────────────────────┐
│  USER SELECTS 25 DEVICES                                    │
│  Sets Batch Size: 10                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  BATCH 1: Devices 1-10                                      │
│  ├─ Connect (SSH)                                           │
│  ├─ Execute Commands                                        │
│  ├─ Save Results                                            │
│  └─ Disconnect                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  BATCH 2: Devices 11-20                                     │
│  ├─ Connect (SSH)                                           │
│  ├─ Execute Commands                                        │
│  ├─ Save Results                                            │
│  └─ Disconnect                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  BATCH 3: Devices 21-25                                     │
│  ├─ Connect (SSH)                                           │
│  ├─ Execute Commands                                        │
│  ├─ Save Results                                            │
│  └─ Disconnect                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
                   JOB COMPLETE
```

---

## 📝 IMPLEMENTATION PLAN

### Phase 1: Backend - Batch Job Manager

**File**: `backend/modules/command_executor.py`

**Changes**:
1. Add `batch_size` parameter to job creation
2. Implement batch splitting logic
3. Sequential batch execution with auto-disconnect
4. Track batch progress separately

**New Job Structure**:
```python
{
    "id": "job-uuid",
    "status": "running",
    "total_devices": 25,
    "batch_size": 10,
    "current_batch": 1,
    "total_batches": 3,
    "batches": [
        {
            "batch_number": 1,
            "device_ids": ["dev1", "dev2", ...],
            "status": "completed",
            "start_time": "...",
            "end_time": "..."
        },
        {
            "batch_number": 2,
            "device_ids": ["dev11", "dev12", ...],
            "status": "running",
            "start_time": "...",
            "end_time": null
        },
        ...
    ],
    "results": {...}
}
```

### Phase 2: Backend - API Endpoint Update

**File**: `backend/server.py`

**Changes**:
1. Update `POST /api/automation/jobs` to accept `batch_size` parameter
2. Pass batch_size to job manager
3. Return batch progress in job status

**API Request**:
```json
{
    "device_ids": ["dev1", "dev2", ..., "dev25"],
    "commands": ["show ospf database", ...],
    "batch_size": 10  // NEW PARAMETER
}
```

**API Response**:
```json
{
    "job_id": "uuid",
    "total_devices": 25,
    "batch_size": 10,
    "total_batches": 3,
    "current_batch": 1,
    "status": "running"
}
```

### Phase 3: Frontend - Batch Size UI

**File**: `pages/Automation.tsx`

**Changes**:
1. Add batch size input/selector
2. Display batch progress (Batch 1/3, Batch 2/3, etc.)
3. Show per-batch results
4. Update progress bar to show batch progress

**UI Components**:
```tsx
// Batch Size Selector
<div className="batch-config">
  <label>Batch Size (devices per batch)</label>
  <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))}>
    <option value={5}>5 devices</option>
    <option value={10}>10 devices (recommended)</option>
    <option value={15}>15 devices</option>
    <option value={20}>20 devices</option>
    <option value={0}>All at once (no batching)</option>
  </select>
</div>

// Batch Progress Display
<div className="batch-progress">
  <p>Processing Batch {currentBatch} of {totalBatches}</p>
  <p>Batch 1: ✅ Complete (10 devices)</p>
  <p>Batch 2: 🔄 Running (10 devices)</p>
  <p>Batch 3: ⏳ Pending (5 devices)</p>
</div>
```

### Phase 4: Connection Management Strategy

**Key Principle**: **On-Demand Connections**

**Current Flow** (problematic):
```
1. User clicks "Connect" → SSH to all devices
2. Devices stay connected
3. User clicks "Start Automation" → Execute commands
4. User manually clicks "Disconnect"
```

**New Flow** (scalable):
```
1. User selects devices
2. User clicks "Start Automation" (no separate connect step)
3. For each batch:
   a. Connect to batch devices
   b. Execute commands
   c. Disconnect batch devices
   d. Move to next batch
4. Job complete, all devices disconnected
```

**Benefits**:
- ✅ No permanent connections
- ✅ Automatic cleanup
- ✅ Lower resource usage
- ✅ Scales to 100+ devices

---

## 🔧 DETAILED IMPLEMENTATION

### 1. Backend: Batch Job Executor

```python
# backend/modules/command_executor.py

class BatchJobExecutor:
    """Executes automation jobs in batches"""
    
    def __init__(self, batch_size: int = 10):
        self.batch_size = batch_size
        self.connection_manager = connection_manager
        self.command_executor = command_executor
    
    def split_into_batches(self, device_ids: List[str]) -> List[List[str]]:
        """Split device list into batches"""
        if self.batch_size == 0:
            return [device_ids]  # No batching
        
        batches = []
        for i in range(0, len(device_ids), self.batch_size):
            batches.append(device_ids[i:i + self.batch_size])
        return batches
    
    async def execute_batch_job(
        self, 
        job_id: str,
        device_ids: List[str],
        commands: List[str],
        batch_size: int = 10
    ):
        """Execute job in batches with auto-connect/disconnect"""
        
        self.batch_size = batch_size
        batches = self.split_into_batches(device_ids)
        
        job_manager.update_job(job_id, {
            "total_batches": len(batches),
            "current_batch": 0,
            "batches": []
        })
        
        for batch_num, batch_devices in enumerate(batches, 1):
            if job_manager.is_stop_requested(job_id):
                break
            
            logger.info(f"📦 Processing Batch {batch_num}/{len(batches)} ({len(batch_devices)} devices)")
            
            # Update job status
            job_manager.update_job(job_id, {"current_batch": batch_num})
            
            batch_start = datetime.now()
            
            try:
                # 1. CONNECT to batch devices
                logger.info(f"🔌 Connecting to batch {batch_num}...")
                connected_devices = []
                for device_id in batch_devices:
                    try:
                        device_info = get_device_info(device_id)
                        result = self.connection_manager.connect(device_id, device_info)
                        if result['status'] == 'connected':
                            connected_devices.append(device_id)
                    except Exception as e:
                        logger.error(f"Failed to connect {device_id}: {e}")
                
                # 2. EXECUTE commands on connected devices
                logger.info(f"⚡ Executing commands on {len(connected_devices)} devices...")
                for device_id in connected_devices:
                    if job_manager.is_stop_requested(job_id):
                        break
                    
                    device_name = get_device_name(device_id)
                    for command in commands:
                        try:
                            result = self.command_executor.execute_command(
                                device_id, device_name, command
                            )
                            job_manager.update_device_result(job_id, device_id, result)
                        except Exception as e:
                            logger.error(f"Command failed on {device_id}: {e}")
                
                # 3. DISCONNECT batch devices
                logger.info(f"🔌 Disconnecting batch {batch_num}...")
                for device_id in connected_devices:
                    try:
                        self.connection_manager.disconnect(device_id)
                    except Exception as e:
                        logger.warning(f"Failed to disconnect {device_id}: {e}")
                
                batch_end = datetime.now()
                
                # Record batch completion
                job_manager.add_batch_result(job_id, {
                    "batch_number": batch_num,
                    "device_ids": batch_devices,
                    "status": "completed",
                    "start_time": batch_start.isoformat(),
                    "end_time": batch_end.isoformat(),
                    "duration_seconds": (batch_end - batch_start).total_seconds()
                })
                
                logger.info(f"✅ Batch {batch_num}/{len(batches)} complete")
                
            except Exception as e:
                logger.error(f"❌ Batch {batch_num} failed: {e}")
                job_manager.add_batch_result(job_id, {
                    "batch_number": batch_num,
                    "device_ids": batch_devices,
                    "status": "failed",
                    "error": str(e)
                })
        
        # Mark job as complete
        job_manager.complete_job(job_id)
        logger.info(f"🎉 Job {job_id} complete - processed {len(batches)} batches")
```

### 2. Frontend: Batch Configuration UI

```tsx
// pages/Automation.tsx

const [batchSize, setBatchSize] = useState<number>(10);
const [batchProgress, setBatchProgress] = useState<{
  current: number;
  total: number;
  batches: Array<{number: number; status: string; devices: number}>;
} | null>(null);

const handleStartAutomation = async () => {
  if (selectedDeviceIds.size === 0) {
    setError('Please select at least one device');
    return;
  }

  setError(null);
  setJobStatus(null);

  try {
    const deviceIds = Array.from(selectedDeviceIds);
    const activeCommands = availableCommands.filter(c => c.enabled).map(c => c.command);

    // Start batch job
    const result = await API.startAutomationJob(
      deviceIds,
      activeCommands,
      batchSize  // Pass batch size
    );
    
    setActiveJobId(result.job_id);
    
    // Show batch info
    if (result.total_batches > 1) {
      console.log(`Job will process ${result.total_batches} batches of ${batchSize} devices each`);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to start automation');
  }
};

// Batch Configuration UI
<GlassCard className="mb-6">
  <h3 className="text-lg font-semibold mb-4">Batch Configuration</h3>
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium mb-2">
        Batch Size (devices per batch)
      </label>
      <select
        value={batchSize}
        onChange={e => setBatchSize(Number(e.target.value))}
        className="w-full px-3 py-2 rounded-lg border"
      >
        <option value={5}>5 devices</option>
        <option value={10}>10 devices (recommended)</option>
        <option value={15}>15 devices</option>
        <option value={20}>20 devices</option>
        <option value={0}>All at once (no batching)</option>
      </select>
    </div>
    <div>
      <label className="block text-sm font-medium mb-2">
        Estimated Batches
      </label>
      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
        {selectedDeviceIds.size > 0 && batchSize > 0
          ? Math.ceil(selectedDeviceIds.size / batchSize)
          : selectedDeviceIds.size > 0
          ? 1
          : 0} batch(es)
      </div>
    </div>
  </div>
  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
    💡 Tip: Use batch size of 10 for optimal performance. Larger batches may overwhelm network devices.
  </p>
</GlassCard>

// Batch Progress Display
{jobStatus && jobStatus.total_batches > 1 && (
  <GlassCard className="mb-6">
    <h3 className="text-lg font-semibold mb-4">Batch Progress</h3>
    <div className="space-y-2">
      <p className="text-sm">
        Processing Batch {jobStatus.current_batch} of {jobStatus.total_batches}
      </p>
      <div className="space-y-1">
        {jobStatus.batches?.map((batch, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="w-20">Batch {batch.batch_number}:</span>
            {batch.status === 'completed' && <span className="text-green-600">✅ Complete</span>}
            {batch.status === 'running' && <span className="text-blue-600">🔄 Running</span>}
            {batch.status === 'pending' && <span className="text-gray-500">⏳ Pending</span>}
            {batch.status === 'failed' && <span className="text-red-600">❌ Failed</span>}
            <span className="text-gray-600">({batch.device_ids.length} devices)</span>
          </div>
        ))}
      </div>
    </div>
  </GlassCard>
)}
```

---

## 🎯 BENEFITS OF THIS SOLUTION

### 1. **Scalability**
- ✅ Handles 20, 50, 100+ routers
- ✅ Configurable batch size
- ✅ No resource exhaustion

### 2. **Resource Management**
- ✅ Max 10 SSH connections at a time (configurable)
- ✅ Automatic connection cleanup
- ✅ Lower memory footprint

### 3. **User Control**
- ✅ Choose batch size based on network capacity
- ✅ See batch-by-batch progress
- ✅ Stop job between batches

### 4. **Reliability**
- ✅ Batch failure doesn't affect other batches
- ✅ Can retry failed batches
- ✅ Clear error isolation

### 5. **Simplicity**
- ✅ Minimal code changes
- ✅ Reuses existing logic
- ✅ Backward compatible

---

## 📊 TESTING STRATEGY

### Test Cases:
1. **10 devices, batch size 10**: Single batch (existing behavior)
2. **25 devices, batch size 10**: 3 batches (10, 10, 5)
3. **50 devices, batch size 10**: 5 batches
4. **10 devices, batch size 0**: No batching (all at once)
5. **Job stop between batches**: Clean disconnect, resume capability
6. **Batch failure**: Subsequent batches continue

### Validation:
- Puppeteer E2E test for batch processing
- Monitor SSH connection count (should never exceed batch_size)
- Verify all devices processed
- Check proper disconnect after each batch

---

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1 (Immediate):
1. Backend batch job executor
2. API endpoint update
3. Basic UI for batch size selection

### Phase 2 (Next):
4. Batch progress display
5. Per-batch results
6. Retry failed batches

### Phase 3 (Future):
7. Pause/resume between batches
8. Dynamic batch size adjustment
9. Parallel batch execution (advanced)

---

This solution is **powerful yet simple**, scales to 100+ routers, and maintains the clean architecture of the application.
