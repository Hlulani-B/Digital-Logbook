import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listTemplates, type Template } from '../templateApi';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ auth: { getSession } }),
}));

const fetchMock = vi.fn<typeof fetch>();
const template: Template = {
  id: 'fixture-template',
  name: 'Regression template',
  fields: [],
  scope: 'built_in',
  version: 1,
  is_fork: false,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function proxyResponse(status: number) {
  return new Response('<html><body>Private proxy diagnostics</body></html>', {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  getSession.mockResolvedValue({
    data: { session: { access_token: 'test-only-session' } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listTemplates scoped loading', () => {
  it.each(['built_in', 'personal', 'global', 'all'] as const)(
    'requests only the supplied %s scope and unwraps templates',
    async (scope) => {
      const record = { ...template, scope: scope === 'all' ? 'built_in' : scope };
      fetchMock.mockResolvedValueOnce(jsonResponse({ templates: [record] }));

      await expect(listTemplates(scope)).resolves.toEqual([record]);
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(new RegExp(`/service/templates\\?scope=${scope}$`)),
        { headers: { Authorization: 'Bearer test-only-session' } }
      );
    }
  );

  it('preserves the no-argument all-scopes API', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ templates: [template] }));

    await expect(listTemplates()).resolves.toEqual([template]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/service\/templates\?scope=all$/),
      expect.any(Object)
    );
  });

  it.each(['built_in', 'personal', 'global'] as const)(
    'returns a genuine empty %s result without adding records',
    async (scope) => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ templates: [] }));
      await expect(listTemplates(scope)).resolves.toEqual([]);
    }
  );

  it('allows a new request to succeed after a failure', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'Template storage is unavailable.' }, 503))
      .mockResolvedValueOnce(jsonResponse({ templates: [template] }));

    await expect(listTemplates('personal')).rejects.toThrow('Template storage is unavailable.');
    await expect(listTemplates('built_in')).resolves.toEqual([template]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('listTemplates errors', () => {
  it('asks for sign-in without fetching when there is no session', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } });

    await expect(listTemplates('built_in')).rejects.toThrow('Please sign in to load templates.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['json', 'html'])('maps a %s 401 to a sign-in message', async (format) => {
    fetchMock.mockResolvedValueOnce(
      format === 'json' ? jsonResponse({ error: 'Token expired' }, 401) : proxyResponse(401)
    );
    await expect(listTemplates('personal')).rejects.toThrow('Please sign in to load templates.');
  });

  it.each(['json', 'html'])('maps a %s 404 to endpoint unavailable, not empty', async (format) => {
    fetchMock.mockResolvedValueOnce(
      format === 'json' ? jsonResponse({ error: 'Not found' }, 404) : proxyResponse(404)
    );
    await expect(listTemplates('global')).rejects.toThrow(
      'The template endpoint is unavailable (404). Please try again later.'
    );
  });

  it.each([
    [400, 'Invalid template scope.'],
    [403, 'Access to these templates is denied.'],
    [503, 'Template storage is unavailable.'],
  ])('preserves the safe backend error for HTTP %s', async (status, message) => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: message, details: 'Do not display diagnostic details' }, Number(status))
    );
    await expect(listTemplates('personal')).rejects.toThrow(new Error(String(message)));
  });

  it.each([
    [400, 'Invalid template request.'],
    [403, 'You do not have permission to load these templates.'],
    [503, 'The template service is unavailable. Please try again later.'],
    [502, 'Failed to load templates (HTTP 502). Please try again.'],
  ])('uses a safe fallback for a non-JSON HTTP %s proxy response', async (status, message) => {
    fetchMock.mockResolvedValueOnce(proxyResponse(Number(status)));
    await expect(listTemplates('global')).rejects.toThrow(new Error(String(message)));
  });

  it.each([null, {}, { error: '' }, { error: '   ' }, { error: { message: 'Private details' } }])(
    'uses a safe fallback for an unusable JSON error: %j',
    async (body) => {
      fetchMock.mockResolvedValueOnce(jsonResponse(body, 503));
      await expect(listTemplates('personal')).rejects.toThrow(
        'The template service is unavailable. Please try again later.'
      );
    }
  );

  it('does not display HTML embedded in a JSON error', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: '<h1>Proxy diagnostics</h1>' }, 503));
    await expect(listTemplates('global')).rejects.toThrow(
      'The template service is unavailable. Please try again later.'
    );
  });

  it('does not expose unexpected server diagnostics', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Private server diagnostics' }, 500));
    await expect(listTemplates()).rejects.toThrow(
      'Failed to load templates (HTTP 500). Please try again.'
    );
  });

  it('reports network failure instead of returning an empty list or raw details', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Private network diagnostics'));
    await expect(listTemplates('personal')).rejects.toThrow(
      'Unable to reach the template service. Please try again.'
    );
  });

  it.each([null, {}, [], { templates: null }, { templates: {} }, { error: 'Unexpected error' }])(
    'rejects malformed success data instead of treating it as empty: %j',
    async (body) => {
      fetchMock.mockResolvedValueOnce(jsonResponse(body));
      await expect(listTemplates()).rejects.toThrow(
        'The template service returned an invalid response. Please try again.'
      );
    }
  );

  it('rejects a successful proxy HTML page with a safe message', async () => {
    fetchMock.mockResolvedValueOnce(proxyResponse(200));
    await expect(listTemplates('built_in')).rejects.toThrow(
      'The template service returned an invalid response. Please try again.'
    );
  });
});
