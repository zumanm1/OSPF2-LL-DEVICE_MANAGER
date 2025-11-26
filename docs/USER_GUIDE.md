# User Guide

## Getting Started

1. **Start the Application**:
   - Ensure Backend is running on port 9051
   - Ensure Frontend is running on port 9050
   - Open `http://localhost:9050` in your browser

## Device Manager (Step 0)
The main dashboard shows your inventory of network devices.
- **Add Device**: Click "Add Device" to input credentials and details.
- **Import CSV**: Use the "Actions" dropdown to upload a CSV list of devices.
- **Bulk Edit**: Select multiple devices using checkboxes and click "Bulk Edit" to change common fields (e.g., Country, Tags).

## Network Automation (Step 1)
Navigate to the **Automation** page via the navbar.

1. **Select Devices**: Choose which routers you want to interact with.
2. **Connect**: Click "Connect". The system will establish SSH sessions.
3. **Execute Commands**: 
   - Review the list of OSPF commands.
   - Add custom commands if needed.
   - Click "Start Automation".
4. **Monitor Progress**: Watch the progress bar and real-time result logs.
5. **Review Results**: Expand device results to see success/failure status and execution time.

## Data Save & Viewing (Step 2)
Navigate to the **Data Save** page.
- Browse through the file tree of collected data.
- `IOSXRV-TEXT`: Contains raw CLI output.
- `IOSXRV-JSON`: Contains structured JSON data parsed from the CLI output.
- Click a file to view its contents.

## Topology Transformation (Step 3)
Navigate to the **Transformation** page.
- The system analyzes the collected OSPF database and CDP neighbor tables.
- It constructs a visualizable graph of the network.
- You can download the resulting JSON topology file.

## Troubleshooting
- **Connection Failed**: Check if the device IP is reachable and credentials are correct.
- **Port Conflicts**: Ensure ports 9050 and 9051 are free before starting the app.
