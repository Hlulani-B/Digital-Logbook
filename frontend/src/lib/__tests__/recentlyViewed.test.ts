import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getRecentlyViewed,
  trackViewedEntry,
  trackViewedProject,
  clearRecentlyViewed,
  type RecentlyViewedEntry,
} from '../recentlyViewed';

const STORAGE_KEY = 'recentlyViewedEntries.v1';

function setStored(items: RecentlyViewedEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function getStored(): RecentlyViewedEntry[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('recentlyViewed', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('getRecentlyViewed', () => {
    it('returns empty array when storage is empty', () => {
      expect(getRecentlyViewed()).toEqual([]);
    });

    it('returns stored entries newest-first', () => {
      const items: RecentlyViewedEntry[] = [
        { entryId: 'a', projectName: 'P1', title: 'A', viewedAt: '2025-01-01T00:00:00Z', type: 'entry' },
        { entryId: 'b', projectName: 'P1', title: 'B', viewedAt: '2025-01-02T00:00:00Z', type: 'entry' },
      ];
      setStored(items);
      const result = getRecentlyViewed();
      expect(result).toHaveLength(2);
      expect(result[0].entryId).toBe('a');
    });

    it('caps at MAX_ITEMS (3)', () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        entryId: `e${i}`,
        projectName: 'P',
        title: `T${i}`,
        viewedAt: new Date(i).toISOString(),
        type: 'entry' as const,
      }));
      setStored(items);
      expect(getRecentlyViewed()).toHaveLength(3);
    });

    it('filters out invalid entries', () => {
      const items = [
        { entryId: 'a', projectName: 'P', title: 'A', viewedAt: '2025-01-01', type: 'entry' },
        { entryId: 123, projectName: 'P', title: 'bad', viewedAt: 'x', type: 'entry' },
        null,
        'string',
      ];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      const result = getRecentlyViewed();
      expect(result).toHaveLength(1);
      expect(result[0].entryId).toBe('a');
    });

    it('returns empty array for non-array stored value', () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'array' }));
      expect(getRecentlyViewed()).toEqual([]);
    });

    it('returns empty array on corrupt JSON', () => {
      window.localStorage.setItem(STORAGE_KEY, '{broken');
      expect(getRecentlyViewed()).toEqual([]);
    });
  });

  describe('trackViewedEntry', () => {
    it('adds a new entry to the top', () => {
      trackViewedEntry({ entryId: 'e1', projectName: 'Proj', title: 'Task 1' });
      const stored = getStored();
      expect(stored).toHaveLength(1);
      expect(stored[0].entryId).toBe('e1');
      expect(stored[0].type).toBe('entry');
      expect(stored[0].viewedAt).toBeTruthy();
    });

    it('deduplicates by entryId', () => {
      trackViewedEntry({ entryId: 'e1', projectName: 'P', title: 'First' });
      trackViewedEntry({ entryId: 'e2', projectName: 'P', title: 'Second' });
      trackViewedEntry({ entryId: 'e1', projectName: 'P', title: 'First again' });
      const stored = getStored();
      expect(stored).toHaveLength(2);
      expect(stored[0].entryId).toBe('e1');
      expect(stored[0].title).toBe('First again');
    });

    it('caps at 3 items', () => {
      trackViewedEntry({ entryId: 'a', projectName: 'P', title: 'A' });
      trackViewedEntry({ entryId: 'b', projectName: 'P', title: 'B' });
      trackViewedEntry({ entryId: 'c', projectName: 'P', title: 'C' });
      trackViewedEntry({ entryId: 'd', projectName: 'P', title: 'D' });
      const stored = getStored();
      expect(stored).toHaveLength(3);
      expect(stored.map((e: RecentlyViewedEntry) => e.entryId)).toEqual(['d', 'c', 'b']);
    });

    it('dispatches recentlyViewedChanged event', () => {
      const handler = vi.fn();
      window.addEventListener('recentlyViewedChanged', handler);
      trackViewedEntry({ entryId: 'e1', projectName: 'P', title: 'T' });
      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener('recentlyViewedChanged', handler);
    });

    it('skips entries with empty entryId', () => {
      trackViewedEntry({ entryId: '', projectName: 'P', title: 'T' });
      expect(getStored()).toHaveLength(0);
    });
  });

  describe('trackViewedProject', () => {
    it('stores a project-type entry', () => {
      trackViewedProject({ projectName: 'MyProj', title: 'My Project' });
      const stored = getStored();
      expect(stored).toHaveLength(1);
      expect(stored[0].type).toBe('project');
      expect(stored[0].entryId).toBe('project:MyProj');
    });

    it('deduplicates projects by generated entryId', () => {
      trackViewedProject({ projectName: 'P1', title: 'First' });
      trackViewedProject({ projectName: 'P1', title: 'Updated' });
      const stored = getStored();
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('Updated');
    });
  });

  describe('clearRecentlyViewed', () => {
    it('removes all stored entries', () => {
      trackViewedEntry({ entryId: 'e1', projectName: 'P', title: 'T' });
      expect(getStored()).toHaveLength(1);
      clearRecentlyViewed();
      expect(getStored()).toHaveLength(0);
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('dispatches recentlyViewedChanged event', () => {
      const handler = vi.fn();
      window.addEventListener('recentlyViewedChanged', handler);
      clearRecentlyViewed();
      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener('recentlyViewedChanged', handler);
    });
  });
});
