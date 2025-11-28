import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './ui/GlassCard';
import * as API from '../api';

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
  // savedEnabled tracks the ACTUAL server state (for badge display)
  // config.enabled tracks the local form state (may differ before save)
  const [savedEnabled, setSavedEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  // Track if there are unsaved changes
  const hasUnsavedChanges = config.enabled !== savedEnabled;

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
      // Update savedEnabled to reflect actual server state
      setSavedEnabled(data.enabled);
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
          {/* Show ENABLED badge only when server state is enabled (not local form state) */}
          {savedEnabled && (
            <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded-full">
              ENABLED
            </span>
          )}
          {/* Show unsaved indicator when local state differs from server state */}
          {hasUnsavedChanges && (
            <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 rounded-full animate-pulse">
              UNSAVED
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

export default JumphostConfig;



