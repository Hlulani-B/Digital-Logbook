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
import { getAllEntries, sortUnarchivedEntries, sortArchivedEntries } from '@/functions/project/entries.js';
import { getArchives, getUnarchived, getArchivedProjects, getUnarchivedProjects } from '@/functions/project/archives.js';
import { getFields } from '@/functions/project/fields.js';
import { getProfile } from '@/functions/profile/profile.js';
import { getActivities } from '@/functions/activity.js';
// dueSoon and searchAll are computed locally from cached entries

// ── Pure compute functions (no server calls) ────────────────────
import { calculateTotalTimeTracked, calculateProjectStats } from '@/functions/dashboard/stats.js';
import { calculateStreaks } from '@/functions/dashboard/streaks.js';
import { getOverdueText } from '@/functions/dashboard/overdue.js';

// ── Cache layer ─────────────────────────────────────────────────
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache.js';

// Sentinel error used to skip cache writes when server returns empty but cache has data
class _SkipCache extends Error { constructor() { super('skip-cache'); } }

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

  // ── Parallel phase: fire ALL service calls at once ───────────
  // This triggers cold-starts on all 3 backend services simultaneously
  // instead of waiting for each one sequentially.
  const [
    projectsResult,
    allEntriesResult,
    profileResult,
    archivesResults,
    fieldsResults,
    activityResult,
  ] = await Promise.allSettled([
    // 1. Projects (project-service)
    getProjectsByEmail(email),
    // 2. All entries (project-service)
    getAllEntries(email),
    // 3. Profile (profile-service — separate cold start)
    getProfile(email),
    // 4. Archives (project-service, 4 calls in parallel)
    Promise.allSettled([
      getArchives(email, null),
      getUnarchived(email, null),
      getArchivedProjects(email),
      getUnarchivedProjects(email),
    ]),
    // 5. Fields (project-service, 2 calls in parallel)
    Promise.allSettled([
      getFields(email, 'entries'),
      getFields(email, 'projects'),
    ]),
    // 6. Activity log (dashboard-service — separate cold start)
    getActivities(email),
  ]);

  // ── Process results ──────────────────────────────────────────

  // 1. Projects
  try {
    if (projectsResult.status === 'fulfilled' && projectsResult.value?.success) {
      const projects = projectsResult.value.projects || projectsResult.value.data || [];
      // Guard: don't overwrite non-empty cache with empty server data
      if (projects.length === 0) {
        const existing = await cacheGet(CACHE_STORES.PROJECTS, email);
        const existingProjects = existing?.projects || existing?.data || [];
        if (Array.isArray(existingProjects) && existingProjects.length > 0) {
          console.warn('[syncService] Server returned 0 projects but cache has', existingProjects.length, '— keeping cache');
          projects.length > 0 || summary.synced.push('projects:skipped-empty');
          // Skip the cache write — fall through to the catch
          throw new _SkipCache();
        }
      }
      await cacheSet(CACHE_STORES.PROJECTS, email, { success: true, projects });
      summary.synced.push('projects');
      onProgress?.({ store: 'projects', data: projects });
    }
  } catch (err) {
    if (err instanceof _SkipCache) { /* intentional skip */ }
    else console.error('[syncService] Failed to cache projects:', err);
  }

  // 2. All entries + per-project split (no extra server calls!)
  try {
    if (allEntriesResult.status === 'fulfilled' && allEntriesResult.value?.success) {
      const entries = Array.isArray(allEntriesResult.value.data) ? allEntriesResult.value.data : [];

      // Guard: don't overwrite non-empty cache with empty server data.
      // This prevents the race where SSE deletes cache → loadData calls syncAllData
      // → server hasn't persisted yet → returns [] → clobbers good cache.
      if (entries.length === 0) {
        const existing = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
        const existingEntries = existing?.data || [];
        if (Array.isArray(existingEntries) && existingEntries.length > 0) {
          console.warn('[syncService] Server returned 0 entries but cache has', existingEntries.length, '— keeping cache');
          summary.synced.push('all-entries:skipped-empty');
          throw new _SkipCache();
        }
      }

      const enrichedEntries = entries.map((e) => ({
        ...e,
        overdue_text: getOverdueText(e.due_date, e.status),
      }));
      await cacheSet(CACHE_STORES.ALL_ENTRIES, email, { success: true, data: enrichedEntries });
      summary.synced.push('all-entries');
      onProgress?.({ store: 'all-entries', data: enrichedEntries });

      // Split all-entries into per-project caches (pure local, zero server calls)
      const projectNames = [...new Set(entries.map((e) => e.project_name).filter(Boolean))];
      for (const projectName of projectNames) {
        const projEntries = enrichedEntries.filter((e) => e.project_name === projectName);
        await cacheSet(CACHE_STORES.ENTRIES, `${email}:${projectName}`, {
          success: true,
          data: projEntries,
        });
      }
      summary.synced.push('per-project-entries');
    }
  } catch (err) {
    if (err instanceof _SkipCache) { /* intentional skip */ }
    else console.error('[syncService] Failed to cache entries:', err);
  }

  // 3. Profile
  try {
    if (profileResult.status === 'fulfilled' && profileResult.value?.success) {
      await cacheSet(CACHE_STORES.PROFILE, email, profileResult.value);
      summary.synced.push('profile');
      onProgress?.({ store: 'profile', data: profileResult.value });
    }
  } catch (err) {
    console.error('[syncService] Failed to cache profile:', err);
  }

  // 4. Archives
  try {
    if (archivesResults.status === 'fulfilled') {
      const [archivesResult, unarchivedResult, archivedProjectsResult, unarchivedProjectsResult] =
        archivesResults.value;
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
    }
  } catch (err) {
    console.error('[syncService] Failed to cache archives:', err);
  }

  // 5. Fields
  try {
    if (fieldsResults.status === 'fulfilled') {
      const fieldTables = ['entries', 'projects'];
      for (let i = 0; i < fieldTables.length; i++) {
        const fr = fieldsResults.value[i];
        if (fr.status === 'fulfilled' && fr.value?.success) {
          await cacheSet(CACHE_STORES.FIELDS, `${email}:${fieldTables[i]}`, fr.value);
          summary.synced.push(`fields:${fieldTables[i]}`);
        }
      }
    }
  } catch (err) {
    console.error('[syncService] Failed to cache fields:', err);
  }

  // 6. Activity log
  try {
    if (activityResult.status === 'fulfilled' && activityResult.value?.success) {
      await cacheSet('activity', email, activityResult.value);
      summary.synced.push('activity');
      onProgress?.({ store: 'activity', data: activityResult.value });
    }
  } catch (err) {
    console.error('[syncService] Failed to cache activity:', err);
  }

  // ── Post-sync: compute derived data from cache (pure local, no server) ──
  try {
    const cachedEntries = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
    if (cachedEntries?.data && Array.isArray(cachedEntries.data)) {
      const allEntries = cachedEntries.data;

      // Due-soon: compute from cached entries
      const dueSoonEntries = computeDueSoon(allEntries);
      await cacheSet(CACHE_STORES.ENTRIES, `${email}:due-soon`, {
        success: true,
        data: dueSoonEntries,
      });
      summary.synced.push('due-soon');
      onProgress?.({ store: 'due-soon', data: dueSoonEntries });

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
    console.error('[syncService] Failed to compute derived data:', err);
    summary.errors.push({ store: 'computed', message: err.message });
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
