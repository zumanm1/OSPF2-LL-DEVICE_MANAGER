import { Device } from './types';
import { API_BASE_URL } from './config';

// Default timeout for API requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * API Client for Network Device Manager Backend
 */

// Global callback for authentication failures (401)
let onAuthenticationRequired: (() => void) | null = null;

/**
 * Register a callback to handle authentication failures
 * This allows the app to redirect to login when 401 is received
 */
export function setAuthenticationHandler(handler: () => void) {
  onAuthenticationRequired = handler;
}

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export class APITimeoutError extends Error {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'APITimeoutError';
  }
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit & { timeout?: number }): Promise<T> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',  // CRITICAL: Send session cookies with requests
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));

      // Handle 401 Unauthorized - trigger logout/redirect to login
      if (response.status === 401 && onAuthenticationRequired) {
        console.log('🔒 API returned 401 - triggering authentication handler');
        onAuthenticationRequired();
        // Don't throw error for 401, let the auth handler redirect
        throw new APIError(401, 'Session expired - please login again');
      }

      throw new APIError(response.status, error.detail || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APITimeoutError(`Request to ${endpoint} timed out after ${timeoutMs}ms`);
    }
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Get all devices from the backend
 */
export async function getAllDevices(): Promise<Device[]> {
  return fetchAPI<Device[]>('/devices');
}

/**
 * Get a single device by ID
 */
export async function getDevice(id: string): Promise<Device> {
  return fetchAPI<Device>(`/devices/${id}`);
}

/**
 * Create a new device
 */
export async function createDevice(device: Device): Promise<Device> {
  return fetchAPI<Device>('/devices', {
    method: 'POST',
    body: JSON.stringify(device),
  });
}

/**
 * Update an existing device
 */
export async function updateDevice(id: string, device: Device): Promise<Device> {
  return fetchAPI<Device>(`/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(device),
  });
}

/**
 * Delete a device
 */
export async function deleteDevice(id: string): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>(`/devices/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Bulk delete devices
 */
export async function bulkDeleteDevices(ids: string[]): Promise<{ message: string; count: number }> {
  return fetchAPI<{ message: string; count: number }>('/devices/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

/**
 * Bulk import devices
 */
export async function bulkImportDevices(devices: Device[]): Promise<{ message: string; count: number }> {
  return fetchAPI<{ message: string; count: number }>('/devices/bulk-import', {
    method: 'POST',
    body: JSON.stringify(devices),
  });
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; database: string }> {
  return fetchAPI<{ status: string; database: string }>('/health');
}

// ============================================================================
// AUTOMATION API (Step 1)
// ============================================================================

export interface AutomationStatus {
  active_connections: number;
  connected_devices: string[];
  file_statistics: {
    text_directory: { file_count: number; total_size_mb: number };
    json_directory: { file_count: number; total_size_mb: number };
    total_files: number;
    total_size_mb: number;
  };
  status: string;
}

export interface ConnectionResult {
  status: string;
  device_id: string;
  device_name?: string;
  ip_address?: string;
  prompt?: string;
  error?: string;
}

export interface CommandResult {
  status: string;
  command: string;
  device_id: string;
  device_name: string;
  output?: string;
  output_length?: number;
  execution_time_seconds?: number;
  filename?: string;
  error?: string;
}

export interface ExecutionResult {
  total_devices: number;
  devices_processed: number;
  total_commands_success: number;
  total_commands_error: number;
  device_results: Array<{
    device_id: string;
    device_name: string;
    total_commands: number;
    success_count: number;
    error_count: number;
    results: CommandResult[];
  }>;
}

export interface FileInfo {
  filename: string;
  filepath: string;
  size_bytes: number;
  size_kb: number;
  created_at: string;
  modified_at: string;
  type: string;
}

export interface JobStatus {
  id: string;
  execution_id?: string;  // ID for the execution directory (e.g., exec_20250125_143052)
  status: 'running' | 'completed' | 'failed' | 'stopping' | 'stopped';
  start_time: string;
  end_time?: string;
  total_devices: number;
  completed_devices: number;
  progress_percent: number;

  // Real-time tracking
  current_device?: {
    device_id: string;
    device_name: string;
    country: string;
    current_command: string;
    command_index: number;
    total_commands: number;
    command_percent: number;
    command_elapsed_time: number;
  };

  device_progress?: Record<string, {
    device_name: string;
    country: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    percent: number;
    completed_commands: number;
    total_commands: number;
    commands: Array<{
      command: string;
      status: 'pending' | 'running' | 'success' | 'failed';
      percent: number;
      execution_time?: number;
      error?: string;
    }>;
  }>;

  country_stats?: Record<string, {
    total_devices: number;
    completed_devices: number;
    running_devices: number;
    failed_devices: number;
    pending_devices: number;
    total_commands: number;
    completed_commands: number;
    percent: number;
    device_percent: number;
    command_percent: number;
  }>;

  results: Record<string, any>;
  errors: string[];
}

/**
 * Start automation job with optional batch processing
 */
export async function startAutomationJob(
  deviceIds: string[],
  commands?: string[],
  batchSize?: number,
  devicesPerHour?: number
): Promise<{
  job_id: string;
  status: string;
  total_devices: number;
  batch_size: number;
  total_batches: number;
}> {
  return fetchAPI('/automation/jobs', {
    method: 'POST',
    body: JSON.stringify({
      device_ids: deviceIds,
      commands,
      batch_size: batchSize,
      devices_per_hour: devicesPerHour
    }),
    timeout: 60000, // 60 seconds for job startup
  });
}

/**
 * Get job status
 */
export async function getAutomationJob(jobId: string): Promise<JobStatus> {
  return fetchAPI(`/automation/jobs/${jobId}`);
}

/**
 * Get latest job
 */
export async function getLatestAutomationJob(): Promise<JobStatus | { status: 'no_jobs' }> {
  return fetchAPI('/automation/jobs/latest');
}

/**
 * Stop job
 */
export async function stopAutomationJob(jobId: string): Promise<{ message: string }> {
  return fetchAPI(`/automation/jobs/${jobId}/stop`, {
    method: 'POST'
  });
}

/**
 * Connect to devices for automation
 */
export async function automationConnect(
  deviceIds: string[],
  connectionMode: 'parallel' | 'sequential' = 'parallel'
): Promise<{
  total_devices: number;
  success_count: number;
  error_count: number;
  results: ConnectionResult[];
}> {
  return fetchAPI('/automation/connect', {
    method: 'POST',
    body: JSON.stringify({
      device_ids: deviceIds,
      connection_mode: connectionMode  // PHASE 2: Support sequential/parallel
    }),
    timeout: 120000, // 120 seconds for large batches (10 devices × 10s + buffer)
  });
}

/**
 * Execute commands on connected devices
 */
export async function automationExecute(
  deviceIds: string[],
  commands?: string[]
): Promise<ExecutionResult> {
  return fetchAPI('/automation/execute', {
    method: 'POST',
    body: JSON.stringify({ device_ids: deviceIds, commands }),
  });
}

/**
 * Disconnect from devices
 */
export async function automationDisconnect(deviceIds: string[]): Promise<{
  total_devices: number;
  disconnected_count: number;
  results: ConnectionResult[];
}> {
  return fetchAPI('/automation/disconnect', {
    method: 'POST',
    body: JSON.stringify({ device_ids: deviceIds }),
  });
}

/**
 * Get automation system status
 */
export async function automationStatus(): Promise<AutomationStatus> {
  return fetchAPI('/automation/status');
}

/**
 * List automation output files
 */
export async function automationFiles(
  folderType: 'text' | 'json' = 'text',
  deviceName?: string
): Promise<{
  folder_type: string;
  device_filter: string | null;
  file_count: number;
  files: FileInfo[];
}> {
  const params = new URLSearchParams();
  params.append('folder_type', folderType);
  if (deviceName) params.append('device_name', deviceName);

  return fetchAPI(`/automation/files?${params.toString()}`);
}

/**
 * Get content of a specific file
 */
export async function automationFileContent(
  filename: string,
  folderType: 'text' | 'json' = 'text'
): Promise<{
  filename: string;
  content: string;
  size_bytes: number;
  lines: number;
  created_at: string;
  type: string;
}> {
  return fetchAPI(`/automation/files/${filename}?folder_type=${folderType}`);
}

// ============================================================================
// TRANSFORMATION API (Step 3)
// ============================================================================

export interface TopologyNode {
  id: string;
  name: string;
  hostname: string;
  country: string;
  type: string;
  status: string;
}

export interface TopologyLink {
  id: number;
  source: string;
  target: string;
  source_interface: string;
  target_interface: string;
  status: string;
  cost: number;
}

export interface PhysicalLink {
  id: string;
  router_a: string;
  router_b: string;
  cost_a_to_b: number;
  cost_b_to_a: number;
  interface_a: string;
  interface_b: string;
  is_asymmetric: boolean;
  status: string;
}

export interface TopologyData {
  nodes: TopologyNode[];
  links: TopologyLink[];
  physical_links?: PhysicalLink[];
  timestamp: string;
  metadata: any;
}

/**
 * Generate network topology
 */
export async function generateTopology(): Promise<TopologyData> {
  return fetchAPI('/transform/topology', {
    method: 'POST'
  });
}

/**
 * Get latest topology
 */
export async function getLatestTopology(): Promise<TopologyData> {
  return fetchAPI('/transform/topology/latest');
}

/**
 * Get topology history
 */
export async function getTopologyHistory(): Promise<any[]> {
  return fetchAPI('/transform/history');
}

/**
 * Get a specific topology snapshot from history
 */
export async function getTopologySnapshot(filename: string): Promise<TopologyData> {
  return fetchAPI(`/transform/history/${filename}`);
}

/**
 * Delete a specific topology snapshot from history
 */
export async function deleteTopologySnapshot(filename: string): Promise<void> {
  return fetchAPI(`/transform/history/${filename}`, {
    method: 'DELETE'
  });
}

/**
 * Clear all topology history
 */
export async function clearTopologyHistory(): Promise<void> {
  return fetchAPI('/transform/history', {
    method: 'DELETE'
  });
}

/**
 * NetViz Pro compatible topology format
 */
export interface NetVizProNode {
  id: string;
  name: string;
  hostname: string;
  loopback_ip: string;
  country: string;
  is_active: boolean;
  node_type: string;
}

export interface NetVizProCapacity {
  speed: string;
  is_bundle: boolean;
  bundle_type?: string;
  member_count?: number;
  member_speed?: string;
  total_capacity_mbps: number;
}

export interface NetVizProTraffic {
  forward_traffic_mbps: number;
  forward_utilization_pct: number;
  reverse_traffic_mbps: number;
  reverse_utilization_pct: number;
}

export interface NetVizProLink {
  source: string;
  target: string;
  source_interface: string;
  target_interface: string;
  forward_cost: number;
  reverse_cost: number;
  cost: number;
  status: string;
  edge_type: string;
  is_asymmetric: boolean;
  source_capacity: NetVizProCapacity;
  target_capacity: NetVizProCapacity;
  traffic: NetVizProTraffic;
}

export interface NetVizProTopology {
  nodes: NetVizProNode[];
  links: NetVizProLink[];
  metadata: {
    export_timestamp: string;
    node_count: number;
    edge_count: number;
    asymmetric_count: number;
    description: string;
    data_source: string;
    format_version: string;
  };
  traffic_snapshots: any[];
  current_snapshot_id: string;
}

/**
 * Get topology in NetViz Pro compatible format
 */
export async function getNetvizProTopology(): Promise<NetVizProTopology> {
  return fetchAPI('/transform/topology/netviz-pro');
}

// ============================================================================
// DATABASE ADMINISTRATION API
// ============================================================================

export interface DatabaseStats {
  [dbName: string]: {
    path: string;
    size_bytes: number;
    size_mb: number;
    tables: { [tableName: string]: number };
    exists: boolean;
  };
}

export interface DatabaseActionResponse {
  status: string;
  database: string;
  timestamp: string;
  action?: string;
  tables_cleared?: string[];
}

/**
 * Get all database statistics
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  return fetchAPI('/admin/databases');
}

/**
 * Clear all data from a database
 */
export async function clearDatabase(dbName: string): Promise<DatabaseActionResponse> {
  return fetchAPI(`/admin/database/${dbName}/clear`, {
    method: 'POST'
  });
}

/**
 * Reset database to default state
 */
export async function resetDatabase(dbName: string): Promise<DatabaseActionResponse> {
  return fetchAPI(`/admin/database/${dbName}/reset`, {
    method: 'POST'
  });
}

/**
 * Export database as JSON
 */
export async function exportDatabase(dbName: string): Promise<any> {
  return fetchAPI(`/admin/database/${dbName}/export`);
}

/**
 * Delete database file
 */
export async function deleteDatabase(dbName: string): Promise<DatabaseActionResponse> {
  return fetchAPI(`/admin/database/${dbName}`, {
    method: 'DELETE'
  });
}

// ============================================================================
// INTERFACE CAPACITY API (Step 2.7c)
// ============================================================================

export interface InterfaceData {
  id: string;
  router: string;
  interface: string;
  description: string;
  admin_status: string;
  line_protocol: string;
  bw_kbps: number;
  capacity_class: string;
  input_rate_bps: number;
  output_rate_bps: number;
  input_utilization_pct: number;
  output_utilization_pct: number;
  is_physical: boolean;
  parent_interface: string | null;
  neighbor_router: string | null;
  neighbor_interface: string | null;
  router_country: string | null;
  updated_at: string;
}

export interface CapacitySummary {
  total_interfaces: number;
  physical_interfaces: number;
  logical_interfaces: number;
  by_capacity_class: Record<string, number>;
  by_router: Record<string, number>;
  high_utilization: {
    router: string;
    interface: string;
    input_pct: number;
    output_pct: number;
    bw_kbps: number;
  }[];
  timestamp: string;
}

export interface TrafficLink {
  source_router: string;
  source_interface: string;
  target_router: string;
  target_interface: string;
  source_country: string;
  target_country: string;
  input_bps: number;
  output_bps: number;
  capacity_kbps: number;
  capacity_class: string;
}

export interface TrafficMatrix {
  links: TrafficLink[];
  by_country: Record<string, {
    source: string;
    target: string;
    total_input_bps: number;
    total_output_bps: number;
    link_count: number;
  }>;
  total_traffic_bps: number;
  timestamp: string;
}

/**
 * Get interface capacity list
 */
export async function getInterfaceCapacity(): Promise<{ interfaces: InterfaceData[] }> {
  return fetchAPI('/interface-capacity');
}

/**
 * Get interface capacity summary
 */
export async function getInterfaceCapacitySummary(): Promise<CapacitySummary> {
  return fetchAPI('/interface-capacity/summary');
}

/**
 * Get traffic matrix
 */
export async function getTrafficMatrix(): Promise<TrafficMatrix> {
  return fetchAPI('/interface-capacity/traffic-matrix');
}

/**
 * Transform interface data from collected files
 */
export async function transformInterfaces(): Promise<{
  interfaces_processed: number;
  routers_processed: number;
  timestamp: string;
}> {
  return fetchAPI('/transform/interfaces', { method: 'POST' });
}

// ============================================================================
// CDP NEIGHBORS & PHYSICAL TOPOLOGY API
// ============================================================================

export interface CDPNeighbor {
  local_device: string;
  local_interface: string;
  neighbor_device: string;
  neighbor_interface: string;
  neighbor_ip: string;
  platform: string;
}

export interface PhysicalNode {
  id: string;
  name: string;
  type: string;
  country?: string;
}

export interface PhysicalLink {
  id: string;
  source: string;
  target: string;
  source_interface: string;
  target_interface: string;
}

/**
 * Get CDP neighbors
 */
export async function getCDPNeighbors(): Promise<{ neighbors: CDPNeighbor[] }> {
  return fetchAPI('/cdp-neighbors');
}

/**
 * Get physical topology
 */
export async function getPhysicalTopology(): Promise<{
  nodes: PhysicalNode[];
  links: PhysicalLink[];
}> {
  return fetchAPI('/physical-topology');
}

// ============================================================================
// OSPF DESIGNER API
// ============================================================================

export interface OSPFLink {
  id: string;
  source: string;
  target: string;
  cost: number;
  interface_local: string;
  interface_remote: string;
}

export interface DraftTopology {
  nodes: any[];
  links: OSPFLink[];
  updated_links: any[];
}

export interface ImpactAnalysis {
  changes: any[];
  affected_paths: any[];
  risk_level: string;
  summary: string;
}

/**
 * Create new OSPF design draft session
 */
export async function createOSPFDraft(): Promise<{ status: string }> {
  return fetchAPI('/ospf/design/draft', { method: 'POST' });
}

/**
 * Get current OSPF design draft
 */
export async function getOSPFDraft(): Promise<DraftTopology> {
  return fetchAPI('/ospf/design/draft');
}

/**
 * Update cost in OSPF draft
 */
export async function updateOSPFCost(
  source: string,
  target: string,
  interfaceName: string,
  cost: number
): Promise<{ status: string }> {
  return fetchAPI('/ospf/design/update-cost', {
    method: 'POST',
    body: JSON.stringify({
      source,
      target,
      interface: interfaceName,
      cost
    })
  });
}

/**
 * Run OSPF impact analysis
 */
export async function runOSPFImpactAnalysis(): Promise<ImpactAnalysis> {
  return fetchAPI('/ospf/analyze/impact');
}

/**
 * Delete OSPF design draft
 */
export async function deleteOSPFDraft(): Promise<{ status: string; message: string }> {
  return fetchAPI('/ospf/design/draft', { method: 'DELETE' });
}

// ============== JUMPHOST CONFIGURATION API ==============

export interface JumphostConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  connected?: boolean;
  active_tunnels?: number;
}

export interface JumphostTestResult {
  status: 'success' | 'failed' | 'skipped';
  message: string;
}

/**
 * Get current jumphost configuration
 */
export async function getJumphostConfig(): Promise<JumphostConfig> {
  return fetchAPI('/settings/jumphost');
}

/**
 * Save jumphost configuration
 */
export async function saveJumphostConfig(config: JumphostConfig): Promise<{ status: string; message: string }> {
  return fetchAPI('/settings/jumphost', {
    method: 'POST',
    body: JSON.stringify(config)
  });
}

/**
 * Test jumphost connection
 */
export async function testJumphostConnection(): Promise<JumphostTestResult> {
  return fetchAPI('/settings/jumphost/test', {
    method: 'POST'
  });
}
