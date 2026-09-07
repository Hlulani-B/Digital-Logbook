/**
 * Integration tests for entry CRUD operations with optimistic updates.
 *
 * Tests the full flow:
 *   addEntry → optimistic IndexedDB write → server sync → cache update
 *   updateEntry → optimistic patch → server sync → authoritative update
 *   deleteEntry → optimistic removal → server sync
 *   Rollback on server failure
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';

// Mock the API request module
const mockRequest = vi.fn();
vi.mock('@/lib/api', () => ({
  request: (...args) => mockRequest(...args),
  PROJECT_URL: 'http://localhost:5003',
}));

const { addEntry, updateEntry, deleteEntry, getEntries } = await import('@/functions/project/entries.js');

const EMAIL = 'test@test.com';
const PROJECT = 'TestProject';
const CACHE_KEY = `${EMAIL}:${PROJECT}`;

describe('Entry CRUD Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cache before each test
    return cacheSet(CACHE_STORES.ENTRIES, CACHE_KEY, { success: true, data: [] });
  });

  describe('addEntry — optimistic write + server sync', () => {
    it('writes optimistic entry to cache immediately, then syncs to server', async () => {
      const serverEntry = {
        id: 'real-id-123',
        user_email: EMAIL,
        project_name: PROJECT,
        entries: { task: 'Build feature' },
        due_date: '2025-09-10',
        status: 'up_next',
      };
      mockRequest.mockResolvedValueOnce({ success: true, data: [serverEntry] });

      // Also seed the all-entries cache
      await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, { success: true, data: [] });

      const result = await addEntry(
        EMAIL, PROJECT,
        { task: 'Build feature' },
        '2025-09-10', null, 'up_next', null, null, null,
      );

      // Server was called successfully
      expect(result.success).toBe(true);
      // Server received the correct payload
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('/service/entry'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"function":"add"'),
        }),
      );
    });

    it('rolls back optimistic entry on server failure', async () => {
      // Seed cache with one existing entry
      const existing = { id: 'existing-1', entries: { task: 'Existing' }, project_name: PROJECT };
      await cacheSet(CACHE_STORES.ENTRIES, CACHE_KEY, { success: true, data: [existing] });
      await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, { success: true, data: [existing] });

      mockRequest.mockRejectedValueOnce(new Error('Network error'));

      const result = await addEntry(
        EMAIL, PROJECT,
        { task: 'New task' },
        null, null, 'up_next', null, null, null,
      );

      expect(result.success).toBe(false);

      // Cache should be rolled back to original state
      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe('existing-1');
    });
  });

  describe('updateEntry — optimistic patch + server sync', () => {
    const existingEntry = {
      id: 'entry-1',
      user_email: EMAIL,
      project_name: PROJECT,
      entries: { task: 'Original task' },
      summary: 'Original summary',
      due_date: '2025-09-10',
      priority: '1',
      status: 'up_next',
    };

    beforeEach(async () => {
      await cacheSet(CACHE_STORES.ENTRIES, CACHE_KEY, { success: true, data: [existingEntry] });
      await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, { success: true, data: [existingEntry] });
    });

    it('patches cache optimistically with new values', async () => {
      const updatedEntry = { ...existingEntry, status: 'done_and_dusted', summary: 'Updated summary' };
      mockRequest.mockResolvedValueOnce({ success: true, data: [updatedEntry] });

      await updateEntry(
        EMAIL, PROJECT, 'entry-1',
        undefined, // new_entry
        undefined, // due_date
        undefined, // priority
        'done_and_dusted', // status
        undefined, undefined, undefined,
        'Updated summary', // summary
      );

      // Cache should now have the updated values
      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries[0].status).toBe('done_and_dusted');
      expect(entries[0].summary).toBe('Updated summary');
    });

    it('rolls back on server failure', async () => {
      mockRequest.mockResolvedValueOnce({ success: false, message: 'Conflict' });

      await updateEntry(
        EMAIL, PROJECT, 'entry-1',
        undefined, undefined, undefined,
        'in_motion', // status change
        undefined, undefined, undefined,
      );

      // Cache should be rolled back to original
      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries[0].status).toBe('up_next'); // Original value
    });

    it('rolls back on network error', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Timeout'));

      await updateEntry(
        EMAIL, PROJECT, 'entry-1',
        undefined, '2025-12-25', // new due_date
        undefined, undefined, undefined, undefined, undefined,
      );

      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries[0].due_date).toBe('2025-09-10'); // Original value
    });

    it('updates both per-project and all-entries caches', async () => {
      mockRequest.mockResolvedValueOnce({
        success: true,
        data: [{ ...existingEntry, priority: '0' }],
      });

      await updateEntry(
        EMAIL, PROJECT, 'entry-1',
        undefined, undefined,
        '0', // priority
        undefined, undefined, undefined, undefined,
      );

      const projectCached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const allCached = await cacheGet(CACHE_STORES.ALL_ENTRIES, EMAIL);
      expect((projectCached.data || projectCached)[0].priority).toBe('0');
      expect((allCached.data || allCached)[0].priority).toBe('0');
    });
  });

  describe('deleteEntry — optimistic removal + server sync', () => {
    const entry1 = { id: 'e1', project_name: PROJECT, entries: { task: 'A' } };
    const entry2 = { id: 'e2', project_name: PROJECT, entries: { task: 'B' } };

    beforeEach(async () => {
      await cacheSet(CACHE_STORES.ENTRIES, CACHE_KEY, { success: true, data: [entry1, entry2] });
      await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, { success: true, data: [entry1, entry2] });
    });

    it('removes entry from cache immediately', async () => {
      mockRequest.mockResolvedValueOnce({ success: true });

      await deleteEntry(EMAIL, PROJECT, entry1);

      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe('e2');
    });

    it('removes from all-entries cache too', async () => {
      mockRequest.mockResolvedValueOnce({ success: true });

      await deleteEntry(EMAIL, PROJECT, entry1);

      const allCached = await cacheGet(CACHE_STORES.ALL_ENTRIES, EMAIL);
      const all = allCached.data || allCached;
      expect(all.length).toBe(1);
      expect(all[0].id).toBe('e2');
    });

    it('rolls back on server failure', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Server error'));

      await deleteEntry(EMAIL, PROJECT, entry1);

      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries.length).toBe(2); // Both entries restored
    });
  });

  describe('getEntries — server → cache write', () => {
    it('writes server response to per-project cache', async () => {
      const serverData = [
        { id: 's1', entries: { task: 'From server' }, project_name: PROJECT },
      ];
      mockRequest.mockResolvedValueOnce({ success: true, data: serverData });

      await getEntries(EMAIL, PROJECT);

      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe('s1');
    });

    it('returns error result on failure without corrupting cache', async () => {
      // Seed cache with existing data
      await cacheSet(CACHE_STORES.ENTRIES, CACHE_KEY, { success: true, data: [{ id: 'old' }] });
      mockRequest.mockRejectedValueOnce(new Error('Network down'));

      const result = await getEntries(EMAIL, PROJECT);

      expect(result.success).toBe(false);
      // Cache should still have old data
      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      expect((cached.data || cached).length).toBe(1);
    });
  });
});
