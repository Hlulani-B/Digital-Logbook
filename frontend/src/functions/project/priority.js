import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';
import { addToQueue } from '@/CacheFunctions/offlineQueue';

/**
 * Set priority on an entry.
 * Writes to IndexedDB first (instant UI), then syncs to server.
 * Rolls back on server failure.
 */
export async function setPriority(user_email, priorityValue, project_name, entry_id) {
  const cacheKey = `${user_email}:${project_name}`;

  // 1. Save pre-update cache for rollback
  const cachedBefore = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
  const cachedAllBefore = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);

  // 2. Optimistic: update priority in IndexedDB immediately
  function patchPriority(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.map((e) => {
      if (e.id === entry_id || e.id?.toString() === entry_id?.toString()) {
        return { ...e, priority: priorityValue };
      }
      return e;
    });
  }

  if (cachedBefore) {
    const currentData = cachedBefore.data || cachedBefore;
    await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: patchPriority(currentData) });
  }
  if (cachedAllBefore) {
    const currentAll = cachedAllBefore.data || cachedAllBefore;
    await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: patchPriority(currentAll) });
  }

  // 3. Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[setPriority] Offline, queuing action');
    await addToQueue('setPriority', 'priority', {
      user_email,
      priorityValue,
      project_name,
      entry_id,
    });
    return { success: true, queued: true };
  }

  // 4. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/priority`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'set',
        values: { user_email, priorityValue, project_name, entry_id },
      }),
    });
    return result;
  } catch (err) {
    // 5. On failure, queue for retry (don't rollback)
    console.error('[setPriority] Server sync failed, queuing for retry:', err);
    await addToQueue('setPriority', 'priority', {
      user_email,
      priorityValue,
      project_name,
      entry_id,
    });
    return { success: true, queued: true };
  }
}
