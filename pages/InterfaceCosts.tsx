import React, { useState, useEffect } from 'react';
import * as API from '../api';
import DatabaseAdmin from '../components/DatabaseAdmin';

interface InterfaceCost {
  router: string;
  interface: string;
  neighbor_router: string;
  cost: number;
  cost_source: string;
  is_asymmetric: boolean;
  reverse_cost: number | null;
}

const InterfaceCosts: React.FC = () => {
  const [interfaces, setInterfaces] = useState<InterfaceCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterRouter, setFilterRouter] = useState<string>('');
  const [filterAsymmetric, setFilterAsymmetric] = useState<boolean | null>(null);
  const [sortField, setSortField] = useState<string>('router');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadInterfaceCosts();
  }, []);

  const loadInterfaceCosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('http://localhost:9051/api/ospf/interface-costs');
      if (!response.ok) throw new Error('Failed to fetch interface costs');
      const data = await response.json();
      setInterfaces(data.interfaces || []);
    } catch (err) {
      console.error('Failed to load interface costs:', err);
      setError('Failed to load OSPF interface costs. Ensure topology has been generated.');
    } finally {
      setLoading(false);
    }
  };

  // Get unique routers for filter dropdown
  const uniqueRouters = [...new Set(interfaces.map(i => i.router))].sort();

  // Filter and sort interfaces
  const filteredInterfaces = interfaces
    .filter(i => !filterRouter || i.router === filterRouter)
    .filter(i => filterAsymmetric === null || i.is_asymmetric === filterAsymmetric)
    .sort((a, b) => {
      const aVal = a[sortField as keyof InterfaceCost];
      const bVal = b[sortField as keyof InterfaceCost];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const asymmetricCount = interfaces.filter(i => i.is_asymmetric).length;
  const symmetricCount = interfaces.filter(i => !i.is_asymmetric).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">OSPF Interface Costs</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Step 2.5b: View all OSPF interfaces and their costs per router
          </p>
        </div>

        {/* Database Admin Panel */}
        <DatabaseAdmin dbName="topology" tableName="links" />

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 mt-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{interfaces.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total OSPF Interfaces</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{uniqueRouters.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Routers</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{asymmetricCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Asymmetric Interfaces</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{symmetricCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Symmetric Interfaces</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Router</label>
              <select
                value={filterRouter}
                onChange={(e) => setFilterRouter(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="">All Routers</option>
                {uniqueRouters.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Type</label>
              <select
                value={filterAsymmetric === null ? '' : filterAsymmetric ? 'asym' : 'sym'}
                onChange={(e) => setFilterAsymmetric(e.target.value === '' ? null : e.target.value === 'asym')}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="">All</option>
                <option value="asym">Asymmetric Only</option>
                <option value="sym">Symmetric Only</option>
              </select>
            </div>

            <div className="ml-auto">
              <button
                onClick={loadInterfaceCosts}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Reload'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Interface Cost Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    onClick={() => handleSort('router')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    Router {sortField === 'router' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('interface')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    Interface {sortField === 'interface' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('neighbor_router')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    Neighbor {sortField === 'neighbor_router' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('cost')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    Cost (Outbound) {sortField === 'cost' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Reverse Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInterfaces.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      {loading ? 'Loading OSPF interface costs...' : 'No OSPF interfaces found. Generate topology first.'}
                    </td>
                  </tr>
                ) : (
                  filteredInterfaces.map((intf, idx) => (
                    <tr
                      key={`${intf.router}-${intf.interface}-${idx}`}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${intf.is_asymmetric ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {intf.router}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                        {intf.interface}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {intf.neighbor_router}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-bold ${intf.is_asymmetric ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                          {intf.cost}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-bold ${intf.is_asymmetric ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                          {intf.reverse_cost ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                          {intf.cost_source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {intf.is_asymmetric ? (
                          <span className="px-2 py-1 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                            ASYMMETRIC
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                            Symmetric
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Legend</h4>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-amber-100 dark:bg-amber-900/30 rounded"></span>
              <span>Asymmetric (different cost in each direction)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-white dark:bg-gray-700 border rounded"></span>
              <span>Symmetric (same cost both directions)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterfaceCosts;
