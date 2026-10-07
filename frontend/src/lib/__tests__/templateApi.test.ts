import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetSession = vi.fn();
const mockFetch = vi.fn();

vi.mock('../supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../templateApi';

describe('templateApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listTemplates', () => {
    it('fetches templates with default scope', async () => {
      const templates = [{ id: '1', name: 'T1', fields: [], scope: 'built_in', version: 1, is_fork: false }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ templates }),
      });

      const result = await listTemplates();
      expect(result).toEqual(templates);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/service/templates?scope=all'),
        expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } })
      );
    });

    it('passes custom scope', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ templates: [] }),
      });

      await listTemplates('personal');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('scope=personal'),
        expect.any(Object)
      );
    });

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });
      await expect(listTemplates()).rejects.toThrow('Please sign in');
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network down'));
      await expect(listTemplates()).rejects.toThrow('Unable to reach the template service');
    });

    it('throws on 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(listTemplates()).rejects.toThrow('Please sign in');
    });

    it('throws on 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(listTemplates()).rejects.toThrow('template endpoint is unavailable');
    });

    it('throws on invalid response shape', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'not an array' }),
      });
      await expect(listTemplates()).rejects.toThrow('invalid response');
    });

    it('throws backend error message on 400', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad scope value' }),
      });
      await expect(listTemplates()).rejects.toThrow('Bad scope value');
    });
  });

  describe('getTemplate', () => {
    it('fetches a single template by id', async () => {
      const template = { id: 't1', name: 'T1', fields: [], scope: 'built_in', version: 1, is_fork: false };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ template }),
      });

      const result = await getTemplate('t1');
      expect(result).toEqual(template);
    });

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });
      await expect(getTemplate('t1')).rejects.toThrow('Not authenticated');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      await expect(getTemplate('t1')).rejects.toThrow('Template not found');
    });
  });

  describe('createTemplate', () => {
    it('sends POST with template data', async () => {
      const input = { name: 'New', fields: [{ key: 'k' }] };
      const created = { id: 'new-1', ...input, scope: 'personal', version: 1, is_fork: false };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ template: created }),
      });

      const result = await createTemplate(input);
      expect(result).toEqual(created);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/service/templates'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify(input) })
      );
    });

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });
      await expect(createTemplate({ name: 'X', fields: [] })).rejects.toThrow('Not authenticated');
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Name required' }),
      });
      await expect(createTemplate({ name: '', fields: [] })).rejects.toThrow('Name required');
    });
  });

  describe('updateTemplate', () => {
    it('sends PUT with updated data', async () => {
      const updated = { id: 't1', name: 'Updated', fields: [], scope: 'personal', version: 2, is_fork: false };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ template: updated }),
      });

      const result = await updateTemplate('t1', { name: 'Updated' });
      expect(result).toEqual(updated);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/service/templates/t1'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });
      await expect(updateTemplate('t1', { name: 'X' })).rejects.toThrow('Not authenticated');
    });
  });

  describe('deleteTemplate', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await deleteTemplate('t1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/service/templates/t1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });
      await expect(deleteTemplate('t1')).rejects.toThrow('Not authenticated');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      await expect(deleteTemplate('t1')).rejects.toThrow('Failed to delete template');
    });
  });
});
