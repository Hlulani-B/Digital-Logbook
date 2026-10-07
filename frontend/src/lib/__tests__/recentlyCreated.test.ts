import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getRecentlyCreated,
  trackCreatedEntry,
  clearRecentlyCreated,
  type RecentlyCreatedEntry,
} from '../recentlyCreated';

const STORAGE_KEY = 'recentlyCreatedEntries.v1';

function getStored(): RecentlyCreatedEntry[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('recentlyCreated', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('getRecentlyCreated', () => {
    it('returns empty array when storage is empty', () => {
      expect(getRecentlyCreated()).toEqual([]);
    });

    it('returns stored entries', () => {
      const items: RecentlyCreatedEntry[] = [
        { entryId: 'a', projectName: 'P1', title: 'A', createdAt: '2025-01-01T00:00:00Z' },
      ];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      expect(getRecentlyCreated()).toHaveLength(1);
    });

    it('caps at MAX_ITEMS (3)', () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        entryId: `e${i}`,
        projectName: 'P',
        title: `T${i}`,
        createdAt: new Date(i).toISOString(),
      }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      expect(getRecentlyCreated()).toHaveLength(3);
    });

    it('filters out invalid entries', () => {
      const items = [
        { entryId: 'a', projectName: 'P', title: 'A', createdAt: '2025-01-01' },
        { entryId: 123, projectName: 'P', title: 'bad', createdAt: 'x' },
        null,
      ];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      expect(getRecentlyCreated()).toHaveLength(1);
    });

    it('returns empty for non-array stored value', () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify('not-array'));
      expect(getRecentlyCreated()).toEqual([]);
    });

    it('returns empty on corrupt JSON', () => {
      window.localStorage.setItem(STORAGE_KEY, '{broken');
      expect(getRecentlyCreated()).toEqual([]);
    });
  });

  describe('trackCreatedEntry', () => {
    it('adds a new entry', () => {
      trackCreatedEntry({ entryId: 'e1', projectName: 'Proj', title: 'Task 1' });
      const stored = getStored();
      expect(stored).toHaveLength(1);
      expect(stored[0].entryId).toBe('e1');
      expect(stored[0].createdAt).toBeTruthy();
    });

    it('generates a local id when entryId is missing', () => {
      trackCreatedEntry({ projectName: 'Proj', title: 'No ID' });
      const stored = getStored();
      expect(stored).toHaveLength(1);
      expect(stored[0].entryId).toMatch(/^local-/);
    });

    it('deduplicates by entryId', () => {
      trackCreatedEntry({ entryId: 'e1', projectName: 'P', title: 'First' });
      trackCreatedEntry({ entryId: 'e1', projectName: 'P', title: 'Updated' });
      const stored = getStored();
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('Updated');
    });

    it('caps at 3 items', () => {
      trackCreatedEntry({ entryId: 'a', projectName: 'P', title: 'A' });
      trackCreatedEntry({ entryId: 'b', projectName: 'P', title: 'B' });
      trackCreatedEntry({ entryId: 'c', projectName: 'P', title: 'C' });
      trackCreatedEntry({ entryId: 'd', projectName: 'P', title: 'D' });
      const stored = getStored();
      expect(stored).toHaveLength(3);
      expect(stored.map((e: RecentlyCreatedEntry) => e.entryId)).toEqual(['d', 'c', 'b']);
    });

    it('skips when projectName is empty', () => {
      trackCreatedEntry({ projectName: '', title: 'T' });
      expect(getStored()).toHaveLength(0);
    });

    it('dispatches recentlyCreatedChanged event', () => {
      const handler = vi.fn();
      window.addEventListener('recentlyCreatedChanged', handler);
      trackCreatedEntry({ entryId: 'e1', projectName: 'P', title: 'T' });
      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener('recentlyCreatedChanged', handler);
    });
  });

  describe('clearRecentlyCreated', () => {
    it('removes all stored entries', () => {
      trackCreatedEntry({ entryId: 'e1', projectName: 'P', title: 'T' });
      expect(getStored()).toHaveLength(1);
      clearRecentlyCreated();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('dispatches recentlyCreatedChanged event', () => {
      const handler = vi.fn();
      window.addEventListener('recentlyCreatedChanged', handler);
      clearRecentlyCreated();
      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener('recentlyCreatedChanged', handler);
    });
  });
});
