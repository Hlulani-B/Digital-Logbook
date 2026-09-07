/**
 * SSE (Server-Sent Events) connection manager for real-time updates.
 *
 * Opens a persistent connection to the backend's SSE endpoint and
 * dispatches events to registered listeners. Used to receive
 * parsed natural language entry data the moment the AI finishes
 * parsing — before the full POST response cycle completes.
 */

import { PROJECT_URL } from './api';

let eventSource = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000; // 1 second

// Event listeners: Map<eventName, Set<callback>>
const listeners = new Map();

/**
 * Get the JWT token from Supabase for SSE authentication.
 * @returns {Promise<string>}
 */
async function getToken() {
  const { getSupabase } = await import('./supabase');
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  return session?.access_token || '';
}

/**
 * Connect to the SSE stream.
 * Automatically reconnects on failure with exponential backoff.
 */
export async function connectSSE() {
  // Don't create duplicate connections
  if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
    return;
  }

  try {
    const token = await getToken();
    if (!token) {
      console.warn('[SSE] No auth token available, skipping connection');
      return;
    }

    // EventSource doesn't support custom headers, so we pass the token as a query param
    // The backend middleware should be updated to accept token from query string for SSE
    const url = `${PROJECT_URL}/service/nl-stream?token=${encodeURIComponent(token)}`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('[SSE] Connected to stream');
      reconnectAttempts = 0;
    };

    eventSource.onerror = (err) => {
      console.warn('[SSE] Connection error:', err);
      eventSource.close();
      eventSource = null;
      scheduleReconnect();
    };

    // Listen for named events
    eventSource.addEventListener('connected', (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[SSE] Stream confirmed:', data);
        dispatch('connected', data);
      } catch (err) {
        console.warn('[SSE] Failed to parse connected event:', err);
      }
    });

    eventSource.addEventListener('entry_parsed', (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[SSE] Entry parsed event received:', data);
        dispatch('entry_parsed', data);
      } catch (err) {
        console.warn('[SSE] Failed to parse entry_parsed event:', err);
      }
    });

    eventSource.addEventListener('entry_error', (e) => {
      try {
        const data = JSON.parse(e.data);
        console.warn('[SSE] Entry error event received:', data);
        dispatch('entry_error', data);
      } catch (err) {
        console.warn('[SSE] Failed to parse entry_error event:', err);
      }
    });
  } catch (err) {
    console.error('[SSE] Failed to connect:', err);
    scheduleReconnect();
  }
}

/**
 * Schedule a reconnection attempt with exponential backoff.
 */
function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn('[SSE] Max reconnect attempts reached, giving up');
    return;
  }

  const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;

  console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => {
    connectSSE();
  }, delay);
}

/**
 * Disconnect from the SSE stream.
 */
export function disconnectSSE() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  reconnectAttempts = 0; // Reset so future connectSSE calls work cleanly
}

/**
 * Register a listener for an SSE event.
 * @param {string} event - The event name
 * @param {Function} callback - The callback to invoke
 * @returns {Function} Unsubscribe function
 */
export function onSSEEvent(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  // Return unsubscribe function
  return () => {
    const set = listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        listeners.delete(event);
      }
    }
  };
}

/**
 * Dispatch an event to all registered listeners.
 * @param {string} event - The event name
 * @param {any} data - The event data
 */
function dispatch(event, data) {
  const set = listeners.get(event);
  if (set) {
    for (const cb of set) {
      try {
        cb(data);
      } catch (err) {
        console.warn(`[SSE] Listener error for "${event}":`, err);
      }
    }
  }
}

/**
 * Check if the SSE connection is currently open.
 * @returns {boolean}
 */
export function isSSEConnected() {
  return eventSource !== null && eventSource.readyState === EventSource.OPEN;
}
