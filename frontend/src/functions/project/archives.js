import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';
import { addToQueue } from '@/CacheFunctions/offlineQueue';

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
 * Archive a project (and all its entries).
 * Updates IndexedDB immediately, then syncs to server.
 */
export async function archiveProject(user_email, project_name) {
  // Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[archiveProject] Offline, queuing action');
    await addToQueue('archiveProject', 'archives', {
      user_email,
      project_name,
    });
    return { success: true, queued: true };
  }

  // Online: sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/archive`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'archive_project',
        values: { user_email, project_name },
      }),
    });

    // On success, refresh caches
    if (result?.success) {
      // Re-fetch projects and archives to update caches
      const { getProjectsByEmail } = await import('./project.js');
      await getProjectsByEmail(user_email);
      await getArchivedProjects(user_email);
      await getUnarchivedProjects(user_email);
      // Also refresh entries and archives for this project
      const { getEntries } = await import('./entries.js');
      await getEntries(user_email, project_name);
      await getArchives(user_email, project_name);
      await getUnarchived(user_email, project_name);
    }
    return result;
  } catch (err) {
    // On failure, queue for retry
    console.error('[archiveProject] Failed, queuing for retry:', err);
    await addToQueue('archiveProject', 'archives', {
      user_email,
      project_name,
    });
    return { success: true, queued: true };
  }
}

/**
 * Unarchive a project (and all its entries).
 */
export async function unarchiveProject(user_email, project_name) {
  // Check online status
  if (!navigator.onLine) {
    console.log('[unarchiveProject] Offline, queuing action');
    await addToQueue('unarchiveProject', 'archives', {
      user_email,
      project_name,
    });
    return { success: true, queued: true };
  }

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
      const { getEntries } = await import('./entries.js');
      await getEntries(user_email, project_name);
      await getArchives(user_email, project_name);
      await getUnarchived(user_email, project_name);
    }
    return result;
  } catch (err) {
    console.error('[unarchiveProject] Failed, queuing for retry:', err);
    await addToQueue('unarchiveProject', 'archives', {
      user_email,
      project_name,
    });
    return { success: true, queued: true };
  }
}

/**
 * Archive an entry.
 */
export async function archiveEntry(user_email, project_name, entry_id) {
  // Check online status
  if (!navigator.onLine) {
    console.log('[archiveEntry] Offline, queuing action');
    await addToQueue('archiveEntry', 'archives', {
      user_email,
      project_name,
      entry_id,
    });
    return { success: true, queued: true };
  }

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
    console.error('[archiveEntry] Failed, queuing for retry:', err);
    await addToQueue('archiveEntry', 'archives', {
      user_email,
      project_name,
      entry_id,
    });
    return { success: true, queued: true };
  }
}

/**
 * Unarchive an entry.
 */
export async function unarchiveEntry(user_email, project_name, entry_id) {
  // Check online status
  if (!navigator.onLine) {
    console.log('[unarchiveEntry] Offline, queuing action');
    await addToQueue('unarchiveEntry', 'archives', {
      user_email,
      project_name,
      entry_id,
    });
    return { success: true, queued: true };
  }

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
    console.error('[unarchiveEntry] Failed, queuing for retry:', err);
    await addToQueue('unarchiveEntry', 'archives', {
      user_email,
      project_name,
      entry_id,
    });
    return { success: true, queued: true };
  }
}
