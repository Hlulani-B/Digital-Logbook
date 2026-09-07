/**
 * CacheFunctions — Central data synchronization module.
 *
 * Local-first architecture:
 * - syncAllData(email) fetches ALL data from server → populates IndexedDB
 * - Pages read ONLY from IndexedDB (no direct server calls)
 * - Mutations write IndexedDB first (instant UI) → then sync to server
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
