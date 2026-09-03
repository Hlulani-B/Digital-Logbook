import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';

// ── GET functions ──────────────────────────────────────────────

/**
 * Fetch archives for a user/project.
 * Writes to IndexedDB, returns result for compatibility.
 */
export async function getArchives(user_email, project_name) {
  const cacheKey = project_name
    ? `${user_email}:${project_name}`
    : `${user_email}:all`;

  try {
    const result = await request(`${PROJECT_URL}/service/archive`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getArchives',
        values: { user_email, project_name: project_name || null },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ARCHIVES, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[getArchives] Failed:', err);
    return { success: false, data: [] };
  }
}

/**
 * Fetch unarchived entries.
 */
export async function getUnarchived(user_email, project_name) {
  const cacheKey = `unarchived:${user_email}:${project_name || 'all'}`;

  try {
    const result = await request(`${PROJECT_URL}/service/archive`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getUnarchived',
        values: { user_email, project_name: project_name || null },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ARCHIVES, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[getUnarchived] Failed:', err);
    return { success: false, data: [] };
  }
}

/**
 * Fetch archived projects.
 */
export async function getArchivedProjects(user_email) {
  const cacheKey = `archived-projects:${user_email}`;

  try {
    const result = await request(`${PROJECT_URL}/service/archive`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getArchivedProjects',
        values: { user_email },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ARCHIVES, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[getArchivedProjects] Failed:', err);
    return { success: false, data: [] };
  }
}

/**
 * Fetch unarchived projects.
 */
export async function getUnarchivedProjects(user_email) {
  const cacheKey = `unarchived-projects:${user_email}`;

  try {
    const result = await request(`${PROJECT_URL}/service/archive`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getUnarchivedProjects',
        values: { user_email },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ARCHIVES, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[getUnarchivedProjects] Failed:', err);
    return { success: false, data: [] };
  }
}

// ── POST functions — optimistic IndexedDB first ──────────────

/**
 * Archive a project.
 * Updates IndexedDB immediately, then syncs to server.
 */
export async function archiveProject(user_email, project_name) {
  // 1. Sync to server (archive is a state change, hard to do optimistic)
  try {
    const result = await request(`${PROJECT_URL}/service/archive`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'archive_project',
        values: { user_email, project_name },
      }),
    });

    // 2. On success, refresh caches
    if (result?.success) {
      // Re-fetch projects and archives to update caches
      const { getProjectsByEmail } = await import('./project.js');
      await getProjectsByEmail(user_email);
      await getArchivedProjects(user_email);
      await getUnarchivedProjects(user_email);
    }
    return result;
  } catch (err) {
    console.error('[archiveProject] Failed:', err);
    return { success: false, message: err.message || 'Failed to archive project' };
  }
}

/**
 * Unarchive a project.
 */
export async function unarchiveProject(user_email, project_name) {
  try {
    const result = await request(`${PROJECT_URL}/service/archive`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'unarchive_project',
        values: { user_email, project_name },
      }),
    });

    if (result?.success) {
      const { getProjectsByEmail } = await import('./project.js');
      await getProjectsByEmail(user_email);
      await getArchivedProjects(user_email);
      await getUnarchivedProjects(user_email);
    }
    return result;
  } catch (err) {
    console.error('[unarchiveProject] Failed:', err);
    return { success: false, message: err.message || 'Failed to unarchive project' };
  }
}

/**
 * Archive an entry.
 */
export async function archiveEntry(user_email, project_name, entry_id) {
  try {
    const result = await request(`${PROJECT_URL}/service/archive`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'archive_entry',
        values: { user_email, project_name, entry_id },
      }),
    });

    // Refresh entries cache on success
    if (result?.success) {
      const { getEntries } = await import('./entries.js');
      await getEntries(user_email, project_name);
    }
    return result;
  } catch (err) {
    console.error('[archiveEntry] Failed:', err);
    return { success: false, message: err.message || 'Failed to archive entry' };
  }
}

/**
 * Unarchive an entry.
 */
export async function unarchiveEntry(user_email, project_name, entry_id) {
  try {
    const result = await request(`${PROJECT_URL}/service/archive`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'unarchive_entry',
        values: { user_email, project_name, entry_id },
      }),
    });

    if (result?.success) {
      const { getEntries } = await import('./entries.js');
      await getEntries(user_email, project_name);
    }
    return result;
  } catch (err) {
    console.error('[unarchiveEntry] Failed:', err);
    return { success: false, message: err.message || 'Failed to unarchive entry' };
  }
}
