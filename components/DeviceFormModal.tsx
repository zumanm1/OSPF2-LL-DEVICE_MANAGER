
import React, { useState, useEffect } from 'react';
import { Device, DeviceType, Platform, Software, Protocol } from '../types';
import { DEVICE_TYPE_OPTIONS, PLATFORM_OPTIONS, SOFTWARE_OPTIONS, COUNTRIES, PROTOCOL_OPTIONS } from '../constants';

interface DeviceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (device: Device) => void;
  deviceToEdit: Device | null;
  preselectedCountry?: string;
}

const initialFormState: Omit<Device, 'id'> = {
  deviceName: '',
  ipAddress: '',
  protocol: Protocol.SSH,
  port: 22,
  username: '',       // Username inherited from jumphost settings
  password: '',       // Password inherited from jumphost settings
  country: '',
  deviceType: DeviceType.PE,
  platform: Platform.ISR4000,
  software: Software.IOS_XE,
  tags: [],
};

const DeviceFormModal: React.FC<DeviceFormModalProps> = ({ isOpen, onClose, onSubmit, deviceToEdit, preselectedCountry }) => {
  const [formData, setFormData] = useState<Omit<Device, 'id'>>(initialFormState);
  const [currentTag, setCurrentTag] = useState('');
  const [errors, setErrors] = useState<{ deviceName?: string }>({});

  useEffect(() => {
    if (isOpen) {
        if (deviceToEdit) {
            // When editing, populate the form with the device's data.
            setFormData({
                ...deviceToEdit,
                password: deviceToEdit.password || '', // Ensure password is a string
            });
        } else {
            // When adding, use the initial state, pre-selecting a country if available.
            const countryToSet = COUNTRIES.find(c => c.name === preselectedCountry) || COUNTRIES[0];
            setFormData({
                ...initialFormState,
                country: countryToSet.name,
                deviceName: `${countryToSet.code3.toLowerCase()}-`,
            });
        }
        // Reset errors and tag input whenever the modal opens or its subject changes.
        setErrors({});
        setCurrentTag('');
    }
  }, [deviceToEdit, isOpen, preselectedCountry]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
     if (name === 'deviceName' && errors.deviceName) {
        setErrors(prev => ({ ...prev, deviceName: undefined }));
    }
     if (name === 'protocol') {
        const newProtocol = value as Protocol;
        setFormData(prev => ({
            ...prev,
            protocol: newProtocol,
            port: newProtocol === Protocol.SSH ? 22 : 23,
        }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountryName = e.target.value;
    const selectedCountry = COUNTRIES.find(c => c.name === newCountryName);

    setFormData(prev => {
        let restOfDeviceName = prev.deviceName;
        const currentCountry = COUNTRIES.find(c => c.name === prev.country);
        
        if (currentCountry) {
            const allPrefixes = [currentCountry.code3, currentCountry.code2, ...(currentCountry.aliases || [])]
              .map(p => `${p.toLowerCase()}-`);
            
            for (const prefix of allPrefixes) {
              if (restOfDeviceName.toLowerCase().startsWith(prefix)) {
                restOfDeviceName = restOfDeviceName.slice(prefix.length);
                break; 
              }
            }
        }
        
        let updatedDeviceName = restOfDeviceName;
        if (selectedCountry) {
            updatedDeviceName = `${selectedCountry.code3.toLowerCase()}-${restOfDeviceName}`;
        }

        return { 
            ...prev, 
            country: newCountryName,
            deviceName: updatedDeviceName
        };
    });

    if (errors.deviceName) {
        setErrors(prev => ({...prev, deviceName: undefined}));
    }
};
  
  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Use 0 instead of empty string to maintain type consistency with Device.port: number
    setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : Number(value) }));
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTag(e.target.value);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = currentTag.trim();
      if (newTag && !formData.tags.includes(newTag)) {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
      }
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const selectedCountry = COUNTRIES.find(c => c.name === formData.country);
    if (!selectedCountry) {
        // Should not happen if country is a select, but good practice
        return;
    }
    
    const validPrefixes = [selectedCountry.code3, selectedCountry.code2, ...(selectedCountry.aliases || [])]
        .map(p => p.toLowerCase());
    
    const nameParts = formData.deviceName.toLowerCase().split('-');
    const prefix = nameParts[0];

    // Handle names with multiple hyphens in the suffix, e.g., "gbr-lon-pe-01"
    if (nameParts.length < 2) {
        setErrors({ deviceName: `Name must be in 'countryCode-suffix' format.` });
        return;
    }

    const suffix = formData.deviceName.substring(formData.deviceName.indexOf('-') + 1);

    if (!suffix) {
        setErrors({ deviceName: `Suffix cannot be empty.` });
        return;
    }

    if (!validPrefixes.includes(prefix)) {
        const prefixesString = validPrefixes.map(p => `'${p}-'`).join(' or ');
        setErrors({ 
            deviceName: `Name must start with a valid prefix for ${selectedCountry.name}, e.g., ${prefixesString}.`
        });
        return;
    }

    setErrors({});
    const deviceData: Device = {
      id: deviceToEdit?.id || crypto.randomUUID(),
      ...formData,
      port: Number(formData.port) || (formData.protocol === Protocol.SSH ? 22 : 23),
    };
    onSubmit(deviceData);
  };

  if (!isOpen) {
    return null;
  }
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{deviceToEdit ? 'Edit Device' : 'Add New Device'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Provide the details for the network device.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                <div className="grid grid-cols-1 gap-y-6">
                    <div>
                        <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Country</label>
                        <select id="country" name="country" value={formData.country} onChange={handleCountryChange} className="w-full form-select">
                            {COUNTRIES.map(opt => <option key={opt.code3} value={opt.name}>{opt.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Device Name</label>
                        <input type="text" id="deviceName" name="deviceName" value={formData.deviceName} onChange={handleChange} required placeholder="e.g., gbr-pe-01" className={`w-full form-input ${errors.deviceName ? 'border-red-500/50' : ''}`} />
                        {errors.deviceName && <p className="text-red-500 dark:text-red-400 text-xs mt-2">{errors.deviceName}</p>}
                    </div>
                    <div>
                        <label htmlFor="ipAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">IP Address</label>
                        <input type="text" id="ipAddress" name="ipAddress" value={formData.ipAddress} onChange={handleChange} required className="w-full form-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                            <label htmlFor="protocol" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Protocol</label>
                            <select id="protocol" name="protocol" value={formData.protocol} onChange={handleChange} className="w-full form-select">
                                {PROTOCOL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="port" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Port</label>
                            <input type="number" id="port" name="port" value={formData.port} onChange={handlePortChange} required className="w-full form-input" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-y-6">
                    {/* Credentials Info - Both Username & Password come from Jumphost Settings */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            <div className="text-sm text-blue-800 dark:text-blue-300">
                                <p className="font-semibold text-base">Credentials from Jumphost</p>
                                <p className="text-xs mt-2 opacity-90">
                                    <strong>Username</strong> and <strong>Password</strong> are automatically inherited from Jumphost Settings on the Automation page.
                                </p>
                                <p className="text-xs mt-1 opacity-75">
                                    All network devices use the same credentials as the jumphost/bastion server.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="deviceType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Device Type</label>
                        <select id="deviceType" name="deviceType" value={formData.deviceType} onChange={handleChange} className="w-full form-select">
                            {DEVICE_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="platform" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Platform</label>
                            <select id="platform" name="platform" value={formData.platform} onChange={handleChange} className="w-full form-select">
                                {PLATFORM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="software" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Software</label>
                            <select id="software" name="software" value={formData.software} onChange={handleChange} className="w-full form-select">
                                {SOFTWARE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
                <div className="flex flex-wrap items-center gap-2 p-2 form-input min-h-[44px]">
                {formData.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-600/30 text-blue-800 dark:text-blue-300 text-sm font-medium px-2.5 py-1 rounded-full">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-blue-600/70 dark:text-blue-400/70 hover:text-blue-800 dark:hover:text-white focus:outline-none" aria-label={`Remove ${tag} tag`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    </span>
                ))}
                <input
                    type="text"
                    id="tags"
                    value={currentTag}
                    onChange={handleTagChange}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Add a tag and press Enter..."
                    className="flex-grow bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none p-1"
                />
                </div>
            </div>

            <div className="flex justify-end items-center gap-4 pt-6 mt-8 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-600/50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors font-semibold shadow-lg shadow-blue-500/20">{deviceToEdit ? 'Update Device' : 'Add Device'}</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceFormModal;
