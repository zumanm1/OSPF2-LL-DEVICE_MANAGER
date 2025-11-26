import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ImpactReport from '../components/ImpactReport';
import * as API from '../api';
import type { OSPFLink, DraftTopology } from '../api';

const OSPFDesigner: React.FC = () => {
    const [draft, setDraft] = useState<DraftTopology | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [impactAnalysis, setImpactAnalysis] = useState<any | null>(null);
    const [editCost, setEditCost] = useState<{ id: string, cost: number } | null>(null);

    useEffect(() => {
        initializeDraft();
    }, []);

    const initializeDraft = async () => {
        try {
            setLoading(true);
            // Create new draft session
            await API.createOSPFDraft();
            // Fetch the draft
            const data = await API.getOSPFDraft();
            setDraft(data);
        } catch (error) {
            console.error('Failed to initialize draft:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateCost = async (link: OSPFLink, newCost: number) => {
        try {
            await API.updateOSPFCost(link.source, link.target, link.interface_local, newCost);

            // Refresh draft to get updated state
            const data = await API.getOSPFDraft();
            setDraft(data);
            setEditCost(null);

            // Clear previous analysis as it's now stale
            setImpactAnalysis(null);
        } catch (error) {
            console.error('Failed to update cost:', error);
            alert('Failed to update cost');
        }
    };

    const runAnalysis = async () => {
        try {
            setAnalyzing(true);
            const data = await API.runOSPFImpactAnalysis();
            setImpactAnalysis(data);
        } catch (error) {
            console.error('Failed to run analysis:', error);
            alert('Failed to run analysis');
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">OSPF Cost Designer</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Design network changes in a safe draft environment. Analyze impact before deploying.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={initializeDraft}
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Reset Draft
                        </button>
                        <button
                            onClick={runAnalysis}
                            disabled={analyzing}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/30 flex items-center gap-2"
                        >
                            {analyzing ? 'Analyzing...' : 'Run Impact Analysis'}
                        </button>
                    </div>
                </div>

                {/* Impact Report */}
                <ImpactReport analysis={impactAnalysis} isLoading={analyzing} />

                {/* Draft Topology Editor */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Draft Topology Links</h2>
                        <span className="text-sm text-gray-500">
                            {draft?.updated_links.length} changes pending
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3">Source Router</th>
                                    <th className="px-6 py-3">Interface</th>
                                    <th className="px-6 py-3">Target Router</th>
                                    <th className="px-6 py-3">Current Cost</th>
                                    <th className="px-6 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {draft?.links.map((link, idx) => {
                                    const isModified = draft.updated_links.some(
                                        ul => ul.source === link.source && ul.target === link.target && ul.interface === link.interface_local
                                    );

                                    return (
                                        <tr
                                            key={`${link.source}-${link.target}-${idx}`}
                                            className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isModified ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{link.source}</td>
                                            <td className="px-6 py-4 font-mono text-gray-500 dark:text-gray-400">{link.interface_local}</td>
                                            <td className="px-6 py-4 text-gray-900 dark:text-white">{link.target}</td>
                                            <td className="px-6 py-4">
                                                {editCost?.id === `${link.source}-${link.target}-${idx}` ? (
                                                    <input
                                                        type="number"
                                                        autoFocus
                                                        className="w-20 px-2 py-1 border border-primary-500 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                                        value={editCost.cost}
                                                        onChange={(e) => setEditCost({ ...editCost, cost: parseInt(e.target.value) || 0 })}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdateCost(link, editCost.cost);
                                                            if (e.key === 'Escape') setEditCost(null);
                                                        }}
                                                        onBlur={() => setEditCost(null)}
                                                    />
                                                ) : (
                                                    <span
                                                        className={`font-bold cursor-pointer hover:text-primary-600 ${isModified ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}
                                                        onClick={() => setEditCost({ id: `${link.source}-${link.target}-${idx}`, cost: link.cost })}
                                                    >
                                                        {link.cost}
                                                        {isModified && <span className="ml-2 text-xs font-normal text-amber-600">(Modified)</span>}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => setEditCost({ id: `${link.source}-${link.target}-${idx}`, cost: link.cost })}
                                                    className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 font-medium"
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default OSPFDesigner;
