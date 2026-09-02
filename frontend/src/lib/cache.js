/**
 * IndexedDB caching layer for stale-while-revalidate pattern.
 * 
 * This module provides a local-first caching mechanism:
 * - Read operations: Return cached data immediately, then fetch fresh data in background
 * - Write operations: Update Supabase first, then sync cache on success
 * 
 * Pattern: https://web.dev/stale-while-revalidate/
 */

import { openDB } from 'idb';

const DB_NAME = 'digital-logbook-cache';
const DB_VERSION = 1;

// Cache store names
const STORES = {
  PROJECTS: 'projects',
  ENTRIES: 'entries',
  ALL_ENTRIES: 'all-entries',
  PROFILE: 'profile',
  SEARCH: 'search',
};

// Cache metadata (timestamps for stale checks)
const META_STORE = 'cache-meta';

let dbPromise = null;

/**
 * Get or create the IndexedDB database instance.
 */
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create object stores for each cache type
        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          db.createObjectStore(STORES.PROJECTS, { keyPath: 'email' });
        }
        if (!db.objectStoreNames.contains(STORES.ENTRIES)) {
          db.createObjectStore(STORES.ENTRIES, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.ALL_ENTRIES)) {
          db.createObjectStore(STORES.ALL_ENTRIES, { keyPath: 'email' });
        }
        if (!db.objectStoreNames.contains(STORES.PROFILE)) {
          db.createObjectStore(STORES.PROFILE, { keyPath: 'email' });
        }
        if (!db.objectStoreNames.contains(STORES.SEARCH)) {
          db.createObjectStore(STORES.SEARCH, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Get cached data for a key.
 * @param {string} store - The object store name
 * @param {string} key - The cache key
 * @returns {Promise<any|null>} The cached data or null
 */
export async function cacheGet(store, key) {
  try {
    const db = await getDB();
    return await db.get(store, key);
  } catch (err) {
    console.warn(`[Cache] Failed to get ${key} from ${store}:`, err);
    return null;
  }
}

/**
 * Set cached data for a key.
 * @param {string} store - The object store name
 * @param {string} key - The cache key
 * @param {any} data - The data to cache
 * @returns {Promise<void>}
 */
export async function cacheSet(store, key, data) {
  try {
    const db = await getDB();
    // Wrap data with key if it doesn't have one
    const record = typeof data === 'object' && data !== null && !Array.isArray(data)
      ? { ...data, key }
      : { key, data };
    await db.put(store, record);
    // Update timestamp
    await db.put(META_STORE, { key, timestamp: Date.now() });
  } catch (err) {
    console.warn(`[Cache] Failed to set ${key} in ${store}:`, err);
  }
}

/**
 * Get the timestamp of when a cache entry was last updated.
 * @param {string} key - The cache key
 * @returns {Promise<number|null>} Timestamp in ms or null
 */
export async function cacheGetTimestamp(key) {
  try {
    const db = await getDB();
    const meta = await db.get(META_STORE, key);
    return meta?.timestamp || null;
  } catch (err) {
    return null;
  }
}

/**
 * Delete a cached entry.
 * @param {string} store - The object store name
 * @param {string} key - The cache key
 * @returns {Promise<void>}
 */
export async function cacheDelete(store, key) {
  try {
    const db = await getDB();
    await db.delete(store, key);
    await db.delete(META_STORE, key);
  } catch (err) {
    console.warn(`[Cache] Failed to delete ${key} from ${store}:`, err);
  }
}

/**
 * Clear all cached data for a specific user.
 * Useful for logout or data refresh.
 * @param {string} email - User's email
 * @returns {Promise<void>}
 */
export async function clearUserCache(email) {
  try {
    const db = await getDB();
    const tx = db.transaction(Object.values(STORES), 'readwrite');
    await Promise.all([
      tx.objectStore(STORES.PROJECTS).delete(email),
      tx.objectStore(STORES.ENTRIES).delete(email),
      tx.objectStore(STORES.ALL_ENTRIES).delete(email),
      tx.objectStore(STORES.PROFILE).delete(email),
      tx.objectStore(STORES.SEARCH).delete(email),
      tx.objectStore(META_STORE).delete(email),
      tx.done,
    ]);
  } catch (err) {
    console.warn(`[Cache] Failed to clear cache for ${email}:`, err);
  }
}

/**
 * Stale-while-revalidate pattern implementation.
 * Returns cached data immediately if available, then fetches fresh data
 * and calls the onUpdate callback when fresh data arrives.
 * 
 * @param {Object} options
 * @param {string} options.store - The cache store name
 * @param {string} options.key - The cache key
 * @param {Function} options.fetcher - Async function to fetch fresh data
 * @param {Function} [options.onUpdate] - Callback when fresh data arrives (receives fresh data)
 * @param {number} [options.maxAge] - Max age in ms before considering stale (default: 5 min)
 * @returns {Promise<any>} The cached data (or null if no cache)
 */
export async function staleWhileRevalidate({
  store,
  key,
  fetcher,
  onUpdate,
  maxAge = 5 * 60 * 1000, // 5 minutes default
}) {
  // 1. Try to get cached data
  const cached = await cacheGet(store, key);
  const timestamp = await cacheGetTimestamp(key);
  const isStale = timestamp ? Date.now() - timestamp > maxAge : true;

  // 2. Start background fetch for fresh data
  const freshPromise = fetcher()
    .then(async (freshData) => {
      // Update cache with fresh data
      await cacheSet(store, key, freshData);
      // Notify caller of fresh data
      if (onUpdate) {
        onUpdate(freshData);
      }
      return freshData;
    })
    .catch((err) => {
      console.warn(`[Cache] Background fetch failed for ${key}:`, err);
      return null;
    });

  // 3. Return cached data immediately if available and not too stale
  if (cached && !isStale) {
    return cached.data !== undefined ? cached.data : cached;
  }

  // 4. If no cache or very stale, wait for fresh data
  if (cached && isStale) {
    // Return stale cache but fresh data is being fetched
    return cached.data !== undefined ? cached.data : cached;
  }

  // 5. No cache at all - must wait for fetch
  return freshPromise;
}

/**
 * Cache wrapper for read operations.
 * Wraps a fetch function with IndexedDB caching.
 * 
 * @param {string} store - Cache store name
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to fetch data
 * @returns {Promise<any>} The data (from cache or fresh)
 */
export async function cachedFetch(store, key, fetchFn) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    // Try cache first
    cacheGet(store, key).then((cached) => {
      if (cached && !resolved) {
        resolved = true;
        resolve(cached.data !== undefined ? cached.data : cached);
      }
    });

    // Fetch fresh data
    fetchFn()
      .then(async (data) => {
        await cacheSet(store, key, data);
        if (!resolved) {
          resolved = true;
          resolve(data);
        }
      })
      .catch((err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
  });
}

// Export store names for use in other modules
export { STORES as CACHE_STORES };
