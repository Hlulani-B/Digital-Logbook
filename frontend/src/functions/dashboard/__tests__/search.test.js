import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchAll, searchProject, searchProjects } from '../search';

describe('search functions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('searchAll', () => {
    it('calls /service/search with searchAll function', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: [] })),
      });

      const result = await searchAll('user@test.com', 'bug');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/service/search'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            function: 'searchAll',
            values: { user_email: 'user@test.com', keyword: 'bug' },
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('returns network error on fetch failure', async () => {
      fetch.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await searchAll('user@test.com', 'test');
      expect(result).toEqual({ success: false, message: 'Network error: Connection refused' });
    });

    it('returns error on invalid JSON response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true, status: 200,
        text: () => Promise.resolve('not-json{{{'),
      });
      const result = await searchAll('user@test.com', 'test');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Server returned status 200');
    });

    it('returns error on non-ok HTTP response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false, status: 500,
        text: () => Promise.resolve(JSON.stringify({ error: 'Internal error' })),
      });
      const result = await searchAll('user@test.com', 'test');
      expect(result).toEqual({ success: false, message: 'Internal error' });
    });
  });

  describe('searchProject', () => {
    it('calls /service/search with searchProject function', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: [] })),
      });
      await searchProject('user@test.com', 'MyProject', 'feature');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/service/search'),
        expect.objectContaining({
          body: JSON.stringify({
            function: 'searchProject',
            values: { user_email: 'user@test.com', project_name: 'MyProject', keyword: 'feature' },
          }),
        })
      );
    });
  });

  describe('searchProjects', () => {
    it('calls /service/search with searchProjects function', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: [] })),
      });
      await searchProjects('user@test.com', 'log');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/service/search'),
        expect.objectContaining({
          body: JSON.stringify({
            function: 'searchProjects',
            values: { user_email: 'user@test.com', keyword: 'log' },
          }),
        })
      );
    });
  });
});
