/**
 * Integration tests for the syncService module.
 *
 * Tests that syncAllData correctly fetches from all server endpoints
 * and populates IndexedDB stores, and that computeDueSoon works correctly.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheGet, cacheSet, clearUserCache, CACHE_STORES } from '@/lib/cache';

// Mock all server fetch functions
const mockGetProjectsByEmail = vi.fn();
const mockGetAllEntries = vi.fn();
const mockGetProfile = vi.fn();
const mockGetArchives = vi.fn();
const mockGetArchivedProjects = vi.fn();
const mockGetUnarchivedProjects = vi.fn();

vi.mock('@/functions/project/project.js', () => ({
  getProjectsByEmail: (...args) => mockGetProjectsByEmail(...args),
}));

vi.mock('@/functions/project/entries.js', () => ({
  getAllEntries: (...args) => mockGetAllEntries(...args),
  sortUnarchivedEntries: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock('@/functions/profile/profile.js', () => ({
  getProfile: (...args) => mockGetProfile(...args),
}));

vi.mock('@/functions/project/archives.js', () => ({
  getArchives: (...args) => mockGetArchives(...args),
  getArchivedProjects: (...args) => mockGetArchivedProjects(...args),
  getUnarchivedProjects: (...args) => mockGetUnarchivedProjects(...args),
}));

const { syncAllData, computeDueSoon, syncProjectEntries } = await import('@/CacheFunctions/syncService.js');

const EMAIL = 'sync@test.com';

describe('SyncService Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset throttle by re-importing (or just wait)
    // Default mock returns
    mockGetProjectsByEmail.mockResolvedValue({ success: true, projects: [] });
    mockGetAllEntries.mockResolvedValue({ success: true, data: [] });
    mockGetProfile.mockResolvedValue({ success: true, data: { username: 'syncuser' } });
    mockGetArchives.mockResolvedValue({ success: true, data: [] });
    mockGetArchivedProjects.mockResolvedValue({ success: true, data: [] });
    mockGetUnarchivedProjects.mockResolvedValue({ success: true, data: [] });
  });

  afterEach(async () => {
    await clearUserCache(EMAIL);
  });

  describe('syncAllData — full sync flow', () => {
    it('populates projects cache from server', async () => {
      mockGetProjectsByEmail.mockResolvedValue({
        success: true,
        projects: [
          { project_name: 'Alpha', created_at: '2025-01-01' },
          { project_name: 'Beta', created_at: '2025-02-01' },
        ],
      });

      const result = await syncAllData(EMAIL, { force: true });

      expect(result.synced).toContain('projects');
      const cached = await cacheGet(CACHE_STORES.PROJECTS, EMAIL);
      expect(cached.projects.length).toBe(2);
      expect(cached.projects[0].project_name).toBe('Alpha');
    });

    it('populates all-entries cache and per-project caches', async () => {
      mockGetAllEntries.mockResolvedValue({
        success: true,
        data: [
          { id: '1', project_name: 'Alpha', summary: 'Task 1' },
          { id: '2', project_name: 'Beta', summary: 'Task 2' },
          { id: '3', project_name: 'Alpha', summary: 'Task 3' },
        ],
      });

      await syncAllData(EMAIL, { force: true });

      // All-entries cache
      const allCached = await cacheGet(CACHE_STORES.ALL_ENTRIES, EMAIL);
      expect(allCached.data.length).toBe(3);

      // Per-project caches
      const alphaCached = await cacheGet(CACHE_STORES.ENTRIES, `${EMAIL}:Alpha`);
      expect(alphaCached.data.length).toBe(2);

      const betaCached = await cacheGet(CACHE_STORES.ENTRIES, `${EMAIL}:Beta`);
      expect(betaCached.data.length).toBe(1);
    });

    it('populates profile cache', async () => {
      mockGetProfile.mockResolvedValue({
        success: true,
        data: { username: 'testuser', avatar: 'pic.jpg' },
      });

      await syncAllData(EMAIL, { force: true });

      const cached = await cacheGet(CACHE_STORES.PROFILE, EMAIL);
      expect(cached.data.username).toBe('testuser');
    });

    it('reports errors for failed stores without stopping other syncs', async () => {
      mockGetProjectsByEmail.mockRejectedValue(new Error('Server down'));
      mockGetAllEntries.mockResolvedValue({ success: true, data: [{ id: '1', project_name: 'X' }] });
      mockGetProfile.mockResolvedValue({ success: true, data: { username: 'ok' } });

      const result = await syncAllData(EMAIL, { force: true });

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some(e => e.store === 'projects')).toBe(true);
      // Other stores should still sync
      expect(result.synced).toContain('all-entries');
      expect(result.synced).toContain('profile');
    });

    it('calls onProgress for each store synced', async () => {
      const onProgress = vi.fn();

      await syncAllData(EMAIL, { force: true, onProgress });

      // Should be called for projects, all-entries, profile, archives, due-soon
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(3);
      const stores = onProgress.mock.calls.map(c => c[0].store);
      expect(stores).toContain('projects');
      expect(stores).toContain('all-entries');
      expect(stores).toContain('profile');
    });

    it('returns early if no email provided', async () => {
      const result = await syncAllData('', { force: true });
      expect(result.success).toBe(false);
      expect(result.message).toBe('No email provided');
    });
  });

  describe('computeDueSoon', () => {
    it('returns entries due within 3 days', () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const entries = [
        { id: '1', due_date: tomorrow.toISOString().split('T')[0] },
        { id: '2', due_date: in5Days.toISOString().split('T')[0] },
        { id: '3', due_date: null },
      ];

      const result = computeDueSoon(entries);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    it('returns empty array for null input', () => {
      expect(computeDueSoon(null)).toEqual([]);
      expect(computeDueSoon(undefined)).toEqual([]);
    });

    it('excludes entries with invalid dates', () => {
      const entries = [
        { id: '1', due_date: 'not-a-date' },
        { id: '2', due_date: '2020-01-01' }, // Past date
      ];
      const result = computeDueSoon(entries);
      expect(result.length).toBe(0);
    });
  });

  describe('syncProjectEntries', () => {
    it('syncs a single projects entries to cache', async () => {
      const { sortUnarchivedEntries } = await import('@/functions/project/entries.js');
      sortUnarchivedEntries.mockResolvedValueOnce({
        success: true,
        data: [
          { id: 'p1', project_name: 'MyProject', summary: 'Task A' },
          { id: 'p2', project_name: 'MyProject', summary: 'Task B' },
        ],
      });

      await syncProjectEntries(EMAIL, 'MyProject');

      const cached = await cacheGet(CACHE_STORES.ENTRIES, `${EMAIL}:MyProject`);
      expect(cached.data.length).toBe(2);
    });
  });
});
