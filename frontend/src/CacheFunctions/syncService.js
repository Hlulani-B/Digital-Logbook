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
 * IndexedDB stores (mirrors database schema):
 *   - projects     → all user projects
 *   - all-entries  → all entries across all projects
 *   - entries      → per-project entries (key: email:projectName)
 *   - profile      → user profile
 *   - archives     → archived entries and projects
 *   - fields       → custom fields per table
 */

import { getProjectsByEmail } from '@/functions/project/project.js';
import { getAllEntries, sortUnarchivedEntries } from '@/functions/project/entries.js';
import { getProfile } from '@/functions/profile/profile.js';
import { getArchives, getArchivedProjects, getUnarchivedProjects } from '@/functions/project/archives.js';
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

  // ── 1. Projects ──────────────────────────────────────────────
  try {
    const result = await getProjectsByEmail(email);
    if (result?.success || result?.projects) {
      const projects = result.projects || [];
      await cacheSet(CACHE_STORES.PROJECTS, email, { success: true, data: projects });
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
    if (result?.success || result?.data) {
      const entries = result.data || [];
      await cacheSet(CACHE_STORES.ALL_ENTRIES, email, { success: true, data: entries });
      summary.synced.push('all-entries');
      onProgress?.({ store: 'all-entries', data: entries });

      // Also populate per-project entry caches from the all-entries data
      const byProject = new Map();
      for (const entry of entries) {
        const pn = entry.project_name;
        if (!pn) continue;
        if (!byProject.has(pn)) byProject.set(pn, []);
        byProject.get(pn).push(entry);
      }
      for (const [projectName, projectEntries] of byProject) {
        await cacheSet(CACHE_STORES.ENTRIES, `${email}:${projectName}`, {
          success: true,
          data: projectEntries,
        });
      }
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

  // ── 4. Archives ──────────────────────────────────────────────
  try {
    const [archivesResult, archivedProjectsResult, unarchivedProjectsResult] =
      await Promise.allSettled([
        getArchives(email, null),
        getArchivedProjects(email),
        getUnarchivedProjects(email),
      ]);

    if (archivesResult.status === 'fulfilled' && archivesResult.value?.success) {
      await cacheSet(CACHE_STORES.ARCHIVES, `${email}:all`, archivesResult.value);
      summary.synced.push('archives');
      onProgress?.({ store: 'archives', data: archivesResult.value });
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

  // ── 5. Due-soon (computed from cached entries, no server call) ──
  try {
    const cachedEntries = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
    if (cachedEntries?.data && Array.isArray(cachedEntries.data)) {
      const dueSoonEntries = computeDueSoon(cachedEntries.data);
      await cacheSet(CACHE_STORES.ENTRIES, `${email}:due-soon`, {
        success: true,
        data: dueSoonEntries,
      });
      summary.synced.push('due-soon');
      onProgress?.({ store: 'due-soon', data: dueSoonEntries });
    }
  } catch (err) {
    console.error('[syncService] Failed to compute due-soon:', err);
    summary.errors.push({ store: 'due-soon', message: err.message });
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
 *
 * @param {string} email - User's email
 * @param {string} projectName - Project name
 */
export async function syncProjectEntries(email, projectName) {
  if (!email || !projectName) return;
  try {
    const result = await sortUnarchivedEntries(email, projectName, 0);
    if (result?.success || result?.data) {
      const entries = result.data || [];
      await cacheSet(CACHE_STORES.ENTRIES, `${email}:${projectName}`, {
        success: true,
        data: entries,
      });
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
