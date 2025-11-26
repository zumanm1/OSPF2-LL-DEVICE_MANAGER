import React, { useState, useEffect } from 'react';
import * as API from '../api';
import { Device } from '../types';
import NetworkIcon from './icons/NetworkIcon';
import SaveIcon from './icons/SaveIcon';
import DownloadIcon from './icons/DownloadIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';

interface PipelineVisualizationProps {
  devices: Device[];
}

interface DeviceStat {
  name: string;
  status: string;
  progress: string;
}

interface CountryStat {
  total: number;
  completed: number;
  devices: DeviceStat[];
}

const PipelineVisualization: React.FC<PipelineVisualizationProps> = ({ devices }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [automationJob, setAutomationJob] = useState<API.JobStatus | null>(null);
  const [fileStats, setFileStats] = useState<{ text: number; json: number } | null>(null);
  const [topologyStats, setTopologyStats] = useState<{ nodes: number; links: number; timestamp: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const pipelineProgress = React.useMemo(() => {
    if (!automationJob) return 0;

    let progress = 0;
    if (automationJob.status === 'completed') progress += 33;
    else if (automationJob.status === 'running') progress += (automationJob.progress_percent * 0.33);
    
    if (fileStats && fileStats.text > 0) progress += 33;
    if (topologyStats && topologyStats.nodes > 0) progress += 34;
    
    return Math.min(100, Math.round(progress));
  }, [automationJob, fileStats, topologyStats]);

  const countryStats = React.useMemo(() => {
    if (!automationJob || !devices) return null;
    
    const stats: Record<string, CountryStat> = {};
    
    devices.forEach(device => {
      const country = device.country || "Unknown";
      if (!stats[country]) {
        stats[country] = { total: 0, completed: 0, devices: [] };
      }
      stats[country].total++;
      
      const res = automationJob.results[device.id];
      let status = 'pending';
      let progress = '0/8';
      
      if (res) {
        if (res.status === 'success' || res.status === 'failed' || res.status === 'partial_success') {
          stats[country].completed++;
          status = res.status;
        } else {
          status = 'running';
        }
        // Parse summary "X/Y commands success"
        const match = res.summary?.match(/(\d+\/\d+)/);
        if (match) progress = match[1];
      }
      
      stats[country].devices.push({
        name: device.deviceName,
        status,
        progress
      });
    });
    
    return stats;
  }, [automationJob, devices]);

  useEffect(() => {
    refreshPipeline();
    const interval = setInterval(refreshPipeline, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const refreshPipeline = async () => {
    setLoading(true);
    try {
      // Step 1: Automation
      const job = await API.getLatestAutomationJob();
      if ('status' in job && job.status === 'no_jobs') {
        setAutomationJob(null);
      } else {
        setAutomationJob(job as API.JobStatus);
      }

      // Step 2: Files
      const textFiles = await API.automationFiles('text');
      const jsonFiles = await API.automationFiles('json');
      setFileStats({ text: textFiles.file_count, json: jsonFiles.file_count });

      // Step 3: Topology
      const topo = await API.getLatestTopology();
      setTopologyStats({
        nodes: topo.nodes.length,
        links: topo.links.length,
        timestamp: topo.timestamp
      });

    } catch (err) {
      console.error("Pipeline refresh failed", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadFailures = () => {
    if (!automationJob) return;
    const failures = Object.entries(automationJob.results)
      .filter(([_, res]: [string, any]) => res.status === 'failed' || res.status === 'error')
      .map(([id, res]: [string, any]) => ({
        device_id: id,
        device_name: res.device_name,
        error: res.error,
        timestamp: automationJob.end_time || automationJob.start_time
      }));

    if (failures.length === 0) {
      alert("No failures to download");
      return;
    }

    const jsonString = JSON.stringify(failures, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `automation_failures_${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const StepCard = ({ title, icon: Icon, children, status }: any) => (
    <div className={`flex-1 bg-white dark:bg-gray-800 rounded-lg border p-4 transition-all ${
      status === 'running' ? 'border-blue-500 shadow-md ring-1 ring-blue-200' : 
      status === 'failed' ? 'border-red-500 shadow-md' : 
      status === 'completed' || status === 'success' ? 'border-green-500 shadow-sm' : 
      'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-full ${
          status === 'running' ? 'bg-blue-100 text-blue-600' :
          status === 'failed' ? 'bg-red-100 text-red-600' :
          status === 'completed' || status === 'success' ? 'bg-green-100 text-green-600' :
          'bg-gray-100 text-gray-600'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        {status === 'running' && <span className="ml-auto w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {children}
      </div>
    </div>
  );

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 whitespace-nowrap">
            Pipeline Status
            {loading && <div className="w-2 h-2 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>}
          </h2>
          
          {/* Pipeline Progress Bar */}
          <div className="flex-1 max-w-md hidden sm:block">
             <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
               <span>Progress</span>
               <span>{pipelineProgress}%</span>
             </div>
             <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
               <div 
                 className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" 
                 style={{ width: `${pipelineProgress}%` }}
               ></div>
             </div>
          </div>
        </div>

        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-4"
        >
          <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-in">
          {/* Step 1: Automation */}
          <StepCard 
            title="1. Automation" 
            icon={NetworkIcon}
            status={automationJob?.status === 'running' ? 'running' : automationJob?.status === 'failed' ? 'failed' : automationJob?.status === 'completed' ? 'completed' : 'idle'}
          >
            {automationJob ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-medium capitalize ${
                    automationJob.status === 'failed' ? 'text-red-600' : 
                    automationJob.status === 'completed' ? 'text-green-600' : 'text-blue-600'
                  }`}>{automationJob.status.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Progress:</span>
                  <span>{automationJob.completed_devices}/{automationJob.total_devices}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <button 
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {showDetails ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>

                {showDetails && countryStats && (
                  <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2 space-y-2 max-h-60 overflow-y-auto">
                    {Object.entries(countryStats).map(([country, stats]: [string, CountryStat]) => (
                      <div key={country} className="text-xs">
                        <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-300">
                          <span>{country}</span>
                          <span>{stats.completed}/{stats.total}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full my-1">
                          <div 
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                          ></div>
                        </div>
                        <div className="space-y-1 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
                          {stats.devices.map(dev => (
                            <div key={dev.name} className="flex justify-between text-gray-500 dark:text-gray-400">
                              <span>{dev.name}</span>
                              <span className={dev.status === 'failed' ? 'text-red-500' : dev.status === 'success' ? 'text-green-500' : 'text-blue-500'}>
                                {dev.status === 'success' ? 'Done' : dev.progress}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Failures */}
                {Object.values(automationJob.results).some((r: any) => r.status === 'failed' || r.status === 'error') && (
                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between text-red-600 dark:text-red-400">
                      <span className="flex items-center gap-1 text-xs font-bold">
                        <ExclamationTriangleIcon className="w-3 h-3" />
                        Failures Detected
                      </span>
                      <button 
                        onClick={downloadFailures}
                        className="text-xs underline flex items-center gap-1 hover:text-red-800"
                      >
                        <DownloadIcon className="w-3 h-3" /> Report
                      </button>
                    </div>
                    <div className="mt-1 max-h-20 overflow-y-auto text-xs space-y-1">
                      {Object.entries(automationJob.results)
                        .filter(([_, res]: [string, any]) => res.status === 'failed' || res.status === 'error')
                        .map(([id, res]: [string, any]) => (
                          <div key={id} className="flex justify-between">
                            <span>{res.device_name}</span>
                            <span className="truncate max-w-[100px] ml-2 text-red-500" title={res.error}>{res.error}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="italic">No jobs run yet</p>
            )}
          </StepCard>

          {/* Step 2: Data Save */}
          <StepCard 
            title="2. Data Collection" 
            icon={SaveIcon}
            status={fileStats && fileStats.text > 0 ? 'success' : 'idle'}
          >
            {fileStats ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Text Files:</span>
                  <span className="font-bold">{fileStats.text}</span>
                </div>
                <div className="flex justify-between">
                  <span>JSON Files:</span>
                  <span className="font-bold">{fileStats.json}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Stored in OUTPUT-Data_save
                </div>
              </div>
            ) : (
              <p>Loading stats...</p>
            )}
          </StepCard>

          {/* Step 3: Transformation */}
          <StepCard 
            title="3. Transformation" 
            icon={NetworkIcon} // Reusing NetworkIcon or create TopologyIcon
            status={topologyStats && topologyStats.nodes > 0 ? 'success' : 'idle'}
          >
            {topologyStats ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Nodes:</span>
                  <span className="font-bold">{topologyStats.nodes}</span>
                </div>
                <div className="flex justify-between">
                  <span>Links:</span>
                  <span className="font-bold">{topologyStats.links}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Last Generated: {new Date(topologyStats.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <p>No topology generated</p>
            )}
          </StepCard>
        </div>
      )}
    </div>
  );
};

export default PipelineVisualization;
