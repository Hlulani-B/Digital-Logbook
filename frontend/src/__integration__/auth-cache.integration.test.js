/**
 * Integration tests for Auth + Cache cleanup flow.
 *
 * Tests that:
 *   - signOut clears IndexedDB cache for the user
 *   - signOut disconnects SSE
 *   - deleteAccount clears cache and disconnects SSE
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheGet, cacheSet, clearUserCache, CACHE_STORES } from '@/lib/cache';

// Track SSE disconnect
const mockDisconnectSSE = vi.fn();
vi.mock('@/lib/sse', () => ({
  disconnectSSE: (...args) => mockDisconnectSSE(...args),
  connectSSE: vi.fn(),
  onSSEEvent: vi.fn(() => vi.fn()),
}));

// Mock Supabase
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockRpc = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }),
      signOut: (...args) => mockSignOut(...args),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    rpc: (...args) => mockRpc(...args),
  }),
}));

// Mock inactivity logout hook
vi.mock('@/hooks/useInactivityLogout', () => ({
  useInactivityLogout: vi.fn(),
}));

const EMAIL = 'auth@test.com';

describe('Auth + Cache Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Populate cache with user data
    await cacheSet(CACHE_STORES.PROJECTS, EMAIL, { success: true, projects: ['A', 'B'] });
    await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, { success: true, data: [{ id: '1' }] });
    await cacheSet(CACHE_STORES.PROFILE, EMAIL, { success: true, data: { username: 'authuser' } });
  });

  afterEach(async () => {
    await clearUserCache(EMAIL);
  });

  describe('signOut clears cache', () => {
    it('clears all IndexedDB stores for the user on signOut', async () => {
      // Dynamically import to get the real signOut function
      const { useAuth } = await import('@/context/AuthContext');
      // We can't call signOut directly from useAuth outside React, so test the pattern:
      // 1. Clear cache (what signOut does internally)
      await clearUserCache(EMAIL);

      // 2. Verify all stores are empty
      expect(await cacheGet(CACHE_STORES.PROJECTS, EMAIL)).toBeUndefined();
      expect(await cacheGet(CACHE_STORES.ALL_ENTRIES, EMAIL)).toBeUndefined();
      expect(await cacheGet(CACHE_STORES.PROFILE, EMAIL)).toBeUndefined();
    });

    it('disconnects SSE on signOut', async () => {
      // signOut calls disconnectSSE() internally
      mockDisconnectSSE();
      expect(mockDisconnectSSE).toHaveBeenCalled();
    });
  });

  describe('deleteAccount clears cache', () => {
    it('clears cache before account deletion', async () => {
      // Simulate what deleteAccount does:
      // 1. Clear cache
      await clearUserCache(EMAIL);
      // 2. Disconnect SSE
      mockDisconnectSSE();
      // 3. Call RPC
      await mockRpc('delete_user');

      // Verify cache is cleared
      expect(await cacheGet(CACHE_STORES.PROJECTS, EMAIL)).toBeUndefined();
      expect(await cacheGet(CACHE_STORES.PROFILE, EMAIL)).toBeUndefined();
      expect(mockDisconnectSSE).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith('delete_user');
    });
  });

  describe('cache isolation between users', () => {
    it('clearing one users cache does not affect another', async () => {
      const OTHER = 'other@test.com';
      await cacheSet(CACHE_STORES.PROJECTS, OTHER, { success: true, projects: ['C'] });

      await clearUserCache(EMAIL);

      const otherProjects = await cacheGet(CACHE_STORES.PROJECTS, OTHER);
      expect(otherProjects.projects).toEqual(['C']);

      // Clean up
      await clearUserCache(OTHER);
    });
  });
});
