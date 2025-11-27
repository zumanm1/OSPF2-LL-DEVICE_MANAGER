import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Device, DeviceType } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './ui/GlassCard';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import ArrowUpIcon from './icons/ArrowUpIcon';
import ArrowDownIcon from './icons/ArrowDownIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import SearchIcon from './icons/SearchIcon';

type SortDirection = 'ascending' | 'descending';
interface SortConfig {
  key: keyof Device;
  direction: SortDirection;
}

interface DeviceTableProps {
  devices: Device[];
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onUpdateDevice: (device: Device) => void;
  requestSort: (key: keyof Device) => void;
  sortConfig: SortConfig | null;
  groupBy: keyof Device | 'None';
  selectedDeviceIds: Set<string>;
  onSelectDevice: (deviceId: string) => void;
  onSelectAll: () => void;
}

const InlineTagEditor: React.FC<{ device: Device; onUpdateDevice: (device: Device) => void; }> = ({ device, onUpdateDevice }) => {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    const newTag = inputValue.trim();
    if (newTag && !device.tags.includes(newTag)) {
      onUpdateDevice({ ...device, tags: [...device.tags, newTag] });
    }
    setInputValue('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateDevice({ ...device, tags: device.tags.filter(t => t !== tagToRemove) });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
      {device.tags.map(tag => (
        <span key={tag} className="flex items-center gap-1.5 bg-primary-100/50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full border border-primary-200 dark:border-primary-800">
          {tag}
          <button onClick={() => handleRemoveTag(tag)} className="text-primary-500 dark:text-primary-400 hover:text-primary-800 dark:hover:text-white focus:outline-none" aria-label={`Remove ${tag} tag`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleAddTag}
        placeholder="+ tag"
        className="bg-transparent text-gray-600 dark:text-gray-300 placeholder-gray-400 focus:outline-none w-16 text-xs p-0.5 border-b border-transparent focus:border-primary-500 transition-colors"
      />
    </div>
  );
};


const SortableHeader: React.FC<{
  columnKey: keyof Device;
  title: string;
  requestSort: (key: keyof Device) => void;
  sortConfig: SortConfig | null;
  className?: string;
}> = ({ columnKey, title, requestSort, sortConfig, className }) => {
  const isSorted = sortConfig?.key === columnKey;
  const direction = isSorted ? sortConfig?.direction : undefined;

  return (
    <th scope="col" className={`px-6 py-4 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 ${className}`}>
      <button
        type="button"
        onClick={() => requestSort(columnKey)}
        className="group flex items-center gap-2 transition-colors hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none"
      >
        {title}
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          {isSorted ?
            (direction === 'ascending' ? <ArrowDownIcon className="w-3 h-3" /> : <ArrowUpIcon className="w-3 h-3" />)
            : <ArrowUpIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          }
        </span>
      </button>
    </th>
  );
};

const getDeviceTypePillClasses = (deviceType: DeviceType) => {
  switch (deviceType) {
    case DeviceType.PE: return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    case DeviceType.P: return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
    case DeviceType.RR: return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
    case DeviceType.MANAGEMENT: return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}

const DeviceRow: React.FC<{
  device: Device;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onUpdateDevice: (device: Device) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
}> = ({ device, onEdit, onDelete, onUpdateDevice, isSelected, onSelect }) => (
  <motion.tr
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    className={`border-b border-gray-100 dark:border-white/5 transition-colors duration-200 group ${isSelected ? 'bg-primary-50/50 dark:bg-primary-900/20' : 'hover:bg-gray-50/50 dark:hover:bg-white/5'
      }`}
  >
    <td className="px-4 py-4 w-4">
      <input
        type="checkbox"
        className="form-checkbox h-4 w-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 transition-all"
        checked={isSelected}
        onChange={() => onSelect(device.id)}
        aria-label={`Select device ${device.deviceName}`}
      />
    </td>
    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
      {device.deviceName}
    </td>
    <td className="px-6 py-4 hidden md:table-cell">
      <InlineTagEditor device={device} onUpdateDevice={onUpdateDevice} />
    </td>
    <td className="px-6 py-4 hidden lg:table-cell font-mono text-sm text-gray-500 dark:text-gray-400">{device.ipAddress}</td>
    <td className="px-6 py-4 hidden xl:table-cell font-mono text-sm text-gray-500 dark:text-gray-400">{device.protocol} / {device.port}</td>
    <td className="px-6 py-4 hidden md:table-cell">
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getDeviceTypePillClasses(device.deviceType)}`}>{device.deviceType}</span>
    </td>
    <td className="px-6 py-4 hidden lg:table-cell text-gray-500 dark:text-gray-400">{device.platform}</td>
    <td className="px-6 py-4 hidden xl:table-cell text-gray-500 dark:text-gray-400">{device.software}</td>
    <td className="px-6 py-4 hidden xl:table-cell text-gray-500 dark:text-gray-400">{device.country}</td>
    <td className="px-6 py-4">
      <div className="flex items-center justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button onClick={() => onEdit(device)} className="p-1.5 text-gray-400 hover:text-primary-600 dark:text-gray-500 dark:hover:text-primary-400 transition-colors rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/30" aria-label={`Edit ${device.deviceName}`}>
          <PencilIcon className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(device)} className="p-1.5 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/30" aria-label={`Delete ${device.deviceName}`}>
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </td>
  </motion.tr>
);


const DeviceTable: React.FC<DeviceTableProps> = ({ devices, onEdit, onDelete, onUpdateDevice, requestSort, sortConfig, groupBy, selectedDeviceIds, onSelectDevice, onSelectAll }) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageSizeOptions = [10, 25, 50, 100];

  // Reset to page 1 when devices change (e.g., filtering)
  useEffect(() => {
    setCurrentPage(1);
  }, [devices.length]);

  // Memoize grouped devices first to maintain stable hook order
  const groupedDevices = useMemo(() => {
    if (groupBy === 'None') return null;
    return devices.reduce((acc, device) => {
      const key = device[groupBy] as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(device);
      return acc;
    }, {} as Record<string, Device[]>);
  }, [devices, groupBy]);

  const sortedGroupKeys = useMemo(() =>
    groupedDevices ? Object.keys(groupedDevices).sort((a, b) => a.localeCompare(b)) : [],
    [groupedDevices]
  );

  // Pagination calculations (only when not grouping)
  const totalPages = useMemo(() => Math.ceil(devices.length / pageSize), [devices.length, pageSize]);
  const paginatedDevices = useMemo(() => {
    if (groupBy !== 'None') return devices; // Don't paginate when grouping
    const startIndex = (currentPage - 1) * pageSize;
    return devices.slice(startIndex, startIndex + pageSize);
  }, [devices, currentPage, pageSize, groupBy]);

  const allVisibleSelected = useMemo(() => devices.length > 0 && selectedDeviceIds.size === devices.length, [devices.length, selectedDeviceIds.size]);
  const someVisibleSelected = useMemo(() => selectedDeviceIds.size > 0 && selectedDeviceIds.size < devices.length, [devices.length, selectedDeviceIds.size]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  if (devices.length === 0) {
    return (
      <GlassCard className="text-center py-20 flex flex-col items-center justify-center">
        <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-full mb-4">
          <SearchIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">No Devices Found</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          No devices match your current selection. Try adjusting your search or filter criteria.
        </p>
      </GlassCard>
    );
  }

  const deviceRowProps = (device: Device) => ({
    device: device,
    onEdit: onEdit,
    onDelete: onDelete,
    onUpdateDevice: onUpdateDevice,
    isSelected: selectedDeviceIds.has(device.id),
    onSelect: onSelectDevice,
  });

  return (
    <GlassCard className="overflow-hidden !p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left border-collapse">
          <thead className="bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200 dark:border-white/10">
            <tr>
              <th scope="col" colSpan={10} className="px-6 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <span>
                    {groupBy === 'None'
                      ? `Showing ${Math.min((currentPage - 1) * pageSize + 1, devices.length)}-${Math.min(currentPage * pageSize, devices.length)} of ${devices.length} devices`
                      : `Total Devices: ${devices.length}`
                    }
                  </span>
                  {groupBy === 'None' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                        className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        {pageSizeOptions.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </th>
            </tr>
            <tr>
              <th scope="col" className="px-4 py-4 w-4">
                <input
                  type="checkbox"
                  ref={headerCheckboxRef}
                  className="form-checkbox h-4 w-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 transition-all"
                  checked={allVisibleSelected}
                  onChange={onSelectAll}
                  aria-label="Select all devices"
                />
              </th>
              <SortableHeader columnKey="deviceName" title="Device Name" requestSort={requestSort} sortConfig={sortConfig} />
              <th scope="col" className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden md:table-cell">Tags</th>
              <SortableHeader columnKey="ipAddress" title="IP Address" requestSort={requestSort} sortConfig={sortConfig} className="hidden lg:table-cell" />
              <SortableHeader columnKey="port" title="Protocol / Port" requestSort={requestSort} sortConfig={sortConfig} className="hidden xl:table-cell" />
              <th scope="col" className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden md:table-cell">Type</th>
              <th scope="col" className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden lg:table-cell">Platform</th>
              <th scope="col" className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden xl:table-cell">Software</th>
              <SortableHeader columnKey="country" title="Country" requestSort={requestSort} sortConfig={sortConfig} className="hidden xl:table-cell" />
              <th scope="col" className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            <AnimatePresence mode='popLayout'>
              {groupedDevices ? (
                sortedGroupKeys.map(groupName => {
                  const isCollapsed = collapsedGroups.has(groupName);
                  const groupDevices = groupedDevices[groupName];
                  return (
                    <React.Fragment key={groupName}>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 sticky top-[88px] z-[5] border-y border-gray-200 dark:border-white/10 backdrop-blur-sm">
                        <th colSpan={10} className="px-4 py-2 text-left font-semibold text-gray-800 dark:text-white">
                          <button
                            onClick={() => toggleGroup(groupName)}
                            className="flex items-center gap-3 w-full text-left focus:outline-none group py-1"
                            aria-expanded={!isCollapsed}
                          >
                            <div className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                              {isCollapsed ? <ChevronRightIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                            </div>
                            <span className="text-sm">{groupName}</span>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">{groupDevices.length}</span>
                          </button>
                        </th>
                      </tr>
                      {!isCollapsed && groupDevices.map(device => (
                        <DeviceRow key={device.id} {...deviceRowProps(device)} />
                      ))}
                    </React.Fragment>
                  );
                })
              ) : (
                paginatedDevices.map((device) => (
                  <DeviceRow key={device.id} {...deviceRowProps(device)} />
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Pagination Controls (only when not grouping and more than one page) */}
      {groupBy === 'None' && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-gray-900/80">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            {/* First Page */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="First page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            {/* Previous Page */}
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Previous page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Next page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Last Page */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Last page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
};

export default DeviceTable;
