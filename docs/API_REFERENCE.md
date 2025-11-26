# API Reference

Base URL: `http://localhost:9051/api`

## Device Management

### `GET /devices`
Retrieve all configured network devices.
- **Response**: `List[Device]`

### `POST /devices`
Create a new device.
- **Body**: `Device` object
- **Response**: Created `Device`

### `PUT /devices/{id}`
Update an existing device.
- **Body**: `Device` object
- **Response**: Updated `Device`

### `DELETE /devices/{id}`
Remove a device.

## Automation

### `POST /automation/connect`
Establish SSH connections to selected devices.
- **Body**: `{ "device_ids": ["id1", "id2"] }`
- **Response**: Connection status summary

### `POST /automation/execute`
Run show commands on connected devices.
- **Body**: 
  ```json
  {
    "device_ids": ["id1", "id2"],
    "commands": ["show version", "show ip int brief"]
  }
  ```
- **Response**: Execution results, output file paths

### `POST /automation/jobs`
Start an asynchronous automation job.
- **Body**: Same as `/execute`
- **Response**: `{ "job_id": "uuid" }`

### `GET /automation/jobs/{id}`
Get status of a running or completed job.

### `GET /automation/files`
List generated output files.
- **Query Params**: `?folder_type=text|json&device_name=filter`

## Transformation

### `POST /transform/topology`
Generate network topology from collected data.
- **Response**: Topology JSON (Nodes and Links)

### `GET /transform/topology/latest`
Retrieve the most recently generated topology.
