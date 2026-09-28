import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';

/**
 * Fetch activities for a user.
 * Local-first: returns cached data immediately, refreshes from server in background.
 * Paginated requests (offset > 0) skip the cache and go straight to the server.
 *
 * @param {string} user_email
 * @param {number} [limit=50]
 * @param {number} [offset=0]
 * @returns {Promise<{success: boolean, data: array, has_more?: boolean}>}
 */
export async function getActivities(user_email, limit = 50, offset = 0) {
  const cacheKey = `${user_email}:activities`;
  const isPaginated = offset > 0;

  // Paginated requests skip cache — always go to server
  if (isPaginated) {
    return _fetchActivitiesFromServer(user_email, limit, cacheKey, offset);
  }

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
  return _fetchActivitiesFromServer(user_email, limit, cacheKey, offset);
}

/** Internal: fetch activities from server and write to cache */
async function _fetchActivitiesFromServer(user_email, limit, cacheKey, offset = 0) {
  try {
    const result = await request(`${PROJECT_URL}/service/activity`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getActivities',
        values: { user_email, limit, offset },
      }),
    });

    // Only cache the first page
    if (result?.success && offset === 0) {
      await cacheSet(CACHE_STORES.ACTIVITY, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[getActivities] Failed:', err);
    return { success: false, data: [], has_more: false };
  }
}

/** Internal: background refresh of activities from server */
function _refreshActivitiesFromServer(user_email, limit, cacheKey) {
  _fetchActivitiesFromServer(user_email, limit, cacheKey).catch(() => {});
}
