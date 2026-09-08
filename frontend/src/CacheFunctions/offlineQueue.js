/**
 * Offline Queue Manager
 * 
 * Manages the queue of offline actions that need to be synced
 * when connectivity is restored. Actions are stored in IndexedDB
 * and processed in FIFO order when online.
 */

import { CACHE_STORES } from '../lib/cache';
import { openDB } from 'idb';

const DB_NAME = 'digital-logbook-cache';
const DB_VERSION = 4;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains(CACHE_STORES.OFFLINE_QUEUE)) {
            db.createObjectStore(CACHE_STORES.OFFLINE_QUEUE, {
              keyPath: 'id',
              autoIncrement: true,
            });
          }
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Add an action to the offline queue.
 * @param {string} action - Action name (e.g., 'addEntry', 'updateProject')
 * @param {string} module - Module name (e.g., 'entries', 'project')
 * @param {object} payload - Action payload (function arguments)
 * @returns {Promise<number>} The queue entry ID
 */
export async function addToQueue(action, module, payload) {
  try {
    const db = await getDB();
    const entry = {
      action,
      module,
      payload,
      timestamp: Date.now(),
      attempts: 0,
    };
    const id = await db.add(CACHE_STORES.OFFLINE_QUEUE, entry);
    console.log(`[OfflineQueue] Queued action: ${action} (id: ${id})`);
    return id;
  } catch (err) {
    console.error('[OfflineQueue] Failed to add to queue:', err);
    throw err;
  }
}

/**
 * Get all pending actions from the queue, ordered by timestamp (FIFO).
 * @returns {Promise<Array>} Array of queue entries
 */
export async function getQueue() {
  try {
    const db = await getDB();
    const entries = await db.getAll(CACHE_STORES.OFFLINE_QUEUE);
    // Sort by timestamp (oldest first)
    return entries.sort((a, b) => a.timestamp - b.timestamp);
  } catch (err) {
    console.error('[OfflineQueue] Failed to get queue:', err);
    return [];
  }
}

/**
 * Get a single queue entry by ID.
 * @param {number} id - Queue entry ID
 * @returns {Promise<object|null>} The queue entry or null
 */
export async function getQueueEntry(id) {
  try {
    const db = await getDB();
    return await db.get(CACHE_STORES.OFFLINE_QUEUE, id);
  } catch (err) {
    console.error('[OfflineQueue] Failed to get queue entry:', err);
    return null;
  }
}

/**
 * Remove an action from the queue (after successful sync).
 * @param {number} id - Queue entry ID
 * @returns {Promise<void>}
 */
export async function removeFromQueue(id) {
  try {
    const db = await getDB();
    await db.delete(CACHE_STORES.OFFLINE_QUEUE, id);
    console.log(`[OfflineQueue] Removed action from queue (id: ${id})`);
  } catch (err) {
    console.error('[OfflineQueue] Failed to remove from queue:', err);
  }
}

/**
 * Update a queue entry (e.g., increment attempts counter).
 * @param {object} entry - The queue entry to update
 * @returns {Promise<void>}
 */
export async function updateQueueEntry(entry) {
  try {
    const db = await getDB();
    await db.put(CACHE_STORES.OFFLINE_QUEUE, entry);
  } catch (err) {
    console.error('[OfflineQueue] Failed to update queue entry:', err);
  }
}

/**
 * Clear all entries from the queue (for testing).
 * @returns {Promise<void>}
 */
export async function clearQueue() {
  try {
    const db = await getDB();
    await db.clear(CACHE_STORES.OFFLINE_QUEUE);
    console.log('[OfflineQueue] Queue cleared');
  } catch (err) {
    console.error('[OfflineQueue] Failed to clear queue:', err);
  }
}

/**
 * Get the number of pending actions in the queue.
 * @returns {Promise<number>} Number of pending actions
 */
export async function getQueueLength() {
  try {
    const db = await getDB();
    return await db.count(CACHE_STORES.OFFLINE_QUEUE);
  } catch (err) {
    console.error('[OfflineQueue] Failed to get queue length:', err);
    return 0;
  }
}
