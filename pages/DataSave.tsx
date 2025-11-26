import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as API from '../api';
import DatabaseAdmin from '../components/DatabaseAdmin';
import SearchIcon from '../components/icons/SearchIcon';
import DownloadIcon from '../components/icons/DownloadIcon';
import ChevronDownIcon from '../components/icons/ChevronDownIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';

const FileIcon = () => (
  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const FolderIcon = ({ open }: { open: boolean }) => (
  <svg className={`w-5 h-5 text-blue-500 ${open ? 'opacity-100' : 'opacity-80'}`} fill="currentColor" viewBox="0 0 24 24">
    <path d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.41l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
);

const DataSave: React.FC = () => {
  const navigate = useNavigate();
  const [textFiles, setTextFiles] = useState<API.FileInfo[]>([]);
  const [jsonFiles, setJsonFiles] = useState<API.FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<API.FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState({ text: true, json: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    loadFileLists();
  }, []);

  const loadFileLists = async () => {
    try {
      setLoading(true);
      const [textData, jsonData] = await Promise.all([
        API.automationFiles('text'),
        API.automationFiles('json')
      ]);
      setTextFiles(textData.files);
      setJsonFiles(jsonData.files);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: API.FileInfo) => {
    setSelectedFile(file);
    setContentLoading(true);
    try {
      const data = await API.automationFileContent(file.filename, file.type as 'text' | 'json');
      setFileContent(data.content);
    } catch (error) {
      console.error('Failed to load file content:', error);
      setFileContent('Error loading file content');
    } finally {
      setContentLoading(false);
    }
  };

  const handleDownload = () => {
    if (!fileContent || !selectedFile) return;

    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleFolder = (folder: 'text' | 'json') => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const filteredTextFiles = textFiles.filter(f => f.filename.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredJsonFiles = jsonFiles.filter(f => f.filename.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 h-[calc(100vh-4rem)]">
      <div className="max-w-screen-2xl mx-auto h-full flex flex-col">
        <header className="mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Save Browser</h1>
            <p className="text-gray-500 dark:text-gray-400">View and manage collected automation data</p>
          </div>
        </header>

        {/* Database Administration */}
        <DatabaseAdmin dbName="datasave" title="Data Save Files" />

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setSelectedFile(null); setFileContent(null); }}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Clear View
          </button>
          <button
            onClick={loadFileLists}
            disabled={loading}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reload Files
          </button>
          <button
            onClick={() => navigate('/transformation')}
            className="px-4 py-2 text-white bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 font-semibold ml-auto"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate Topology →
          </button>
          {selectedFile && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <DownloadIcon className="w-5 h-5" />
              Download File
            </button>
          )}
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          {/* File Tree Sidebar */}
          <div className="w-80 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {/* Text Files Folder */}
              <div>
                <button
                  onClick={() => toggleFolder('text')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
                >
                  {expandedFolders.text ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                  <FolderIcon open={expandedFolders.text} />
                  <span>Running-Config (TEXT)</span>
                  <span className="ml-auto text-xs text-gray-400">{filteredTextFiles.length}</span>
                </button>

                {expandedFolders.text && (
                  <div className="ml-6 mt-1 space-y-1">
                    {filteredTextFiles.map(file => (
                      <button
                        key={file.filename}
                        onClick={() => handleFileSelect(file)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md truncate transition-colors ${selectedFile?.filename === file.filename
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                      >
                        <FileIcon />
                        <span className="truncate">{file.filename}</span>
                      </button>
                    ))}
                    {filteredTextFiles.length === 0 && (
                      <p className="text-xs text-gray-400 px-2 py-1 italic">No files found</p>
                    )}
                  </div>
                )}
              </div>

              {/* JSON Files Folder */}
              <div>
                <button
                  onClick={() => toggleFolder('json')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
                >
                  {expandedFolders.json ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                  <FolderIcon open={expandedFolders.json} />
                  <span>Parsed-Data (JSON)</span>
                  <span className="ml-auto text-xs text-gray-400">{filteredJsonFiles.length}</span>
                </button>

                {expandedFolders.json && (
                  <div className="ml-6 mt-1 space-y-1">
                    {filteredJsonFiles.map(file => (
                      <button
                        key={file.filename}
                        onClick={() => handleFileSelect(file)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md truncate transition-colors ${selectedFile?.filename === file.filename
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                      >
                        <FileIcon />
                        <span className="truncate">{file.filename}</span>
                      </button>
                    ))}
                    {filteredJsonFiles.length === 0 && (
                      <p className="text-xs text-gray-400 px-2 py-1 italic">No files found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedFile ? (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">{selectedFile.filename}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedFile.size_kb} KB • Created {new Date(selectedFile.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-white dark:bg-gray-900 font-mono text-sm">
                  {contentLoading ? (
                    <div className="flex items-center justify-center h-full text-gray-500">Loading content...</div>
                  ) : (
                    <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-300">
                      {fileContent}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-900/30">
                <FileIcon />
                <p className="mt-2">Select a file to view its content</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
};

export default DataSave;
