import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';

const DB_NAME = 'digital-logbook-cache';
const LEGACY_STORES = ['projects', 'entries', 'all-entries', 'profile', 'search', 'cache-meta'];

beforeEach(async () => {
  await deleteDB(DB_NAME);

  const db = await openDB(DB_NAME, 3, {
    upgrade(database) {
      for (const store of LEGACY_STORES) {
        database.createObjectStore(store, { keyPath: 'key' });
      }
    },
  });

  await db.put('projects', {
    key: 'user@example.com',
    success: true,
    data: [{ project_name: 'Preserved project' }],
  });
  await db.put('cache-meta', {
    key: 'user@example.com',
    timestamp: 123456789,
  });
  db.close();
});

describe('cache schema upgrade', () => {
  it('preserves v3 cache records and metadata while adding new stores', async () => {
    const { cacheGet, cacheGetTimestamp, CACHE_STORES } = await import('../cache');

    await expect(cacheGet(CACHE_STORES.PROJECTS, 'user@example.com')).resolves.toEqual({
      key: 'user@example.com',
      success: true,
      data: [{ project_name: 'Preserved project' }],
    });
    await expect(cacheGetTimestamp('user@example.com')).resolves.toBe(123456789);

    const upgraded = await openDB(DB_NAME, 4);
    expect(upgraded.objectStoreNames.contains('projects')).toBe(true);
    expect(upgraded.objectStoreNames.contains('cache-meta')).toBe(true);
    expect(upgraded.objectStoreNames.contains('archives')).toBe(true);
    expect(upgraded.objectStoreNames.contains('fields')).toBe(true);
    upgraded.close();
  });
});
