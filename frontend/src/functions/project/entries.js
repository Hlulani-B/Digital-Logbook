import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';
import { addToQueue } from '@/CacheFunctions/offlineQueue';

function withoutUndefined(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

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
 * Guard: never overwrites non-empty cache with empty server data.
 */
export async function getAllEntries(user_email) {
  console.log('[getAllEntries] called for', user_email);
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getAll',
        values: { user_email },
      }),
    });
    console.log('[getAllEntries] server returned:', result?.success, Array.isArray(result?.data) ? `len=${result.data.length}` : 'no-data');

    if (result?.success) {
      const data = Array.isArray(result.data) ? result.data : [];
      // Don't clobber good cache with empty server response
      if (data.length === 0) {
        const existing = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);
        const existingData = existing?.data || [];
        if (Array.isArray(existingData) && existingData.length > 0) {
          console.warn('[getAllEntries] Server returned 0 entries but cache has', existingData.length, '— keeping cache');
          return result; // return without writing to cache
        }
      }
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
  duration,
  summary,
  notes
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
    summary,
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
    const optimisticAll = Array.isArray(currentAll) ? [...currentAll, optimisticEntry] : currentAll;
    await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: optimisticAll });
  }

  // 2. Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[addEntry] Offline, queuing action');
    await addToQueue('addEntry', 'entries', {
      user_email,
      project_name,
      entry_object,
      due_date,
      priority,
      status,
      started_at,
      ended_at,
      duration,
      summary,
      notes,
    });
    return { success: true, queued: true, data: undefined, message: undefined };
  }

  // 3. Sync to server in background (don't block the UI)
  _syncAddEntryToServer({
    user_email, project_name, entry_object, due_date, priority, status,
    started_at, ended_at, duration, summary, notes, cacheKey, cached, cachedAll,
  });

  // Return immediately — optimistic entry is already in IndexedDB
  return { success: true, optimistic: true, data: undefined, message: undefined };
}

/**
 * Internal: sync an addEntry action to the server in the background.
 * Fires after the optimistic write; replaces optimistic data with real server data on success,
 * or queues for retry on failure.
 */
async function _syncAddEntryToServer({
  user_email, project_name, entry_object, due_date, priority, status,
  started_at, ended_at, duration, summary, notes, cacheKey, cached, cachedAll,
}) {
  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'add',
        values: withoutUndefined({
          user_email,
          project_name,
          entry_object,
          due_date,
          priority,
          status,
          started_at,
          ended_at,
          duration,
          summary,
          notes,
        }),
      }),
    });

    // On success, replace optimistic entry with real data in cache
    if (result?.success && result.data) {
      const newEntry = Array.isArray(result.data) ? result.data[0] : result.data;
      if (cached) {
        const currentData = cached.data || cached;
        const newData = Array.isArray(currentData)
          ? currentData.map((e) =>
              e.id?.toString().startsWith('optimistic-') && e.entries === entry_object
                ? newEntry
                : e
            )
          : currentData;
        await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: newData });
      }
      if (cachedAll) {
        const currentAll = cachedAll.data || cachedAll;
        const newAll = Array.isArray(currentAll)
          ? currentAll.map((e) =>
              e.id?.toString().startsWith('optimistic-') && e.entries === entry_object
                ? newEntry
                : e
            )
          : currentAll;
        await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: newAll });
      }
    }
  } catch (err) {
    // On failure, queue for retry (optimistic entry stays in cache)
    console.error('[addEntry] Server sync failed, queuing for retry:', err);
    await addToQueue('addEntry', 'entries', {
      user_email, project_name, entry_object, due_date, priority, status,
      started_at, ended_at, duration, notes,
    });
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
  duration,
  summary
) {
  const cacheKey = `${user_email}:${project_name}`;

  // 1. Save pre-update cache state for rollback
  const cachedBefore = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
  const cachedAllBefore = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);

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
          summary: summary !== undefined ? summary : e.summary,
        };
      }
      return e;
    });
  }

  // 2. Optimistic update: patch the entry in cache
  if (cachedBefore) {
    const currentData = cachedBefore.data || cachedBefore;
    await cacheSet(CACHE_STORES.ENTRIES, cacheKey, {
      success: true,
      data: patchEntry(currentData),
    });
  }
  if (cachedAllBefore) {
    const currentAll = cachedAllBefore.data || cachedAllBefore;
    await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, {
      success: true,
      data: patchEntry(currentAll),
    });
  }

  // 3. Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[updateEntry] Offline, queuing action');
    await addToQueue('updateEntry', 'entries', {
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
      summary,
    });
    return { success: true, queued: true };
  }

  // 4. Sync to server
  try {
    console.log('[updateEntry] Sending to server:', { entry_id, priority, status, project_name });
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'update',
        values: withoutUndefined({
          user_email,
          project_name,
          entry_id,
          new_entry,
          due_date,
          priority,
          status,
          started_at,
          ended_at,
          summary,
        }),
      }),
    });

    console.log('[updateEntry] Server response:', JSON.stringify(result));

    // 5a. Server returned success — update cache with authoritative server data
    if (result?.success && result.data) {
      const updatedEntry = Array.isArray(result.data) ? result.data[0] : result.data;
      // Re-read current cache (not stale reference) and replace the entry
      const currentCached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
      if (currentCached) {
        const currentData = currentCached.data || currentCached;
        const newData = Array.isArray(currentData)
          ? currentData.map((e) =>
              e.id === entry_id || e.id?.toString() === entry_id?.toString() ? updatedEntry : e
            )
          : currentData;
        await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: newData });
      }
      const currentCachedAll = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);
      if (currentCachedAll) {
        const currentAll = currentCachedAll.data || currentCachedAll;
        const newAll = Array.isArray(currentAll)
          ? currentAll.map((e) =>
              e.id === entry_id || e.id?.toString() === entry_id?.toString() ? updatedEntry : e
            )
          : currentAll;
        await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { success: true, data: newAll });
      }
    }
    // 5b. Server returned failure — queue for retry
    else if (result && !result.success) {
      console.warn('[updateEntry] Server returned failure, queuing for retry:', result.message);
      await addToQueue('updateEntry', 'entries', {
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
        summary,
      });
    }

    return result;
  } catch (err) {
    // 6. On network error, queue for retry (don't rollback)
    console.error('[updateEntry] Server sync failed, queuing for retry:', err);
    await addToQueue('updateEntry', 'entries', {
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
      summary,
    });
    return { success: true, queued: true };
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
    await cacheSet(CACHE_STORES.ENTRIES, cacheKey, {
      success: true,
      data: removeEntry(currentData),
    });
  }
  if (cachedAll) {
    const currentAll = cachedAll.data || cachedAll;
    await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, {
      success: true,
      data: removeEntry(currentAll),
    });
  }

  // 2. Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[deleteEntry] Offline, queuing action');
    await addToQueue('deleteEntry', 'entries', {
      user_email,
      project_name,
      entry,
    });
    return { success: true, queued: true };
  }

  // 3. Sync to server
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
    // 4. On failure, queue for retry (don't rollback)
    console.error('[deleteEntry] Server sync failed, queuing for retry:', err);
    await addToQueue('deleteEntry', 'entries', {
      user_email,
      project_name,
      entry,
    });
    return { success: true, queued: true };
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

  // 4. Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[deleteEntryById] Offline, queuing action');
    await addToQueue('deleteEntryById', 'entries', {
      user_email,
      entry_id,
    });
    return { success: true, queued: true };
  }

  // 5. Sync to server
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
    // 6. On failure, queue for retry
    console.error('[deleteEntryById] Server sync failed, queuing for retry:', err);
    await addToQueue('deleteEntryById', 'entries', {
      user_email,
      entry_id,
    });
    return { success: true, queued: true };
  }
}
