# 🔍 ROOT CAUSE ANALYSIS - Topology Export Bug

## Issue
Exported topology shows **WRONG device hostnames** (synthetic names like `deu-r10`, `zwe-r3`) instead of **REAL device hostnames** (`deu-ber-bes-p06`, `zwe-hra-pop-p01`).

## Root Cause Found

### Data Flow Discovery
1. **Device Database** (`devices.db`): Contains CORRECT hostnames
   - `deu-ber-bes-p06`, `zwe-hra-pop-p01`, etc.

2. **Automation Execution**: Saves files with CORRECT hostnames
   - Files saved to: `data/executions/exec_TIMESTAMP/TEXT/`
   - Filenames: `deu-ber-bes-p06_show_ospf_neighbor_*.txt` ✅
   - `current` symlink points to latest execution ✅

3. **TopologyBuilder**: Reads from WRONG directory
   - **BUG**: Uses hardcoded `data/OUTPUT-Data_save/TEXT` (line 26)
   - Should use: `data/current/TEXT` (symlink to latest execution)
   - OLD files in OUTPUT-Data_save have synthetic names (`deu-r10`) ❌

4. **Topology Export**: Uses data from TopologyBuilder
   - Exports whatever TopologyBuilder parsed
   - Result: Wrong hostnames in exported JSON ❌

## The Bug
**File**: `backend/modules/topology_builder.py`  
**Line**: 26-31

```python
def __init__(self, text_dir: str = "data/OUTPUT-Data_save/TEXT", ...):
    # ❌ BUG: Hardcoded to OUTPUT-Data_save instead of using 'current' symlink
```

## Solution
Update `TopologyBuilder` to use the `current` symlink (like `FileManager` does).

### Files to Fix
1. `backend/modules/topology_builder.py` - Update default text_dir
2. `backend/server.py` - Ensure TopologyBuilder uses correct directory

## Impact
- **Current**: Topology shows old synthetic names
- **After Fix**: Topology will show real device hostnames from latest automation run


