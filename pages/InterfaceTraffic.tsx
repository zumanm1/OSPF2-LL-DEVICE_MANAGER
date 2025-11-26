import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as API from '../api';
import type { InterfaceData, CapacitySummary, TrafficMatrix } from '../api';

const InterfaceTraffic: React.FC = () => {
    const [interfaces, setInterfaces] = useState<InterfaceData[]>([]);
    const [summary, setSummary] = useState<CapacitySummary | null>(null);
    const [trafficMatrix, setTrafficMatrix] = useState<TrafficMatrix | null>(null);
    const [loading, setLoading] = useState(true);
    const [transforming, setTransforming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'summary' | 'interfaces' | 'traffic'>('summary');
    const [filterRouter, setFilterRouter] = useState<string>('all');
    const [filterCapacity, setFilterCapacity] = useState<string>('all');
    const [showPhysicalOnly, setShowPhysicalOnly] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const [interfacesData, summaryData, matrixData] = await Promise.all([
                API.getInterfaceCapacity(),
                API.getInterfaceCapacitySummary(),
                API.getTrafficMatrix()
            ]);

            setInterfaces(interfacesData.interfaces || []);
            setSummary(summaryData);
            setTrafficMatrix(matrixData);
        } catch (err) {
            setError('Failed to fetch interface data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleTransform = async () => {
        setTransforming(true);
        try {
            await API.transformInterfaces();
            await fetchData();
        } catch (err) {
            setError('Failed to transform interface data');
        } finally {
            setTransforming(false);
        }
    };

    const formatBps = (bps: number): string => {
        if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
        if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
        if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`;
        return `${bps} bps`;
    };

    const formatBw = (kbps: number): string => {
        if (kbps >= 1e6) return `${(kbps / 1e6).toFixed(0)}G`;
        if (kbps >= 1e3) return `${(kbps / 1e3).toFixed(0)}M`;
        return `${kbps}K`;
    };

    const getUtilizationColor = (pct: number): string => {
        if (pct >= 80) return 'bg-red-500';
        if (pct >= 60) return 'bg-orange-500';
        if (pct >= 40) return 'bg-yellow-500';
        if (pct >= 20) return 'bg-blue-500';
        return 'bg-green-500';
    };

    const getCapacityColor = (capacity: string): string => {
        switch (capacity) {
            case '100G': return 'bg-purple-600 text-white';
            case '40G': return 'bg-indigo-600 text-white';
            case '10G': return 'bg-blue-600 text-white';
            case '1G': return 'bg-green-600 text-white';
            case '100M': return 'bg-yellow-600 text-white';
            default: return 'bg-gray-600 text-white';
        }
    };

    const filteredInterfaces = interfaces.filter(intf => {
        if (filterRouter !== 'all' && intf.router !== filterRouter) return false;
        if (filterCapacity !== 'all' && intf.capacity_class !== filterCapacity) return false;
        if (showPhysicalOnly && !intf.is_physical) return false;
        return true;
    });

    const uniqueRouters = [...new Set(interfaces.map(i => i.router))].sort();
    const uniqueCapacities = [...new Set(interfaces.map(i => i.capacity_class))].sort();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading interface data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            {/* Header */}
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Interface Capacity & Traffic Analysis
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                        Step 2.7c - Network traffic analysis and interface capacity monitoring
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleTransform}
                        disabled={transforming}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {transforming ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                Transforming...
                            </>
                        ) : (
                            <>Transform Interface Data</>
                        )}
                    </button>
                    <button
                        onClick={fetchData}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8">
                    {[
                        { id: 'summary', label: 'Summary Dashboard' },
                        { id: 'interfaces', label: 'Interface Details' },
                        { id: 'traffic', label: 'Traffic Flow' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Summary Tab */}
            {activeTab === 'summary' && summary && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                            <div className="text-3xl font-bold text-blue-600">{summary.total_interfaces}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total Interfaces</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                            <div className="text-3xl font-bold text-green-600">{summary.physical_interfaces}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Physical Interfaces</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                            <div className="text-3xl font-bold text-purple-600">{summary.logical_interfaces}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Logical (Sub-interfaces)</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                            <div className="text-3xl font-bold text-orange-600">{summary.high_utilization.length}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">High Utilization (&gt;50%)</div>
                        </div>
                    </div>

                    {/* Capacity Class Distribution */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Interface Capacity Distribution
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(summary.by_capacity_class).sort((a, b) => b[1] - a[1]).map(([capacity, count]) => (
                                <div key={capacity} className={`px-4 py-2 rounded-lg ${getCapacityColor(capacity)}`}>
                                    <span className="font-bold">{capacity}</span>
                                    <span className="ml-2 opacity-80">({count})</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Interfaces by Router */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Interfaces by Router
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {Object.entries(summary.by_router).sort((a, b) => b[1] - a[1]).map(([router, count]) => (
                                <div key={router} className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-center">
                                    <div className="font-semibold text-gray-900 dark:text-white">{router}</div>
                                    <div className="text-2xl font-bold text-blue-600">{count}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* High Utilization Alerts */}
                    {summary.high_utilization.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="text-red-500">High Utilization Interfaces</span>
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Router</th>
                                            <th className="px-4 py-2 text-left">Interface</th>
                                            <th className="px-4 py-2 text-right">Bandwidth</th>
                                            <th className="px-4 py-2 text-right">Input %</th>
                                            <th className="px-4 py-2 text-right">Output %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                        {summary.high_utilization.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                <td className="px-4 py-2 font-medium">{item.router}</td>
                                                <td className="px-4 py-2">{item.interface}</td>
                                                <td className="px-4 py-2 text-right">{formatBw(item.bw_kbps)}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <span className={`px-2 py-1 rounded ${getUtilizationColor(item.input_pct)} text-white`}>
                                                        {item.input_pct.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <span className={`px-2 py-1 rounded ${getUtilizationColor(item.output_pct)} text-white`}>
                                                        {item.output_pct.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Interfaces Tab */}
            {activeTab === 'interfaces' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    {/* Filters */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex flex-wrap gap-4 items-center">
                        <div>
                            <label className="text-sm text-gray-600 dark:text-gray-400 mr-2">Router:</label>
                            <select
                                value={filterRouter}
                                onChange={e => setFilterRouter(e.target.value)}
                                className="px-3 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="all">All Routers</option>
                                {uniqueRouters.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-gray-600 dark:text-gray-400 mr-2">Capacity:</label>
                            <select
                                value={filterCapacity}
                                onChange={e => setFilterCapacity(e.target.value)}
                                className="px-3 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="all">All Capacities</option>
                                {uniqueCapacities.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showPhysicalOnly}
                                onChange={e => setShowPhysicalOnly(e.target.checked)}
                                className="rounded"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Physical Only</span>
                        </label>
                        <span className="text-sm text-gray-500 ml-auto">
                            Showing {filteredInterfaces.length} of {interfaces.length} interfaces
                        </span>
                    </div>

                    {/* Interface Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Router</th>
                                        <th className="px-3 py-2 text-left">Interface</th>
                                        <th className="px-3 py-2 text-left">Description</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-3 py-2 text-center">Capacity</th>
                                        <th className="px-3 py-2 text-right">Input Rate</th>
                                        <th className="px-3 py-2 text-right">Output Rate</th>
                                        <th className="px-3 py-2 text-center">In %</th>
                                        <th className="px-3 py-2 text-center">Out %</th>
                                        <th className="px-3 py-2 text-left">Neighbor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                    {filteredInterfaces.map((intf) => (
                                        <tr key={intf.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="px-3 py-2 font-medium">{intf.router}</td>
                                            <td className="px-3 py-2 font-mono text-xs">
                                                {intf.interface}
                                                {!intf.is_physical && (
                                                    <span className="ml-1 text-purple-500 text-xs">(logical)</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 max-w-xs truncate" title={intf.description}>
                                                {intf.description || '-'}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    intf.line_protocol === 'up'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                    {intf.admin_status}/{intf.line_protocol}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-1 rounded text-xs ${getCapacityColor(intf.capacity_class)}`}>
                                                    {intf.capacity_class}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-xs">
                                                {formatBps(intf.input_rate_bps)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-xs">
                                                {formatBps(intf.output_rate_bps)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="w-16 h-4 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden">
                                                    <div
                                                        className={`h-full ${getUtilizationColor(intf.input_utilization_pct)}`}
                                                        style={{ width: `${Math.min(intf.input_utilization_pct, 100)}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs text-center">{intf.input_utilization_pct.toFixed(1)}%</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="w-16 h-4 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden">
                                                    <div
                                                        className={`h-full ${getUtilizationColor(intf.output_utilization_pct)}`}
                                                        style={{ width: `${Math.min(intf.output_utilization_pct, 100)}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs text-center">{intf.output_utilization_pct.toFixed(1)}%</div>
                                            </td>
                                            <td className="px-3 py-2 text-xs">
                                                {intf.neighbor_router ? (
                                                    <span className="text-blue-600 dark:text-blue-400">
                                                        {intf.neighbor_router}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Traffic Flow Tab */}
            {activeTab === 'traffic' && trafficMatrix && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Total Traffic */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-blue-600">
                                {formatBps(trafficMatrix.total_traffic_bps)}
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">Total Network Traffic</div>
                        </div>
                    </div>

                    {/* Traffic by Country */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Traffic Flow Between Countries
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(trafficMatrix.by_country).map(([key, data]) => (
                                <div
                                    key={key}
                                    className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 rounded-lg p-4"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                            {data.source} → {data.target}
                                        </span>
                                        <span className="text-xs bg-gray-200 dark:bg-gray-500 px-2 py-1 rounded">
                                            {data.link_count} links
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Input</div>
                                            <div className="font-mono text-green-600 dark:text-green-400">
                                                {formatBps(data.total_input_bps)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Output</div>
                                            <div className="font-mono text-blue-600 dark:text-blue-400">
                                                {formatBps(data.total_output_bps)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Link Details */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Link Traffic Details
                        </h3>
                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Source</th>
                                        <th className="px-3 py-2 text-left">Source Interface</th>
                                        <th className="px-3 py-2 text-left">Target</th>
                                        <th className="px-3 py-2 text-left">Target Interface</th>
                                        <th className="px-3 py-2 text-center">Capacity</th>
                                        <th className="px-3 py-2 text-right">Input</th>
                                        <th className="px-3 py-2 text-right">Output</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                    {trafficMatrix.links.map((link, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{link.source_router}</div>
                                                <div className="text-xs text-gray-500">{link.source_country}</div>
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs">{link.source_interface}</td>
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{link.target_router}</div>
                                                <div className="text-xs text-gray-500">{link.target_country}</div>
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs">{link.target_interface}</td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-1 rounded text-xs ${getCapacityColor(link.capacity_class)}`}>
                                                    {link.capacity_class}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-xs text-green-600">
                                                {formatBps(link.input_bps)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-xs text-blue-600">
                                                {formatBps(link.output_bps)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Empty State - Improved with detailed guidance */}
            {interfaces.length === 0 && !loading && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                        <div className="text-amber-500 text-6xl mb-4">⚠️</div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                            No Interface Data Available
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Interface capacity and traffic data has not been collected yet.
                        </p>

                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 text-left">
                            <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Required Steps:</h4>
                            <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-2 list-decimal list-inside">
                                <li><strong>Step 1 - Automation:</strong> Go to the Automation page and run data collection on your devices</li>
                                <li><strong>Step 2 - Data Save:</strong> Ensure the collected data is saved (check Data Save page)</li>
                                <li><strong>Step 3 - Transform:</strong> Click "Transform Interface Data" button below</li>
                            </ol>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-6 text-left">
                            <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Required Commands (collected by automation):</h4>
                            <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1 font-mono">
                                <li>• show interface</li>
                                <li>• show interface description</li>
                                <li>• show interface brief</li>
                                <li>• show ipv4 interface brief</li>
                            </ul>
                        </div>

                        <div className="flex gap-3 justify-center">
                            <a
                                href="/automation"
                                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                Go to Automation
                            </a>
                            <button
                                onClick={handleTransform}
                                disabled={transforming}
                                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                            >
                                {transforming ? 'Transforming...' : 'Try Transform'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InterfaceTraffic;
