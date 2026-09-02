import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetSession = vi.fn();

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

describe('request', () => {
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

  it('includes Authorization header with bearer token', async () => {
    fetch.mockResolvedValueOnce({
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
    fetch.mockResolvedValueOnce({
      ok: false, status: 404,
      text: () => Promise.resolve('Not found'),
    });
    await expect(request('https://example.com/api')).rejects.toThrow('API error 404: Not found');
  });

  it('returns parsed JSON on success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: 'Test' }),
    });
    const result = await request('https://example.com/api');
    expect(result).toEqual({ id: 1, name: 'Test' });
  });

  it('passes through additional options', async () => {
    fetch.mockResolvedValueOnce({
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
    fetch.mockResolvedValueOnce({
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
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ service: 'auth', status: 'ok' }),
    });
    const result = await api.auth.health();
    expect(result).toEqual({ service: 'auth', status: 'ok' });
  });

  it('api.dashboard.health calls DASHBOARD_URL', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ service: 'dashboard', status: 'ok' }),
    });
    const result = await api.dashboard.health();
    expect(result).toEqual({ service: 'dashboard', status: 'ok' });
  });

  it('api.projects.health calls PROJECT_URL', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ service: 'project', status: 'ok' }),
    });
    const result = await api.projects.health();
    expect(result).toEqual({ service: 'project', status: 'ok' });
  });
});
