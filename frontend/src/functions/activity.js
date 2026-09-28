import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';

/**
 * Fetch activities for a user.
 * Local-first: returns cached data immediately, refreshes from server in background.
 * @param {string} user_email
 * @param {number} [limit=50]
 * @param {string|string[]|null} [action_type] - optional filter by action type(s)
 */
export async function getActivities(user_email, limit = 50, action_type = null) {
  const cacheKey = action_type
    ? `${user_email}:activities:${Array.isArray(action_type) ? action_type.join(',') : action_type}`
    : `${user_email}:activities`;

  // 1. Return cached data first (instant)
  const cached = await cacheGet(CACHE_STORES.ACTIVITY, cacheKey);
  if (cached?.success && Array.isArray(cached.data)) {
    // Refresh from server in background (don't block the caller)
    if (navigator.onLine) {
      _refreshActivitiesFromServer(user_email, limit, cacheKey, action_type);
    }
    return { ...cached, _fromCache: true };
  }

  // 2. No cache — must wait for server
  if (!navigator.onLine) {
    console.log('[getActivities] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

  console.log('[getActivities] No cache, fetching from server...');
  return _fetchActivitiesFromServer(user_email, limit, cacheKey, action_type);
}

/** Internal: fetch activities from server and write to cache */
async function _fetchActivitiesFromServer(user_email, limit, cacheKey, action_type) {
  try {
    const values = { user_email, limit };
    if (action_type) values.action_type = action_type;

    const result = await request(`${PROJECT_URL}/service/activity`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getActivities',
        values,
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
function _refreshActivitiesFromServer(user_email, limit, cacheKey, action_type) {
  _fetchActivitiesFromServer(user_email, limit, cacheKey, action_type).catch(() => {});
}
