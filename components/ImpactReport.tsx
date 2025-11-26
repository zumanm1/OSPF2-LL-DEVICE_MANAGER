import React from 'react';
import { motion } from 'framer-motion';

interface ChangedPath {
    source: string;
    target: string;
    old_path: string[];
    new_path: string[] | null;
    type: 'changed' | 'lost';
}

interface ImpactAnalysisResult {
    changed_paths: ChangedPath[];
    impacted_nodes: string[];
    impacted_countries: string[];
    blast_radius_score: 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
    changes_count: number;
}

interface ImpactReportProps {
    analysis: ImpactAnalysisResult | null;
    isLoading: boolean;
}

const ImpactReport: React.FC<ImpactReportProps> = ({ analysis, isLoading }) => {
    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Running OSPF Impact Analysis...</p>
                <p className="text-xs text-gray-500 mt-2">Calculating Shortest Path Trees & Blast Radius</p>
            </div>
        );
    }

    if (!analysis) return null;

    // Safely access arrays with defaults
    const changedPaths = analysis.changed_paths || [];
    const impactedNodes = analysis.impacted_nodes || [];
    const impactedCountries = analysis.impacted_countries || [];

    const getScoreColor = (score: string) => {
        switch (score) {
            case 'Critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            case 'High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
            case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Impact Analysis Report</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Predicted impact of proposed OSPF changes</p>
                </div>
                <div className={`px-4 py-2 rounded-full font-bold text-sm ${getScoreColor(analysis.blast_radius_score)}`}>
                    Blast Radius: {analysis.blast_radius_score}
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Summary Stats */}
                <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analysis.changes_count}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Proposed Changes</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{changedPaths.length}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Routing Paths Affected</div>
                    </div>
                    <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{impactedNodes.length}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Routers in Blast Radius</div>
                    </div>
                </div>

                {/* Impacted Countries */}
                <div className="md:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Impacted Regions</h3>
                    {impactedCountries.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {impactedCountries.map(country => (
                                <span key={country} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm border border-gray-200 dark:border-gray-600">
                                    {country}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic">No specific regions identified.</p>
                    )}

                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-6 mb-3 uppercase tracking-wider">Path Changes Detail</h3>
                    <div className="overflow-y-auto max-h-60 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        {changedPaths.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">No routing changes predicted.</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-100 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2">Source</th>
                                        <th className="px-4 py-2">Target</th>
                                        <th className="px-4 py-2">Old Path</th>
                                        <th className="px-4 py-2">New Path</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {changedPaths.map((path, idx) => (
                                        <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-gray-800/50">
                                            <td className="px-4 py-2 font-medium">{path.source}</td>
                                            <td className="px-4 py-2 font-medium">{path.target}</td>
                                            <td className="px-4 py-2 text-gray-500 font-mono text-xs">{path.old_path.join(' → ')}</td>
                                            <td className="px-4 py-2 font-mono text-xs">
                                                {path.type === 'lost' ? (
                                                    <span className="text-red-500 font-bold">UNREACHABLE</span>
                                                ) : (
                                                    <span className="text-blue-600 dark:text-blue-400">{path.new_path?.join(' → ')}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default ImpactReport;
