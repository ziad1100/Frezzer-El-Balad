/**
 * useAgentSSE — Real-time printer status monitoring via Server-Sent Events.
 *
 * Connects to the Local Print Agent's /events endpoint and receives:
 * - status: printer online/offline/connection changes
 * - print-start: a print job has started
 * - print-success: a print job completed successfully
 * - print-failure: a print job failed
 * - heartbeat: connection alive signal
 *
 * Automatically reconnects on disconnect with exponential backoff.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface AgentStatusEvent {
  connected: boolean;
  connectionType: string;
  status: string;
  details?: Record<string, unknown>;
  pendingJobs?: number;
  timestamp: string;
}

export interface PrintJobEvent {
  jobId: string;
  orderNo: string;
  error?: string;
  code?: string;
  timestamp: string;
}

export interface AgentSSEState {
  /** Whether the SSE connection is currently active */
  connected: boolean;
  /** Whether the printer agent reports as online */
  printerOnline: boolean;
  /** Current printer connection type */
  connectionType: string;
  /** Current printer status */
  printerStatus: string;
  /** Last received status event */
  lastStatus: AgentStatusEvent | null;
  /** Recent print events (last 10) */
  recentEvents: Array<{
    type: 'print-start' | 'print-success' | 'print-failure';
    data: PrintJobEvent;
  }>;
}

const AGENT_PORTS = [9200, 9201, 9202];
const MAX_RECENT_EVENTS = 10;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;

/**
 * Detect the local print agent URL.
 * Returns the URL if found, null otherwise.
 */
async function detectAgentUrl(): Promise<string | null> {
  for (const port of AGENT_PORTS) {
    try {
      const url = `http://localhost:${port}`;
      const res = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return url;
    } catch {
      // try next port
    }
  }
  return null;
}

export function useAgentSSE(enabled = true): AgentSSEState {
  const [state, setState] = useState<AgentSSEState>({
    connected: false,
    printerOnline: false,
    connectionType: '',
    printerStatus: '',
    lastStatus: null,
    recentEvents: [],
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const agentUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    // Detect agent URL if not known
    if (!agentUrlRef.current) {
      agentUrlRef.current = await detectAgentUrl();
      if (!agentUrlRef.current) {
        setState((prev) => ({ ...prev, connected: false, printerOnline: false }));
        // Retry detection later
        if (mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptRef.current = 0;
            void connect();
          }, RECONNECT_MAX_MS);
        }
        return;
      }
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource(`${agentUrlRef.current}/events`);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        reconnectAttemptRef.current = 0;
        setState((prev) => ({ ...prev, connected: true }));
      };

      es.addEventListener('status', (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data) as AgentStatusEvent;
          setState((prev) => ({
            ...prev,
            printerOnline: data.connected,
            connectionType: data.connectionType || prev.connectionType,
            printerStatus: data.status || prev.printerStatus,
            lastStatus: data,
          }));
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener('print-start', (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data) as PrintJobEvent;
          setState((prev) => ({
            ...prev,
            recentEvents: [
              { type: 'print-start' as const, data },
              ...prev.recentEvents.slice(0, MAX_RECENT_EVENTS - 1),
            ],
          }));
        } catch {
          // ignore
        }
      });

      es.addEventListener('print-success', (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data) as PrintJobEvent;
          setState((prev) => ({
            ...prev,
            recentEvents: [
              { type: 'print-success' as const, data },
              ...prev.recentEvents.slice(0, MAX_RECENT_EVENTS - 1),
            ],
          }));
        } catch {
          // ignore
        }
      });

      es.addEventListener('print-failure', (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data) as PrintJobEvent;
          setState((prev) => ({
            ...prev,
            recentEvents: [
              { type: 'print-failure' as const, data },
              ...prev.recentEvents.slice(0, MAX_RECENT_EVENTS - 1),
            ],
          }));
        } catch {
          // ignore
        }
      });

      es.addEventListener('heartbeat', () => {
        // Connection is alive — reset reconnect on next error
        if (!mountedRef.current) return;
        setState((prev) => ({ ...prev, connected: true }));
      });

      es.onerror = () => {
        if (!mountedRef.current) return;
        es.close();
        eventSourceRef.current = null;
        setState((prev) => ({ ...prev, connected: false }));

        // Exponential backoff reconnect
        const delay = Math.min(
          RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current),
          RECONNECT_MAX_MS,
        );
        reconnectAttemptRef.current++;

        // If we've been disconnected for a while, re-detect the agent
        if (reconnectAttemptRef.current > 5) {
          agentUrlRef.current = null;
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          void connect();
        }, delay);
      };
    } catch {
      // EventSource constructor failed
      setState((prev) => ({ ...prev, connected: false }));
      reconnectTimeoutRef.current = setTimeout(() => {
        agentUrlRef.current = null;
        void connect();
      }, RECONNECT_MAX_MS);
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      void connect();
    }
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  return state;
}
