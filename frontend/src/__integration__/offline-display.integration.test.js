/**
 * Offline display + sync regression tests.
 *
 * The contract these lock down: a mutation made while offline MUST be visible in
 * the UI immediately (from the local cache, even when that cache was still cold)
 * and MUST reach the server unchanged once the connection returns.
 *
 *   A. offline addEntry, cold cache   → row is written and emitted (page renders it)
 *   B. reload while offline           → the row is still there (IndexedDB durability)
 *   C. offline addNote                → note is written and read back
 *   D. reconnect: queued addEntry     → dispatched, optimistic row replaced once
 *   E. reconnect: queued addNote      → dispatched (an unregistered action is
 *                                       retried 3x and then silently dropped)
 *
 * sql.js is swapped for its asm.js build so the real cache layer can run under
 * Node (the wasm build can't locate /sql-wasm.wasm outside a browser).
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sql.js', async () => {
  const mod = await import('sql.js/dist/sql-asm.js');
  return { default: mod.default ?? mod };
});

const mockRequest = vi.fn();
vi.mock('@/lib/api', () => ({
  request: (...args) => mockRequest(...args),
  PROJECT_URL: 'http://localhost:5003',
}));

const EMAIL = 'offline@test.com';
const PROJECT = 'OfflineProject';
const CACHE_KEY = `${EMAIL}:${PROJECT}`;

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

const entryFields = [null, null, 'up_next', null, null, null, null, undefined];

describe('offline display and sync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setOnline(false);
    // Every server call fails while offline.
    mockRequest.mockRejectedValue(new Error('Failed to fetch'));
    // Tests share one IndexedDB, and the queue/cache are module singletons —
    // start each one clean so an earlier case can't leak rows into a later one.
    const { clearQueue } = await import('@/CacheFunctions/offlineQueue.js');
    const { clearUserCache } = await import('@/lib/cache');
    await clearQueue();
    await clearUserCache(EMAIL);
  });

  it('A: offline addEntry with a cold cache writes and emits the entry', async () => {
    const { cacheGet, cacheSubscribe, CACHE_STORES } = await import('@/lib/cache');
    const { addEntry } = await import('@/functions/project/entries.js');

    expect(await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY)).toBeNull();

    const emissions = [];
    const unsub = cacheSubscribe(CACHE_STORES.ENTRIES, CACHE_KEY, (data) => emissions.push(data));

    const result = await addEntry(EMAIL, PROJECT, { task: 'offline task' }, ...entryFields);

    unsub();

    expect(result.success).toBe(true);
    // The subscriber fired, so any mounted page redraws without a server call.
    expect(emissions.at(-1)).toHaveLength(1);
    expect(emissions.at(-1)[0]._optimistic).toBe(true);

    const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
    expect(cached.data.filter((e) => e._optimistic)).toHaveLength(1);

    const allCached = await cacheGet(CACHE_STORES.ALL_ENTRIES, EMAIL);
    expect(allCached.data.map((e) => e.id)).toContain(result.data.id);
  }, 60000);

  it('B: the offline entry survives a full reload', async () => {
    const { cacheSet, cacheGet, CACHE_STORES } = await import('@/lib/cache');
    await cacheSet(CACHE_STORES.ENTRIES, CACHE_KEY, {
      success: true,
      data: [{ id: 'optimistic-1', project_name: PROJECT, entries: { task: 'offline task' }, _optimistic: true }],
    });
    await tick(200); // let persistDB flush to IndexedDB

    // Page reload: drop every module instance, keep IndexedDB.
    vi.resetModules();
    const fresh = await import('@/lib/cache');
    const after = await fresh.cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
    expect((after?.data || []).map((e) => e.id)).toContain('optimistic-1');
  }, 60000);

  it('C: offline addNote writes the note and getNotes returns it', async () => {
    const { getNotes, addNote } = await import('@/functions/project/notes.js');

    const entryId = 'entry-abc';
    const result = await addNote(EMAIL, entryId, 'text', 'offline note');
    const read = await getNotes(entryId);

    expect(result.success).toBe(true);
    expect((read?.data || []).map((n) => n.value)).toContain('offline note');
  }, 60000);

  it('D: reconnect replays the queued entry without duplicating the row', async () => {
    const { cacheGet, CACHE_STORES } = await import('@/lib/cache');
    const { addEntry } = await import('@/functions/project/entries.js');
    const { getQueue } = await import('@/CacheFunctions/offlineQueue.js');
    const { dispatchAction } = await import('@/CacheFunctions/actionDispatcher.js');

    const created = await addEntry(EMAIL, PROJECT, { task: 'offline task' }, ...entryFields);
    const [queued] = await getQueue();
    expect(queued.action).toBe('addEntry');
    // The queue must know which on-screen row the server result replaces.
    expect(queued.payload.optimistic_id).toBe(created.data.id);

    setOnline(true);
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({
      success: true,
      data: { id: 'real-1', project_name: PROJECT, entries: { task: 'offline task' } },
    });

    await dispatchAction(queued);

    // Exactly one row — the server one. No leftover optimistic twin.
    const cached = await cacheGet(CACHE_STORES.ENTRIES, CACHE_KEY);
    expect(cached.data).toHaveLength(1);
    expect(cached.data[0].id).toBe('real-1');
  }, 60000);

  it('E: reconnect replays the queued note', async () => {
    const { cacheGet, CACHE_STORES } = await import('@/lib/cache');
    const { addNote } = await import('@/functions/project/notes.js');
    const { getQueue } = await import('@/CacheFunctions/offlineQueue.js');
    const { dispatchAction, getRegisteredActions } = await import('@/CacheFunctions/actionDispatcher.js');

    expect(getRegisteredActions()).toEqual(
      expect.arrayContaining(['addNote', 'updateNote', 'deleteNote'])
    );

    const entryId = 'entry-abc';
    await addNote(EMAIL, entryId, 'text', 'note to sync');
    const [queued] = await getQueue();

    setOnline(true);
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({
      success: true,
      data: { id: 'note-real-1', entry_id: entryId, entry_type: 'text', value: 'note to sync' },
    });

    const cached = await cacheGet(CACHE_STORES.NOTES, `notes:${entryId}`);
    expect(cached.data.some((n) => n._optimistic)).toBe(true);

    await dispatchAction(queued);

    const after = await cacheGet(CACHE_STORES.NOTES, `notes:${entryId}`);
    expect(after.data.map((n) => n.id)).toContain('note-real-1');
    expect(after.data.filter((n) => n._optimistic)).toHaveLength(0);
  }, 60000);
});
