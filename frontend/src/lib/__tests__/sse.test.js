/**
 * Tests for the SSE connection manager.
 *
 * Covers: connectSSE, disconnectSSE, onSSEEvent, dispatch, isSSEConnected.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the api module
vi.mock('@/lib/api', () => ({
  PROJECT_URL: 'http://localhost:5003',
}));

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  getSupabase: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: { access_token: 'mock-jwt-token' },
          },
        })
      ),
    },
  })),
}));

// Track EventSource instances
let eventSourceInstances = [];
let eventSourceHandlers = {};

// Mock EventSource
class MockEventSource {
  static CLOSED = 2;
  static CONNECTING = 0;
  static OPEN = 1;

  url;
  readyState = MockEventSource.CONNECTING;
  onopen = null;
  onerror = null;
  _listeners = {};

  constructor(url) {
    this.url = url;
    eventSourceInstances.push(this);
  }

  addEventListener(event, handler) {
    this._listeners[event] = handler;
    eventSourceHandlers[event] = handler;
  }

  removeEventListener(event) {
    delete this._listeners[event];
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  // Simulate receiving an event
  simulateEvent(event, data) {
    const handler = this._listeners[event];
    if (handler) {
      handler({ data: JSON.stringify(data) });
    }
  }

  // Simulate connection open
  simulateOpen() {
    this.readyState = MockEventSource.OPEN;
    if (this.onopen) this.onopen();
  }

  // Simulate connection error
  simulateError() {
    if (this.onerror) this.onerror(new Error('Connection failed'));
  }
}

// Set global EventSource
global.EventSource = MockEventSource;

// Import after mocks are set up
const { connectSSE, disconnectSSE, onSSEEvent, isSSEConnected } = await import('../sse');

describe('SSE Connection Manager', () => {
  beforeEach(() => {
    eventSourceInstances = [];
    eventSourceHandlers = {};
    vi.useFakeTimers();
  });

  afterEach(() => {
    disconnectSSE();
    vi.useRealTimers();
  });

  describe('connectSSE', () => {
    it('should create an EventSource connection', async () => {
      await connectSSE();
      expect(eventSourceInstances.length).toBe(1);
      expect(eventSourceInstances[0].url).toContain('/service/nl-stream');
      expect(eventSourceInstances[0].url).toContain('token=');
    });

    it('should not create duplicate connections', async () => {
      await connectSSE();
      await connectSSE();
      expect(eventSourceInstances.length).toBe(1);
    });

    it('should include JWT token in URL', async () => {
      await connectSSE();
      expect(eventSourceInstances[0].url).toContain('mock-jwt-token');
    });
  });

  describe('disconnectSSE', () => {
    it('should close the EventSource connection', async () => {
      await connectSSE();
      expect(eventSourceInstances[0].readyState).toBe(MockEventSource.CONNECTING);
      disconnectSSE();
      expect(eventSourceInstances[0].readyState).toBe(MockEventSource.CLOSED);
    });

    it('should prevent further reconnection attempts', async () => {
      await connectSSE();
      disconnectSSE();
      // Try reconnecting after disconnect — should not create new connection
      // because reconnectAttempts is set to MAX
      vi.advanceTimersByTime(60000);
      // No new EventSource should be created
      expect(eventSourceInstances.length).toBe(1);
    });
  });

  describe('onSSEEvent', () => {
    it('should register and receive events', async () => {
      const callback = vi.fn();
      onSSEEvent('entry_parsed', callback);

      await connectSSE();
      eventSourceInstances[0].simulateEvent('entry_parsed', {
        project: 'TestProject',
        fields: { task: 'Test' },
      });

      expect(callback).toHaveBeenCalledWith({
        project: 'TestProject',
        fields: { task: 'Test' },
      });
    });

    it('should return an unsubscribe function', async () => {
      const callback = vi.fn();
      const unsub = onSSEEvent('entry_parsed', callback);

      await connectSSE();

      // First event should be received
      eventSourceInstances[0].simulateEvent('entry_parsed', { test: 1 });
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsub();

      // Second event should NOT be received
      eventSourceInstances[0].simulateEvent('entry_parsed', { test: 2 });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners for the same event', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      onSSEEvent('entry_parsed', cb1);
      onSSEEvent('entry_parsed', cb2);

      await connectSSE();
      eventSourceInstances[0].simulateEvent('entry_parsed', { test: true });

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it('should handle entry_error events', async () => {
      const callback = vi.fn();
      onSSEEvent('entry_error', callback);

      await connectSSE();
      eventSourceInstances[0].simulateEvent('entry_error', {
        success: false,
        error: 'Something went wrong',
      });

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Something went wrong',
      });
    });
  });

  describe('isSSEConnected', () => {
    it('should return false when not connected', () => {
      expect(isSSEConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await connectSSE();
      eventSourceInstances[0].simulateOpen();
      expect(isSSEConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      await connectSSE();
      eventSourceInstances[0].simulateOpen();
      disconnectSSE();
      expect(isSSEConnected()).toBe(false);
    });
  });

  describe('reconnection', () => {
    it('should attempt reconnection on error', async () => {
      await connectSSE();
      eventSourceInstances[0].simulateError();

      // Should schedule reconnect — flush async operations
      await vi.advanceTimersByTimeAsync(1500);
      expect(eventSourceInstances.length).toBe(2); // Original + reconnect
    });

    it('should use exponential backoff', async () => {
      await connectSSE();

      // First error — reconnect after 1s
      eventSourceInstances[0].simulateError();
      await vi.advanceTimersByTimeAsync(500);
      expect(eventSourceInstances.length).toBe(1); // Not yet
      await vi.advanceTimersByTimeAsync(600);
      expect(eventSourceInstances.length).toBe(2); // Now (~1s)

      // Second error — reconnect after 2s
      eventSourceInstances[1].simulateError();
      await vi.advanceTimersByTimeAsync(1500);
      expect(eventSourceInstances.length).toBe(2); // Not yet (need 2s)
      await vi.advanceTimersByTimeAsync(600);
      expect(eventSourceInstances.length).toBe(3); // Now (~2s)
    });
  });
});
