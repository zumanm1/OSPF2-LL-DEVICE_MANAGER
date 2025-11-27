
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Device } from '../types';
import * as API from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import DatabaseAdmin from '../components/DatabaseAdmin';
import { RealTimeProgress } from '../components/RealTimeProgress';
import { clsx } from 'clsx';
import { useJobWebSocket } from '../hooks/useJobWebSocket';

// Jumphost Configuration Component
const JumphostConfig: React.FC<{
  onStatusChange?: (connected: boolean) => void;
}> = ({ onStatusChange }) => {
  // SECURITY: Start with empty values - load from secure backend API on mount
  const [config, setConfig] = useState<API.JumphostConfig>({
    enabled: false,
    host: '',
    port: 22,
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const data = await API.getJumphostConfig();
      setConfig(prev => ({
        ...data,
        // Keep the current password if the API returns masked value
        password: data.password === '********' ? prev.password : data.password
      }));
      onStatusChange?.(data.connected || false);
    } catch (err) {
      console.error('Failed to load jumphost config:', err);
      setMessage({ type: 'error', text: 'Failed to load jumphost configuration from server' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await API.saveJumphostConfig(config);
      setMessage({ type: 'success', text: 'Jumphost configuration saved successfully' });
      loadConfig();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setMessage(null);
    try {
      // First save the config
      await API.saveJumphostConfig(config);
      // Then test
      const result = await API.testJumphostConnection();
      if (result.status === 'success') {
        setMessage({ type: 'success', text: result.message });
      } else if (result.status === 'skipped') {
        setMessage({ type: 'info', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <GlassCard className="mb-6">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          SSH Jumphost / Bastion
          {config.enabled && (
            <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded-full">
              ENABLED
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {config.connected && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              CONNECTED
            </span>
          )}
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-orange-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading jumphost configuration...</span>
                </div>
              )}

              {!isLoading && (
                <>
              {/* Enable Toggle */}
              <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                <div>
                  <label className="font-semibold text-gray-900 dark:text-white">Enable Jumphost</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Route all router connections through this bastion server
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfig({ ...config, enabled: !config.enabled });
                  }}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    config.enabled
                      ? 'bg-orange-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      config.enabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Configuration Fields */}
              <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Jumphost IP / Hostname
                  </label>
                  <input
                    type="text"
                    value={config.host}
                    onChange={e => setConfig({ ...config, host: e.target.value })}
                    placeholder="172.16.39.173"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    SSH Port
                  </label>
                  <input
                    type="number"
                    value={config.port}
                    onChange={e => setConfig({ ...config, port: parseInt(e.target.value) || 22 })}
                    placeholder="22"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={config.username}
                    onChange={e => setConfig({ ...config, username: e.target.value })}
                    placeholder="vmuser"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={config.password}
                    onChange={e => setConfig({ ...config, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Message */}
              {message && (
                <div className={`mt-4 p-3 rounded-lg ${
                  message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' :
                  message.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' :
                  'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:bg-gray-400 transition-colors font-semibold"
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
                <button
                  onClick={handleTest}
                  disabled={isTesting || !config.enabled}
                  className="px-6 py-2.5 bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-700 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 transition-colors font-semibold"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {/* Info Box */}
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-semibold mb-1">How Jumphost Works:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>All SSH connections to routers will tunnel through the jumphost</li>
                      <li>NetMan → Jumphost → Router (SSH-over-SSH tunnel)</li>
                      <li>Useful when routers are not directly accessible from this machine</li>
                    </ul>
                  </div>
                </div>
              </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

interface AutomationProps {
  devices: Device[];
}

const Automation: React.FC<AutomationProps> = ({ devices }) => {
  const navigate = useNavigate(); // React Router navigation
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [connectedDevices, setConnectedDevices] = useState<Set<string>>(new Set());
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<API.JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [automationStatus, setAutomationStatus] = useState<API.AutomationStatus | null>(null);

  // Command Management State - synced with backend OSPF_COMMANDS
  const [availableCommands, setAvailableCommands] = useState<{ command: string, enabled: boolean }[]>([
    { command: "terminal length 0", enabled: true },
    { command: "show process cpu", enabled: true },
    { command: "show process memory", enabled: true },
    { command: "show route connected", enabled: true },
    { command: "show route ospf", enabled: true },
    { command: "show ospf database", enabled: true },
    { command: "show ospf database self-originate", enabled: true },
    { command: "show ospf database router", enabled: true },
    { command: "show ospf database network", enabled: true },
    { command: "show ospf interface brief", enabled: true },
    { command: "show ospf neighbor", enabled: true },
    { command: "show running-config router ospf", enabled: true },
    { command: "show cdp neighbor", enabled: true }
  ]);
  const [newCommand, setNewCommand] = useState("");

  // Batch Processing State
  const [batchSize, setBatchSize] = useState<number>(10);  // Default: 10 devices per batch
  const [devicesPerHour, setDevicesPerHour] = useState<number>(0);  // Default: 0 = no rate limit

  // Connection Mode State (PHASE 2 Feature)
  const [connectionMode, setConnectionMode] = useState<'parallel' | 'sequential'>('parallel');  // Default: parallel

  // Auto-Transform State
  const [autoTransform, setAutoTransform] = useState<boolean>(true);  // Default: enabled
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformMessage, setTransformMessage] = useState<string | null>(null);
  const [previousJobStatus, setPreviousJobStatus] = useState<string | null>(null);

  // WebSocket for real-time job updates
  const { isConnected: wsConnected } = useJobWebSocket({
    jobId: activeJobId,
    enabled: !!activeJobId,
    onUpdate: useCallback((data) => {
      // Update job status from WebSocket
      if (data && data.job_id === activeJobId) {
        setJobStatus(prev => {
          // Map WebSocket current_device to JobStatus format with defaults
          const currentDevice = data.current_device ? {
            device_id: data.current_device.device_id,
            device_name: data.current_device.device_name,
            country: data.current_device.country,
            current_command: data.current_device.current_command || '',
            command_index: data.current_device.command_index || 0,
            total_commands: data.current_device.total_commands || 0,
            command_percent: 0,
            command_elapsed_time: 0,
          } : prev?.current_device || null;

          return {
            ...prev,
            status: data.status,
            progress_percent: data.progress_percent,
            total_devices: data.total_devices,
            completed_devices: data.completed_devices,
            current_device: currentDevice,
            device_progress: data.device_progress || prev?.device_progress || {},
            country_stats: data.country_stats || prev?.country_stats || {},
            errors: data.errors || prev?.errors || [],
            results: prev?.results || {}
          } as API.JobStatus;
        });

        // Check for job completion to trigger auto-transform
        if (data.status === 'completed' && previousJobStatus === 'running' && autoTransform) {
          triggerAutoTransform();
        }
        setPreviousJobStatus(data.status);
      }
    }, [activeJobId, previousJobStatus, autoTransform])
  });

  // Load automation status on mount
  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Poll job status if active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeJobId) {
      loadJobStatus(activeJobId);
      // Faster polling for real-time updates
      interval = setInterval(() => loadJobStatus(activeJobId), 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeJobId]);

  const loadStatus = async () => {
    try {
      const status = await API.automationStatus();
      setAutomationStatus(status);
      setConnectedDevices(new Set(status.connected_devices));
    } catch (err) {
      console.error('Failed to load automation status:', err);
    }
  };

  const loadJobStatus = async (jobId: string) => {
    try {
      const status = await API.getAutomationJob(jobId);
      setJobStatus(status);

      // Check if job just completed (transition from running to completed)
      if (status.status === 'completed' && previousJobStatus === 'running' && autoTransform) {
        // Trigger auto-transform
        triggerAutoTransform();
      }

      // Update previous status for next comparison
      setPreviousJobStatus(status.status);

      if (status.status === 'completed' || status.status === 'failed' || status.status === 'stopped') {
        // Job finished, stop polling (but keep jobId to show results until cleared)
      }
    } catch (err) {
      console.error('Failed to load job status:', err);
    }
  };

  const triggerAutoTransform = async () => {
    setIsTransforming(true);
    setTransformMessage('Auto-transforming collected data...');
    try {
      // Generate topology from collected data
      await API.generateTopology();
      // Transform interface data
      await API.transformInterfaces();
      setTransformMessage('Auto-transform completed! Data ready for analysis.');
      setTimeout(() => setTransformMessage(null), 5000);
    } catch (err) {
      console.error('Auto-transform failed:', err);
      setTransformMessage('Auto-transform failed. You can manually transform on the Transformation page.');
      setTimeout(() => setTransformMessage(null), 8000);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleSelectDevice = (deviceId: string) => {
    const newSet = new Set(selectedDeviceIds);
    if (newSet.has(deviceId)) {
      newSet.delete(deviceId);
    } else {
      newSet.add(deviceId);
    }
    setSelectedDeviceIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedDeviceIds.size === devices.length) {
      setSelectedDeviceIds(new Set());
    } else {
      setSelectedDeviceIds(new Set(devices.map(d => d.id)));
    }
  };

  const handleConnect = async () => {
    if (selectedDeviceIds.size === 0) {
      setError('Please select at least one device');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const deviceCount = selectedDeviceIds.size;

      // Show progress message for large batches
      if (deviceCount > 5) {
        setError(`⏳ Connecting to ${deviceCount} devices... This may take up to 2 minutes. Please wait.`);
      }

      const result = await API.automationConnect(Array.from(selectedDeviceIds), connectionMode);

      if (result.error_count > 0) {
        setError(`⚠️ Connected to ${result.success_count}/${result.total_devices} devices. ${result.error_count} failed. Check device credentials and network connectivity.`);
      } else {
        setError(null); // Clear progress message on success
      }

      await loadStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';

      // Better error messages for common issues
      if (message.includes('timed out')) {
        setError(`❌ Connection timeout: Too many devices or slow network. Try connecting fewer devices at once (recommended: max 10 at a time).`);
      } else if (message.includes('Network error')) {
        setError(`❌ Network error: Cannot reach backend server. Check if the backend is running on port 9051.`);
      } else if (message.includes('500')) {
        setError(`❌ Server error: ${message}. Check backend logs for details.`);
      } else {
        setError(`❌ ${message}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (connectedDevices.size === 0) {
      setError('No devices connected');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await API.automationDisconnect(Array.from(connectedDevices));
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartJob = async (failedOnly: boolean = false) => {
    // LAZY CONNECTION: No need to connect first - backend will connect on-demand
    if (selectedDeviceIds.size === 0) {
      setError('Please select at least one device');
      return;
    }

    setError(null);
    setJobStatus(null);

    try {
      let devicesToRun: string[] = Array.from(selectedDeviceIds);

      // Filter if retrying failed (based on previous job)
      if (failedOnly && jobStatus && jobStatus.results) {
        devicesToRun = devicesToRun.filter(id => {
          const res = jobStatus.results[id];
          return !res || res.status === 'failed' || res.status === 'error';
        });
        if (devicesToRun.length === 0) {
          setError("No failed devices to retry.");
          return;
        }
      }

      // Get enabled commands
      const activeCommands = availableCommands.filter(c => c.enabled).map(c => c.command);

      // Show progress message
      setError(`⏳ Starting automation for ${devicesToRun.length} devices... Backend will connect automatically in batches of ${batchSize}.`);

      // Start job with batch processing and rate limiting
      const result = await API.startAutomationJob(devicesToRun, activeCommands, batchSize, devicesPerHour);
      setActiveJobId(result.job_id);

      // Clear progress message
      setError(null);

      // Log batch information
      if (result.total_batches > 1) {
        console.log(`🔄 Job will process ${result.total_batches} batches of ${result.batch_size} devices each`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start job');
    }
  };

  const handleStopJob = async () => {
    if (!activeJobId) return;
    try {
      await API.stopAutomationJob(activeJobId);
    } catch (err) {
      console.error("Failed to stop job", err);
    }
  };

  const handleClearJob = () => {
    setActiveJobId(null);
    setJobStatus(null);
  };

  const calculateStats = () => {
    if (!jobStatus) return null;
    let totalSuccess = 0;
    let totalFailed = 0;

    Object.values(jobStatus.results).forEach((res: any) => {
      if (res.commands) {
        res.commands.forEach((cmd: any) => {
          if (cmd.status === 'success') totalSuccess++;
          else totalFailed++;
        });
      } else if (res.status === 'failed') {
        // Count device failure as one failure context? 
        // Or just rely on command counts. If connection failed, 0 commands run.
      }
    });
    return { totalSuccess, totalFailed };
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-900 dark:text-white">Network Automation</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Connect to devices and execute OSPF data collection commands
        </p>

        {/* Database Administration */}
        <DatabaseAdmin dbName="automation" title="Automation Jobs" />

        {/* Jumphost Configuration */}
        <JumphostConfig />

        {/* Status Banner */}
        <AnimatePresence>
          {automationStatus && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6"
            >
              <GlassCard className="p-6 border-l-4 border-l-primary-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-8">
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Active Connections</span>
                      <div className="mt-1 text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {automationStatus.active_connections}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Total Files</span>
                      <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                        {automationStatus.file_statistics.total_files}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Storage Used</span>
                      <div className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {automationStatus.file_statistics.total_size_mb.toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* WebSocket Status Indicator */}
                    {activeJobId && (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide flex items-center gap-1.5 ${
                        wsConnected
                          ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-cyan-500 animate-pulse' : 'bg-gray-400'}`}></div>
                        {wsConnected ? 'LIVE' : 'OFFLINE'}
                      </div>
                    )}
                    <div className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wide shadow-sm ${automationStatus.status === 'operational'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                      }`}>
                      {automationStatus.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                    </svg>
                  </div>
                  <span className="text-red-800 dark:text-red-300 font-medium">{error}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device Selection Panel */}
          <div className="lg:col-span-1">
            <GlassCard className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Devices</h2>
                <button
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  {selectedDeviceIds.size === devices.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                {devices.map(device => {
                  const isSelected = selectedDeviceIds.has(device.id);
                  const isConnected = connectedDevices.has(device.id);

                  return (
                    <motion.div
                      key={device.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectDevice(device.id)}
                      className={clsx(
                        "p-3 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden",
                        isSelected
                          ? "bg-primary-50 dark:bg-primary-900/30 border-primary-500 shadow-md"
                          : "bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary-500/5 pointer-events-none" />
                      )}
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                            isSelected ? "bg-primary-500 border-primary-500" : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                          )}>
                            {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white text-sm">
                              {device.deviceName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                              {device.ipAddress}
                            </div>
                          </div>
                        </div>
                        {isConnected && (
                          <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-full border border-green-200 dark:border-green-800">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                            <span className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Live</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-6 space-y-3 pt-6 border-t border-gray-100 dark:border-gray-700/50">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting || selectedDeviceIds.size === 0}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl hover:from-green-700 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20 font-semibold text-sm"
                >
                  {isConnecting ? 'Connecting...' : `Connect(${selectedDeviceIds.size})`}
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isConnecting || connectedDevices.size === 0}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-sm"
                >
                  {isConnecting ? 'Disconnecting...' : 'Disconnect All'}
                </button>
              </div>
            </GlassCard>
          </div>

          {/* Execution Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Batch Configuration */}
            <GlassCard>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Batch Configuration
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Batch Size Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Batch Size (devices per batch)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={2}
                      max={50}
                      value={batchSize}
                      onChange={e => {
                        const value = parseInt(e.target.value) || 2;
                        setBatchSize(Math.max(2, Math.min(50, value)));
                      }}
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-gray-900 dark:text-white font-medium"
                      placeholder="2-50"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                      min: 2
                    </div>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {[5, 10, 15, 20].map(size => (
                      <button
                        key={size}
                        onClick={() => setBatchSize(size)}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${batchSize === size
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                    <button
                      onClick={() => setBatchSize(0)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${batchSize === 0
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                  </div>
                </div>

                {/* Estimated Batches */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Estimated Batches
                  </label>
                  <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-between h-[42px]">
                    <span className="text-gray-900 dark:text-white font-bold text-lg">
                      {selectedDeviceIds.size > 0 && batchSize > 0
                        ? Math.ceil(selectedDeviceIds.size / batchSize)
                        : selectedDeviceIds.size > 0
                          ? 1
                          : 0}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      batch{((selectedDeviceIds.size > 0 && batchSize > 0
                        ? Math.ceil(selectedDeviceIds.size / batchSize)
                        : selectedDeviceIds.size > 0
                          ? 1
                          : 0) !== 1) ? 'es' : ''}
                    </span>
                  </div>
                  {selectedDeviceIds.size > 0 && batchSize > 0 && (
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {selectedDeviceIds.size % batchSize !== 0 && (
                        <span>Last batch: {selectedDeviceIds.size % batchSize} devices</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Rate Limiting */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Rate Limit (devices/hour)
                  </label>
                  <select
                    value={devicesPerHour}
                    onChange={e => setDevicesPerHour(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-gray-900 dark:text-white font-medium h-[42px]"
                  >
                    <option value={0}>No limit (max speed)</option>
                    <option value={10}>10 devices/hour</option>
                    <option value={20}>20 devices/hour</option>
                    <option value={30}>30 devices/hour</option>
                    <option value={50}>50 devices/hour</option>
                    <option value={100}>100 devices/hour</option>
                  </select>
                  {devicesPerHour > 0 && selectedDeviceIds.size > 0 && (
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      Est. time: ~{Math.ceil((selectedDeviceIds.size / devicesPerHour) * 60)} min
                    </div>
                  )}
                </div>
              </div>

              {/* Connection Mode Toggle (PHASE 2 Feature) */}
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Connection Mode
                  <span className="ml-auto text-xs font-normal text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full">
                    PHASE 2
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConnectionMode('parallel')}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${connectionMode === 'parallel'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/50 scale-105'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Parallel</span>
                      {connectionMode === 'parallel' && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                      ⚡ Fast (Default)
                    </div>
                  </button>

                  <button
                    onClick={() => setConnectionMode('sequential')}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${connectionMode === 'sequential'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50 scale-105'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      <span>Sequential</span>
                      {connectionMode === 'sequential' && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                      🐢 Slow but safe
                    </div>
                  </button>
                </div>

                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  {connectionMode === 'parallel' ? (
                    <span>✅ Connects to multiple devices simultaneously (up to 10 at once). Faster but uses more resources.</span>
                  ) : (
                    <span>⏱️ Connects to devices one at a time. Slower but more reliable for unstable networks.</span>
                  )}
                </div>
              </div>

              {/* Auto-Transform Toggle */}
              <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Auto-Transform on Completion
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Automatically generate topology when automation finishes
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoTransform(!autoTransform)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      autoTransform ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        autoTransform ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {autoTransform && (
                  <div className="mt-2 text-xs text-green-700 dark:text-green-300">
                    ✅ When job completes: Topology + Interface data will auto-transform
                  </div>
                )}
              </div>

              {/* Transform Status Message */}
              {transformMessage && (
                <div className={`mt-4 p-4 rounded-xl border flex items-center gap-3 ${
                  isTransforming
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : transformMessage.includes('completed')
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}>
                  {isTransforming ? (
                    <svg className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : transformMessage.includes('completed') ? (
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <span className={`text-sm font-medium ${
                    isTransforming
                      ? 'text-blue-800 dark:text-blue-300'
                      : transformMessage.includes('completed')
                      ? 'text-green-800 dark:text-green-300'
                      : 'text-amber-800 dark:text-amber-300'
                  }`}>
                    {transformMessage}
                  </span>
                </div>
              )}

              {/* Info Cards */}
              <div className="mt-4 space-y-3">
                {/* Batch Processing Tips */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-semibold mb-1">💡 Batch Processing Tips:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Batch size: <strong>2-50 devices</strong> (recommended: 10)</li>
                        <li>Smaller batches = more reliable, larger batches = faster</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Rate Limiting Info */}
                {devicesPerHour > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div className="text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-semibold mb-1">⏱️ Rate Limiting Active:</p>
                        <p>Processing <strong>{devicesPerHour} devices per hour</strong> to prevent network overload. Delays will be added between batches.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation Warning */}
                {batchSize > 0 && selectedDeviceIds.size > 0 && batchSize > selectedDeviceIds.size && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <div className="text-sm text-yellow-800 dark:text-yellow-300">
                        <p className="font-semibold">⚠️ Batch size ({batchSize}) is larger than selected devices ({selectedDeviceIds.size})</p>
                        <p>All devices will be processed in a single batch.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Command Execution
              </h2>

              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                  OSPF Data Collection Commands
                </h3>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-1 border border-gray-200 dark:border-gray-700/50">
                  <div className="space-y-1 max-h-[520px] overflow-y-auto p-2 custom-scrollbar">
                    {availableCommands.map((cmd, index) => (
                      <label key={index} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={cmd.enabled}
                          onChange={() => {
                            const newCommands = [...availableCommands];
                            newCommands[index].enabled = !newCommands[index].enabled;
                            setAvailableCommands(newCommands);
                          }}
                          className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className={clsx(
                          "text-sm font-mono transition-colors",
                          cmd.enabled ? "text-gray-900 dark:text-gray-200 font-medium" : "text-gray-400 dark:text-gray-500 line-through"
                        )}>
                          {cmd.command}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t border-gray-200 dark:border-gray-700/50 mt-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCommand}
                        onChange={(e) => setNewCommand(e.target.value)}
                        placeholder="Add custom command..."
                        className="flex-1 text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newCommand.trim()) {
                            setAvailableCommands([...availableCommands, { command: newCommand.trim(), enabled: true }]);
                            setNewCommand("");
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (newCommand.trim()) {
                            setAvailableCommands([...availableCommands, { command: newCommand.trim(), enabled: true }]);
                            setNewCommand("");
                          }
                        }}
                        className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {/* Real-Time Progress */}
              <AnimatePresence>
                {jobStatus && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-8"
                  >
                    <RealTimeProgress
                      currentDevice={jobStatus.current_device}
                      deviceProgress={jobStatus.device_progress}
                      countryStats={jobStatus.country_stats}
                      overallProgress={{
                        completed: jobStatus.completed_devices,
                        total: jobStatus.total_devices,
                        percent: jobStatus.progress_percent
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Control Buttons */}
              <div className="flex flex-wrap gap-3">
                {!activeJobId || (jobStatus?.status === 'completed' || jobStatus?.status === 'failed' || jobStatus?.status === 'stopped') ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartJob(false)}
                      disabled={selectedDeviceIds.size === 0}
                      className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20 font-semibold text-sm flex-1"
                    >
                      {selectedDeviceIds.size === 0 ? 'Select Devices to Start' : 'Start Automation'}
                    </button>
                    {jobStatus && (
                      <>
                        {jobStatus.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => navigate('/data-save')}
                            className="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold text-sm shadow-lg shadow-green-500/20 flex items-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View Data →
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartJob(true)}
                          className="px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-semibold text-sm shadow-lg shadow-orange-500/20"
                        >
                          Restart Failed
                        </button>
                        <button
                          type="button"
                          onClick={handleClearJob}
                          className="px-6 py-2.5 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors font-semibold text-sm"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopJob}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold text-sm w-full shadow-lg shadow-red-500/20 animate-pulse"
                  >
                    Stop Execution
                  </button>
                )}
              </div>
            </GlassCard>

            {/* Results */}
            <AnimatePresence>
              {jobStatus && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                >
                  <GlassCard>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Execution Results
                    </h3>

                    {/* Execution ID Display */}
                    {jobStatus.execution_id && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Execution ID:</span>
                          <code className="text-xs font-mono text-indigo-700 dark:text-indigo-300 bg-white/50 dark:bg-black/30 px-2 py-1 rounded">{jobStatus.execution_id}</code>
                        </div>
                      </div>
                    )}

                    {/* Summary Grid */}
                    {stats && (
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/50">
                          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {stats.totalSuccess}
                          </div>
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Commands Success</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/50">
                          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                            {stats.totalFailed}
                          </div>
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Commands Failed</div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {jobStatus.completed_devices}/{jobStatus.total_devices}
                          </div>
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Devices Processed</div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                      {Object.entries(jobStatus.results).map(([deviceId, result]: [string, any]) => (
                        <details key={deviceId} className={`group bg-white dark:bg-gray-800/50 rounded-xl border ${result.status === 'success' ? 'border-green-200 dark:border-green-900/50' :
                          result.status === 'failed' ? 'border-red-200 dark:border-red-900/50' :
                            'border-gray-200 dark:border-gray-700'
                          } open:shadow-md transition-all duration-200`}>
                          <summary className={`flex items-center justify-between p-4 cursor-pointer list-none ${result.status === 'success' ? 'bg-green-50/30 dark:bg-green-900/10' :
                            result.status === 'failed' ? 'bg-red-50/30 dark:bg-red-900/10' :
                              'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                            } rounded-xl group-open:rounded-b-none transition-colors`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${result.status === 'success' ? 'bg-green-500 shadow-green-500/50' :
                                result.status === 'failed' ? 'bg-red-500 shadow-red-500/50' : 'bg-blue-500 animate-pulse shadow-blue-500/50'
                                }`}></div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {result.device_name}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {result.error ? (
                                <span className="text-sm text-red-600 dark:text-red-400 font-medium bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">Failed</span>
                              ) : (
                                <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                  {result.summary}
                                </span>
                              )}
                              <div className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                                <svg className="w-4 h-4 text-gray-500 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </summary>

                          <div className="p-4 border-t border-gray-100 dark:border-gray-700/50 space-y-2 bg-white/50 dark:bg-gray-800/30">
                            {result.error && (
                              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-300 font-mono mb-3 border border-red-100 dark:border-red-800/30">
                                Error: {result.error}
                              </div>
                            )}

                            {result.commands && result.commands.map((cmd: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between py-2.5 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{cmd.command}</span>
                                {cmd.status === 'success' ? (
                                  <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md border border-green-100 dark:border-green-800/30">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {cmd.execution_time_seconds?.toFixed(2)}s
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md border border-red-100 dark:border-red-800/30" title={cmd.error}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Failed
                                  </span>
                                )}
                              </div>
                            ))}

                            {(!result.commands || result.commands.length === 0) && !result.error && (
                              <div className="text-sm text-gray-500 italic text-center py-4">
                                No commands executed
                              </div>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Automation;
