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
  ACTIVITY: 'activity',
  CACHE_META: 'cache_meta',
};

// DDL for every store above. This is applied on EVERY database open — not only
// when the database is created — because the persisted snapshot outlives the
// code that wrote it. A snapshot taken before a table was added makes every
// `INSERT` into that table fail with "no such table", and because cacheSet only
// console.warns, the affected feature (new offline entries/notes/activity)
// silently stops showing anything while the rest of the app keeps working.
const SCHEMA_SQL = Object.values(TABLES)
  .map((table) =>
    table === TABLES.OFFLINE_QUEUE
      ? `CREATE TABLE IF NOT EXISTS ${table} (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, created_at INTEGER);`
      : table === TABLES.CACHE_META
        ? `CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY, timestamp INTEGER);`
        : `CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY, data TEXT);`
  )
  .join('\n');

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
      try {
        cb(payload);
      } catch (e) {
        console.warn('[Cache] Subscriber error:', e);
      }
    });
  }
}

// Persistence is serialised through this chain; pendingSnapshot always holds
// the newest not-yet-written byte array.
let persistChain = Promise.resolve();
let pendingSnapshot = null;

/**
 * Open the IndexedDB handle that stores the SQLite snapshot.
 * Shared by the read and the write path so the object store is created
 * identically in both.
 */
function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains('storage')) {
        idb.createObjectStore('storage');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('[Cache] IndexedDB open failed'));
    request.onblocked = () => reject(new Error('[Cache] IndexedDB open blocked'));
  });
}

/**
 * Persist the SQLite database to IndexedDB for durability.
 * Exported for use by offlineQueue.js
 *
 * The snapshot is taken SYNCHRONOUSLY at call time and writes are chained so
 * they land in the order they were requested. Without the chain, two
 * back-to-back cacheSet calls (an offline entry writes the per-project list,
 * then the all-entries list, then its notes) race each other through
 * IndexedDB, and the LAST write to finish — not the newest snapshot — wins.
 * The newest change is then missing from disk and disappears on reload.
 *
 * @returns {Promise<void>} resolves once this snapshot has been written
 */
export function persistDB(db) {
  let snapshot;
  try {
    // Uint8Array instead of a Blob: blobs are structured-cloned inconsistently
    // (and cannot be read back without an extra async hop), and the SQLite
    // export is already a byte array.
    snapshot = db.export();
  } catch (err) {
    console.warn('[Cache] Failed to serialise DB:', err);
    return Promise.resolve();
  }

  pendingSnapshot = snapshot;
  persistChain = persistChain
    .then(async () => {
      // Newest snapshot wins: anything older is superseded and can be skipped.
      const bytes = pendingSnapshot;
      pendingSnapshot = null;
      if (!bytes) return;
      const idb = await openIDB();
      try {
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('storage', 'readwrite');
          tx.objectStore('storage').put(bytes, STORAGE_KEY);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error || new Error('[Cache] persist tx failed'));
          tx.onabort = () => reject(tx.error || new Error('[Cache] persist tx aborted'));
        });
      } finally {
        idb.close();
      }
    })
    .catch((err) => console.warn('[Cache] Failed to persist DB:', err));
  return persistChain;
}

/**
 * Normalise whatever IndexedDB hands back into a byte array. Older builds
 * stored a Blob, current ones a Uint8Array — both must load or the whole
 * cache looks empty after an upgrade.
 *
 * Deliberately duck-typed: IndexedDB returns objects built by the browser's
 * structured-clone implementation, and `saved instanceof Uint8Array` is false
 * for them whenever the value crosses a realm (workers, jsdom, some engines),
 * which would silently discard a perfectly good snapshot.
 */
async function toBytes(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const hasByteLength = typeof saved.byteLength === 'number';
  if (hasByteLength && typeof saved.length === 'number') {
    // Typed array (any realm): copy so we never hold a view on a shared buffer.
    return new Uint8Array(saved);
  }
  if (hasByteLength) {
    // Plain ArrayBuffer.
    return new Uint8Array(saved);
  }
  if (typeof saved.arrayBuffer === 'function') {
    // Legacy Blob snapshots written before the switch to byte arrays.
    return new Uint8Array(await saved.arrayBuffer());
  }
  console.warn('[Cache] Unrecognised saved-DB format:', saved?.constructor?.name);
  return null;
}

/**
 * Load the SQLite database bytes from IndexedDB.
 * Never throws — a missing or unreadable snapshot simply means "no cache".
 */
async function loadDB() {
  let idb;
  try {
    idb = await openIDB();
    const saved = await new Promise((resolve) => {
      try {
        const tx = idb.transaction('storage', 'readonly');
        const getReq = tx.objectStore('storage').get(STORAGE_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return await toBytes(saved);
  } catch (err) {
    console.warn('[Cache] Failed to read saved DB:', err);
    return null;
  } finally {
    idb?.close();
  }
}

/**
 * Build the SQLite database: load the persisted snapshot when there is one,
 * then (re-)apply the schema so tables added by newer builds exist.
 */
async function createDB({ fresh = false } = {}) {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => `/sql-wasm.wasm`,
    });
  }

  let db = null;
  if (!fresh) {
    const bytes = await loadDB();
    if (bytes) {
      try {
        db = new SQL.Database(bytes);
      } catch (err) {
        console.warn('[Cache] Saved DB snapshot is unreadable — starting fresh:', err);
        db = null;
      }
    }
  }
  if (!db) db = new SQL.Database();

  db.run(SCHEMA_SQL);
  return db;
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
    dbPromise = createDB()
      .catch(async (err) => {
        // A failed open must not be cached as a permanent rejection: the old
        // code memoised the rejected promise, so one transient hiccup (a
        // corrupt snapshot, a blocked IndexedDB handle) disabled every read
        // AND write for the rest of the session — offline mutations were then
        // queued fine but never rendered, because their cache write failed.
        console.error('[Cache] DB open failed, recreating an empty database:', err);
        return createDB({ fresh: true });
      })
      .then(async (db) => {
        persistDB(db);
        return db;
      })
      .catch((err) => {
        // Even the rebuild failed — drop the memo so the next call retries.
        dbPromise = null;
        throw err;
      });
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
 * Delete several cached entries in one batch and notify each affected
 * subscriber EXACTLY ONCE, no matter how many of the deleted keys it watches.
 *
 * Why this exists: `cacheDelete` emits synchronously on every call, so a single
 * SSE `entry_parsed` event that invalidates ENTRIES + ALL_ENTRIES + PROJECTS
 * fans out into 2-4 independent `loadData()` runs in any page subscribed to
 * more than one of those stores. Those overlapping reloads each bump their own
 * sequence and each fire a force-sync, and it is precisely that concurrency that
 * lets a slower, earlier fetch land in IndexedDB after a newer one and clobber
 * fresh data with a stale snapshot (the "data disappears randomly" symptom).
 *
 * Here every row is deleted first and the DB persisted once, THEN we resolve the
 * UNIQUE set of subscriber callbacks across all keys and invoke each a single
 * time. The dedup key is the callback identity, not the store — so a page that
 * registers the SAME reload function on several stores is reloaded once per
 * batch, which is what collapses the fan-out.
 *
 * @param {Array<{store: string, key: string}>} pairs - store/key rows to delete
 * @returns {Promise<void>}
 */
export async function cacheDeleteMany(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return;
  const notify = new Set(); // unique subscriber callbacks across every key
  try {
    const db = await getDB();
    for (const { store, key } of pairs) {
      if (!store || !key) continue;
      db.run(`DELETE FROM ${store} WHERE key = ?`, [key]);
      db.run(`DELETE FROM cache_meta WHERE key = ?`, [key]);
      const subs = listeners.get(`${store}:${key}`);
      if (subs) subs.forEach((cb) => notify.add(cb));
    }
    persistDB(db);
  } catch (err) {
    console.warn('[Cache] Failed to batch-delete:', err);
    return;
  }
  // One notification per unique subscriber, mirroring cacheDelete's null payload.
  notify.forEach((cb) => {
    try {
      cb(null);
    } catch (e) {
      console.warn('[Cache] Subscriber error:', e);
    }
  });
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
    const tables = [
      TABLES.PROJECTS,
      TABLES.ENTRIES,
      TABLES.ALL_ENTRIES,
      TABLES.PROFILE,
      TABLES.SEARCH,
      TABLES.ARCHIVES,
      TABLES.FIELDS,
      TABLES.ACTIVITY,
    ];
    // Keys come in two shapes: the bare email (projects/profile) and
    // `email:sub-key` (per-project entries, `email:due-soon`, field lists).
    // Matching only the bare email used to leave every other account's
    // per-project data readable on a shared device after sign-out.
    for (const table of tables) {
      db.run(`DELETE FROM ${table} WHERE key = ? OR key LIKE ?`, [email, `${email}:%`]);
    }
    // Notes are keyed by entry id, so match on the owner stored inside the row.
    try {
      db.run(
        `DELETE FROM ${TABLES.NOTES}
         WHERE EXISTS (
           SELECT 1 FROM json_each(json_extract(${TABLES.NOTES}.data, '$.data'))
           WHERE json_extract(value, '$.email') = ?
         )`,
        [email]
      );
    } catch (err) {
      console.warn('[Cache] Could not clear notes for user:', err);
    }
    db.run(`DELETE FROM ${TABLES.CACHE_META} WHERE key = ? OR key LIKE ?`, [email, `${email}:%`]);

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
