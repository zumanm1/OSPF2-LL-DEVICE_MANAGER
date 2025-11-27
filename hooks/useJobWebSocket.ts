/**
 * WebSocket Hook for Real-Time Job Updates
 * Connects to backend WebSocket and provides live job status updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// WebSocket message types from backend
export interface JobUpdate {
  type: 'job_update';
  job_id: string;
  data: {
    event: string;
    job_id: string;
    status: string;
    progress_percent: number;
    total_devices: number;
    completed_devices: number;
    current_device: {
      device_id: string;
      device_name: string;
      country: string;
      status: string;
      current_command?: string;
      command_index?: number;
      total_commands?: number;
    } | null;
    device_progress: Record<string, {
      device_name: string;
      country: string;
      status: string;
      completed_commands: number;
      total_commands: number;
      percent?: number;
      commands?: Array<{
        command: string;
        status: string;
        percent: number;
        execution_time?: number;
        error?: string;
      }>;
    }>;
    country_stats: Record<string, {
      total_devices: number;
      completed_devices: number;
      running_devices: number;
      failed_devices: number;
      pending_devices: number;
      total_commands: number;
      completed_commands: number;
      percent?: number;
    }>;
    errors: string[];
  };
}

export interface UseJobWebSocketOptions {
  jobId?: string | null;
  enabled?: boolean;
  onUpdate?: (data: JobUpdate['data']) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export interface UseJobWebSocketReturn {
  isConnected: boolean;
  lastUpdate: JobUpdate['data'] | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

const BACKEND_WS_URL = 'ws://localhost:9051';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useJobWebSocket(options: UseJobWebSocketOptions = {}): UseJobWebSocketReturn {
  const {
    jobId = null,
    enabled = true,
    onUpdate,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<JobUpdate['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;

    cleanup();

    // Build WebSocket URL - use "all" if no specific job
    const wsPath = jobId ? `/ws/jobs/${jobId}` : '/ws/jobs/all';
    const wsUrl = `${BACKEND_WS_URL}${wsPath}`;

    console.log(`[WebSocket] Connecting to ${wsUrl}...`);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: JobUpdate = JSON.parse(event.data);
          if (message.type === 'job_update') {
            console.log(`[WebSocket] Job update: ${message.data.event}`, message.data);
            setLastUpdate(message.data);
            onUpdate?.(message.data);
          }
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        setError('WebSocket connection error');
        onError?.(event);
      };

      ws.onclose = (event) => {
        console.log(`[WebSocket] Disconnected (code: ${event.code})`);
        setIsConnected(false);
        onDisconnect?.();

        // Attempt reconnection if not intentionally closed
        if (enabled && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          console.log(`[WebSocket] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
          reconnectTimeout.current = setTimeout(connect, RECONNECT_DELAY);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Max reconnection attempts reached');
        }
      };
    } catch (e) {
      console.error('[WebSocket] Failed to create WebSocket:', e);
      setError('Failed to connect to WebSocket');
    }
  }, [enabled, jobId, cleanup, onConnect, onDisconnect, onError, onUpdate]);

  const disconnect = useCallback(() => {
    console.log('[WebSocket] Disconnecting...');
    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    cleanup();
    setIsConnected(false);
  }, [cleanup]);

  // Connect on mount / when enabled changes
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      cleanup();
    };
  }, [enabled, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    lastUpdate,
    error,
    connect,
    disconnect,
  };
}

export default useJobWebSocket;
