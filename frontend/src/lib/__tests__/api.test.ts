import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

const mockGetSession = vi.fn();
const { mockEnsureBackendReady, mockInvalidateBackendReady } = vi.hoisted(() => ({
  mockEnsureBackendReady: vi.fn(),
  mockInvalidateBackendReady: vi.fn(),
}));

vi.mock('../gateway', () => ({
  GATEWAY_URL: '',
  ensureBackendReady: mockEnsureBackendReady,
  invalidateBackendReady: mockInvalidateBackendReady,
}));

vi.mock('../supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}));

import { request, api } from '../api';

// Helper to get typed mock fetch
function getMockFetch(): Mock {
  return fetch as unknown as Mock;
}

describe('request', () => {
  beforeEach(() => {
    mockEnsureBackendReady.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('includes Authorization header with bearer token', async () => {
    getMockFetch().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
    });
    await request('https://example.com/api');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('throws on non-ok response', async () => {
    getMockFetch().mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    });
    await expect(request('https://example.com/api')).rejects.toThrow('API error 404: Not found');
  });

  it('returns parsed JSON on success', async () => {
    getMockFetch().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: 'Test' }),
    });
    const result = await request('https://example.com/api');
    expect(result).toEqual({ id: 1, name: 'Test' });
  });

  it('passes through additional options', async () => {
    getMockFetch().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await request('https://example.com/api', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      })
    );
  });

  it('uses empty Authorization when no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    getMockFetch().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await request('https://example.com/api');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: '' }),
      })
    );
  });

  it('starts the operation timeout only after the backend is ready', async () => {
    vi.useFakeTimers();
    let ready!: () => void;
    mockEnsureBackendReady.mockReturnValueOnce(new Promise<void>((resolve) => (ready = resolve)));
    getMockFetch().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ saved: true }),
    });
    const pending = request('/api/project/service/entries', { method: 'POST', timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).not.toHaveBeenCalled();
    ready();
    await expect(pending).resolves.toEqual({ saved: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getMockFetch().mock.calls[0][1].signal.aborted).toBe(false);
  });

  it('invalidates readiness without replaying a failed write', async () => {
    getMockFetch().mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: () => Promise.resolve('upstream unavailable'),
    });
    await expect(
      request('/api/project/service/entries', { method: 'POST', body: '{}' })
    ).rejects.toThrow('API error 502');
    expect(mockInvalidateBackendReady).toHaveBeenCalledWith('/api/project/service/entries');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('api health checks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('api.auth.health calls AUTH_URL', async () => {
    getMockFetch().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ service: 'auth', status: 'ok' }),
    });
    const result = await api.auth.health();
    expect(result).toEqual({ service: 'auth', status: 'ok' });
  });

  it('api.dashboard.health calls DASHBOARD_URL', async () => {
    getMockFetch().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ service: 'dashboard', status: 'ok' }),
    });
    const result = await api.dashboard.health();
    expect(result).toEqual({ service: 'dashboard', status: 'ok' });
  });

  it('api.projects.health calls PROJECT_URL', async () => {
    getMockFetch().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ service: 'project', status: 'ok' }),
    });
    const result = await api.projects.health();
    expect(result).toEqual({ service: 'project', status: 'ok' });
  });
});
