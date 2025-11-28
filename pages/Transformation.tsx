import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as API from '../api';
import DatabaseAdmin from '../components/DatabaseAdmin';
import NetworkIcon from '../components/icons/NetworkIcon';
import DownloadIcon from '../components/icons/DownloadIcon';
import SaveIcon from '../components/icons/SaveIcon';

const Transformation: React.FC = () => {
  const navigate = useNavigate();
  const [topology, setTopology] = useState<API.TopologyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<'circle' | 'grid'>('circle');
  const [history, setHistory] = useState<any[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [newDataAvailable, setNewDataAvailable] = useState(false);

  useEffect(() => {
    loadLatestTopology();
    loadHistory();
  }, []);

  useEffect(() => {
    checkDataAvailability();
  }, [topology]);

  const checkDataAvailability = async () => {
    try {
        const files = await API.automationFiles('text');
        if (files && files.file_count > 0) {
            // If no topology exists, but files do -> New Data
            if (!topology) {
                setNewDataAvailable(true);
            } else {
                // Check if any file is newer than topology timestamp
                const topologyTime = new Date(topology.timestamp).getTime();
                // Files are sorted by created_at desc in backend
                const latestFile = files.files[0]; 
                if (latestFile) {
                    const fileTime = new Date(latestFile.created_at).getTime();
                    // Allow 5 seconds buffer for clock skew/processing time
                    if (fileTime > topologyTime + 5000) {
                        setNewDataAvailable(true);
                    } else {
                        setNewDataAvailable(false);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to check data availability", e);
    }
  };

  const loadLatestTopology = async () => {
    try {
      const data = await API.getLatestTopology();
      if (data && data.nodes && data.nodes.length > 0) {
        setTopology(data);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load topology", err);
      // Don't show error for 404 (no topology yet) - that's expected
      if (err instanceof Error && !err.message.includes('404')) {
        setError("Failed to load latest topology. Check backend connection.");
      }
    }
  };

  const loadHistory = async () => {
    try {
      const data = await API.getTopologyHistory();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load history", err);
      // Don't block UI for history load failure, but notify user
      if (err instanceof Error && !err.message.includes('404')) {
        setError("Failed to load topology history.");
      }
    }
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await API.generateTopology();
      setTopology(data);
      loadHistory(); // Refresh history
    } catch (err) {
      console.error("Failed to generate topology", err);
      setError("Failed to generate topology. Ensure automation data exists.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSnapshot = async (filename: string) => {
    try {
      setLoading(true);
      const data = await API.getTopologySnapshot(filename);
      setTopology(data);
      setSelectedSnapshot(filename);
    } catch (err) {
      console.error("Failed to load snapshot", err);
      setError("Failed to load snapshot.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSnapshot = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete snapshot ${filename}?`)) return;
    try {
      await API.deleteTopologySnapshot(filename);
      loadHistory();
      if (selectedSnapshot === filename) {
        setTopology(null);
        setSelectedSnapshot(null);
      }
    } catch (err) {
      console.error("Failed to delete snapshot", err);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to delete ALL history?")) return;
    try {
      await API.clearTopologyHistory();
      loadHistory();
      setTopology(null);
      setSelectedSnapshot(null);
    } catch (err) {
      console.error("Failed to clear history", err);
    }
  };

  const handleDownload = () => {
    if (!topology) return;
    const jsonString = JSON.stringify(topology, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `topology-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadNetvizPro = async () => {
    try {
      setLoading(true);
      const netvizData = await API.getNetvizProTopology();
      const jsonString = JSON.stringify(netvizData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `netviz-pro-topology-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download NetViz Pro topology", err);
      setError("Failed to download NetViz Pro topology. Ensure topology is generated first.");
    } finally {
      setLoading(false);
    }
  };

  // SVG Graph Logic
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 800;
  const height = 600;
  const padding = 50;

  // Dynamic country color mapping - generates consistent colors for any country
  const countryColors: Record<string, string> = {
    'USA': '#3b82f6',      // Blue
    'UK': '#ef4444',       // Red
    'Germany': '#f59e0b',  // Amber
    'France': '#8b5cf6',   // Purple
    'Japan': '#ec4899',    // Pink
    'China': '#f97316',    // Orange
    'India': '#14b8a6',    // Teal
    'Australia': '#84cc16',// Lime
    'Canada': '#06b6d4',   // Cyan
    'Brazil': '#22c55e',   // Green
    'Zimbabwe': '#a855f7', // Violet
    'South Africa': '#eab308', // Yellow
  };

  const getCountryColor = (country: string): string => {
    if (countryColors[country]) {
      return countryColors[country];
    }
    // Generate a consistent color for unknown countries based on hash
    let hash = 0;
    for (let i = 0; i < country.length; i++) {
      hash = country.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const getCoordinates = (index: number, total: number) => {
    if (layout === 'circle') {
      const radius = Math.min(width, height) / 2 - padding - 50;
      const angle = (index / total) * 2 * Math.PI;
      return {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle)
      };
    } else {
      // Grid
      const cols = Math.ceil(Math.sqrt(total));
      const cellWidth = (width - 2 * padding) / cols;
      const cellHeight = (height - 2 * padding) / cols;
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        x: padding + col * cellWidth + cellWidth / 2,
        y: padding + row * cellHeight + cellHeight / 2
      };
    }
  };

  const nodeCoordinates = React.useMemo(() => {
    if (!topology) return {};
    const coords: Record<string, { x: number, y: number }> = {};
    topology.nodes.forEach((node, index) => {
      coords[node.id] = getCoordinates(index, topology.nodes.length);
    });
    return coords;
  }, [topology, layout]);

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-screen-xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <NetworkIcon className="w-8 h-8 text-blue-600" />
              Network Topology
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Transform OSPF/CDP data into visual network graphs
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setLayout(prev => prev === 'circle' ? 'grid' : 'circle')}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Layout: {layout === 'circle' ? 'Circle' : 'Grid'}
            </button>
            <button
              onClick={() => { setTopology(null); setError(null); setSelectedSnapshot(null); }}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear View
            </button>
            {topology && (
              <>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                  <DownloadIcon className="w-5 h-5" />
                  Download JSON
                </button>
                <button
                  onClick={handleDownloadNetvizPro}
                  disabled={loading}
                  className={`flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  title="Download in NetViz Pro compatible format"
                >
                  <DownloadIcon className="w-5 h-5" />
                  Download JSON 2
                </button>
              </>
            )}
            <div className="relative">
              {newDataAvailable && (
                <span className="absolute -top-2 -right-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse z-10 shadow-sm border border-white dark:border-gray-800">
                  New Data
                </span>
              )}
              <button
                onClick={handleGenerate}
                disabled={loading}
                className={`flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <SaveIcon className="w-5 h-5" />
                {loading ? 'Generating...' : 'Generate Topology'}
              </button>
            </div>
            <button
              onClick={() => navigate('/automation')}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:from-purple-700 hover:to-purple-600 transition-all shadow-lg shadow-purple-500/30 font-semibold"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              New Automation
            </button>
          </div>
        </header>

        {/* Database Administration */}
        <DatabaseAdmin dbName="topology" title="Network Topology" />

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* History Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">History</h3>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No history available</p>
              ) : (
                <ul className="space-y-2 max-h-[500px] overflow-y-auto">
                  {history.map((item) => (
                    <li
                      key={item.filename}
                      onClick={() => handleLoadSnapshot(item.filename)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedSnapshot === item.filename
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-transparent'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-medium text-gray-900 dark:text-white">
                            {item.timestamp.split('_')[0]}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {item.timestamp.split('_')[1]?.replace(/-/g, ':')}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1">
                            {(item.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSnapshot(item.filename, e)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {!topology ? (
              <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                <NetworkIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 dark:text-white">No Topology Data</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 mb-6">
                  Run automation first to collect network data, then click Generate.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {/* Visualization Canvas */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 overflow-hidden">
                  <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-slate-50 dark:bg-slate-900 rounded-lg">
                    {/* Links - Use physical_links for accurate bidirectional costs */}
                    {(topology.physical_links || []).map((plink, idx) => {
                      const start = nodeCoordinates[plink.router_a];
                      const end = nodeCoordinates[plink.router_b];
                      if (!start || !end) return null;
                      const midX = (start.x + end.x) / 2;
                      const midY = (start.y + end.y) / 2;
                      const isAsym = plink.is_asymmetric;
                      return (
                        <g key={`plink-${idx}`}>
                          <line
                            x1={start.x}
                            y1={start.y}
                            x2={end.x}
                            y2={end.y}
                            stroke={isAsym ? '#f59e0b' : '#94a3b8'}
                            strokeWidth={isAsym ? '3' : '2'}
                            strokeDasharray={isAsym ? '5,3' : 'none'}
                            className={isAsym ? '' : 'dark:stroke-slate-600'}
                          />
                          {/* Cost labels showing both directions */}
                          <text x={midX} y={midY - 8} textAnchor="middle" className={`text-[9px] font-medium ${isAsym ? 'fill-amber-600' : 'fill-gray-600'}`}>
                            {plink.router_a.split('-').pop()}: {plink.cost_a_to_b}
                          </text>
                          <text x={midX} y={midY + 8} textAnchor="middle" className={`text-[9px] font-medium ${isAsym ? 'fill-amber-600' : 'fill-gray-600'}`}>
                            {plink.router_b.split('-').pop()}: {plink.cost_b_to_a}
                          </text>
                          {isAsym && (
                            <text x={midX + 25} y={midY} textAnchor="start" className="text-[8px] fill-red-500 font-bold">
                              ASYM
                            </text>
                          )}
                        </g>
                      );
                    })}
                    {/* Fallback to directional links if physical_links not available */}
                    {(!topology.physical_links || topology.physical_links.length === 0) && topology.links.map((link, idx) => {
                      const start = nodeCoordinates[link.source];
                      const end = nodeCoordinates[link.target];
                      if (!start || !end) return null;
                      return (
                        <g key={`link-${idx}`}>
                          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#94a3b8" strokeWidth="2" className="dark:stroke-slate-600" />
                          <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2} textAnchor="middle" className="text-[10px] fill-gray-500">
                            Cost: {link.cost}
                          </text>
                        </g>
                      );
                    })}

                    {/* Nodes */}
                    {topology.nodes.map(node => {
                      const coords = nodeCoordinates[node.id];
                      if (!coords) return null;
                      return (
                        <g key={`node-${node.id}`} transform={`translate(${coords.x}, ${coords.y})`}>
                          <circle
                            r="20"
                            fill={getCountryColor(node.country)}
                            className="stroke-white dark:stroke-gray-800 stroke-2 shadow-lg"
                          />
                          <text
                            y="35"
                            textAnchor="middle"
                            className="text-xs font-semibold fill-gray-700 dark:fill-gray-300"
                          >
                            {node.name}
                          </text>
                          <text
                            y="48"
                            textAnchor="middle"
                            className="text-[10px] fill-gray-500"
                          >
                            {node.country}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
                    {/* Dynamic country legend based on actual nodes */}
                    {[...new Set(topology.nodes.map(n => n.country))].sort().map(country => (
                      <div key={country} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getCountryColor(country) }}
                        ></div>
                        {country}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300 dark:border-gray-600">
                      <div className="w-6 h-0.5 bg-slate-400"></div> Symmetric
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 bg-amber-500" style={{borderTop: '2px dashed #f59e0b'}}></div> Asymmetric
                    </div>
                  </div>
                </div>

                {/* Info Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Network Statistics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{topology.nodes.length}</div>
                        <div className="text-sm text-blue-600/80 dark:text-blue-400/80">Routers</div>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{topology.physical_links?.length || Math.floor(topology.links.length / 2)}</div>
                        <div className="text-sm text-green-600/80 dark:text-green-400/80">Physical Links</div>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{topology.links.length}</div>
                        <div className="text-sm text-purple-600/80 dark:text-purple-400/80">OSPF Interfaces</div>
                      </div>
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{topology.physical_links?.filter(l => l.is_asymmetric).length || 0}</div>
                        <div className="text-sm text-amber-600/80 dark:text-amber-400/80">Asymmetric Links</div>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-500">Generated: {new Date(topology.timestamp).toLocaleString()}</p>
                      <p className="text-sm text-gray-500 mt-1">Source: {topology.metadata?.source || 'Unknown'}</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 overflow-y-auto max-h-[400px]">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nodes List</h3>
                    <ul className="space-y-3">
                      {topology.nodes.map(node => (
                        <li key={node.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${node.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{node.name}</div>
                              <div className="text-xs text-gray-500">{node.hostname}</div>
                            </div>
                          </div>
                          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                            {node.country}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transformation;
