import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the idb module with a simple in-memory store
const mockStore = new Map();
const mockMetaStore = new Map();

vi.mock('idb', () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((store, key) => {
        if (store === 'cache-meta') {
          return Promise.resolve(mockMetaStore.get(key));
        }
        return Promise.resolve(mockStore.get(`${store}:${key}`));
      }),
      put: vi.fn((store, data) => {
        const key = data.key || data.email;
        if (store === 'cache-meta') {
          mockMetaStore.set(key, data);
        } else {
          mockStore.set(`${store}:${key}`, data);
        }
        return Promise.resolve();
      }),
      delete: vi.fn((store, key) => {
        if (store === 'cache-meta') {
          mockMetaStore.delete(key);
        } else {
          // Delete all entries matching this store:key pattern
          for (const [k] of mockStore) {
            if (k === `${store}:${key}`) {
              mockStore.delete(k);
            }
          }
        }
        return Promise.resolve();
      }),
      transaction: vi.fn((stores, mode) => {
        const txStores = Array.isArray(stores) ? stores : [stores];
        return {
          objectStore: vi.fn((storeName) => ({
            delete: vi.fn((key) => {
              // Clear matching entries
              for (const [k] of mockStore) {
                if (k.startsWith(`${storeName}:`)) {
                  const entryKey = k.split(':').slice(1).join(':');
                  if (entryKey === key || k === `${storeName}:${key}`) {
                    mockStore.delete(k);
                  }
                }
              }
              return Promise.resolve();
            }),
          })),
          done: Promise.resolve(),
        };
      }),
    })
  ),
}));

import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheGetTimestamp,
  clearUserCache,
  staleWhileRevalidate,
  cachedFetch,
  CACHE_STORES,
} from '../cache';

describe('IndexedDB Cache Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
    mockMetaStore.clear();
  });

  describe('cacheGet and cacheSet', () => {
    it('stores and retrieves data from cache', async () => {
      const testData = { success: true, data: [{ id: 1, name: 'Test' }] };
      
      await cacheSet(CACHE_STORES.PROJECTS, 'user@test.com', testData);
      const result = await cacheGet(CACHE_STORES.PROJECTS, 'user@test.com');
      
      expect(result).toBeDefined();
      // cacheSet wraps object data with key, so result has the original data properties + key
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('returns undefined for non-existent cache key', async () => {
      const result = await cacheGet(CACHE_STORES.PROJECTS, 'nonexistent@test.com');
      expect(result).toBeUndefined();
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
      expect(result).toBeDefined();
      
      await cacheDelete(CACHE_STORES.PROFILE, 'user@test.com');
      result = await cacheGet(CACHE_STORES.PROFILE, 'user@test.com');
      expect(result).toBeUndefined();
    });

    it('also removes timestamp metadata', async () => {
      const testData = { success: true, data: [] };
      
      await cacheSet(CACHE_STORES.ENTRIES, 'key1', testData);
      let timestamp = await cacheGetTimestamp('key1');
      expect(timestamp).toBeDefined();
      
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
      
      // Should return cached data immediately (cached.data is the inner data array)
      expect(result).toBeDefined();
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
      
      // Wait for background fetch to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
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
      
      await expect(
        cachedFetch(CACHE_STORES.ENTRIES, 'error-key', fetcher)
      ).rejects.toThrow('Network error');
    });
  });

  describe('CACHE_STORES', () => {
    it('exports all required store names', () => {
      expect(CACHE_STORES.PROJECTS).toBe('projects');
      expect(CACHE_STORES.ENTRIES).toBe('entries');
      expect(CACHE_STORES.ALL_ENTRIES).toBe('all-entries');
      expect(CACHE_STORES.PROFILE).toBe('profile');
      expect(CACHE_STORES.SEARCH).toBe('search');
    });
  });
});
