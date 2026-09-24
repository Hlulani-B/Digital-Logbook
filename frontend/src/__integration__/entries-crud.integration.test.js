/**
 * Integration tests for entry CRUD operations with optimistic updates.
 *
 * Tests the full flow:
 *   addEntry → optimistic IndexedDB write → server sync → cache update
 *   updateEntry → optimistic patch → server sync → authoritative update
 *   deleteEntry → optimistic removal → server sync
 *   Transport failures queue for replay; known HTTP failures keep the
 *   rollback path (see mutateEntry in functions/project/entries.js).
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';

// US54: validateEntryDates rejects past due dates, so fixtures must stay in the future.
const futureDate = (days = 7) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const FUTURE_DATE = futureDate();

// The schema gate in mutateEntry() loads project fields before every write, so
// field reads are answered separately from entry mutations. Individual tests
// configure `entryResponder` (a value or a function that may throw).
let entryResponder = null;

const mockRequest = vi.fn(async (url, options) => {
  const body = JSON.parse(options?.body ?? '{}');
  if (String(url).includes('/service/field')) return { success: true, data: [] };
  if (!entryResponder) return { success: true };
  return entryResponder(body);
});

vi.mock('@/lib/api', () => ({
  request: (...args) => mockRequest(...args),
  PROJECT_URL: 'http://localhost:5003',
}));

const { addEntry, updateEntry, deleteEntry, getEntries } =
  await import('@/functions/project/entries.js');

const EMAIL = 'test@test.com';
const PROJECT = 'TestProject';
const CACHE_KEY = `${EMAIL}:${PROJECT}`;

const findRequestBody = (fnName) => {
  const call = mockRequest.mock.calls.find(
    ([, options]) => JSON.parse(options?.body ?? '{}').function === fnName
  );
  return JSON.parse(call[1].body);
};

describe('Entry CRUD Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entryResponder = null;
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
        due_date: FUTURE_DATE,
        status: 'up_next',
      };
      entryResponder = () => ({ success: true, data: [serverEntry] });

      // Also seed the all-entries cache
      await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, { success: true, data: [] });

      const result = await addEntry(
        EMAIL,
        PROJECT,
        { task: 'Build feature' },
        FUTURE_DATE,
        null,
        'up_next',
        null,
        null,
        null
      );

      // Server was called successfully
      expect(result.success).toBe(true);
      // Server received the correct payload
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('/service/entry'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"function":"add"'),
        })
      );
      // The optimistic row was reconciled to the authoritative server id
      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe('real-id-123');
    });

    it('rolls back optimistic entry on server failure', async () => {
      // Seed cache with one existing entry
      const existing = { id: 'existing-1', entries: { task: 'Existing' }, project_name: PROJECT };
      await cacheSet(CACHE_STORES.ENTRIES, CACHE_KEY, { success: true, data: [existing] });
      await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, { success: true, data: [existing] });

      // A known HTTP failure is not retryable — it must roll back, not queue.
      entryResponder = () => {
        throw new Error('API error 500: Internal Server Error');
      };

      const result = await addEntry(
        EMAIL,
        PROJECT,
        { task: 'New task' },
        null,
        null,
        'up_next',
        null,
        null,
        null
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
      const updatedEntry = {
        ...existingEntry,
        status: 'done_and_dusted',
        summary: 'Updated summary',
      };
      entryResponder = () => ({ success: true, data: [updatedEntry] });

      await updateEntry(
        EMAIL,
        PROJECT,
        'entry-1',
        undefined, // new_entry
        undefined, // due_date
        undefined, // priority
        'done_and_dusted', // status
        undefined,
        undefined,
        undefined,
        'Updated summary' // summary
      );

      // Cache should now have the updated values
      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries[0].status).toBe('done_and_dusted');
      expect(entries[0].summary).toBe('Updated summary');
    });

    it('preserves opaque legacy payloads for metadata-only updates', async () => {
      const legacyEntry = { ...existingEntry, entries: 'legacy unstructured payload' };
      const updatedEntry = { ...legacyEntry, status: 'in_motion' };
      await cacheSet(CACHE_STORES.ENTRIES, CACHE_KEY, { success: true, data: [legacyEntry] });
      await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, { success: true, data: [legacyEntry] });
      entryResponder = () => ({ success: true, data: [updatedEntry] });

      await updateEntry(
        EMAIL,
        PROJECT,
        'entry-1',
        undefined,
        undefined,
        undefined,
        'in_motion',
        undefined,
        undefined,
        undefined
      );

      const requestValues = findRequestBody('update').values;
      expect(requestValues).not.toHaveProperty('new_entry');
      expect(requestValues.status).toBe('in_motion');

      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      expect((cached.data || cached)[0]).toMatchObject({
        entries: 'legacy unstructured payload',
        status: 'in_motion',
      });
    });

    it('rolls back on server failure', async () => {
      entryResponder = () => ({ success: false, message: 'Conflict' });

      await updateEntry(
        EMAIL,
        PROJECT,
        'entry-1',
        undefined,
        undefined,
        undefined,
        'in_motion', // status change
        undefined,
        undefined,
        undefined
      );

      // Cache should be rolled back to original
      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries[0].status).toBe('up_next'); // Original value
    });

    it('keeps the optimistic patch and queues when the server is unreachable', async () => {
      // Transport failures are queued for replay instead of rolled back.
      entryResponder = () => {
        throw new Error('Request timed out after 90s');
      };

      const result = await updateEntry(
        EMAIL,
        PROJECT,
        'entry-1',
        undefined,
        FUTURE_DATE, // new due_date
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );

      expect(result.queued).toBe(true);

      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries[0].due_date).toBe(`${FUTURE_DATE}T23:59:59.999Z`); // Optimistic value kept
    });

    it('updates both per-project and all-entries caches', async () => {
      entryResponder = () => ({
        success: true,
        data: [{ ...existingEntry, priority: '0' }],
      });

      await updateEntry(
        EMAIL,
        PROJECT,
        'entry-1',
        undefined,
        undefined,
        '0', // priority
        undefined,
        undefined,
        undefined,
        undefined
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
      entryResponder = () => ({ success: true });

      await deleteEntry(EMAIL, PROJECT, entry1);

      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe('e2');
    });

    it('removes from all-entries cache too', async () => {
      entryResponder = () => ({ success: true });

      await deleteEntry(EMAIL, PROJECT, entry1);

      const allCached = await cacheGet(CACHE_STORES.ALL_ENTRIES, EMAIL);
      const all = allCached.data || allCached;
      expect(all.length).toBe(1);
      expect(all[0].id).toBe('e2');
    });

    it('queues the removal for retry on server failure (removal is kept, not rolled back)', async () => {
      entryResponder = () => {
        throw new Error('Server error');
      };

      const result = await deleteEntry(EMAIL, PROJECT, entry1);

      expect(result).toMatchObject({ success: true, queued: true });

      // The optimistic removal stands — replaying the queue finishes the delete.
      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe('e2');
    });
  });

  describe('getEntries — server → cache write', () => {
    it('writes server response to per-project cache', async () => {
      const serverData = [{ id: 's1', entries: { task: 'From server' }, project_name: PROJECT }];
      entryResponder = () => ({ success: true, data: serverData });

      await getEntries(EMAIL, PROJECT);

      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      const entries = cached.data || cached;
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe('s1');
    });

    it('serves the cached rows when the server call fails', async () => {
      // Seed cache with existing data
      await cacheSet(CACHE_STORES.ENTRIES, CACHE_KEY, { success: true, data: [{ id: 'old' }] });
      entryResponder = () => {
        throw new Error('Network down');
      };

      const result = await getEntries(EMAIL, PROJECT);

      // Cache-first fallback: the request still succeeds with cached rows.
      expect(result.success).toBe(true);
      expect(result.data.map((entry) => entry.id)).toEqual(['old']);
      // Cache should still have old data
      const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
      expect((cached.data || cached).length).toBe(1);
    });
  });
});
