/**
 * Offline Queue Manager
 * 
 * Manages the queue of offline actions that need to be synced
 * when connectivity is restored. Actions are stored in SQLite
 * and processed in FIFO order when online.
 */

import { CACHE_STORES } from '../lib/cache';

// Import getDB from cache - we'll add this export
import { getSharedDB, persistDB } from '../lib/cache';

/**
 * Add an action to the offline queue.
 * @param {string} action - Action name (e.g., 'addEntry', 'updateProject')
 * @param {string} module - Module name (e.g., 'entries', 'project')
 * @param {object} payload - Action payload (function arguments)
 * @returns {Promise<number>} The queue entry ID
 */
export async function addToQueue(action, module, payload) {
  try {
    const db = await getSharedDB();
    const entry = {
      action,
      module,
      payload,
      timestamp: Date.now(),
      attempts: 0,
    };
    const jsonStr = JSON.stringify(entry);
    db.run(`INSERT INTO ${CACHE_STORES.OFFLINE_QUEUE} (data, created_at) VALUES (?, ?)`, [jsonStr, entry.timestamp]);
    persistDB(db);
    
    // Get the last inserted ID
    const result = db.exec(`SELECT last_insert_rowid()`);
    const id = result[0]?.values[0][0];
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
    const db = await getSharedDB();
    const result = db.exec(`SELECT id, data FROM ${CACHE_STORES.OFFLINE_QUEUE} ORDER BY created_at ASC`);
    if (result.length === 0) return [];
    return result[0].values.map(([id, data]) => ({
      id,
      ...JSON.parse(data)
    }));
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
    const db = await getSharedDB();
    const result = db.exec(`SELECT id, data FROM ${CACHE_STORES.OFFLINE_QUEUE} WHERE id = ?`, [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    const [entryId, data] = result[0].values[0];
    return { id: entryId, ...JSON.parse(data) };
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
    const db = await getSharedDB();
    db.run(`DELETE FROM ${CACHE_STORES.OFFLINE_QUEUE} WHERE id = ?`, [id]);
    persistDB(db);
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
    const db = await getSharedDB();
    const { id, ...rest } = entry;
    const jsonStr = JSON.stringify(rest);
    db.run(`UPDATE ${CACHE_STORES.OFFLINE_QUEUE} SET data = ? WHERE id = ?`, [jsonStr, id]);
    persistDB(db);
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
    const db = await getSharedDB();
    db.run(`DELETE FROM ${CACHE_STORES.OFFLINE_QUEUE}`);
    persistDB(db);
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
    const db = await getSharedDB();
    const result = db.exec(`SELECT COUNT(*) FROM ${CACHE_STORES.OFFLINE_QUEUE}`);
    return result[0]?.values[0][0] || 0;
  } catch (err) {
    console.error('[OfflineQueue] Failed to get queue length:', err);
    return 0;
  }
}
