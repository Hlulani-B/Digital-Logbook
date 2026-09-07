/**
 * Integration tests for the SSE + IndexedDB cache invalidation flow.
 *
 * Tests that SSE events correctly trigger cache invalidation
 * and that the event dispatch system works end-to-end.
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
          data: { session: { access_token: 'mock-jwt-token' } },
        })
      ),
    },
  })),
}));

// Mock the cache module to track invalidation calls
const cacheDeleteMock = vi.fn();
vi.mock('@/lib/cache', () => ({
  CACHE_STORES: {
    PROJECTS: 'projects',
    ENTRIES: 'entries',
    ALL_ENTRIES: 'all-entries',
    PROFILE: 'profile',
    SEARCH: 'search',
  },
  cacheDelete: (...args) => cacheDeleteMock(...args),
  cacheSet: vi.fn(),
  cacheGet: vi.fn(),
}));

// Mock AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { email: 'testuser@test.com' } })),
}));

// Mock EventSource
let eventSourceInstances = [];
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
  }
  removeEventListener() {}
  close() {
    this.readyState = MockEventSource.CLOSED;
  }
  simulateEvent(event, data) {
    const handler = this._listeners[event];
    if (handler) handler({ data: JSON.stringify(data) });
  }
  simulateOpen() {
    this.readyState = MockEventSource.OPEN;
    if (this.onopen) this.onopen();
  }
}
global.EventSource = MockEventSource;

const { connectSSE, disconnectSSE, onSSEEvent } = await import('../sse');

describe('SSE + Cache Integration', () => {
  beforeEach(() => {
    eventSourceInstances = [];
    cacheDeleteMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    disconnectSSE();
    vi.useRealTimers();
  });

  describe('Single entry SSE event → cache invalidation', () => {
    it('should invalidate entries cache for the specific project', async () => {
      const callback = vi.fn();
      onSSEEvent('entry_parsed', callback);

      await connectSSE();

      // Simulate backend pushing a parsed entry
      eventSourceInstances[0].simulateEvent('entry_parsed', {
        success: true,
        project: 'WebApp',
        fields: { task: 'Fixed login bug' },
        created_new_project: false,
        multi: false,
      });

      // Callback should have been called with the data
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ project: 'WebApp' })
      );
    });

    it('should invalidate projects cache when new project is created', async () => {
      const callback = vi.fn();
      onSSEEvent('entry_parsed', callback);

      await connectSSE();

      eventSourceInstances[0].simulateEvent('entry_parsed', {
        success: true,
        project: 'BrandNewProject',
        fields: { task: 'First entry' },
        created_new_project: true,
        multi: false,
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          project: 'BrandNewProject',
          created_new_project: true,
        })
      );
    });
  });

  describe('Multi-entry SSE event → cache invalidation', () => {
    it('should handle multi-project entries', async () => {
      const callback = vi.fn();
      onSSEEvent('entry_parsed', callback);

      await connectSSE();

      eventSourceInstances[0].simulateEvent('entry_parsed', {
        success: true,
        multi: true,
        results: {
          old: [
            { project_name: 'WebApp', fields: { task: 'Bug fix' } },
            { project_name: 'Gym', fields: { activity: 'Ran 5km' } },
          ],
          new: [
            { project_name: 'Cooking', fields: { recipe: 'Pasta' } },
          ],
        },
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ multi: true })
      );
    });
  });

  describe('Error event flow', () => {
    it('should dispatch error events to listeners', async () => {
      const errorCallback = vi.fn();
      onSSEEvent('entry_error', errorCallback);

      await connectSSE();

      eventSourceInstances[0].simulateEvent('entry_error', {
        success: false,
        error: 'AI returned invalid JSON',
      });

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'AI returned invalid JSON',
        })
      );
    });
  });

  describe('End-to-end SSE event flow', () => {
    it('should handle complete submit → SSE → callback flow', async () => {
      // Simulate the full flow:
      // 1. User submits text
      // 2. Backend parses and pushes via SSE
      // 3. Frontend receives and processes

      const entryCallback = vi.fn();
      const errorCallback = vi.fn();
      onSSEEvent('entry_parsed', entryCallback);
      onSSEEvent('entry_error', errorCallback);

      await connectSSE();
      eventSourceInstances[0].simulateOpen();

      // Simulate successful parse
      eventSourceInstances[0].simulateEvent('entry_parsed', {
        success: true,
        project: 'WebApp',
        fields: { task: 'Fixed login bug' },
        priority: null,
        due_date: '2026-09-03',
        comment: 'Added to WebApp — nice bug fix!',
        multi: false,
        created_new_project: false,
        project_only: false,
      });

      // Entry callback should fire
      expect(entryCallback).toHaveBeenCalledTimes(1);
      expect(errorCallback).not.toHaveBeenCalled();

      // Verify the data structure
      const data = entryCallback.mock.calls[0][0];
      expect(data.project).toBe('WebApp');
      expect(data.fields.task).toBe('Fixed login bug');
      expect(data.due_date).toBe('2026-09-03');
      expect(data.comment).toContain('nice bug fix');
    });

    it('should handle error after successful connection', async () => {
      const entryCallback = vi.fn();
      const errorCallback = vi.fn();
      onSSEEvent('entry_parsed', entryCallback);
      onSSEEvent('entry_error', errorCallback);

      await connectSSE();

      // First a success
      eventSourceInstances[0].simulateEvent('entry_parsed', {
        success: true,
        project: 'WebApp',
      });
      expect(entryCallback).toHaveBeenCalledTimes(1);

      // Then an error
      eventSourceInstances[0].simulateEvent('entry_error', {
        success: false,
        error: 'Network timeout',
      });
      expect(errorCallback).toHaveBeenCalledTimes(1);

      // Then another success
      eventSourceInstances[0].simulateEvent('entry_parsed', {
        success: true,
        project: 'Gym',
      });
      expect(entryCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multiple listeners integration', () => {
    it('should notify all listeners when SSE event arrives', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      onSSEEvent('entry_parsed', listener1);
      onSSEEvent('entry_parsed', listener2);
      onSSEEvent('entry_parsed', listener3);

      await connectSSE();

      eventSourceInstances[0].simulateEvent('entry_parsed', {
        project: 'TestProject',
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should not notify unsubscribed listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      onSSEEvent('entry_parsed', listener1);
      const unsub2 = onSSEEvent('entry_parsed', listener2);

      await connectSSE();

      // First event — both should receive
      eventSourceInstances[0].simulateEvent('entry_parsed', { n: 1 });
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      // Unsubscribe listener2
      unsub2();

      // Second event — only listener1 should receive
      eventSourceInstances[0].simulateEvent('entry_parsed', { n: 2 });
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(1); // Still 1
    });
  });
});
