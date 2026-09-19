import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';

// In-memory mock DB that auto-creates tables on access.
// We intentionally do NOT clear between tests — the cache.js singleton
// (dbPromise) persists across the test file, and all tests use unique keys.
const mockTables = new Map();

function ensureTable(name) {
  if (!mockTables.has(name)) {
    mockTables.set(name, new Map());
  }
}

const mockDbInstance = {
  run(sql, params) {
    const p = params || [];
    // Handle multi-statement CREATE TABLE
    if (/CREATE TABLE/i.test(sql)) {
      const re = /CREATE TABLE IF NOT EXISTS\s+(\w+)/gi;
      let m;
      while ((m = re.exec(sql)) !== null) {
        ensureTable(m[1]);
      }
      return;
    }
    if (/INSERT OR REPLACE INTO\s+(\w+)/i.test(sql)) {
      const t = sql.match(/INSERT OR REPLACE INTO\s+(\w+)/i);
      if (t && p.length >= 2) {
        ensureTable(t[1]);
        mockTables.get(t[1]).set(p[0], p[1]);
      }
      return;
    }
    if (/DELETE FROM\s+(\w+)/i.test(sql)) {
      const t = sql.match(/DELETE FROM\s+(\w+)/i);
      if (t && p.length >= 1) {
        ensureTable(t[1]);
        mockTables.get(t[1]).delete(p[0]);
      }
      return;
    }
  },
  exec(sql, params) {
    const p = params || [];
    const m = sql.match(/SELECT\s+(\w+)\s+FROM\s+(\w+)\s+WHERE\s+key\s*=\s*\?/i);
    if (m) {
      const col = m[1];
      const tbl = m[2];
      ensureTable(tbl);
      const table = mockTables.get(tbl);
      if (table && p.length >= 1 && table.has(p[0])) {
        return [{ columns: [col], values: [[table.get(p[0])]] }];
      }
    }
    return [];
  },
  export() {
    return new Uint8Array([]);
  },
  close() {},
};

vi.mock('sql.js', () => ({
  default: () =>
    Promise.resolve({
      Database: function () {
        return mockDbInstance;
      },
    }),
}));

import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheGetTimestamp,
  staleWhileRevalidate,
  cachedFetch,
  CACHE_STORES,
} from '../cache';

describe('SQLite Cache Layer', () => {
  describe('schema initialization', () => {
    it('creates all required tables on first access', async () => {
      await cacheGet(CACHE_STORES.PROJECTS, 'user@test.com');
      expect(mockTables.has('projects')).toBe(true);
      expect(mockTables.has('entries')).toBe(true);
      expect(mockTables.has('all_entries')).toBe(true);
      expect(mockTables.has('profile')).toBe(true);
      expect(mockTables.has('search')).toBe(true);
      expect(mockTables.has('archives')).toBe(true);
      expect(mockTables.has('fields')).toBe(true);
      expect(mockTables.has('notes')).toBe(true);
      expect(mockTables.has('cache_meta')).toBe(true);
      expect(mockTables.has('offline_queue')).toBe(true);
    });
  });

  describe('cacheGet and cacheSet', () => {
    it('stores and retrieves data from cache', async () => {
      const testData = { success: true, data: [{ id: 1, name: 'Test' }] };
      await cacheSet(CACHE_STORES.PROJECTS, 'user@test.com', testData);
      const result = await cacheGet(CACHE_STORES.PROJECTS, 'user@test.com');
      expect(result).not.toBeNull();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('returns null for non-existent cache key', async () => {
      const result = await cacheGet(CACHE_STORES.PROJECTS, 'nonexistent@test.com');
      expect(result).toBeNull();
    });

    it('stores timestamps with cached data', async () => {
      const testData = { success: true, data: [] };
      await cacheSet(CACHE_STORES.ENTRIES, 'user@test.com:project1', testData);
      const timestamp = await cacheGetTimestamp('user@test.com:project1');
      expect(timestamp).toBeDefined();
      expect(typeof timestamp).toBe('number');
      expect(Date.now() - timestamp).toBeLessThan(1000);
    });
  });

  describe('cacheDelete', () => {
    it('removes data from cache', async () => {
      const testData = { success: true, data: [{ id: 1 }] };
      await cacheSet(CACHE_STORES.PROFILE, 'user@test.com', testData);
      let result = await cacheGet(CACHE_STORES.PROFILE, 'user@test.com');
      expect(result).not.toBeNull();

      await cacheDelete(CACHE_STORES.PROFILE, 'user@test.com');
      result = await cacheGet(CACHE_STORES.PROFILE, 'user@test.com');
      expect(result).toBeNull();
    });

    it('also removes timestamp metadata', async () => {
      const testData = { success: true, data: [] };
      await cacheSet(CACHE_STORES.ENTRIES, 'key1', testData);
      let timestamp = await cacheGetTimestamp('key1');
      expect(timestamp).not.toBeNull();

      await cacheDelete(CACHE_STORES.ENTRIES, 'key1');
      timestamp = await cacheGetTimestamp('key1');
      expect(timestamp).toBeNull();
    });
  });

  describe('staleWhileRevalidate', () => {
    it('returns cached data immediately when available', async () => {
      const cachedData = { success: true, data: [{ id: 1, cached: true }] };
      await cacheSet(CACHE_STORES.PROJECTS, 'user@test.com', cachedData);

      const fetcher = vi.fn().mockResolvedValue({ success: true, data: [{ id: 2, fresh: true }] });
      const onUpdate = vi.fn();

      const result = await staleWhileRevalidate({
        store: CACHE_STORES.PROJECTS,
        key: 'user@test.com',
        fetcher,
        onUpdate,
        maxAge: 60000,
      });

      expect(result).toEqual([{ id: 1, cached: true }]);
      expect(fetcher).toHaveBeenCalled();
    });

    it('calls onUpdate when fresh data arrives', async () => {
      const cachedData = { success: true, data: [{ id: 1 }] };
      const freshData = { success: true, data: [{ id: 2 }] };
      await cacheSet(CACHE_STORES.PROJECTS, 'user@test.com', cachedData);

      const fetcher = vi.fn().mockResolvedValue(freshData);
      const onUpdate = vi.fn();

      await staleWhileRevalidate({
        store: CACHE_STORES.PROJECTS,
        key: 'user@test.com',
        fetcher,
        onUpdate,
        maxAge: 60000,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(onUpdate).toHaveBeenCalledWith(freshData);
    });

    it('waits for fetch when no cache exists', async () => {
      const freshData = { success: true, data: [{ id: 1 }] };
      const fetcher = vi.fn().mockResolvedValue(freshData);

      const result = await staleWhileRevalidate({
        store: CACHE_STORES.PROJECTS,
        key: 'newuser@test.com',
        fetcher,
        maxAge: 60000,
      });

      expect(result).toEqual(freshData);
      expect(fetcher).toHaveBeenCalled();
    });
  });

  describe('cachedFetch', () => {
    it('returns data from fetch on first call', async () => {
      const testData = { success: true, data: [{ id: 1 }] };
      const fetcher = vi.fn().mockResolvedValue(testData);

      const result = await cachedFetch(CACHE_STORES.ENTRIES, 'key1', fetcher);
      expect(result).toEqual(testData);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('handles fetch errors gracefully', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));
      await expect(cachedFetch(CACHE_STORES.ENTRIES, 'error-key', fetcher)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('CACHE_STORES', () => {
    it('exports all required store names', () => {
      expect(CACHE_STORES.PROJECTS).toBe('projects');
      expect(CACHE_STORES.ENTRIES).toBe('entries');
      expect(CACHE_STORES.ALL_ENTRIES).toBe('all_entries');
      expect(CACHE_STORES.PROFILE).toBe('profile');
      expect(CACHE_STORES.SEARCH).toBe('search');
    });
  });
});
