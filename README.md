# NetMan OSPF Device Manager

A comprehensive network device management and OSPF automation platform with real-time monitoring, multi-device automation, and network traffic analysis.

## Features

### Core Features
- **Device Management**: Full CRUD operations for network devices with country-based organization
- **Multi-Device Automation**: Execute commands on multiple devices simultaneously with parallel execution
- **Real-time Progress**: WebSocket-based live updates during automation jobs
- **Data Save & Export**: Backup configurations, export to CSV/JSON
- **Interface Cost Calculator**: Calculate OSPF interface costs based on bandwidth
- **Transformation Engine**: Parse and transform CDP/neighbor data
- **Traffic Analysis**: Analyze interface traffic and generate visualizations
- **OSPF Designer**: Design and visualize OSPF network topologies

### Security Features
- **Session-based Authentication**: Secure login with session tokens
- **Role-based Access Control (RBAC)**: Three roles - Admin, Operator, Viewer
- **Password Hashing**: SHA-256 with salt
- **Password Expiry**: Configurable login count limit
- **Localhost-only Access**: Configurable access restrictions
- **Jumphost Support**: Route connections through a jumphost

## Architecture

**Frontend**:
- React 19 with TypeScript
- Vite for dev server and build
- Tailwind CSS
- WebSocket for real-time updates
- Port: 9050

**Backend**:
- Python 3.9+ with FastAPI
- SQLite database
- Telnet/SSH via Netmiko
- WebSocket broadcasting
- Port: 9051

## Requirements

- **Node.js** 18+ (for frontend)
- **Python** 3.9+ (for backend)
- **npm** (comes with Node.js)

### Ubuntu 24.04 Prerequisites

```bash
# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and venv
sudo apt-get install -y python3 python3-pip python3-venv

# Verify installations
node --version  # Should be 18+
python3 --version  # Should be 3.9+
```

### macOS Prerequisites

```bash
# Using Homebrew
brew install node python@3.11
```

## Installation

```bash
# Clone the repository
git clone https://github.com/zumanm1/OSPF-LL-DEVICE_MANAGER.git
cd OSPF-LL-DEVICE_MANAGER

# Make scripts executable
chmod +x install.sh start.sh stop.sh restart.sh

# Run installation
./install.sh
```

## Usage

### Start the Application

```bash
./start.sh
```

This starts both:
- **Backend API**: http://localhost:9051
- **Frontend UI**: http://localhost:9050

### Stop the Application

```bash
./stop.sh
```

### Restart the Application

```bash
./restart.sh
```

## Configuration

Edit `backend/.env.local` to customize settings:

```env
# Security Settings
SECURITY_ENABLED=true
APP_USERNAME=admin
APP_PASSWORD=admin123
APP_LOGIN_MAX_USES=10
APP_SESSION_TIMEOUT=3600
APP_SECRET_KEY=change-this-to-a-random-secret-key

# Access Control
LOCALHOST_ONLY=true
ALLOWED_HOSTS=127.0.0.1,localhost

# Jumphost Configuration (optional)
JUMPHOST_ENABLED=false
JUMPHOST_IP=
JUMPHOST_USERNAME=
JUMPHOST_PASSWORD=
```

## Default Credentials

- **Username**: admin
- **Password**: admin123

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, devices, automation, settings |
| **Operator** | Can manage devices, run automation, view settings |
| **Viewer** | Read-only access to view data |

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Get auth status

### Devices
- `GET /api/devices` - List devices
- `POST /api/devices` - Add device
- `PUT /api/devices/{id}` - Update device
- `DELETE /api/devices/{id}` - Delete device

### Users (Admin only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/{username}` - Update user
- `DELETE /api/users/{username}` - Delete user
- `GET /api/roles` - Get available roles

### Automation
- `POST /api/automation/start` - Start automation job
- `GET /api/automation/job/{id}` - Get job status
- `POST /api/automation/stop/{id}` - Stop job

### WebSocket
- `ws://localhost:9051/ws/jobs/{job_id}` - Real-time job updates
- `ws://localhost:9051/ws/jobs/all` - All job updates

## Project Structure

```
OSPF-LL-DEVICE_MANAGER/
├── backend/
│   ├── server.py           # FastAPI backend server
│   ├── modules/
│   │   ├── auth.py         # Authentication & authorization
│   │   ├── command_executor.py  # Automation engine
│   │   ├── websocket_manager.py # WebSocket manager
│   │   └── ...
│   ├── data/               # Device databases
│   └── requirements.txt    # Python dependencies
├── pages/                  # React page components
│   ├── Automation.tsx      # Automation page
│   ├── DataSave.tsx        # Data save/export page
│   ├── InterfaceCosts.tsx  # Interface cost calculator
│   ├── InterfaceTraffic.tsx # Traffic analysis
│   ├── OSPFDesigner.tsx    # OSPF network designer
│   └── Transformation.tsx  # Data transformation
├── components/             # Reusable React components
├── hooks/                  # React hooks
│   └── useJobWebSocket.ts  # WebSocket hook for jobs
├── types/                  # TypeScript type definitions
├── install.sh              # Installation script
├── start.sh                # Start script
├── stop.sh                 # Stop script
├── restart.sh              # Restart script
└── README.md               # This file
```

## Testing

Run validation tests with Puppeteer:

```bash
# Full security validation
node test-security-validation.cjs

# P3 features validation (WebSocket, Roles, Password hashing)
node test-p3-validation.cjs

# Automation workflow test
node test-automation-workflow.cjs
```

## Logs

Logs are stored in the `logs/` directory:
- `logs/backend.log` - Backend server logs
- `logs/frontend.log` - Frontend dev server logs

## Troubleshooting

### Port Already in Use

```bash
# Kill processes on ports
lsof -ti:9050 | xargs kill -9
lsof -ti:9051 | xargs kill -9
```

### Password Expired

Reset the login count by deleting the session file:
```bash
rm backend/auth_session.json
./restart.sh
```

### Backend Won't Start

Check the backend log:
```bash
tail -f logs/backend.log
```

### Frontend Won't Start

Check if Node.js dependencies are installed:
```bash
npm install
```

## Recent Updates

### P3 Features (Latest)
- **WebSocket Real-time Updates**: Live job progress via WebSocket
- **User Roles/Permissions**: Admin, Operator, Viewer roles with RBAC
- **Password Hashing**: SHA-256 with salt for secure password storage
- **Comprehensive Test Suite**: Puppeteer-based validation tests

### Security Enhancements
- Session-based authentication with configurable timeout
- Password expiry after configurable login attempts
- Localhost-only access option
- Jumphost support for secure router connections

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

---

**Built with Claude Code**
