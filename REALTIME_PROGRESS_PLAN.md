# REAL-TIME PROGRESS TRACKING - IMPLEMENTATION PLAN

## 🎯 REQUIREMENT ANALYSIS

### Current State:
- **Basic Progress**: Shows X/Y devices completed
- **Overall Percentage**: Single progress bar
- **Results After Completion**: Device results shown only after job completes

### Required State:
- **Per Command Progress**: Show which command is executing on which device
- **Per Device Progress**: Real-time status for each device
- **Per Country Grouping**: Group devices by country (USA, UK, etc.)
- **Live Updates**: Update UI as commands execute (not after completion)

---

## 🏗️ SOLUTION ARCHITECTURE

### Component 1: Enhanced Job Status Data Structure

**Current**:
```typescript
interface JobStatus {
  completed_devices: number;
  total_devices: number;
  progress_percent: number;
  results: Record<string, any>;
}
```

**Enhanced**:
```typescript
interface JobStatus {
  // Existing fields
  completed_devices: number;
  total_devices: number;
  progress_percent: number;
  
  // NEW: Real-time tracking
  current_device?: {
    device_id: string;
    device_name: string;
    country: string;
    current_command: string;
    command_index: number;
    total_commands: number;
  };
  
  // NEW: Per-device progress
  device_progress: Record<string, {
    device_name: string;
    country: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    current_command?: string;
    completed_commands: number;
    total_commands: number;
    commands: Array<{
      command: string;
      status: 'pending' | 'running' | 'success' | 'failed';
      execution_time?: number;
    }>;
  }>;
  
  // NEW: Country statistics
  country_stats: Record<string, {
    total_devices: number;
    completed_devices: number;
    running_devices: number;
    failed_devices: number;
  }>;
  
  results: Record<string, any>;
}
```

---

### Component 2: Real-Time Progress UI

#### A. Current Execution Banner
```tsx
{jobStatus?.current_device && (
  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200">
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
      <div>
        <p className="font-semibold text-blue-900 dark:text-blue-100">
          Currently Processing
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Device: <strong>{jobStatus.current_device.device_name}</strong> ({jobStatus.current_device.country})
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Command: <strong>{jobStatus.current_device.current_command}</strong>
          ({jobStatus.current_device.command_index}/{jobStatus.current_device.total_commands})
        </p>
      </div>
    </div>
  </div>
)}
```

#### B. Country-Grouped Progress
```tsx
<div className="space-y-4">
  {Object.entries(jobStatus.country_stats).map(([country, stats]) => (
    <div key={country} className="border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">{country}</h4>
        <span className="text-sm">
          {stats.completed_devices}/{stats.total_devices} devices
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: `${(stats.completed_devices / stats.total_devices) * 100}%` }}
        />
      </div>
      <div className="flex gap-4 mt-2 text-xs">
        <span className="text-blue-600">⚡ Running: {stats.running_devices}</span>
        <span className="text-green-600">✅ Done: {stats.completed_devices}</span>
        <span className="text-red-600">❌ Failed: {stats.failed_devices}</span>
      </div>
    </div>
  ))}
</div>
```

#### C. Per-Device Command Progress
```tsx
<div className="space-y-3">
  {Object.entries(jobStatus.device_progress).map(([deviceId, progress]) => (
    <div key={deviceId} className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-semibold">{progress.device_name}</span>
          <span className="text-xs text-gray-500 ml-2">({progress.country})</span>
        </div>
        <StatusBadge status={progress.status} />
      </div>
      
      {/* Command Progress */}
      <div className="space-y-1">
        {progress.commands.map((cmd, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <StatusIcon status={cmd.status} />
            <span className={cmd.status === 'running' ? 'font-semibold text-blue-600' : ''}>
              {cmd.command}
            </span>
            {cmd.execution_time && (
              <span className="text-gray-500">({cmd.execution_time}s)</span>
            )}
          </div>
        ))}
      </div>
      
      {/* Progress Bar */}
      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
        <div 
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${(progress.completed_commands / progress.total_commands) * 100}%` }}
        />
      </div>
      <p className="text-xs text-gray-600 mt-1">
        {progress.completed_commands}/{progress.total_commands} commands
      </p>
    </div>
  ))}
</div>
```

---

### Component 3: Backend Real-Time Updates

**File**: `backend/modules/command_executor.py`

```python
def execute_command_with_progress(self, device_id, device_name, country, command, job_id, command_index, total_commands):
    """Execute command and update real-time progress"""
    
    # Update job status: current device and command
    job_manager.update_current_execution(job_id, {
        "device_id": device_id,
        "device_name": device_name,
        "country": country,
        "current_command": command,
        "command_index": command_index + 1,
        "total_commands": total_commands
    })
    
    # Update device progress: mark command as running
    job_manager.update_device_command_status(
        job_id, 
        device_id, 
        command_index, 
        "running"
    )
    
    start_time = time.time()
    
    try:
        # Execute command
        output = connection.send_command(command, read_timeout=60)
        execution_time = time.time() - start_time
        
        # Update device progress: mark command as success
        job_manager.update_device_command_status(
            job_id, 
            device_id, 
            command_index, 
            "success",
            execution_time=execution_time
        )
        
        return {"status": "success", "output": output, "execution_time": execution_time}
        
    except Exception as e:
        execution_time = time.time() - start_time
        
        # Update device progress: mark command as failed
        job_manager.update_device_command_status(
            job_id, 
            device_id, 
            command_index, 
            "failed",
            error=str(e),
            execution_time=execution_time
        )
        
        return {"status": "failed", "error": str(e), "execution_time": execution_time}
```

---

### Component 4: Job Manager Enhancements

**File**: `backend/modules/command_executor.py`

```python
class JobManager:
    def update_current_execution(self, job_id: str, current_device: Dict):
        """Update currently executing device and command"""
        with self.lock:
            job = self.jobs.get(job_id)
            if job:
                job["current_device"] = current_device
    
    def update_device_command_status(
        self, 
        job_id: str, 
        device_id: str, 
        command_index: int, 
        status: str,
        execution_time: float = None,
        error: str = None
    ):
        """Update specific command status for a device"""
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                return
            
            # Initialize device_progress if not exists
            if "device_progress" not in job:
                job["device_progress"] = {}
            
            if device_id not in job["device_progress"]:
                job["device_progress"][device_id] = {
                    "device_name": "",  # Will be set from device info
                    "country": "",
                    "status": "pending",
                    "completed_commands": 0,
                    "total_commands": 0,
                    "commands": []
                }
            
            device_progress = job["device_progress"][device_id]
            
            # Update command status
            if command_index < len(device_progress["commands"]):
                device_progress["commands"][command_index]["status"] = status
                if execution_time:
                    device_progress["commands"][command_index]["execution_time"] = execution_time
                if error:
                    device_progress["commands"][command_index]["error"] = error
            
            # Update completed count
            if status in ["success", "failed"]:
                device_progress["completed_commands"] += 1
            
            # Update device status
            if device_progress["completed_commands"] == device_progress["total_commands"]:
                device_progress["status"] = "completed"
            elif status == "running":
                device_progress["status"] = "running"
            
            # Update country stats
            self._update_country_stats(job)
    
    def _update_country_stats(self, job: Dict):
        """Calculate country-level statistics"""
        country_stats = {}
        
        for device_id, progress in job.get("device_progress", {}).items():
            country = progress.get("country", "Unknown")
            
            if country not in country_stats:
                country_stats[country] = {
                    "total_devices": 0,
                    "completed_devices": 0,
                    "running_devices": 0,
                    "failed_devices": 0
                }
            
            country_stats[country]["total_devices"] += 1
            
            if progress["status"] == "completed":
                country_stats[country]["completed_devices"] += 1
            elif progress["status"] == "running":
                country_stats[country]["running_devices"] += 1
            elif progress["status"] == "failed":
                country_stats[country]["failed_devices"] += 1
        
        job["country_stats"] = country_stats
```

---

## 📊 UI MOCKUP

### Real-Time Progress Display

```
╔═══════════════════════════════════════════════════════════════════════╗
║  ⚡ Currently Processing                                              ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Device: usa-r5 (USA)                                                 ║
║  Command: show ip ospf neighbor (3/8)                                 ║
╚═══════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════╗
║  📊 Progress by Country                                               ║
╠═══════════════════════════════════════════════════════════════════════╣
║  USA                                          3/5 devices              ║
║  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  60%  ║
║  ⚡ Running: 1  ✅ Done: 2  ❌ Failed: 0                               ║
║                                                                       ║
║  UK                                           2/3 devices              ║
║  ████████████████████████████████████████████░░░░░░░░░░░░░░░░░  67%  ║
║  ⚡ Running: 0  ✅ Done: 2  ❌ Failed: 0                               ║
║                                                                       ║
║  GERMANY                                      1/2 devices              ║
║  ████████████████████████████████████████████████████████████  50%  ║
║  ⚡ Running: 1  ✅ Done: 0  ❌ Failed: 0                               ║
╚═══════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════╗
║  📋 Device Progress                                                   ║
╠═══════════════════════════════════════════════════════════════════════╣
║  ┌─────────────────────────────────────────────────────────────────┐ ║
║  │ usa-r5 (USA)                                    ⚡ RUNNING        │ ║
║  ├─────────────────────────────────────────────────────────────────┤ ║
║  │ ✅ show process cpu (1.2s)                                      │ ║
║  │ ✅ show process memory (0.8s)                                   │ ║
║  │ 🔄 show ip ospf neighbor                                        │ ║
║  │ ⏳ show ospf database                                           │ ║
║  │ ⏳ show route ospf                                              │ ║
║  │ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  3/8     │ ║
║  └─────────────────────────────────────────────────────────────────┘ ║
║                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────┐ ║
║  │ usa-r1 (USA)                                    ✅ COMPLETED     │ ║
║  ├─────────────────────────────────────────────────────────────────┤ ║
║  │ ✅ show process cpu (1.1s)                                      │ ║
║  │ ✅ show process memory (0.9s)                                   │ ║
║  │ ✅ show ip ospf neighbor (1.5s)                                 │ ║
║  │ ✅ show ospf database (2.3s)                                    │ ║
║  │ ████████████████████████████████████████████████████████  8/8   │ ║
║  └─────────────────────────────────────────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## 🎯 IMPLEMENTATION PHASES

### Phase 1: Backend Data Structure ✅
1. Enhance JobStatus interface
2. Add current_device tracking
3. Add device_progress tracking
4. Add country_stats calculation

### Phase 2: Backend Real-Time Updates ✅
1. Update command_executor to track progress
2. Implement update_current_execution()
3. Implement update_device_command_status()
4. Implement _update_country_stats()

### Phase 3: Frontend UI Components ✅
1. Current Execution Banner
2. Country Progress Cards
3. Per-Device Command List
4. Status Icons and Badges

### Phase 4: Polling & Real-Time Updates ✅
1. Increase polling frequency (500ms during execution)
2. Smooth animations for progress bars
3. Auto-scroll to current device

---

## 🚀 BENEFITS

1. **Visibility**: See exactly what's happening in real-time
2. **Country Grouping**: Understand progress by geographic region
3. **Command-Level Detail**: Know which commands are slow/failing
4. **Early Detection**: Spot issues before job completes
5. **User Confidence**: Visual feedback builds trust

---

**This will transform the automation experience from "waiting in the dark" to "watching progress live"!**
