/**
 * CacheFunctions — Central data synchronization module.
 *
 * Local-first architecture:
 * - syncAllData(email) fetches ALL data from server → populates IndexedDB
 * - Pages read ONLY from IndexedDB (no direct server calls)
 * - Mutations write IndexedDB first (instant UI) → then sync to server
 * - Offline actions are queued in IndexedDB and synced when connectivity returns
 *
 * @module CacheFunctions
 */

export {
  syncAllData,
  syncProjectEntries,
  computeDueSoon,
  getLastSyncTime,
  isSyncing,
} from './syncService';

export {
  addToQueue,
  getQueue,
  removeFromQueue,
  clearQueue,
  getQueueLength,
} from './offlineQueue';

export { processQueue, hasPendingActions, getPendingCount } from './queueProcessor';
export { dispatchAction, getRegisteredActions } from './actionDispatcher';
