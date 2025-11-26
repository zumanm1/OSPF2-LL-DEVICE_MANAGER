import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as API from '../api';
import { GlassCard } from './ui/GlassCard';

interface DatabaseAdminProps {
    dbName: string;
    title: string;
}

const DatabaseAdmin: React.FC<DatabaseAdminProps> = ({ dbName, title }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showConfirm, setShowConfirm] = useState<string | null>(null);

    const loadStats = async () => {
        try {
            const allStats = await API.getDatabaseStats();
            setStats(allStats[dbName]);
        } catch (err) {
            console.error('Failed to load stats', err);
        }
    };

    useEffect(() => {
        loadStats();
    }, [dbName]);

    const handleAction = async (action: string) => {
        setLoading(true);
        setMessage(null);
        try {
            let result;
            switch (action) {
                case 'clear':
                    result = await API.clearDatabase(dbName);
                    setMessage({ type: 'success', text: `Cleared ${result.tables_cleared?.length || 0} tables` });
                    break;
                case 'reset':
                    result = await API.resetDatabase(dbName);
                    setMessage({ type: 'success', text: result.action || 'Database reset' });
                    break;
                case 'export':
                    result = await API.exportDatabase(dbName);
                    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${dbName}_export_${new Date().toISOString()}.json`;
                    a.click();
                    setMessage({ type: 'success', text: 'Database exported successfully' });
                    break;
                case 'delete':
                    result = await API.deleteDatabase(dbName);
                    setMessage({ type: 'success', text: 'Database file deleted' });
                    break;
            }
            await loadStats();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Action failed' });
        } finally {
            setLoading(false);
            setShowConfirm(null);
        }
    };

    const confirmAction = (action: string) => {
        setShowConfirm(action);
    };

    return (
        <GlassCard className="mb-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    🗄️ {title} Database
                </h3>
                <button
                    onClick={loadStats}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                    Refresh
                </button>
            </div>

            {stats && stats.exists && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Size</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {stats.size_mb.toFixed(2)} MB
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Tables</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {Object.keys(stats.tables || {}).length}
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Records</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {Object.values(stats.tables || {}).reduce((a: number, b: any) => a + b, 0)}
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                            Active
                        </div>
                    </div>
                </div>
            )}

            {stats && stats.exists && stats.tables && (
                <div className="mb-4">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tables:</div>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(stats.tables).map(([table, count]: [string, any]) => (
                            <div key={table} className="flex justify-between text-sm bg-gray-50 dark:bg-gray-800/30 px-3 py-2 rounded">
                                <span className="text-gray-600 dark:text-gray-400">{table}</span>
                                <span className="font-mono text-gray-900 dark:text-white">{count} rows</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => confirmAction('clear')}
                    disabled={loading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 text-sm font-medium"
                >
                    Clear Data
                </button>
                <button
                    onClick={() => confirmAction('reset')}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                    Reset to Default
                </button>
                <button
                    onClick={() => handleAction('export')}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                    Export JSON
                </button>
                <button
                    onClick={() => confirmAction('delete')}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                    Delete DB File
                </button>
            </div>

            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`mt-4 p-3 rounded-lg ${message.type === 'success'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                            }`}
                    >
                        {message.text}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                        onClick={() => setShowConfirm(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                Confirm {showConfirm.charAt(0).toUpperCase() + showConfirm.slice(1)}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Are you sure you want to {showConfirm} the {title} database? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleAction(showConfirm)}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => setShowConfirm(null)}
                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </GlassCard>
    );
};

export default DatabaseAdmin;
