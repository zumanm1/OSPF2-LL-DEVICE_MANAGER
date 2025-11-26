# Network Device Manager - Python Backend

FastAPI-based REST API with SQLite database for managing network devices.

## Features

- ✅ RESTful API with FastAPI
- ✅ SQLite database for persistence
- ✅ CORS enabled for frontend integration
- ✅ Automatic API documentation (Swagger/OpenAPI)
- ✅ Bulk operations support (import/delete)
- ✅ Type validation with Pydantic

## Requirements

- Python 3.8+
- pip

## Installation

1. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

## Running the Server

Start the FastAPI server:

```bash
python server.py
```

Or using uvicorn directly:

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 9051
```

The server will start on: **http://localhost:9051**

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:9051/docs
- **ReDoc**: http://localhost:9051/redoc

## API Endpoints

### Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/devices` | Get all devices |
| GET    | `/api/devices/{id}` | Get device by ID |
| POST   | `/api/devices` | Create new device |
| PUT    | `/api/devices/{id}` | Update device |
| DELETE | `/api/devices/{id}` | Delete device |
| POST   | `/api/devices/bulk-delete` | Delete multiple devices |
| POST   | `/api/devices/bulk-import` | Import multiple devices |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/health` | Health check |

## Database

- **Type**: SQLite
- **File**: `devices.db` (auto-created)
- **Location**: Backend directory

The database is automatically initialized with mock data on first run.

## Development

The server runs in auto-reload mode during development. Any changes to `server.py` will automatically restart the server.

## CORS Configuration

The backend is configured to accept requests from:
- `http://localhost:9050` (Frontend Vite dev server)
- `http://localhost:3000` (Alternative frontend port)

To add more origins, edit the `allow_origins` list in `server.py`.

## Troubleshooting

### Port already in use
If port 9051 is already in use, change the port in `server.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=YOUR_PORT)
```

### Database locked
If you get a "database is locked" error, ensure only one instance of the server is running.

### CORS errors
Make sure your frontend is running on one of the allowed origins.
