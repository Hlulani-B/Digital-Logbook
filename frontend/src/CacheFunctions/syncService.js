/**
 * syncService.js — Central data synchronization for local-first architecture.
 *
 * This module is the SINGLE source of truth for fetching data from the server
 * and populating IndexedDB. All pages read from IndexedDB only — they never
 * call server APIs directly.
 *
 * Flow:
 *   1. On app load (user login)  → syncAllData(email) warms up IndexedDB
 *   2. Pages read from IndexedDB → instant UI, no spinners
 *   3. Mutations write IndexedDB first (optimistic) → then sync to server
 *   4. syncAllData can be called again to refresh all data in background
 *
 * Uses every GET/compute function under frontend/src/functions/:
 *   project/project.js    → getProjectsByEmail
 *   project/entries.js    → getAllEntries, getEntries, sortUnarchivedEntries, sortArchivedEntries
 *   project/archives.js   → getArchives, getUnarchived, getArchivedProjects, getUnarchivedProjects
 *   project/fields.js     → getFields
 *   profile/profile.js    → getProfile
 *   activity.js           → getActivities
 *   dashboard.js          → dueSoon (cache-first due-soon computation)
 *   dashboard/stats.js    → calculateTotalTimeTracked, calculateProjectStats
 *   dashboard/streaks.js  → calculateStreaks
 *   dashboard/overdue.js  → getOverdueText (enriches entries with overdue info)
 *   dashboard/search.js   → searchAll (pre-warms global search cache)
 *
 * IndexedDB stores (mirrors database schema):
 *   - projects     → all user projects
 *   - all-entries  → all entries across all projects
 *   - entries      → per-project entries (key: email:projectName)
 *   - profile      → user profile
 *   - archives     → archived entries and projects
 *   - fields       → custom fields per table
 *   - search       → global search results
 *   - activity     → activity log
 */

// ── Server-fetch GET functions ──────────────────────────────────
import { getProjectsByEmail } from '@/functions/project/project.js';
import { getAllEntries, getEntries, sortUnarchivedEntries, sortArchivedEntries } from '@/functions/project/entries.js';
import { getArchives, getUnarchived, getArchivedProjects, getUnarchivedProjects } from '@/functions/project/archives.js';
import { getFields } from '@/functions/project/fields.js';
import { getProfile } from '@/functions/profile/profile.js';
import { getActivities } from '@/functions/activity.js';
import { dueSoon } from '@/functions/dashboard.js';
import { searchAll } from '@/functions/dashboard/search.js';

// ── Pure compute functions (no server calls) ────────────────────
import { calculateTotalTimeTracked, calculateProjectStats } from '@/functions/dashboard/stats.js';
import { calculateStreaks } from '@/functions/dashboard/streaks.js';
import { getOverdueText } from '@/functions/dashboard/overdue.js';

// ── Cache layer ─────────────────────────────────────────────────
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache.js';

// Track ongoing sync to prevent duplicate concurrent requests
let syncInProgress = null;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 10_000; // 10 seconds between full syncs

/**
 * Sync ALL user data from server → IndexedDB.
 *
 * This is the main entry point for populating the local cache.
 * Call this on app load and whenever you need a full refresh.
 *
 * @param {string} email - User's email address
 * @param {Object} [options]
 * @param {boolean} [options.force=false] - Force sync even if recently synced
 * @param {Function} [options.onProgress] - Called with { store, data } as each store syncs
 * @returns {Promise<Object>} Summary of what was synced
 */
export async function syncAllData(email, { force = false, onProgress } = {}) {
  if (!email) return { success: false, message: 'No email provided' };

  // Prevent duplicate concurrent syncs
  if (syncInProgress) return syncInProgress;

  // Throttle: skip if we synced recently (unless forced)
  if (!force && Date.now() - lastSyncTime < MIN_SYNC_INTERVAL) {
    return { success: true, message: 'Recently synced, skipping', skipped: true };
  }

  syncInProgress = _doSync(email, onProgress);
  try {
    const result = await syncInProgress;
    lastSyncTime = Date.now();
    return result;
  } finally {
    syncInProgress = null;
  }
}

/**
 * Internal: perform the actual sync.
 */
async function _doSync(email, onProgress) {
  const summary = {
    success: true,
    synced: [],
    errors: [],
    timestamp: Date.now(),
  };

  // If offline, skip all server requests — preserve existing cached data.
  // Compute all derived data (due-soon, stats, streaks) from what's already in cache.
  if (!navigator.onLine) {
    console.log('[syncService] Offline — skipping server requests, computing from cache');
    try {
      const cachedEntries = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
      if (cachedEntries?.data && Array.isArray(cachedEntries.data)) {
        const allEntries = cachedEntries.data;

        // Due-soon: compute from cache
        const dueSoonEntries = computeDueSoon(allEntries);
        await cacheSet(CACHE_STORES.ENTRIES, `${email}:due-soon`, {
          success: true,
          data: dueSoonEntries,
        });
        summary.synced.push('due-soon');
        onProgress?.({ store: 'due-soon', data: dueSoonEntries });

        // Stats: compute from cache
        const totalTime = calculateTotalTimeTracked(allEntries);
        const projectStats = calculateProjectStats(allEntries);
        await cacheSet(CACHE_STORES.SEARCH, `${email}:stats`, {
          success: true,
          data: { ...totalTime, projectStats },
        });
        summary.synced.push('stats');

        // Streaks: compute from cache
        const streaks = calculateStreaks(allEntries);
        await cacheSet(CACHE_STORES.SEARCH, `${email}:streaks`, {
          success: true,
          data: streaks,
        });
        summary.synced.push('streaks');
      }
    } catch (err) {
      console.error('[syncService] Failed to compute offline derived data:', err);
    }
    summary.offline = true;
    return summary;
  }

  // ── 1. Projects ──────────────────────────────────────────────
  try {
    const result = await getProjectsByEmail(email);
    if (result?.success && (result.projects || result.data)) {
      const projects = result.projects || result.data || [];
      await cacheSet(CACHE_STORES.PROJECTS, email, { success: true, projects });
      summary.synced.push('projects');
      onProgress?.({ store: 'projects', data: projects });
    }
  } catch (err) {
    console.error('[syncService] Failed to sync projects:', err);
    summary.errors.push({ store: 'projects', message: err.message });
  }

  // ── 2. All Entries ───────────────────────────────────────────
  try {
    const result = await getAllEntries(email);
    if (result?.success && result.data) {
      const entries = Array.isArray(result.data) ? result.data : [];

      // Enrich entries with overdue info (pure compute, no server call)
      const enrichedEntries = entries.map((e) => ({
        ...e,
        overdue_text: getOverdueText(e.due_date, e.status),
      }));

      await cacheSet(CACHE_STORES.ALL_ENTRIES, email, { success: true, data: enrichedEntries });
      summary.synced.push('all-entries');
      onProgress?.({ store: 'all-entries', data: enrichedEntries });

      // Also populate per-project entry caches using getEntries for each project
      const projectNames = [...new Set(entries.map((e) => e.project_name).filter(Boolean))];
      await Promise.allSettled(
        projectNames.map(async (projectName) => {
          try {
            const projResult = await getEntries(email, projectName);
            if (projResult?.success && projResult.data) {
              const projEntries = Array.isArray(projResult.data) ? projResult.data : [];
              const enriched = projEntries.map((e) => ({
                ...e,
                overdue_text: getOverdueText(e.due_date, e.status),
              }));
              await cacheSet(CACHE_STORES.ENTRIES, `${email}:${projectName}`, {
                success: true,
                data: enriched,
              });
            }
          } catch (err) {
            console.warn(`[syncService] Per-project getEntries failed for ${projectName}, using all-entries split`);
            // Fallback: split from all-entries data
            const projEntries = enrichedEntries.filter((e) => e.project_name === projectName);
            await cacheSet(CACHE_STORES.ENTRIES, `${email}:${projectName}`, {
              success: true,
              data: projEntries,
            });
          }
        })
      );
      summary.synced.push('per-project-entries');
    }
  } catch (err) {
    console.error('[syncService] Failed to sync all entries:', err);
    summary.errors.push({ store: 'all-entries', message: err.message });
  }

  // ── 3. Profile ───────────────────────────────────────────────
  try {
    const result = await getProfile(email);
    if (result?.success) {
      await cacheSet(CACHE_STORES.PROFILE, email, result);
      summary.synced.push('profile');
      onProgress?.({ store: 'profile', data: result });
    }
  } catch (err) {
    console.error('[syncService] Failed to sync profile:', err);
    summary.errors.push({ store: 'profile', message: err.message });
  }
  // ── 4. Archives (uses getArchives, getUnarchived, getArchivedProjects, getUnarchivedProjects) ──
  try {
    const [archivesResult, unarchivedResult, archivedProjectsResult, unarchivedProjectsResult] =
      await Promise.allSettled([
        getArchives(email, null),
        getUnarchived(email, null),
        getArchivedProjects(email),
        getUnarchivedProjects(email),
      ]);

    if (archivesResult.status === 'fulfilled' && archivesResult.value?.success) {
      await cacheSet(CACHE_STORES.ARCHIVES, `${email}:all`, archivesResult.value);
      summary.synced.push('archives');
      onProgress?.({ store: 'archives', data: archivesResult.value });
    }
    if (unarchivedResult.status === 'fulfilled' && unarchivedResult.value?.success) {
      await cacheSet(CACHE_STORES.ARCHIVES, `${email}:unarchived`, unarchivedResult.value);
      summary.synced.push('unarchived-entries');
    }
    if (archivedProjectsResult.status === 'fulfilled' && archivedProjectsResult.value?.success) {
      await cacheSet(CACHE_STORES.ARCHIVES, `archived-projects:${email}`, archivedProjectsResult.value);
      summary.synced.push('archived-projects');
    }
    if (unarchivedProjectsResult.status === 'fulfilled' && unarchivedProjectsResult.value?.success) {
      await cacheSet(CACHE_STORES.ARCHIVES, `unarchived-projects:${email}`, unarchivedProjectsResult.value);
      summary.synced.push('unarchived-projects');
    }
  } catch (err) {
    console.error('[syncService] Failed to sync archives:', err);
    summary.errors.push({ store: 'archives', message: err.message });
  }

  // ── 5. Custom Fields (uses getFields) ────────────────────────
  try {
    const fieldTables = ['entries', 'projects'];
    const fieldResults = await Promise.allSettled(
      fieldTables.map((table) => getFields(email, table))
    );
    for (let i = 0; i < fieldTables.length; i++) {
      if (fieldResults[i].status === 'fulfilled' && fieldResults[i].value?.success) {
        const cacheKey = `${email}:${fieldTables[i]}`;
        await cacheSet(CACHE_STORES.FIELDS, cacheKey, fieldResults[i].value);
        summary.synced.push(`fields:${fieldTables[i]}`);
      }
    }
  } catch (err) {
    console.error('[syncService] Failed to sync fields:', err);
    summary.errors.push({ store: 'fields', message: err.message });
  }

  // ── 6. Activity Log (uses getActivities) ─────────────────────
  try {
    const actResult = await getActivities(email);
    if (actResult?.success) {
      await cacheSet('activity', email, actResult);
      summary.synced.push('activity');
      onProgress?.({ store: 'activity', data: actResult });
    }
  } catch (err) {
    console.error('[syncService] Failed to sync activity log:', err);
    summary.errors.push({ store: 'activity', message: err.message });
  }

  // ── 7. Due-soon (uses dueSoon from dashboard.js — cache-first) ──
  try {
    const dueSoonResult = await dueSoon(email);
    if (dueSoonResult?.success && dueSoonResult.data) {
      await cacheSet(CACHE_STORES.ENTRIES, `${email}:due-soon`, {
        success: true,
        data: dueSoonResult.data,
      });
      summary.synced.push('due-soon');
      onProgress?.({ store: 'due-soon', data: dueSoonResult.data });
    }
  } catch (err) {
    console.error('[syncService] Failed to compute due-soon:', err);
    summary.errors.push({ store: 'due-soon', message: err.message });
  }

  // ── 8. Computed stats from cached entries (pure compute, no server) ──
  try {
    const cachedEntries = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
    if (cachedEntries?.data && Array.isArray(cachedEntries.data)) {
      const allEntries = cachedEntries.data;

      // Stats: total time tracked + per-project breakdown
      const totalTime = calculateTotalTimeTracked(allEntries);
      const projectStats = calculateProjectStats(allEntries);
      await cacheSet(CACHE_STORES.SEARCH, `${email}:stats`, {
        success: true,
        data: { ...totalTime, projectStats },
      });
      summary.synced.push('stats');

      // Streaks: current + longest streak
      const streaks = calculateStreaks(allEntries);
      await cacheSet(CACHE_STORES.SEARCH, `${email}:streaks`, {
        success: true,
        data: streaks,
      });
      summary.synced.push('streaks');
    }
  } catch (err) {
    console.error('[syncService] Failed to compute stats/streaks:', err);
    summary.errors.push({ store: 'computed', message: err.message });
  }

  // ── 9. Pre-warm global search cache (uses searchAll from dashboard/search.js) ──
  // searchAll requires a keyword — it's available for on-demand search pages.
  // We pre-warm with a broad wildcard to cache initial results.
  try {
    const searchResult = await searchAll(email, ' ');
    if (searchResult?.success) {
      await cacheSet(CACHE_STORES.SEARCH, `${email}:global`, searchResult);
      summary.synced.push('search');
    }
  } catch (err) {
    // Search pre-warm is best-effort — don't add to errors
    console.warn('[syncService] Search pre-warm skipped:', err.message);
  }

  summary.success = summary.errors.length === 0;
  return summary;
}

/**
 * Compute due-soon entries from a list of all entries.
 * Due-soon = due_date within the next 3 days (inclusive of today).
 *
 * @param {Array} entries - All entries
 * @returns {Array} Entries due within 3 days
 */
export function computeDueSoon(entries) {
  if (!Array.isArray(entries)) return [];
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  return entries.filter((entry) => {
    if (!entry.due_date) return false;
    const due = new Date(entry.due_date);
    if (isNaN(due.getTime())) return false;
    return due >= now && due <= threeDaysFromNow;
  });
}

/**
 * Sync a single project's entries from server → IndexedDB.
 * Use this when navigating to a specific project detail page.
 * Uses sortUnarchivedEntries for sorted data and getEntries for raw data.
 *
 * @param {string} email - User's email
 * @param {string} projectName - Project name
 */
export async function syncProjectEntries(email, projectName) {
  if (!email || !projectName) return;
  try {
    // Fetch sorted unarchived entries (for display)
    const sortedResult = await sortUnarchivedEntries(email, projectName, 0);
    if (sortedResult?.success && sortedResult.data) {
      const entries = Array.isArray(sortedResult.data) ? sortedResult.data : [];
      const enriched = entries.map((e) => ({
        ...e,
        overdue_text: getOverdueText(e.due_date, e.status),
      }));
      await cacheSet(CACHE_STORES.ENTRIES, `${email}:${projectName}`, {
        success: true,
        data: enriched,
      });
    }

    // Also fetch archived entries for this project (for archive view)
    try {
      const archivedResult = await sortArchivedEntries(email, projectName, 0);
      if (archivedResult?.success && archivedResult.data) {
        await cacheSet(CACHE_STORES.ENTRIES, `${email}:${projectName}:archived`, {
          success: true,
          data: archivedResult.data,
        });
      }
    } catch (archErr) {
      console.warn(`[syncService] Failed to sync archived entries for ${projectName}:`, archErr);
    }
  } catch (err) {
    console.error(`[syncService] Failed to sync entries for ${projectName}:`, err);
  }
}

/**
 * Get the timestamp of the last successful full sync.
 * @returns {number} Timestamp in ms, or 0 if never synced.
 */
export function getLastSyncTime() {
  return lastSyncTime;
}

/**
 * Check if a sync is currently in progress.
 * @returns {boolean}
 */
export function isSyncing() {
  return syncInProgress !== null;
}
