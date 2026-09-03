import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';

// ── GET functions — write to IndexedDB, don't return ──────────

/**
 * Fetch entries for a specific project.
 * Writes result to IndexedDB (triggers subscription), does not return data.
 */
export async function getEntries(user_email, project_name) {
  const cacheKey = `${user_email}:${project_name}`;

  // Fetch from server and write to IndexedDB
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'get',
        values: { user_email, project_name },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ENTRIES, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[getEntries] Failed:', err);
    return { success: false, data: [] };
  }
}

/**
 * Fetch ALL entries for a user.
 * Writes result to IndexedDB (triggers subscription), does not return data.
 */
export async function getAllEntries(user_email) {
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getAll',
        values: { user_email },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, result);
    }
    return result;
  } catch (err) {
    console.error('[getAllEntries] Failed:', err);
    return { success: false, data: [] };
  }
}

/**
 * Fetch sorted unarchived entries for a project.
 * Writes to IndexedDB, does not return data.
 */
export async function sortUnarchivedEntries(user_email, project_name, sort_type) {
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'sortUnarchived',
        values: { user_email, project_name, sort_type },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ENTRIES, `${user_email}:${project_name}`, result);
    }
    return result;
  } catch (err) {
    console.error('[sortUnarchivedEntries] Failed:', err);
    return { success: false, data: [] };
  }
}

/**
 * Fetch sorted archived entries for a project.
 */
export async function sortArchivedEntries(user_email, project_name, sort_type) {
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'sortArchived',
        values: { user_email, project_name, sort_type },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ENTRIES, `${user_email}:${project_name}:archived`, result);
    }
    return result;
  } catch (err) {
    console.error('[sortArchivedEntries] Failed:', err);
    return { success: false, data: [] };
  }
}

// ── POST/PUT functions — write to IndexedDB FIRST, then sync ──

/**
 * Add a new entry.
 * Writes optimistic data to IndexedDB immediately, then syncs to server.
 */
export async function addEntry(
  user_email,
  project_name,
  entry_object,
  due_date,
  priority,
  status,
  started_at,
  ended_at,
  duration
) {
  const cacheKey = `${user_email}:${project_name}`;

  // 1. Optimistic update: read current cache, add optimistic entry, write back
  const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
  const cachedAll = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);
  const optimisticEntry = {
    id: `optimistic-${Date.now()}`,
    user_email,
    project_name,
    entries: entry_object,
    due_date,
    priority,
    status,
    started_at,
    ended_at,
    duration,
    created_at: new Date().toISOString(),
    _optimistic: true,
  };

  // Write optimistic entry to per-project cache
  if (cached) {
    const currentData = cached.data || cached;
    const optimisticData = Array.isArray(currentData)
      ? [...currentData, optimisticEntry]
      : currentData;
    await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: optimisticData });
  }

  // Write optimistic entry to all-entries cache
  if (cachedAll) {
    const currentAll = cachedAll.data || cachedAll;
    const optimisticAll = Array.isArray(currentAll)
      ? [...currentAll, optimisticEntry]
      : currentAll;
    await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: optimisticAll });
  }

  // 2. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'add',
        values: {
          user_email,
          project_name,
          entry_object,
          due_date,
          priority,
          status,
          started_at,
          ended_at,
          duration,
        },
      }),
    });

    // 3. On success, update cache with returned data (no re-fetch needed)
    if (result?.success && result.data) {
      const newEntry = Array.isArray(result.data) ? result.data[0] : result.data;
      // Replace optimistic entry with real data in per-project cache
      if (cached) {
        const currentData = cached.data || cached;
        const newData = Array.isArray(currentData)
          ? currentData.map((e) => e.id?.toString().startsWith('optimistic-') && e.entries === entry_object ? newEntry : e)
          : currentData;
        await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: newData });
      }
      // Replace in all-entries cache
      if (cachedAll) {
        const currentAll = cachedAll.data || cachedAll;
        const newAll = Array.isArray(currentAll)
          ? currentAll.map((e) => e.id?.toString().startsWith('optimistic-') && e.entries === entry_object ? newEntry : e)
          : currentAll;
        await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: newAll });
      }
    }
    return result;
  } catch (err) {
    // 4. On failure, rollback optimistic entry
    console.error('[addEntry] Server sync failed, rolling back:', err);
    if (cached) {
      await cacheSet(CACHE_STORES.ENTRIES, cacheKey, cached);
    }
    if (cachedAll) {
      await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, cachedAll);
    }
    return { success: false, message: err.message || 'Failed to add entry' };
  }
}

/**
 * Update an existing entry.
 * Writes optimistic update to IndexedDB immediately, then syncs to server.
 */
export async function updateEntry(
  user_email,
  project_name,
  entry_id,
  new_entry,
  due_date,
  priority,
  status,
  started_at,
  ended_at,
  duration
) {
  const cacheKey = `${user_email}:${project_name}`;

  // 1. Optimistic update: patch the entry in cache
  const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
  const cachedAll = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);

  function patchEntry(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.map((e) => {
      if (e.id === entry_id || e.id?.toString() === entry_id?.toString()) {
        return {
          ...e,
          entries: new_entry ?? e.entries,
          due_date: due_date !== undefined ? due_date : e.due_date,
          priority: priority !== undefined ? priority : e.priority,
          status: status !== undefined ? status : e.status,
          started_at: started_at !== undefined ? started_at : e.started_at,
          ended_at: ended_at !== undefined ? ended_at : e.ended_at,
          duration: duration !== undefined ? duration : e.duration,
        };
      }
      return e;
    });
  }

  if (cached) {
    const currentData = cached.data || cached;
    await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: patchEntry(currentData) });
  }
  if (cachedAll) {
    const currentAll = cachedAll.data || cachedAll;
    await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: patchEntry(currentAll) });
  }

  // 2. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'update',
        values: {
          user_email,
          project_name,
          entry_id,
          new_entry,
          due_date,
          priority,
          status,
          started_at,
          ended_at,
          duration,
        },
      }),
    });

    // 3. On success, update cache with returned data (no re-fetch needed)
    if (result?.success && result.data) {
      const updatedEntry = Array.isArray(result.data) ? result.data[0] : result.data;
      // Update per-project cache
      if (cached) {
        const currentData = cached.data || cached;
        const newData = Array.isArray(currentData)
          ? currentData.map((e) => e.id === entry_id || e.id?.toString() === entry_id?.toString() ? updatedEntry : e)
          : currentData;
        await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: newData });
      }
      // Update all-entries cache
      if (cachedAll) {
        const currentAll = cachedAll.data || cachedAll;
        const newAll = Array.isArray(currentAll)
          ? currentAll.map((e) => e.id === entry_id || e.id?.toString() === entry_id?.toString() ? updatedEntry : e)
          : currentAll;
        await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: newAll });
      }
    }
    return result;
  } catch (err) {
    // 4. On failure, rollback
    console.error('[updateEntry] Server sync failed, rolling back:', err);
    if (cached) await cacheSet(CACHE_STORES.ENTRIES, cacheKey, cached);
    if (cachedAll) await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, cachedAll);
    return { success: false, message: err.message || 'Failed to update entry' };
  }
}

/**
 * Delete an entry.
 * Removes from IndexedDB immediately, then syncs to server.
 */
export async function deleteEntry(user_email, project_name, entry) {
  const cacheKey = `${user_email}:${project_name}`;

  // 1. Optimistic: remove from cache
  const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
  const cachedAll = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);

  function removeEntry(arr) {
    if (!Array.isArray(arr)) return arr;
    const entryId = typeof entry === 'object' ? entry.id : entry;
    return arr.filter((e) => e.id !== entryId && e.id?.toString() !== entryId?.toString());
  }

  if (cached) {
    const currentData = cached.data || cached;
    await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: removeEntry(currentData) });
  }
  if (cachedAll) {
    const currentAll = cachedAll.data || cachedAll;
    await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: removeEntry(currentAll) });
  }

  // 2. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'delete',
        values: { user_email, project_name, entry },
      }),
    });

    if (result?.success) {
      // Cache already updated optimistically - no re-fetch needed
    }
    return result;
  } catch (err) {
    // 3. Rollback on failure
    console.error('[deleteEntry] Server sync failed, rolling back:', err);
    if (cached) await cacheSet(CACHE_STORES.ENTRIES, cacheKey, cached);
    if (cachedAll) await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, cachedAll);
    return { success: false, message: err.message || 'Failed to delete entry' };
  }
}

/**
 * Delete an entry by ID.
 * Removes from both per-project and all-entries IndexedDB caches.
 */
export async function deleteEntryById(user_email, entry_id) {
  // 1. Look up the entry to find its project_name (needed for per-project cache)
  const cachedAll = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);
  let projectName = null;

  if (cachedAll) {
    const currentAll = cachedAll.data || cachedAll;
    if (Array.isArray(currentAll)) {
      const entry = currentAll.find(
        (e) => e.id === entry_id || e.id?.toString() === entry_id?.toString()
      );
      projectName = entry?.project_name || null;
    }
  }

  // 2. Optimistic: remove from per-project cache
  if (projectName) {
    const cacheKey = `${user_email}:${projectName}`;
    const cachedProject = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
    if (cachedProject) {
      const currentData = cachedProject.data || cachedProject;
      const filtered = Array.isArray(currentData)
        ? currentData.filter((e) => e.id !== entry_id && e.id?.toString() !== entry_id?.toString())
        : currentData;
      await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: filtered });
    }
  }

  // 3. Optimistic: remove from all-entries cache
  if (cachedAll) {
    const currentAll = cachedAll.data || cachedAll;
    const filtered = Array.isArray(currentAll)
      ? currentAll.filter((e) => e.id !== entry_id && e.id?.toString() !== entry_id?.toString())
      : currentAll;
    await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: filtered });
  }

  // 4. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'deleteById',
        values: { user_email, entry_id },
      }),
    });

    if (result?.success) {
      // Cache already updated optimistically - no re-fetch needed
    }
    return result;
  } catch (err) {
    console.error('[deleteEntryById] Server sync failed, rolling back:', err);
    // Rollback all-entries cache
    if (cachedAll) await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, cachedAll);
    // Rollback per-project cache
    if (projectName) {
      const cacheKey = `${user_email}:${projectName}`;
      const cachedProject = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
      // Re-fetch and restore — simplest rollback is to re-read from server
      // For now, just leave the optimistic removal (server will still have the entry)
    }
    return { success: false, message: err.message || 'Failed to delete entry' };
  }
}
