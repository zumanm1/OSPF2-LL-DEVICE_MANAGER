
import React, { useState, useEffect, useMemo } from 'react';
import { Device, DeviceType, Platform, Software, Protocol } from '../types';
import { COUNTRIES, DEVICE_TYPE_OPTIONS, PLATFORM_OPTIONS, PROTOCOL_OPTIONS, SOFTWARE_OPTIONS } from '../constants';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';

export interface PreviewRow {
  rowData: { [key: string]: string };
  rowNum: number;
  errors: string[];
}

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (devices: Device[]) => void;
  initialData: PreviewRow[];
}

// Proper IP validation: each octet must be 0-255
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const validateRow = (rowData: { [key: string]: string }): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};
    if (!rowData.deviceName) errors.deviceName = "Device name is required.";
    if (!rowData.ipAddress) errors.ipAddress = "IP address is required.";
    if (!rowData.username) errors.username = "Username is required.";
    if (rowData.ipAddress && !IP_REGEX.test(rowData.ipAddress)) {
        errors.ipAddress = `Invalid IP format.`;
    }
    if (rowData.protocol && !Object.values(Protocol).includes(rowData.protocol as Protocol)) {
        errors.protocol = `Invalid protocol.`;
    }
    if (rowData.deviceType && !Object.values(DeviceType).includes(rowData.deviceType as DeviceType)) {
        errors.deviceType = `Invalid type.`;
    }
    if (rowData.platform && !Object.values(Platform).includes(rowData.platform as Platform)) {
        errors.platform = `Invalid platform.`;
    }
     if (rowData.software && !Object.values(Software).includes(rowData.software as Software)) {
        errors.software = `Invalid software.`;
    }
    if (rowData.country && !COUNTRIES.some(c => c.name === rowData.country)) {
        errors.country = `Invalid country.`;
    }
    return errors;
};

interface ValidatedPreviewRow {
  rowData: { [key: string]: string };
  rowNum: number;
  errors: { [key: string]: string };
}


const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({ isOpen, onClose, onConfirm, initialData }) => {
  const [previewData, setPreviewData] = useState<ValidatedPreviewRow[]>([]);

  useEffect(() => {
    if (isOpen) {
        const validatedData = initialData.map(row => ({
            ...row,
            errors: validateRow(row.rowData)
        }));
        setPreviewData(validatedData);
    }
  }, [isOpen, initialData]);

  const handleFieldChange = (rowIndex: number, field: string, value: string) => {
    setPreviewData(currentData => {
        const newData = [...currentData];
        const updatedRow = { ...newData[rowIndex] };
        updatedRow.rowData = { ...updatedRow.rowData, [field]: value };
        
        if (field === 'protocol') {
            const newProtocol = value as Protocol;
            updatedRow.rowData.port = newProtocol === Protocol.SSH ? '22' : '23';
        }

        updatedRow.errors = validateRow(updatedRow.rowData);
        newData[rowIndex] = updatedRow;
        return newData;
    });
  };

  const { validRows, invalidRowCount } = useMemo(() => {
    const valid = previewData.filter(row => Object.keys(row.errors).length === 0);
    return {
        validRows: valid,
        invalidRowCount: previewData.length - valid.length,
    }
  }, [previewData]);

  const handleConfirm = () => {
    const devicesToImport: Device[] = validRows.map(row => ({
        id: crypto.randomUUID(),
        deviceName: row.rowData.deviceName,
        ipAddress: row.rowData.ipAddress,
        protocol: row.rowData.protocol as Protocol,
        port: parseInt(row.rowData.port, 10) || (row.rowData.protocol === Protocol.SSH ? 22 : 23),
        username: row.rowData.username,
        password: row.rowData.password || undefined,
        country: row.rowData.country,
        deviceType: row.rowData.deviceType as DeviceType,
        platform: row.rowData.platform as Platform,
        software: row.rowData.software as Software,
        tags: row.rowData.tags ? row.rowData.tags.split(';').map(t => t.trim()).filter(Boolean) : [],
    }));
    onConfirm(devicesToImport);
  };
  
  if (!isOpen) return null;

  const renderCell = (row: ValidatedPreviewRow, header: string, rowIndex: number) => {
    const value = row.rowData[header] || '';
    const error = row.errors[header];
    const commonClasses = `w-full bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 rounded-md ${error ? 'border border-red-500/50' : 'border border-transparent'}`;

    const cellContent = () => {
        if (['deviceType', 'platform', 'software', 'country', 'protocol'].includes(header)) {
            let options: string[] = [];
            if(header === 'deviceType') options = DEVICE_TYPE_OPTIONS;
            if(header === 'platform') options = PLATFORM_OPTIONS;
            if(header === 'software') options = SOFTWARE_OPTIONS;
            if(header === 'country') options = COUNTRIES.map(c => c.name);
            if(header === 'protocol') options = PROTOCOL_OPTIONS;

            return (
                <select value={value} onChange={(e) => handleFieldChange(rowIndex, header, e.target.value)} className={`${commonClasses} appearance-none`}>
                    <option value="">Select...</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            );
        }
        return (
            <input 
                type={header.includes('port') ? 'number' : 'text'}
                value={value}
                onChange={(e) => handleFieldChange(rowIndex, header, e.target.value)}
                className={commonClasses}
            />
        );
    }
    
    return (
        <div className="relative group">
            {cellContent()}
            {error && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs bg-red-600 text-white rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                    {error}
                </div>
            )}
        </div>
    );
  };

  // Note: password removed - inherited from jumphost settings
  const headers = ['deviceName', 'ipAddress', 'country', 'protocol', 'port', 'deviceType', 'tags', 'username', 'platform', 'software'];

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Import Preview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review and correct data before importing. Only rows without errors will be processed.
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500"></span>
                <span className="text-green-600 dark:text-green-400 font-medium">{validRows.length} ready to import</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500"></span>
                <span className={invalidRowCount > 0 ? "text-red-500 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"}>{invalidRowCount} with errors</span>
            </div>
          </div>
        </div>
        
        <div className="flex-grow overflow-auto">
          <table className="min-w-full text-sm text-left text-gray-800 dark:text-gray-300">
            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/70 backdrop-blur-sm sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-3 py-3 w-16 text-center">Status</th>
                {headers.map(h => <th key={h} scope="col" className="px-3 py-3 min-w-[160px] font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700/60">
              {previewData.map((row, rowIndex) => {
                const hasErrors = Object.keys(row.errors).length > 0;
                return (
                    <tr key={row.rowNum} className={hasErrors ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}>
                      <td className="px-3 py-1.5 text-center text-gray-500 dark:text-gray-400 align-middle">
                        <div className="flex justify-center">
                            {hasErrors ? (
                                <span className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center" title={Object.values(row.errors).join(' ')}>
                                    <ExclamationTriangleIcon className="h-3 w-3 text-red-500 dark:text-red-400" />
                                </span>
                            ) : (
                                <span className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center" title="Valid">
                                    <svg className="h-3 w-3 text-green-500 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                </span>
                            )}
                        </div>
                      </td>
                      {headers.map(header => (
                        <td key={header} className="px-1 py-1 align-middle">
                            {renderCell(row, header, rowIndex)}
                        </td>
                      ))}
                    </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-end items-center gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-600/50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors font-medium">Cancel</button>
          <button 
            type="button" 
            onClick={handleConfirm}
            disabled={validRows.length === 0}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors font-semibold disabled:bg-gray-300 dark:disabled:bg-gray-500/50 disabled:cursor-not-allowed disabled:text-gray-500 dark:disabled:text-gray-400"
          >
            Confirm Import ({validRows.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportPreviewModal;
