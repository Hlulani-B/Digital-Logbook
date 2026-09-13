import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';

/**
 * Fetch activities for a user.
 * Local-first: returns cached data immediately, refreshes from server in background.
 */
export async function getActivities(user_email, limit = 50) {
  const cacheKey = `${user_email}:activities`;

  // 1. Return cached data first (instant)
  const cached = await cacheGet(CACHE_STORES.ACTIVITY, cacheKey);
  if (cached?.success && Array.isArray(cached.data)) {
    // Refresh from server in background (don't block the caller)
    if (navigator.onLine) {
      _refreshActivitiesFromServer(user_email, limit, cacheKey);
    }
    return { ...cached, _fromCache: true };
  }

  // 2. No cache — must wait for server
  if (!navigator.onLine) {
    console.log('[getActivities] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

  console.log('[getActivities] No cache, fetching from server...');
  return _fetchActivitiesFromServer(user_email, limit, cacheKey);
}

/** Internal: fetch activities from server and write to cache */
async function _fetchActivitiesFromServer(user_email, limit, cacheKey) {
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
    return { success: false, data: [] };
  }
}

/** Internal: background refresh of activities from server */
function _refreshActivitiesFromServer(user_email, limit, cacheKey) {
  _fetchActivitiesFromServer(user_email, limit, cacheKey).catch(() => {});
}
