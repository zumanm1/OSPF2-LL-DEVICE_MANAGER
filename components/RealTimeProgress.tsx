import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './ui/GlassCard';

interface DeviceProgress {
    device_name: string;
    country: string;
    status: 'pending' | 'connecting' | 'connected' | 'running' | 'executing' | 'disconnecting' | 'disconnected' | 'completed' | 'failed' | 'connection_failed';
    current_command?: string;
    completed_commands: number;
    total_commands: number;
    commands: Array<{
        command: string;
        status: 'pending' | 'running' | 'success' | 'failed';
        execution_time?: number;
        error?: string;
    }>;
}

interface CountryStats {
    total_devices: number;
    completed_devices: number;
    running_devices: number;
    failed_devices: number;
}

interface CurrentDevice {
    device_id: string;
    device_name: string;
    country: string;
    current_command: string;
    command_index: number;
    total_commands: number;
}

interface RealTimeProgressProps {
    currentDevice?: CurrentDevice;
    deviceProgress?: Record<string, DeviceProgress>;
    countryStats?: Record<string, CountryStats>;
    overallProgress: {
        completed: number;
        total: number;
        percent: number;
    };
}

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
    switch (status) {
        case 'success':
            return <span className="text-green-500">✅</span>;
        case 'failed':
            return <span className="text-red-500">❌</span>;
        case 'running':
            return <span className="text-blue-500 animate-pulse">🔄</span>;
        case 'pending':
            return <span className="text-gray-400">⏳</span>;
        default:
            return <span className="text-gray-400">⏳</span>;
    }
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: Record<string, string> = {
        pending: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        connecting: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 animate-pulse',
        connected: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse',
        executing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse',
        disconnecting: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 animate-pulse',
        disconnected: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
        failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        connection_failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };

    return (
        <span className={`device-status px-2 py-1 rounded-md text-xs font-bold uppercase ${styles[status] || styles.pending}`}>
            {status.replace('_', ' ')}
        </span>
    );
};

export const RealTimeProgress: React.FC<RealTimeProgressProps> = ({
    currentDevice,
    deviceProgress,
    countryStats,
    overallProgress,
}) => {
    return (
        <div className="space-y-6">
            {/* Current Execution Banner */}
            <AnimatePresence>
                {currentDevice && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <GlassCard className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-l-blue-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                        Currently Processing
                                    </p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                                        {currentDevice.device_name} <span className="text-sm font-normal text-gray-600 dark:text-gray-400">({currentDevice.country})</span>
                                    </p>
                                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                        <span className="font-mono bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded">
                                            {currentDevice.current_command}
                                        </span>
                                        <span className="ml-2 text-gray-600 dark:text-gray-400">
                                            ({currentDevice.command_index}/{currentDevice.total_commands})
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Country Progress */}
            {countryStats && Object.keys(countryStats).length > 0 && (
                <GlassCard>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Progress by Country
                    </h3>
                    <div className="space-y-4">
                        {Object.entries(countryStats).map(([country, stats]) => {
                            const progress = (stats.completed_devices / stats.total_devices) * 100;
                            return (
                                <div key={country} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            <span className="text-2xl">{country === 'USA' ? '🇺🇸' : country === 'UK' ? '🇬🇧' : country === 'GERMANY' ? '🇩🇪' : '🌍'}</span>
                                            {country}
                                        </h4>
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                            {stats.completed_devices}/{stats.total_devices} devices
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <motion.div
                                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>
                                    <div className="flex gap-4 mt-3 text-xs font-medium">
                                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                            Running: {stats.running_devices}
                                        </span>
                                        <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                                            Done: {stats.completed_devices}
                                        </span>
                                        {stats.failed_devices > 0 && (
                                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                                <span className="w-2 h-2 bg-red-500 rounded-full" />
                                                Failed: {stats.failed_devices}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </GlassCard>
            )}

            {/* Per-Device Command Progress */}
            {deviceProgress && Object.keys(deviceProgress).length > 0 && (
                <GlassCard>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Device Progress
                    </h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {Object.entries(deviceProgress)
                            .sort(([, a], [, b]) => {
                                // Sort: active states first, then completed, then pending/failed
                                const order: Record<string, number> = {
                                    connecting: 0,
                                    connected: 1,
                                    executing: 2,
                                    running: 2,
                                    disconnecting: 3,
                                    pending: 4,
                                    completed: 5,
                                    disconnected: 6,
                                    failed: 7,
                                    connection_failed: 8
                                };
                                return (order[a.status] ?? 99) - (order[b.status] ?? 99);
                            })
                            .map(([deviceId, progress]) => {
                                const commandProgress = (progress.completed_commands / progress.total_commands) * 100;
                                return (
                                    <motion.div
                                        key={deviceId}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`border rounded-lg p-4 transition-all ${progress.status === 'running'
                                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-md'
                                            : 'border-gray-200 dark:border-gray-700'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-gray-900 dark:text-white">
                                                    {progress.device_name}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                                    {progress.country}
                                                </span>
                                            </div>
                                            <StatusBadge status={progress.status} />
                                        </div>

                                        {/* Command List */}
                                        <div className="space-y-1.5 mb-3">
                                            {progress.commands.map((cmd, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex items-center gap-2 text-sm ${cmd.status === 'running' ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                                                        }`}
                                                >
                                                    <StatusIcon status={cmd.status} />
                                                    <span className="flex-1 font-mono text-xs">{cmd.command}</span>
                                                    {cmd.execution_time && (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {cmd.execution_time.toFixed(1)}s
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="space-y-1">
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                <motion.div
                                                    className={`h-2 rounded-full ${progress.status === 'failed'
                                                        ? 'bg-red-500'
                                                        : progress.status === 'completed'
                                                            ? 'bg-green-500'
                                                            : 'bg-blue-500'
                                                        }`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${commandProgress}%` }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 text-right">
                                                {progress.completed_commands}/{progress.total_commands} commands
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                    </div>
                </GlassCard>
            )}
        </div>
    );
};
