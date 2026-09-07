/**
 * Integration tests for the useCachedData hook.
 *
 * Tests the full flow:
 *   1. Hook reads from IndexedDB immediately
 *   2. Hook subscribes to cache changes
 *   3. Background fetch writes to cache → hook re-renders with new data
 *   4. Convenience hooks (useCachedProjects, useCachedEntries, useCachedProfile)
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';
import { cacheSet, clearUserCache, CACHE_STORES } from '@/lib/cache';
import { useCachedData, useCachedProjects, useCachedEntries, useCachedProfile } from '@/hooks/useCachedData';

const EMAIL = 'hook@test.com';

// Helper component that uses the hook and renders the data
function TestDataComponent({ store, keyName, fetchFn, deps }: {
  store: string;
  keyName: string;
  fetchFn: (() => Promise<void>) | null;
  deps: unknown[];
}) {
  const { data, loaded } = useCachedData(store, keyName, fetchFn, deps);
  return createElement('div', null,
    createElement('span', { 'data-testid': 'loaded' }, String(loaded)),
    createElement('span', { 'data-testid': 'data' }, JSON.stringify(data)),
  );
}

function TestProjectsComponent({ fetchFn }: { fetchFn: (() => Promise<void>) | null }) {
  const { data, loaded } = useCachedProjects(EMAIL, fetchFn);
  return createElement('div', null,
    createElement('span', { 'data-testid': 'loaded' }, String(loaded)),
    createElement('span', { 'data-testid': 'data' }, JSON.stringify(data)),
  );
}

function TestEntriesComponent({ projectName, fetchFn }: {
  projectName: string | null;
  fetchFn: (() => Promise<void>) | null;
}) {
  const { data, loaded } = useCachedEntries(EMAIL, projectName, fetchFn);
  return createElement('div', null,
    createElement('span', { 'data-testid': 'loaded' }, String(loaded)),
    createElement('span', { 'data-testid': 'data' }, JSON.stringify(data)),
  );
}

function TestProfileComponent({ fetchFn }: { fetchFn: (() => Promise<void>) | null }) {
  const { data, loaded } = useCachedProfile(EMAIL, fetchFn);
  return createElement('div', null,
    createElement('span', { 'data-testid': 'loaded' }, String(loaded)),
    createElement('span', { 'data-testid': 'data' }, JSON.stringify(data)),
  );
}

describe('useCachedData Hook Integration', () => {
  beforeEach(async () => {
    await clearUserCache(EMAIL);
    vi.clearAllMocks();
  });

  describe('basic hook behavior', () => {
    it('returns null data when cache is empty and no fetchFn', async () => {
      render(createElement(TestDataComponent, {
        store: CACHE_STORES.PROJECTS,
        keyName: EMAIL,
        fetchFn: null,
        deps: [],
      }));

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });
      expect(screen.getByTestId('data').textContent).toBe('null');
    });

    it('returns cached data immediately from IndexedDB', async () => {
      // Pre-populate cache
      await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
        success: true,
        data: [{ project_name: 'CachedProject' }],
      });

      render(createElement(TestDataComponent, {
        store: CACHE_STORES.PROJECTS,
        keyName: EMAIL,
        fetchFn: null,
        deps: [],
      }));

      await waitFor(() => {
        const data = JSON.parse(screen.getByTestId('data').textContent ?? 'null');
        expect(data).toBeTruthy();
        expect(data[0].project_name).toBe('CachedProject');
      });
    });

    it('calls fetchFn in background and updates when cache changes', async () => {
      const fetchFn = vi.fn(async () => {
        // Simulate server fetch writing to cache
        await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
          success: true,
          data: [{ project_name: 'FreshProject' }],
        });
      });

      render(createElement(TestDataComponent, {
        store: CACHE_STORES.PROJECTS,
        keyName: EMAIL,
        fetchFn,
        deps: [],
      }));

      await waitFor(() => {
        const data = JSON.parse(screen.getByTestId('data').textContent ?? 'null');
        expect(data).toBeTruthy();
        expect(data[0].project_name).toBe('FreshProject');
      });

      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('useCachedProjects convenience hook', () => {
    it('reads projects from the projects store', async () => {
      await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
        success: true,
        data: [{ project_name: 'Alpha' }, { project_name: 'Beta' }],
      });

      render(createElement(TestProjectsComponent, { fetchFn: null }));

      await waitFor(() => {
        const data = JSON.parse(screen.getByTestId('data').textContent ?? 'null');
        expect(data.length).toBe(2);
        expect(data[0].project_name).toBe('Alpha');
      });
    });
  });

  describe('useCachedEntries convenience hook', () => {
    it('reads per-project entries when projectName is provided', async () => {
      const cacheKey = `${EMAIL}:MyProject`;
      await cacheSet(CACHE_STORES.ENTRIES, cacheKey, {
        success: true,
        data: [{ id: '1', summary: 'Task A' }],
      });

      render(createElement(TestEntriesComponent, { projectName: 'MyProject', fetchFn: null }));

      await waitFor(() => {
        const data = JSON.parse(screen.getByTestId('data').textContent ?? 'null');
        expect(data.length).toBe(1);
        expect(data[0].summary).toBe('Task A');
      });
    });

    it('reads all-entries when no projectName', async () => {
      await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, {
        success: true,
        data: [{ id: '1', summary: 'All Task' }],
      });

      render(createElement(TestEntriesComponent, { projectName: null, fetchFn: null }));

      await waitFor(() => {
        const data = JSON.parse(screen.getByTestId('data').textContent ?? 'null');
        expect(data.length).toBe(1);
        expect(data[0].summary).toBe('All Task');
      });
    });
  });

  describe('useCachedProfile convenience hook', () => {
    it('reads profile from the profile store', async () => {
      await cacheSet(CACHE_STORES.PROFILE, EMAIL, {
        success: true,
        data: { username: 'hookuser', avatar: 'pic.png' },
      });

      render(createElement(TestProfileComponent, { fetchFn: null }));

      await waitFor(() => {
        const data = JSON.parse(screen.getByTestId('data').textContent ?? 'null');
        expect(data.username).toBe('hookuser');
      });
    });
  });

  describe('reactive updates via cache subscription', () => {
    it('re-renders when cache is updated externally', async () => {
      // Start with initial data
      await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
        success: true,
        data: [{ project_name: 'Initial' }],
      });

      render(createElement(TestProjectsComponent, { fetchFn: null }));

      await waitFor(() => {
        const data = JSON.parse(screen.getByTestId('data').textContent ?? 'null');
        expect(data[0].project_name).toBe('Initial');
      });

      // Update cache externally (simulating sync or another component writing)
      await act(async () => {
        await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
          success: true,
          data: [{ project_name: 'Initial' }, { project_name: 'NewProject' }],
        });
      });

      await waitFor(() => {
        const data = JSON.parse(screen.getByTestId('data').textContent ?? 'null');
        expect(data.length).toBe(2);
        expect(data[1].project_name).toBe('NewProject');
      });
    });
  });
});
