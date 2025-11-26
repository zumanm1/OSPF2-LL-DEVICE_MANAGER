# OSPF-LL-DEVICE_MANAGER (NetMan)

A modern, full-stack network device configuration management application built with React (TypeScript) frontend and Python (FastAPI) backend with SQLite database.

## 🎯 Features

- ✅ **Full CRUD Operations** - Add, edit, delete network devices
- ✅ **SQLite Database** - Persistent storage with Python FastAPI backend
- ✅ **Bulk Operations** - Import/export CSV, bulk editing, bulk deletion
- ✅ **Advanced Filtering** - Search, filter by type/location, grouping
- ✅ **Dark Mode** - Toggle between light and dark themes
- ✅ **Inline Editing** - Quick tag editing directly in the table
- ✅ **State Management** - Save/load entire application state
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile
- ✅ **Type Safe** - Full TypeScript implementation
- ✅ **IP Validation** - Proper IPv4 validation (0-255 per octet)
- ✅ **Error Handling** - Comprehensive error handling and user feedback

## 🏗️ Architecture

**Frontend**:
- React 19 with TypeScript
- Vite for dev server and build
- Tailwind CSS (CDN)
- Port: 9050

**Backend**:
- Python 3.8+ with FastAPI
- SQLite database
- Pydantic for validation
- Port: 9051

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.8+
- **pip** (Python package manager)

## 🚀 Quick Start

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Install Backend Dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 3. Start the Backend Server

```bash
cd backend
source venv/bin/activate  # If not already activated
python server.py
```

Server will start on: **http://localhost:9051**
API docs: **http://localhost:9051/docs**

### 4. Start the Frontend (in a new terminal)

```bash
npm run dev
```

Frontend will start on: **http://localhost:9050**

## 📁 Project Structure

```
OSPF-LL-DEVICE_MANAGER/
├── backend/
│   ├── server.py           # FastAPI backend server
│   ├── requirements.txt    # Python dependencies
│   ├── devices.db          # SQLite database (auto-created)
│   └── README.md           # Backend documentation
├── components/
│   ├── DeviceTable.tsx     # Main table component
│   ├── DeviceFormModal.tsx # Add/Edit device modal
│   ├── ImportPreviewModal.tsx # CSV import preview
│   ├── BulkEditModal.tsx   # Bulk editing modal
│   ├── Navbar.tsx          # Navigation bar
│   └── icons/              # SVG icon components
├── App.tsx                 # Main application component
├── api.ts                  # Backend API client
├── types.ts                # TypeScript type definitions
├── constants.ts            # Static data and enums
├── index.tsx               # React entry point
├── index.html              # HTML shell
├── vite.config.ts          # Vite configuration
├── package.json            # Node dependencies
└── README.md               # This file
```

## 🔧 Configuration

### Frontend Port (default: 9050)
Edit `vite.config.ts`:
```typescript
server: {
  port: 9050,  // Change this
  host: '0.0.0.0',
}
```

### Backend Port (default: 3001)
Edit `backend/server.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=9051)  # Change port here
```

### API URL
If changing backend port, update `api.ts`:
```typescript
const API_BASE_URL = 'http://localhost:9051/api';
```

## 📦 Available Scripts

### Frontend
- `npm run dev` - Start development server (port 9050)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Backend
- `python backend/server.py` - Start FastAPI server
- Visit `/docs` for interactive API documentation

## 🎨 Features in Detail

### Device Management
- Add devices with country-based naming validation
- Inline tag editing
- Protocol-based port auto-selection (SSH→22, Telnet→23)
- Bulk edit country and tags for multiple devices

### Import/Export
- **CSV Template**: Download pre-formatted template
- **CSV Import**: Preview and validate before importing
- **CSV Export**: Export all or filtered devices
- **JSON State**: Save/load entire app state with theme

### Search & Filter
- **Search**: Multi-term search across all device fields
- **Filter**: By device type (PE, P, RR, Management)
- **Location Filter**: By country
- **Grouping**: Group by country, type, or platform

### User Interface
- **Dark Mode**: System preference detection + manual toggle
- **Responsive**: Columns hide on smaller screens
- **Animations**: Smooth transitions and modal effects
- **Accessibility**: ARIA labels and keyboard navigation

## 🐛 Bug Fixes Applied

This release includes fixes for 9 critical bugs:

1. ✅ **CSS Animation Syntax** - Fixed slideInUp animation
2. ✅ **Missing CSS File** - Removed broken index.css reference
3. ✅ **IP Validation** - Proper IPv4 validation (0-255 octets)
4. ✅ **Port Type Safety** - Fixed number type consistency
5. ✅ **CSV Template** - Corrected template format
6. ✅ **Error Handlers** - Added file read error handling
7. ✅ **SQLite Backend** - Full backend with database persistence
8. ✅ **Mock Data** - Fixed password field consistency
9. ✅ **API Integration** - Frontend-backend communication

## 🔒 Security Notes

- Passwords are stored in plain text in the database (for demo purposes)
- No authentication/authorization implemented
- CORS is wide open for development
- **DO NOT use in production without proper security measures**

## 🧪 Testing

The application includes mock data for 6 network devices:
- 2x PE routers (UK, Zimbabwe)
- 2x P routers (USA, Germany)
- 2x RR routers (UK, USA)

## 📝 API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:9051/docs
- **ReDoc**: http://localhost:9051/redoc

## 🤝 Contributing

This is a demo/prototype application. For production use:
1. Add authentication and authorization
2. Implement proper password hashing
3. Add input sanitization
4. Implement rate limiting
5. Add comprehensive testing
6. Set up proper logging
7. Configure production CORS policies

## 📄 License

MIT License - feel free to use for your own projects!

---

**Built with Claude Code** 🤖
