/**
 * SQLite caching layer with event-driven subscriptions.
 * Uses sql.js (SQLite compiled to WebAssembly) for local-first storage.
 * 
 * This module provides a local-first caching mechanism:
 * - Read operations: Return cached data immediately, then fetch fresh data in background
 * - Write operations: Update SQLite first (optimistic), then sync to server
 * - Components subscribe to cache changes via useCachedData hook
 * 
 * Pattern: SQLite-first with stale-while-revalidate
 */

import initSqlJs from 'sql.js';

const DB_NAME = 'digital-logbook-sqlite';
const STORAGE_KEY = 'sqlitedb';

// SQL tables that mirror Supabase schema (store data as JSON for compatibility)
const TABLES = {
  PROJECTS: 'projects',
  ENTRIES: 'entries',
  ALL_ENTRIES: 'all_entries',
  PROFILE: 'profile',
  SEARCH: 'search',
  ARCHIVES: 'archives',
  FIELDS: 'fields',
  OFFLINE_QUEUE: 'offline_queue',
  NOTES: 'notes',
  CACHE_META: 'cache_meta',
};

let dbPromise = null;
let SQL = null;

// ── Event system for cache changes ──────────────────────────
const listeners = new Map(); // key -> Set<callback>

/**
 * Subscribe to cache changes for a specific store+key.
 * @param {string} store - The table name
 * @param {string} key - The cache key
 * @param {Function} callback - Called with new data when cache changes
 * @returns {Function} Unsubscribe function
 */
export function cacheSubscribe(store, key, callback) {
  const cacheKey = `${store}:${key}`;
  if (!listeners.has(cacheKey)) {
    listeners.set(cacheKey, new Set());
  }
  listeners.get(cacheKey).add(callback);
  return () => {
    listeners.get(cacheKey)?.delete(callback);
  };
}

/**
 * Notify all subscribers of a cache change.
 */
function emitCacheChange(store, key, data) {
  const cacheKey = `${store}:${key}`;
  const subs = listeners.get(cacheKey);
  if (subs) {
    const payload = data?.data !== undefined ? data.data : data;
    subs.forEach((cb) => {
      try { cb(payload); } catch (e) { console.warn('[Cache] Subscriber error:', e); }
    });
  }
}

/**
 * Persist the SQLite database to IndexedDB for durability.
 * Exported for use by offlineQueue.js
 */
export function persistDB(db) {
  try {
    const data = db.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    // Use IndexedDB to store the binary
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => {
      const idb = request.result;
      const tx = idb.transaction('storage', 'readwrite');
      tx.objectStore('storage').put(blob, STORAGE_KEY);
      tx.oncomplete = () => idb.close();
    };
    request.onerror = () => console.warn('[Cache] Failed to persist DB');
  } catch (err) {
    console.warn('[Cache] Persist error:', err);
  }
}

/**
 * Load the SQLite database from IndexedDB.
 */
function loadDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('storage');
    };
    request.onsuccess = () => {
      const idb = request.result;
      try {
        const tx = idb.transaction('storage', 'readonly');
        const getReq = tx.objectStore('storage').get(STORAGE_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
        tx.oncomplete = () => idb.close();
      } catch {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
  });
}

/**
 * Get or create the SQLite database instance.
 * Exported for use by offlineQueue.js
 */
export async function getSharedDB() {
  return getDB();
}

async function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      // Initialize sql.js WASM
      if (!SQL) {
        SQL = await initSqlJs({
          locateFile: file => `https://sql.js.org/dist/${file}`
        });
      }

      // Try to load existing database
      const savedData = await loadDB();
      let db;
      if (savedData) {
        const buffer = await savedData.arrayBuffer();
        db = new SQL.Database(new Uint8Array(buffer));
      } else {
        db = new SQL.Database();
        
        // Create tables mirroring Supabase schema
        // Each table has a key (primary key) and data (JSON blob)
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS projects (key TEXT PRIMARY KEY, data TEXT);
          CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, data TEXT);
          CREATE TABLE IF NOT EXISTS all_entries (key TEXT PRIMARY KEY, data TEXT);
          CREATE TABLE IF NOT EXISTS profile (key TEXT PRIMARY KEY, data TEXT);
          CREATE TABLE IF NOT EXISTS search (key TEXT PRIMARY KEY, data TEXT);
          CREATE TABLE IF NOT EXISTS archives (key TEXT PRIMARY KEY, data TEXT);
          CREATE TABLE IF NOT EXISTS fields (key TEXT PRIMARY KEY, data TEXT);
          CREATE TABLE IF NOT EXISTS notes (key TEXT PRIMARY KEY, data TEXT);
          CREATE TABLE IF NOT EXISTS cache_meta (key TEXT PRIMARY KEY, timestamp INTEGER);
          CREATE TABLE IF NOT EXISTS offline_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, created_at INTEGER);
        `;
        db.run(createTableSQL);
      }

      // Persist initial state
      persistDB(db);
      return db;
    })();
  }
  return dbPromise;
}

/**
 * Get cached data for a key.
 * @param {string} store - The table name
 * @param {string} key - The cache key
 * @returns {Promise<any|null>} The cached data or null
 */
export async function cacheGet(store, key) {
  try {
    const db = await getDB();
    const result = db.exec(`SELECT data FROM ${store} WHERE key = ?`, [key]);
    if (result.length > 0 && result[0].values.length > 0) {
      const jsonStr = result[0].values[0][0];
      return JSON.parse(jsonStr);
    }
    return null;
  } catch (err) {
    console.warn(`[Cache] Failed to get ${key} from ${store}:`, err);
    return null;
  }
}

/**
 * Set cached data for a key.
 * @param {string} store - The table name
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
    const jsonStr = JSON.stringify(record);
    
    db.run(`INSERT OR REPLACE INTO ${store} (key, data) VALUES (?, ?)`, [key, jsonStr]);
    
    // Update timestamp
    db.run(`INSERT OR REPLACE INTO cache_meta (key, timestamp) VALUES (?, ?)`, [key, Date.now()]);
    
    // Persist to IndexedDB
    persistDB(db);
    
    // Notify subscribers
    emitCacheChange(store, key, data);
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
    const result = db.exec(`SELECT timestamp FROM cache_meta WHERE key = ?`, [key]);
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Delete a cached entry.
 * @param {string} store - The table name
 * @param {string} key - The cache key
 * @returns {Promise<void>}
 */
export async function cacheDelete(store, key) {
  try {
    const db = await getDB();
    db.run(`DELETE FROM ${store} WHERE key = ?`, [key]);
    db.run(`DELETE FROM cache_meta WHERE key = ?`, [key]);
    
    // Persist to IndexedDB
    persistDB(db);
    
    // Notify subscribers that data was cleared
    emitCacheChange(store, key, null);
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
    const tables = ['projects', 'entries', 'all_entries', 'profile', 'search', 'archives', 'fields'];
    for (const table of tables) {
      db.run(`DELETE FROM ${table} WHERE key = ?`, [email]);
    }
    db.run(`DELETE FROM cache_meta WHERE key = ?`, [email]);
    
    // Persist to IndexedDB
    persistDB(db);
    
    // Notify all subscribers for this user that data was cleared
    tables.forEach((store) => {
      emitCacheChange(store, email, null);
    });
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
 * @param {string} options.store - The table name
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
 * Wraps a fetch function with SQLite caching.
 * 
 * @param {string} store - Table name
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

// Export table names for use in other modules
export { TABLES as CACHE_STORES };
