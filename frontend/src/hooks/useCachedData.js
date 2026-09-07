/**
 * useCachedData — React hook for IndexedDB-first data loading.
 * 
 * Usage:
 *   const data = useCachedData(CACHE_STORES.PROJECTS, email, fetchFn);
 * 
 * Behavior:
 * 1. Reads from IndexedDB immediately (no loading state)
 * 2. Subscribes to cache changes — re-renders when cache updates
 * 3. Calls fetchFn in background to refresh data from server
 * 4. fetchFn should write to IndexedDB via cacheSet, which triggers re-render
 * 
 * @param {string} store - Cache store name (from CACHE_STORES)
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Optional async function to fetch fresh data from server
 * @param {any[]} deps - Dependency array for re-running fetchFn (like useEffect deps)
 * @returns {any|null} The cached data, or null if no cache exists yet
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheGet, cacheSet, cacheSubscribe } from '@/lib/cache';

export function useCachedData(store, key, fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  // Subscribe to cache changes
  useEffect(() => {
    if (!store || !key) return;

    // 1. Read from IndexedDB immediately
    let cancelled = false;
    (async () => {
      const cached = await cacheGet(store, key);
      if (!cancelled) {
        const payload = cached?.data !== undefined ? cached.data : cached;
        setData(payload ?? null);
        setLoaded(true);
      }
    })();

    // 2. Subscribe to future cache changes
    const unsubscribe = cacheSubscribe(store, key, (newData) => {
      if (!cancelled) {
        setData(newData ?? null);
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [store, key]);

  // 3. Trigger background fetch
  useEffect(() => {
    if (!store || !key || !fetchFnRef.current) return;

    const doFetch = async () => {
      try {
        await fetchFnRef.current();
        // fetchFn should call cacheSet which triggers the subscription above
      } catch (err) {
        console.warn(`[useCachedData] Background fetch failed for ${store}:${key}:`, err);
      }
    };

    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, key, ...deps]);

  return { data, loaded };
}

/**
 * useCachedProjects — convenience hook for loading projects from cache.
 */
export function useCachedProjects(email, fetchFn) {
  return useCachedData('projects', email, fetchFn, [email]);
}

/**
 * useCachedEntries — convenience hook for loading entries from cache.
 */
export function useCachedEntries(email, projectName, fetchFn) {
  const key = projectName ? `${email}:${projectName}` : email;
  const store = projectName ? 'entries' : 'all-entries';
  return useCachedData(store, key, fetchFn, [email, projectName]);
}

/**
 * useCachedProfile — convenience hook for loading profile from cache.
 */
export function useCachedProfile(email, fetchFn) {
  return useCachedData('profile', email, fetchFn, [email]);
}
