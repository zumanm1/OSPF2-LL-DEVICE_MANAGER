import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Device, DeviceType, Platform, Software, Protocol } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import { COUNTRIES } from './constants';
import DeviceTable from './components/DeviceTable';
import DeviceFormModal from './components/DeviceFormModal';
import ImportPreviewModal, { PreviewRow } from './components/ImportPreviewModal';
import BulkEditModal from './components/BulkEditModal';
import Navbar from './components/Navbar';
import PipelineVisualization from './components/PipelineVisualization';
import Automation from './pages/Automation';
import DataSave from './pages/DataSave';
import Transformation from './pages/Transformation';
import InterfaceCosts from './pages/InterfaceCosts';
import InterfaceTraffic from './pages/InterfaceTraffic';
import OSPFDesigner from './pages/OSPFDesigner';
import Login from './pages/Login';
import PlusIcon from './components/icons/PlusIcon';
import DownloadIcon from './components/icons/DownloadIcon';
import ImportIcon from './components/icons/ImportIcon';
import ExportIcon from './components/icons/ExportIcon';
import PencilIcon from './components/icons/PencilIcon';
import TrashIcon from './components/icons/TrashIcon';
import SearchIcon from './components/icons/SearchIcon';
import ChevronDownIcon from './components/icons/ChevronDownIcon';
import DatabaseAdmin from './components/DatabaseAdmin';
import * as API from './api';

type SortDirection = 'ascending' | 'descending';
interface SortConfig {
  key: keyof Device;
  direction: SortDirection;
}

export interface BulkUpdateData {
  country?: string;
  tagsToAdd?: string[];
  tagsToRemove?: string[];
}

// Proper IP validation: each octet must be 0-255
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// A simple dropdown component for the actions menu
const ActionsDropdown: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700/80 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-800 focus:ring-blue-500 transition-all border border-gray-300 dark:border-gray-600"
      >
        Actions
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-30 animate-scale-in"
          style={{ transformOrigin: 'top right' }}
        >
          <div className="py-1" onClick={() => setIsOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};


const App: React.FC = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'deviceName', direction: 'ascending' });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [groupBy, setGroupBy] = useState<keyof Device | 'None'>('None');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const location = useLocation(); // React Router location hook

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('http://localhost:9051/api/auth/status', {
        credentials: 'include',
      });
      const status = await response.json();

      // If security is disabled, auto-authenticate
      if (!status.security_enabled) {
        setIsAuthenticated(true);
        setCurrentUser('admin');
        return;
      }

      // Check if already authenticated
      if (status.authenticated && status.session) {
        setIsAuthenticated(true);
        setCurrentUser(status.session.username);
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      // If we can't connect, show login page
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLoginSuccess = (token: string, username: string) => {
    setIsAuthenticated(true);
    setCurrentUser(username);
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:9051/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('session_token');
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // Load devices from Python backend on mount (moved BEFORE conditional returns to follow hooks rules)
  useEffect(() => {
    async function loadDevices() {
      try {
        setIsLoading(true);
        setApiError(null);
        const loadedDevices = await API.getAllDevices();
        setDevices(loadedDevices);
        console.log(`✅ Loaded ${loadedDevices.length} devices from backend`);
      } catch (error) {
        console.error('Failed to load devices:', error);
        setApiError(error instanceof Error ? error.message : 'Failed to connect to backend');
        // Don't fallback to mock data - show error instead
      } finally {
        setIsLoading(false);
      }
    }

    loadDevices();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);


  const handleOpenModal = useCallback(() => {
    setEditingDevice(null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingDevice(null);
  }, []);

  const handleEditDevice = useCallback((device: Device) => {
    setEditingDevice(device);
    setIsModalOpen(true);
  }, []);

  const handleUpdateDevice = useCallback(async (updatedDevice: Device) => {
    try {
      await API.updateDevice(updatedDevice.id, updatedDevice);
      const devices = await API.getAllDevices();
      setDevices(devices);
    } catch (error) {
      console.error('Failed to update device:', error);
      alert(`Error: Failed to update device. ${error instanceof Error ? error.message : ''}`);
    }
  }, []);

  const handleDeleteDevice = useCallback(async (device: Device) => {
    if (window.confirm(`Are you sure you want to delete the device "${device.deviceName}"?`)) {
      try {
        await API.deleteDevice(device.id);
        const devices = await API.getAllDevices();
        setDevices(devices);
      } catch (error) {
        console.error('Failed to delete device:', error);
        alert(`Error: Failed to delete device. ${error instanceof Error ? error.message : ''}`);
      }
    }
  }, []);

  const handleFormSubmit = useCallback(async (device: Device) => {
    try {
      if (editingDevice) {
        await handleUpdateDevice(device);
      } else {
        await API.createDevice(device);
        const devices = await API.getAllDevices();
        setDevices(devices);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save device:', error);
      alert(`Error: Failed to save device. ${error instanceof Error ? error.message : ''}`);
    }
  }, [editingDevice, handleCloseModal, handleUpdateDevice]);

  const requestSort = (key: keyof Device) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleDownloadTemplate = () => {
    const headers = ['deviceName', 'ipAddress', 'protocol', 'port', 'username', 'password', 'country', 'deviceType', 'platform', 'software', 'tags'];
    // Fixed: Ensure all required fields are present and properly formatted
    const examples = [
      'gbr-lon-p-02,10.1.1.2,SSH,22,cisco,password123,United Kingdom,P,3725,IOS,"core;london"',
      'usa-chi-pe-01,10.2.2.3,Telnet,23,admin,password123,United States,PE,ISR4000,IOS XE,datacenter'
    ];
    const csvContent = [headers.join(','), ...examples].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'device-import-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDevicesToCsv = (devicesToExport: Device[], filename: string) => {
    const headers = ['id', 'deviceName', 'ipAddress', 'protocol', 'port', 'username', 'password', 'country', 'deviceType', 'platform', 'software', 'tags'];
    const csvRows = devicesToExport.map(device =>
      headers.map(header => {
        if (header === 'tags') {
          return `"${(device.tags || []).join(';')}"`;
        }
        return `"${(device as any)[header] ?? ''}"`;
      }).join(',')
    );

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    exportDevicesToCsv(devices, `network-devices-export-all-${timestamp}.csv`);
  };

  const handleExportFiltered = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    exportDevicesToCsv(sortedAndFilteredDevices, `network-devices-export-filtered-${timestamp}.csv`);
  };


  const validatePreviewRow = (rowData: { [key: string]: string }): string[] => {
    const errors: string[] = [];
    if (!rowData.deviceName || !rowData.ipAddress || !rowData.username) {
      errors.push("Missing required field (deviceName, ipAddress, or username).");
    }
    if (rowData.ipAddress && !IP_REGEX.test(rowData.ipAddress)) {
      errors.push(`Invalid IP address format: ${rowData.ipAddress}.`);
    }
    if (rowData.protocol && !Object.values(Protocol).includes(rowData.protocol as Protocol)) {
      errors.push(`Invalid protocol. Use one of: ${Object.values(Protocol).join(', ')}.`);
    }
    if (rowData.deviceType && !Object.values(DeviceType).includes(rowData.deviceType as DeviceType)) {
      errors.push(`Invalid deviceType. Use one of: ${Object.values(DeviceType).join(', ')}.`);
    }
    if (rowData.platform && !Object.values(Platform).includes(rowData.platform as Platform)) {
      errors.push(`Invalid platform. Use one of: ${Object.values(Platform).join(', ')}.`);
    }
    if (rowData.software && !Object.values(Software).includes(rowData.software as Software)) {
      errors.push(`Invalid software. Use one of: ${Object.values(Software).join(', ')}.`);
    }
    if (rowData.country && !COUNTRIES.some(c => c.name === rowData.country)) {
      errors.push(`Invalid country name.`);
    }
    return errors;
  };

  const handleImportCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.trim().split(/\r?\n/);
      const headers = lines[0].split(',').map(h => h.trim());
      const requiredHeaders = ['deviceName', 'ipAddress', 'protocol', 'port', 'country', 'deviceType', 'platform', 'software'];

      if (!requiredHeaders.every(h => headers.includes(h))) {
        alert('Import failed: CSV file is missing required headers.\nRequired: ' + requiredHeaders.join(', '));
        return;
      }

      const parsedData: PreviewRow[] = lines.slice(1).map((line, index) => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: { [key: string]: string } = {};
        headers.forEach((header, i) => {
          rowData[header] = values[i];
        });
        return {
          rowData,
          rowNum: index + 2,
          errors: validatePreviewRow(rowData)
        };
      });

      setPreviewData(parsedData);
      setIsPreviewOpen(true);
    };
    reader.onerror = () => {
      console.error("CSV file read error:", reader.error);
      alert("Error reading CSV file. Please ensure the file is valid and try again.");
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async (devicesToImport: Device[]) => {
    try {
      await API.bulkImportDevices(devicesToImport);
      const devices = await API.getAllDevices();
      setDevices(devices);
      setIsPreviewOpen(false);
      alert(`Successfully imported ${devicesToImport.length} devices.`);
    } catch (error) {
      console.error('Failed to import devices:', error);
      alert(`Error: Failed to import devices. ${error instanceof Error ? error.message : ''}`);
    }
  };

  const handleSaveState = () => {
    const stateToSave = {
      theme,
      devices,
    };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.setAttribute('download', `network-devices-config-${timestamp}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadState = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (data && (data.theme === 'light' || data.theme === 'dark') && Array.isArray(data.devices)) {
          setTheme(data.theme);
          setDevices(data.devices);
          alert("Configuration loaded successfully.");
        } else {
          throw new Error("Invalid configuration file format.");
        }
      } catch (error) {
        console.error("Failed to load or parse configuration file:", error);
        alert(`Error: Could not load configuration. The file might be corrupted or in the wrong format.`);
      }
    };
    reader.onerror = () => {
      console.error("JSON file read error:", reader.error);
      alert("Error reading configuration file. Please try again.");
    };
    reader.readAsText(file);
  };

  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleLoadState(file);
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const handleLoadStateClick = () => {
    jsonInputRef.current?.click();
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleImportCsv(file);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const sortedAndFilteredDevices = useMemo(() => {
    let filtered = [...devices];

    if (deviceTypeFilter !== 'All') {
      filtered = filtered.filter(device => device.deviceType === deviceTypeFilter);
    }

    if (selectedLocation !== 'All') {
      filtered = filtered.filter(device => device.country === selectedLocation);
    }

    const searchTerms = searchQuery.toLowerCase().split(' ').filter(Boolean);

    if (searchTerms.length > 0) {
      filtered = filtered.filter(device => {
        return searchTerms.every(term => {
          return (
            device.deviceName.toLowerCase().includes(term) ||
            device.ipAddress.toLowerCase().includes(term) ||
            device.protocol.toLowerCase().includes(term) ||
            device.port.toString().includes(term) ||
            device.country.toLowerCase().includes(term) ||
            device.username.toLowerCase().includes(term) ||
            device.deviceType.toLowerCase().includes(term) ||
            device.platform.toLowerCase().includes(term) ||
            device.software.toLowerCase().includes(term) ||
            device.tags.some(tag => tag.toLowerCase().includes(term))
          );
        });
      });
    }

    if (sortConfig) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [devices, searchQuery, sortConfig, deviceTypeFilter, selectedLocation]);

  useEffect(() => {
    // Clear selection if filtered devices change
    const visibleIds = new Set(sortedAndFilteredDevices.map(d => d.id));
    setSelectedDeviceIds(currentSelection => {
      const newSelection = new Set<string>();
      currentSelection.forEach(id => {
        if (visibleIds.has(id)) {
          newSelection.add(id);
        }
      });
      return newSelection;
    });
  }, [sortedAndFilteredDevices]);


  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceIds(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(deviceId)) {
        newSelection.delete(deviceId);
      } else {
        newSelection.add(deviceId);
      }
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    if (selectedDeviceIds.size === sortedAndFilteredDevices.length) {
      setSelectedDeviceIds(new Set());
    } else {
      setSelectedDeviceIds(new Set(sortedAndFilteredDevices.map(d => d.id)));
    }
  };

  const handleBulkUpdate = async (updateData: BulkUpdateData) => {
    try {
      // Update each selected device
      const updatePromises = devices
        .filter(device => selectedDeviceIds.has(device.id))
        .map(async device => {
          const newDevice = { ...device };

          if (updateData.country && updateData.country !== 'Unchanged') {
            newDevice.country = updateData.country;
          }

          const currentTags = new Set(newDevice.tags || []);
          updateData.tagsToAdd?.forEach(tag => currentTags.add(tag));
          updateData.tagsToRemove?.forEach(tag => currentTags.delete(tag));
          newDevice.tags = Array.from(currentTags).sort();

          return API.updateDevice(newDevice.id, newDevice);
        });

      await Promise.all(updatePromises);
      const updatedDevices = await API.getAllDevices();
      setDevices(updatedDevices);
      setIsBulkEditModalOpen(false);
      setSelectedDeviceIds(new Set());
    } catch (error) {
      console.error('Failed to bulk update devices:', error);
      alert(`Error: Failed to update devices. ${error instanceof Error ? error.message : ''}`);
    }
  };

  const handleBulkDelete = useCallback(async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedDeviceIds.size} selected device(s)? This action cannot be undone.`)) {
      try {
        await API.bulkDeleteDevices(Array.from(selectedDeviceIds));
        const devices = await API.getAllDevices();
        setDevices(devices);
        setSelectedDeviceIds(new Set());
      } catch (error) {
        console.error('Failed to bulk delete devices:', error);
        alert(`Error: Failed to delete devices. ${error instanceof Error ? error.message : ''}`);
      }
    }
  }, [selectedDeviceIds]);

  // === AUTHENTICATION CHECKS (must be after all hooks) ===
  // Show loading spinner while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="text-white text-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          Loading...
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // === MAIN APPLICATION RENDER ===
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-300">
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        onSaveState={handleSaveState}
        onLoadStateClick={handleLoadStateClick}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <input type="file" ref={jsonInputRef} onChange={handleJsonUpload} accept=".json" className="hidden" id="json-importer" />

      {/* Pipeline Visualization Dashboard */}
      {location.pathname !== '/' && (
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <PipelineVisualization />
        </div>
      )}

      <Routes>
        <Route path="/" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Device Manager</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage and monitor your network infrastructure</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => csvInputRef.current?.click()}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <ImportIcon className="-ml-1 mr-2 h-5 w-5" />
                      Import CSV
                    </button>
                    <button
                      onClick={() => {
                        setEditingDevice(null);
                        setIsModalOpen(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                      Add Device
                    </button>
                  </div>
                </div>

                {/* Database Administration */}
                <DatabaseAdmin dbName="devices" title="Device Manager" />

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Search Bar */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <SearchIcon className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search devices..."
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-shadow shadow-sm group-focus-within:shadow-md"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Filters */}
                  <select
                    value={deviceTypeFilter}
                    onChange={(e) => setDeviceTypeFilter(e.target.value as DeviceType | 'All')}
                    className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <option value="All">All Types</option>
                    {Object.values(DeviceType).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>

                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <option value="All">All Locations</option>
                    {COUNTRIES.map((loc) => (
                      <option key={loc.code3} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Group By:</label>
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value as keyof Device | 'None')}
                      className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm transition-shadow hover:shadow-md"
                    >
                      <option value="None">None</option>
                      <option value="deviceType">Type</option>
                      <option value="country">Country</option>
                      <option value="platform">Platform</option>
                    </select>
                  </div>
                </div>

                {/* Bulk Actions */}
                {selectedDeviceIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-lg flex items-center justify-between"
                  >
                    <span className="text-sm text-primary-700 dark:text-primary-300 font-medium px-2">
                      {selectedDeviceIds.size} devices selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsBulkEditModalOpen(true)}
                        className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-white border border-primary-200 rounded-md hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-primary-300 dark:border-primary-700 dark:hover:bg-gray-700"
                      >
                        Bulk Edit
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-gray-800 dark:text-red-300 dark:border-red-700 dark:hover:bg-gray-700"
                      >
                        Bulk Delete
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="mt-4 flex justify-end">
                  <ActionsDropdown>
                    <label htmlFor="csv-importer" className="cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group flex items-center px-4 py-2 text-sm">
                      <ImportIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" aria-hidden="true" />
                      Import Devices (CSV)
                    </label>
                    <input type="file" ref={csvInputRef} onChange={handleCsvUpload} accept=".csv" className="hidden" id="csv-importer" />

                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                    <button onClick={handleExportFiltered} className="w-full text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group flex items-center px-4 py-2 text-sm">
                      <ExportIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" aria-hidden="true" />
                      Export Filtered (CSV)
                    </button>
                    <button onClick={handleExportAll} className="w-full text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group flex items-center px-4 py-2 text-sm">
                      <ExportIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" aria-hidden="true" />
                      Export All (CSV)
                    </button>

                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                    <button onClick={handleDownloadTemplate} className="w-full text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group flex items-center px-4 py-2 text-sm">
                      <DownloadIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" aria-hidden="true" />
                      Download Template
                    </button>
                  </ActionsDropdown>
                </div>

                <DeviceTable
                  devices={sortedAndFilteredDevices}
                  onEdit={(device) => {
                    setEditingDevice(device);
                    setIsModalOpen(true);
                  }}
                  onDelete={handleDeleteDevice}
                  onUpdateDevice={handleUpdateDevice}
                  requestSort={requestSort}
                  sortConfig={sortConfig}
                  groupBy={groupBy}
                  selectedDeviceIds={selectedDeviceIds}
                  onSelectDevice={handleSelectDevice}
                  onSelectAll={handleSelectAll}
                />
              </div>
            </main>
          </motion.div>
        } />

        <Route path="/automation" element={
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Automation devices={devices} />
          </motion.div>
        } />

        <Route path="/data-save" element={
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <DataSave />
          </motion.div>
        } />

        <Route path="/interface-costs" element={
          <motion.div
            initial={{ opacity: 0, rotateX: -10 }}
            animate={{ opacity: 1, rotateX: 0 }}
            transition={{ duration: 0.5 }}
          >
            <InterfaceCosts />
          </motion.div>
        } />

        <Route path="/ospf-designer" element={
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <OSPFDesigner />
          </motion.div>
        } />

        <Route path="/transformation" element={
          <motion.div
            initial={{ opacity: 0, rotateX: -10 }}
            animate={{ opacity: 1, rotateX: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Transformation />
          </motion.div>
        } />

        <Route path="/interface-traffic" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <InterfaceTraffic />
          </motion.div>
        } />
      </Routes>

      <DeviceFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleFormSubmit}
        initialData={editingDevice}
      />

      <ImportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        previewData={previewData}
        onConfirm={handleConfirmImport}
      />

      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        onConfirm={handleBulkUpdate}
        selectedCount={selectedDeviceIds.size}
      />
    </div>
  );
};

export default App;
