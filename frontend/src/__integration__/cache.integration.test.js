/**
 * Integration tests for the IndexedDB cache layer.
 *
 * Tests that cacheSet → cacheGet → cacheSubscribe → emitCacheChange
 * work together correctly as a cohesive system.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheSubscribe,
  cacheGetTimestamp,
  clearUserCache,
  CACHE_STORES,
} from '@/lib/cache';
describe('Cache Layer Integration', () => {
  afterEach(async () => {
    // Clean up all stores between tests
    await clearUserCache('test@test.com');
    await clearUserCache('other@test.com');
  });

  describe('cacheSet → cacheGet round-trip', () => {
    it('stores and retrieves an object with key', async () => {
      const data = { success: true, data: [{ id: 1, name: 'Test' }] };
      await cacheSet(CACHE_STORES.PROJECTS, 'test@test.com', data);

      const result = await cacheGet(CACHE_STORES.PROJECTS, 'test@test.com');
      expect(result).toBeTruthy();
      expect(result.data).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('stores arrays wrapped with key', async () => {
      const arr = [{ id: 1 }, { id: 2 }];
      await cacheSet(CACHE_STORES.ALL_ENTRIES, 'test@test.com', arr);

      const result = await cacheGet(CACHE_STORES.ALL_ENTRIES, 'test@test.com');
      expect(result).toBeTruthy();
      expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('overwrites previous value on second set', async () => {
      await cacheSet(CACHE_STORES.PROFILE, 'test@test.com', { success: true, data: { username: 'alice' } });
      await cacheSet(CACHE_STORES.PROFILE, 'test@test.com', { success: true, data: { username: 'bob' } });

      const result = await cacheGet(CACHE_STORES.PROFILE, 'test@test.com');
      expect(result.data.username).toBe('bob');
    });

    it('isolates data between different keys', async () => {
      await cacheSet(CACHE_STORES.PROJECTS, 'test@test.com', { success: true, projects: ['A'] });
      await cacheSet(CACHE_STORES.PROJECTS, 'other@test.com', { success: true, projects: ['B'] });

      const r1 = await cacheGet(CACHE_STORES.PROJECTS, 'test@test.com');
      const r2 = await cacheGet(CACHE_STORES.PROJECTS, 'other@test.com');
      expect(r1.projects).toEqual(['A']);
      expect(r2.projects).toEqual(['B']);
    });

    it('isolates data between different stores for same key', async () => {
      await cacheSet(CACHE_STORES.PROJECTS, 'test@test.com', { success: true, projects: ['X'] });
      await cacheSet(CACHE_STORES.PROFILE, 'test@test.com', { success: true, data: { username: 'Y' } });

      const projects = await cacheGet(CACHE_STORES.PROJECTS, 'test@test.com');
      const profile = await cacheGet(CACHE_STORES.PROFILE, 'test@test.com');
      expect(projects.projects).toEqual(['X']);
      expect(profile.data.username).toBe('Y');
    });
  });

  describe('cacheSubscribe → cacheSet event flow', () => {
    it('notifies subscriber when cache is updated', async () => {
      const callback = vi.fn();
      cacheSubscribe(CACHE_STORES.ENTRIES, 'test@test.com:ProjectA', callback);

      await cacheSet(CACHE_STORES.ENTRIES, 'test@test.com:ProjectA', {
        success: true,
        data: [{ id: 1, summary: 'New task' }],
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith([{ id: 1, summary: 'New task' }]);
    });

    it('notifies multiple subscribers for the same key', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      cacheSubscribe(CACHE_STORES.ALL_ENTRIES, 'test@test.com', cb1);
      cacheSubscribe(CACHE_STORES.ALL_ENTRIES, 'test@test.com', cb2);

      await cacheSet(CACHE_STORES.ALL_ENTRIES, 'test@test.com', { success: true, data: [] });

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('does not notify subscribers of different keys', async () => {
      const cb = vi.fn();
      cacheSubscribe(CACHE_STORES.PROJECTS, 'test@test.com', cb);

      await cacheSet(CACHE_STORES.PROJECTS, 'other@test.com', { success: true, projects: [] });

      expect(cb).not.toHaveBeenCalled();
    });

    it('stops notifying after unsubscribe', async () => {
      const cb = vi.fn();
      const unsub = cacheSubscribe(CACHE_STORES.PROFILE, 'test@test.com', cb);

      await cacheSet(CACHE_STORES.PROFILE, 'test@test.com', { success: true, data: { username: 'a' } });
      expect(cb).toHaveBeenCalledTimes(1);

      unsub();

      await cacheSet(CACHE_STORES.PROFILE, 'test@test.com', { success: true, data: { username: 'b' } });
      expect(cb).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('cacheDelete', () => {
    it('removes data and notifies subscriber with null', async () => {
      const cb = vi.fn();
      await cacheSet(CACHE_STORES.PROJECTS, 'test@test.com', { success: true, projects: ['A'] });
      cacheSubscribe(CACHE_STORES.PROJECTS, 'test@test.com', cb);

      await cacheDelete(CACHE_STORES.PROJECTS, 'test@test.com');

      const result = await cacheGet(CACHE_STORES.PROJECTS, 'test@test.com');
      expect(result).toBeUndefined();
      expect(cb).toHaveBeenCalledWith(null);
    });
  });

  describe('cacheGetTimestamp', () => {
    it('returns timestamp after cacheSet', async () => {
      const before = Date.now();
      await cacheSet(CACHE_STORES.PROFILE, 'test@test.com', { success: true, data: {} });
      const after = Date.now();

      const ts = await cacheGetTimestamp('test@test.com');
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('returns null for unknown key', async () => {
      const ts = await cacheGetTimestamp('nonexistent-key');
      expect(ts).toBeNull();
    });
  });

  describe('clearUserCache', () => {
    it('clears all stores for the specified user', async () => {
      // Populate all stores
      await cacheSet(CACHE_STORES.PROJECTS, 'test@test.com', { success: true, projects: ['A'] });
      await cacheSet(CACHE_STORES.ALL_ENTRIES, 'test@test.com', { success: true, data: [1, 2] });
      await cacheSet(CACHE_STORES.PROFILE, 'test@test.com', { success: true, data: { username: 'x' } });

      await clearUserCache('test@test.com');

      expect(await cacheGet(CACHE_STORES.PROJECTS, 'test@test.com')).toBeUndefined();
      expect(await cacheGet(CACHE_STORES.ALL_ENTRIES, 'test@test.com')).toBeUndefined();
      expect(await cacheGet(CACHE_STORES.PROFILE, 'test@test.com')).toBeUndefined();
    });

    it('does not affect other users data', async () => {
      await cacheSet(CACHE_STORES.PROJECTS, 'test@test.com', { success: true, projects: ['A'] });
      await cacheSet(CACHE_STORES.PROJECTS, 'other@test.com', { success: true, projects: ['B'] });

      await clearUserCache('test@test.com');

      const other = await cacheGet(CACHE_STORES.PROJECTS, 'other@test.com');
      expect(other.projects).toEqual(['B']);
    });
  });
});
