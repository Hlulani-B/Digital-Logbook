import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';

/**
 * Fetch activities for a user.
 * Cache-first: reads from IndexedDB, falls back to server.
 */
export async function getActivities(user_email, limit = 50) {
  const cacheKey = `${user_email}:activities`;

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.ACTIVITY, cacheKey);
    if (cached) {
      console.log('[getActivities] Offline — serving from cache');
      return cached;
    }
    console.log('[getActivities] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

  try {
    const result = await request(`${PROJECT_URL}/service/activity`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getActivities',
        values: { user_email, limit },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ACTIVITY, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[getActivities] Failed:', err);
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.ACTIVITY, cacheKey);
    if (cached) {
      console.log('[getActivities] Server failed — serving from cache');
      return cached;
    }
    return { success: false, data: [] };
  }
}
