# Real-Time Progress Tracking & Batch Processing Guide

## Overview
The OSPF Network Device Manager now includes advanced batch processing and real-time progress tracking capabilities. This allows for efficient management of large-scale device operations with granular visibility into the execution process.

## Features

### 1. Batch Processing
- **Configurable Batch Size**: Users can set the number of devices processed concurrently (2-50).
- **Rate Limiting**: Users can limit the number of devices processed per hour to prevent network overload.
- **Automatic Delays**: The system automatically calculates and applies delays between batches based on the selected rate limit.

### 2. Real-Time Progress Tracking
The system provides live updates at multiple levels of granularity:

- **Overall Progress**:
  - Total devices completed vs. total.
  - Overall percentage completion.
  - Visual progress bar.

- **Current Execution**:
  - Displays the specific device and command currently being executed.
  - Shows the command index (e.g., "Command 3/5").

- **Country Statistics**:
  - Aggregated progress per country.
  - Breakdown of running, completed, and failed devices per country.
  - Visual progress bars for each country.

- **Device & Command Details**:
  - Per-device status (Pending, Running, Completed, Failed).
  - Detailed list of commands for each device with individual status icons.
  - Execution time for each command.

## How to Use

1.  **Select Devices**: Choose the devices you want to automate from the list.
2.  **Configure Batch**:
    - Use the **Batch Configuration** card to set the **Batch Size**.
    - Optionally, set a **Rate Limit** (devices/hour).
3.  **Select Commands**: Choose the OSPF commands to execute.
4.  **Start Job**: Click **Start Automation**.
5.  **Monitor Progress**: Watch the real-time progress dashboard appear. You will see:
    - A "Currently Processing" card at the top.
    - A "Progress by Country" section.
    - A detailed "Device Progress" list with live updates.

## Technical Implementation

- **Backend**:
  - `JobManager` tracks granular state in memory.
  - `CommandExecutor` processes devices in batches using `ThreadPoolExecutor`.
  - Rate limiting is implemented via calculated sleeps between batches.
- **Frontend**:
  - `RealTimeProgress` component renders the visualization.
  - Polling interval is increased to 500ms during active jobs for smooth updates.
  - `framer-motion` is used for smooth animations.

## Troubleshooting

- **Progress not updating?**: Check if the job is actually running. If the backend crashes, the frontend might stop polling.
- **Rate limit too slow?**: Set "Rate Limit" to "No limit" or increase the batch size.
- **Connection failures?**: The system will mark devices as failed but continue with the rest of the batch.
