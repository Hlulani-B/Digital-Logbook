import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';

// ── GET functions ──────────────────────────────────────────────

/**
 * Fetch all projects for a user.
 * Writes to IndexedDB (triggers subscription), returns result for compatibility.
 */
export async function getProjectsByEmail(user_email) {
  try {
    const result = await request(`${PROJECT_URL}/service/project`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getProjects',
        values: { user_email },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.PROJECTS, user_email, result);
    }
    return result;
  } catch (err) {
    console.error('[getProjectsByEmail] Failed:', err);
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

  // 2. Sync to server
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
    console.error('[addProject] Server sync failed, rolling back:', err);
    if (cached) await cacheSet(CACHE_STORES.PROJECTS, user_email, cached);
    return { success: false, message: err.message || 'Failed to add project' };
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

  // 2. Sync to server
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
    console.error('[editProjectName] Server sync failed, rolling back:', err);
    if (cached) await cacheSet(CACHE_STORES.PROJECTS, user_email, cached);
    return { success: false, message: err.message || 'Failed to rename project' };
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

  // 2. Sync to server
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
    console.error('[deleteProject] Server sync failed, rolling back:', err);
    if (cached) await cacheSet(CACHE_STORES.PROJECTS, user_email, cached);
    return { success: false, message: err.message || 'Failed to delete project' };
  }
}
