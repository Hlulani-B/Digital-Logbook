import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function response(status: number, data: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => data };
}

function awake(service: string) {
  return response(200, { success: true, services: [{ service, status: 'awake' }] });
}

describe('backend startup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_API_GATEWAY_URL', '');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('coalesces concurrent requests to one service and caches successful readiness', async () => {
    const { ensureBackendReady, invalidateBackendReady } = await import('../gateway');
    vi.mocked(fetch).mockResolvedValue(awake('project') as Response);
    await Promise.all([
      ensureBackendReady('/api/project/service/entries'),
      ensureBackendReady('/api/project/service/templates'),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/wake?service=project', expect.anything());
    await ensureBackendReady('/api/project/service/entries');
    expect(fetch).toHaveBeenCalledTimes(1);
    invalidateBackendReady('/api/project/service/entries');
    await ensureBackendReady('/api/project/service/entries');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries sleeping gateway responses before the backend request', async () => {
    const { ensureBackendReady } = await import('../gateway');
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(502, null) as Response)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(awake('profile') as Response);
    const pending = ensureBackendReady('/api/profile/service/login');
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls.every(([url]) => url === '/api/wake?service=profile')).toBe(
      true
    );
  });

  it('does not let a slow all-service wake delay a ready destination', async () => {
    const { wakeBackendServices, ensureBackendReady } = await import('../gateway');
    let release!: (value: Response) => void;
    vi.mocked(fetch)
      .mockReturnValueOnce(new Promise<Response>((resolve) => (release = resolve)))
      .mockResolvedValueOnce(awake('profile') as Response);
    const all = wakeBackendServices();
    await expect(ensureBackendReady('/api/profile/service/login')).resolves.toBeUndefined();
    release(
      response(207, {
        success: false,
        services: [
          { service: 'profile', status: 'awake' },
          { service: 'project', status: 'failed' },
        ],
      }) as Response
    );
    await all;
    vi.mocked(fetch).mockResolvedValueOnce(awake('project') as Response);
    await ensureBackendReady('/api/project/service/entries');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('surfaces a confirmed outage and allows another wake attempt', async () => {
    const { ensureBackendReady } = await import('../gateway');
    vi.mocked(fetch).mockResolvedValueOnce(
      response(503, {
        code: 'SERVICE_UNAVAILABLE',
        error: 'Backend service is unavailable. Please try again.',
      }) as Response
    );
    await expect(ensureBackendReady('/api/project/service/entries')).rejects.toThrow(
      'Backend service is unavailable'
    );
    vi.mocked(fetch).mockResolvedValueOnce(awake('project') as Response);
    await expect(ensureBackendReady('/api/project/service/entries')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('bounds startup retries when the gateway never becomes available', async () => {
    const { ensureBackendReady } = await import('../gateway');
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(response(502, null) as Response);
    const pending = expect(ensureBackendReady('/api/project/service/entries')).rejects.toThrow(
      'took too long to start'
    );
    await vi.advanceTimersByTimeAsync(180_000);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rechecks a service after an idle period', async () => {
    const { ensureBackendReady } = await import('../gateway');
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(awake('dashboard') as Response);
    await ensureBackendReady('/api/dashboard/service/search');
    await vi.advanceTimersByTimeAsync(60_001);
    await ensureBackendReady('/api/dashboard/service/search');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('wakes all services from one call and shares login warm-up calls', async () => {
    const { wakeBackendServices } = await import('../gateway');
    vi.mocked(fetch).mockResolvedValue(
      response(200, {
        success: true,
        services: ['auth', 'dashboard', 'project', 'profile'].map((service) => ({
          service,
          status: 'awake',
        })),
      }) as Response
    );
    await Promise.all([wakeBackendServices(), wakeBackendServices()]);
    await wakeBackendServices();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/wake', expect.anything());
  });

  it('only probes URLs routed through the configured gateway', async () => {
    vi.stubEnv('VITE_API_GATEWAY_URL', 'https://gateway.example.test///');
    const { ensureBackendReady } = await import('../gateway');
    await ensureBackendReady('https://unrelated.example.test/api/project/service/entries');
    await ensureBackendReady('https://gateway.example.test/api/project-other');
    expect(fetch).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValue(awake('project') as Response);
    await ensureBackendReady('https://gateway.example.test/api/project/service/entries');
    expect(fetch).toHaveBeenCalledWith(
      'https://gateway.example.test/api/wake?service=project',
      expect.anything()
    );
  });

  it('holds a raw upload until ready and never replays a failed write', async () => {
    const { fetchFromGateway, ensureBackendReady } = await import('../gateway');
    let release!: (value: Response) => void;
    const failed = response(502, null) as Response;
    vi.mocked(fetch)
      .mockReturnValueOnce(new Promise<Response>((resolve) => (release = resolve)))
      .mockResolvedValueOnce(failed);
    const body = new FormData();
    body.append('file', new Blob(['upload contents']), 'example.txt');
    const upload = fetchFromGateway('/api/project/upload', { method: 'POST', body });
    expect(fetch).toHaveBeenCalledTimes(1);
    release(awake('project') as Response);
    await expect(upload).resolves.toBe(failed);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith('/api/project/upload', { method: 'POST', body });
    vi.mocked(fetch).mockResolvedValueOnce(awake('project') as Response);
    await ensureBackendReady('/api/project/service/entries');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
