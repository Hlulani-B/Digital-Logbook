/**
 * Cache schema upgrade test.
 *
 * The cache layer was migrated from IndexedDB (idb) to SQLite (sql.js).
 * This test verifies that the new sql.js cache initializes correctly
 * and creates all required tables.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock sql.js with an in-memory SQLite implementation
const tables = new Map();

vi.mock('sql.js', () => ({
  default: vi.fn(() =>
    Promise.resolve({
      Database: vi.fn(() => ({
        run: vi.fn((sql) => {
          const stmts = sql
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean);
          for (const stmt of stmts) {
            const m = stmt.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
            if (m) tables.set(m[1], new Map());
          }
        }),
        exec: vi.fn(() => []),
        export: vi.fn(() => new Uint8Array([])),
        close: vi.fn(),
      })),
    })
  ),
}));

beforeEach(() => {
  tables.clear();
  // Reset the module-level dbPromise by resetting modules
  vi.resetModules();
});

describe('cache schema upgrade', () => {
  it('initializes all required tables in the new sql.js cache', async () => {
    const { cacheGet, CACHE_STORES } = await import('../cache');

    // Trigger DB initialization
    await cacheGet(CACHE_STORES.PROJECTS, 'user@example.com');

    // Verify all expected tables were created
    expect(tables.has('projects')).toBe(true);
    expect(tables.has('entries')).toBe(true);
    expect(tables.has('all_entries')).toBe(true);
    expect(tables.has('profile')).toBe(true);
    expect(tables.has('search')).toBe(true);
    expect(tables.has('archives')).toBe(true);
    expect(tables.has('fields')).toBe(true);
    expect(tables.has('notes')).toBe(true);
    expect(tables.has('cache_meta')).toBe(true);
    expect(tables.has('offline_queue')).toBe(true);
  });
});
