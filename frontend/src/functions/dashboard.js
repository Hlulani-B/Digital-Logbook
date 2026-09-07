import { cacheGet, CACHE_STORES } from '@/lib/cache';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Returns entry rows whose due_date falls within the next 3 days
 * (inclusive of today, exclusive of anything past 3 days out).
 * Entries with no due_date are excluded.
 *
 * Local-first: reads from IndexedDB cache. No server call.
 * Falls back to getUnarchived only if cache is empty.
 */
export async function dueSoon(user_email, project_name) {
  // 1. Try to compute from cached entries (instant, no server call)
  try {
    const cacheKey = project_name
      ? `${user_email}:${project_name}`
      : user_email;
    const store = project_name ? CACHE_STORES.ENTRIES : CACHE_STORES.ALL_ENTRIES;
    const cached = await cacheGet(store, cacheKey);

    if (cached?.data && Array.isArray(cached.data)) {
      return { success: true, data: filterDueSoon(cached.data) };
    }
  } catch (err) {
    console.warn('[dueSoon] Cache read failed, falling back to server:', err);
  }

  // 2. Fallback: fetch from server if no cache
  const { getUnarchived } = await import('./project/archives.js');
  let result;
  try {
    result = await getUnarchived(user_email, project_name);
  } catch (err) {
    console.error('[dueSoon] Failed to fetch entries:', err);
    return { success: false, message: err.message || 'Failed to fetch entries', data: [] };
  }

  const data = result?.data || [];
  return { success: true, data: filterDueSoon(data) };
}

/**
 * Filter entries to only those due within the next 3 days.
 */
function filterDueSoon(data) {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * MS_PER_DAY);

  return data.filter((entry) => {
    if (!entry.due_date) return false;
    const due = new Date(entry.due_date);
    if (isNaN(due.getTime())) return false;
    return due >= now && due <= threeDaysFromNow;
  });
}
