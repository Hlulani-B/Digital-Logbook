import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';
import { addToQueue } from '@/CacheFunctions/offlineQueue';

// ── GET functions ──────────────────────────────────────────────

/**
 * Fetch all projects for a user.
 * Cache-first: reads from IndexedDB, falls back to server.
 * Guard: never overwrites non-empty cache with empty server data.
 */
export async function getProjectsByEmail(user_email) {
  console.log('[getProjectsByEmail] called for', user_email);

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.PROJECTS, user_email);
    if (cached) {
      console.log('[getProjectsByEmail] Offline — serving from cache');
      return cached;
    }
    console.log('[getProjectsByEmail] Offline and no cache');
    return { success: false, offline: true, projects: [] };
  }

  try {
    const result = await request(`${PROJECT_URL}/service/project`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getProjects',
        values: { user_email },
      }),
    });
    console.log('[getProjectsByEmail] server returned:', result?.success, Array.isArray(result?.projects || result?.data) ? `len=${(result?.projects || result?.data).length}` : 'no-data');

    if (result?.success) {
      const projects = result.projects || result.data || [];
      // Don't clobber good cache with empty server response
      if (projects.length === 0) {
        const existing = await cacheGet(CACHE_STORES.PROJECTS, user_email);
        const existingProjects = existing?.projects || existing?.data || [];
        if (Array.isArray(existingProjects) && existingProjects.length > 0) {
          console.warn('[getProjectsByEmail] Server returned 0 projects but cache has', existingProjects.length, '— keeping cache');
          return result; // return without writing to cache
        }
      }
      console.log('[getProjectsByEmail] About to cacheSet...');
      await cacheSet(CACHE_STORES.PROJECTS, user_email, result);
      console.log('[getProjectsByEmail] cacheSet done');
    }
    console.log('[getProjectsByEmail] Returning result');
    return result;
  } catch (err) {
    console.error('[getProjectsByEmail] Failed:', err);
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.PROJECTS, user_email);
    if (cached) {
      console.log('[getProjectsByEmail] Server failed — serving from cache');
      return cached;
    }
    return { success: false, projects: [] };
  }
}

// ── POST/PUT functions — optimistic IndexedDB first ──────────

/**
 * Add a new project.
 * Writes optimistic data to IndexedDB immediately, then syncs to server.
 */
export async function addProject(user_email, project_name, description) {
  const cached = await cacheGet(CACHE_STORES.PROJECTS, user_email);

  // 1. Optimistic: add to cache
  const optimisticProject = {
    project_name,
    description: description || '',
    archived: false,
    created_at: new Date().toISOString(),
    _optimistic: true,
  };

  if (cached) {
    const currentData = cached.data || cached;
    const projects = Array.isArray(currentData) ? currentData : (currentData?.projects || []);
    await cacheSet(CACHE_STORES.PROJECTS, user_email, {
      success: true,
      projects: [...projects, optimisticProject],
    });
  }

  // 2. Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[addProject] Offline, queuing action');
    await addToQueue('addProject', 'project', {
      user_email,
      project_name,
      description,
    });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/project`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'add',
        values: { user_email, project_name, description },
      }),
    });

    if (result?.success) {
      await getProjectsByEmail(user_email);
    }
    return result;
  } catch (err) {
    // 4. On failure, queue for retry (don't rollback)
    console.error('[addProject] Server sync failed, queuing for retry:', err);
    await addToQueue('addProject', 'project', {
      user_email,
      project_name,
      description,
    });
    return { success: true, queued: true };
  }
}

/**
 * Edit project name.
 * Updates IndexedDB immediately, then syncs to server.
 */
export async function editProjectName(user_email, new_project_name, old_project_name) {
  const cached = await cacheGet(CACHE_STORES.PROJECTS, user_email);

  // 1. Optimistic: rename in cache
  if (cached) {
    const currentData = cached.data || cached;
    const projects = Array.isArray(currentData) ? currentData : (currentData?.projects || []);
    const renamed = projects.map((p) =>
      p.project_name === old_project_name
        ? { ...p, project_name: new_project_name }
        : p
    );
    await cacheSet(CACHE_STORES.PROJECTS, user_email, { success: true, projects: renamed });
  }

  // 2. Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[editProjectName] Offline, queuing action');
    await addToQueue('editProjectName', 'project', {
      user_email,
      new_project_name,
      old_project_name,
    });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/project`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'edit',
        values: { user_email, new_project_name, old_project_name },
      }),
    });

    if (result?.success) {
      await getProjectsByEmail(user_email);
      // Also invalidate entries cache since project name changed
      await cacheDelete(CACHE_STORES.ENTRIES, `${user_email}:${old_project_name}`);
      await cacheDelete(CACHE_STORES.ALL_ENTRIES, user_email);
    }
    return result;
  } catch (err) {
    // 4. On failure, queue for retry (don't rollback)
    console.error('[editProjectName] Server sync failed, queuing for retry:', err);
    await addToQueue('editProjectName', 'project', {
      user_email,
      new_project_name,
      old_project_name,
    });
    return { success: true, queued: true };
  }
}

/**
 * Delete a project.
 * Removes from IndexedDB immediately, then syncs to server.
 */
export async function deleteProject(user_email, project_name) {
  const cached = await cacheGet(CACHE_STORES.PROJECTS, user_email);

  // 1. Optimistic: remove from cache
  if (cached) {
    const currentData = cached.data || cached;
    const projects = Array.isArray(currentData) ? currentData : (currentData?.projects || []);
    const filtered = projects.filter((p) => p.project_name !== project_name);
    await cacheSet(CACHE_STORES.PROJECTS, user_email, { success: true, projects: filtered });
  }

  // 2. Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[deleteProject] Offline, queuing action');
    await addToQueue('deleteProject', 'project', {
      user_email,
      project_name,
    });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/project`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'delete',
        values: { user_email, project_name },
      }),
    });

    if (result?.success) {
      await getProjectsByEmail(user_email);
      await cacheDelete(CACHE_STORES.ENTRIES, `${user_email}:${project_name}`);
      await cacheDelete(CACHE_STORES.ALL_ENTRIES, user_email);
    }
    return result;
  } catch (err) {
    // 4. On failure, queue for retry (don't rollback)
    console.error('[deleteProject] Server sync failed, queuing for retry:', err);
    await addToQueue('deleteProject', 'project', {
      user_email,
      project_name,
    });
    return { success: true, queued: true };
  }
}

/**
 * Set a project's accent colour.
 * Updates IndexedDB immediately, then syncs to server.
 * @param {string} user_email
 * @param {string} project_name
 * @param {string|null} color - Hex colour string e.g. '#ec4899', or null to clear
 */
export async function setProjectColor(user_email, project_name, color) {
  const cached = await cacheGet(CACHE_STORES.PROJECTS, user_email);

  // 1. Optimistic: update colour in cache
  if (cached) {
    const currentData = cached.data || cached;
    const projects = Array.isArray(currentData) ? currentData : (currentData?.projects || []);
    const updated = projects.map((p) =>
      p.project_name === project_name ? { ...p, project_color: color } : p
    );
    await cacheSet(CACHE_STORES.PROJECTS, user_email, { success: true, projects: updated });
  }

  // 2. Check online status
  if (!navigator.onLine) {
    console.log('[setProjectColor] Offline, queuing action');
    await addToQueue('setProjectColor', 'project', {
      user_email,
      project_name,
      color,
    });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/project`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'setColor',
        values: { user_email, project_name, color },
      }),
    });
    return result;
  } catch (err) {
    console.error('[setProjectColor] Server sync failed, queuing for retry:', err);
    await addToQueue('setProjectColor', 'project', {
      user_email,
      project_name,
      color,
    });
    return { success: true, queued: true };
  }
}
