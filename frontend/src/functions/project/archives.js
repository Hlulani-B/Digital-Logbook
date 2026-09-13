import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';
import { addToQueue } from '@/CacheFunctions/offlineQueue';

// ── Offline optimistic cache helpers ───────────────────────────
// When a mutation is queued while offline we still want the UI to
// reflect it immediately: the item leaves the active feed and shows
// up under Archives (and vice-versa). We achieve that by patching
// the same IndexedDB stores the views subscribe to (ALL_ENTRIES,
// ENTRIES, PROJECTS, ARCHIVES) so cacheSubscribe fires a re-render.
// The server reconciles the change once the offline queue replays.

/** Flip the `archived` flag on a single entry inside the given store/key. */
async function setEntryArchivedFlag(store, key, entryId, archived) {
  const cached = await cacheGet(store, key);
  if (!cached || !Array.isArray(cached.data)) return null;
  let touched = null;
  const data = cached.data.map((e) => {
    if (String(e.id) === String(entryId)) {
      touched = { ...e, archived };
      return touched;
    }
    return e;
  });
  await cacheSet(store, key, { ...cached, data });
  return touched;
}

/** Add (or remove) an entry row from the getArchives `${email}:all` list. */
async function patchArchivesAllList(user_email, entry, shouldInclude) {
  const key = `${user_email}:all`;
  const cached = await cacheGet(CACHE_STORES.ARCHIVES, key);
  const list = Array.isArray(cached?.data) ? cached.data : [];
  const without = list.filter((e) => String(e.id) !== String(entry.id));
  const next = shouldInclude ? [{ ...entry, archived: true }, ...without] : without;
  await cacheSet(CACHE_STORES.ARCHIVES, key, { success: true, data: next });
}

/** Flip the `archived` flag on a project inside the PROJECTS store. */
async function setProjectArchivedFlag(user_email, projectName, archived) {
  const cached = await cacheGet(CACHE_STORES.PROJECTS, user_email);
  if (!cached) return;
  const raw = cached.data || cached.projects;
  if (!Array.isArray(raw)) return;
  const data = raw.map((p) =>
    p.project_name === projectName ? { ...p, archived } : p
  );
  await cacheSet(CACHE_STORES.PROJECTS, user_email, { ...cached, data });
}

/** Mirror the backend project→entries archive cascade in the ALL_ENTRIES store. */
async function cacheSetEntriesArchivedForProject(user_email, projectName, archived) {
  const cached = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);
  if (!cached || !Array.isArray(cached.data)) return;
  const data = cached.data.map((e) =>
    e.project_name === projectName ? { ...e, archived } : e
  );
  await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, { ...cached, data });
}

/**
 * Apply the full set of cache side-effects for archiving/unarchiving a single
 * entry so every subscribed view (Dashboard feed via ALL_ENTRIES, project page
 * via ENTRIES, Archives via the `${email}:all` list) updates at once. Used by
 * both the offline (optimistic) and online (post-success) paths.
 */
async function applyEntryArchive(user_email, project_name, entry_id, archived) {
  const touched = await setEntryArchivedFlag(
    CACHE_STORES.ALL_ENTRIES,
    user_email,
    entry_id,
    archived
  );
  await setEntryArchivedFlag(
    CACHE_STORES.ENTRIES,
    `${user_email}:${project_name}`,
    entry_id,
    archived
  );
  if (touched) await patchArchivesAllList(user_email, touched, archived);
}

/** Same idea for a project + its cascaded entries. */
async function applyProjectArchive(user_email, project_name, archived) {
  await setProjectArchivedFlag(user_email, project_name, archived);
  await cacheSetEntriesArchivedForProject(user_email, project_name, archived);
}

// ── GET functions ──────────────────────────────────────────────

/**
 * Fetch archives for a user/project.
 * Cache-first: reads from IndexedDB, falls back to server.
 */
export async function getArchives(user_email, project_name) {
  const cacheKey = project_name
    ? `${user_email}:${project_name}`
    : `${user_email}:all`;

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.ARCHIVES, cacheKey);
    if (cached) {
      console.log('[getArchives] Offline — serving from cache');
      return cached;
    }
    console.log('[getArchives] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

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
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.ARCHIVES, cacheKey);
    if (cached) {
      console.log('[getArchives] Server failed — serving from cache');
      return cached;
    }
    return { success: false, data: [] };
  }
}

/**
 * Fetch unarchived entries.
 * Cache-first: reads from IndexedDB, falls back to server.
 */
export async function getUnarchived(user_email, project_name) {
  const cacheKey = `unarchived:${user_email}:${project_name || 'all'}`;

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.ARCHIVES, cacheKey);
    if (cached) {
      console.log('[getUnarchived] Offline — serving from cache');
      return cached;
    }
    console.log('[getUnarchived] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

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
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.ARCHIVES, cacheKey);
    if (cached) {
      console.log('[getUnarchived] Server failed — serving from cache');
      return cached;
    }
    return { success: false, data: [] };
  }
}

/**
 * Fetch archived projects.
 * Cache-first: reads from IndexedDB, falls back to server.
 */
export async function getArchivedProjects(user_email) {
  const cacheKey = `archived-projects:${user_email}`;

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.ARCHIVES, cacheKey);
    if (cached) {
      console.log('[getArchivedProjects] Offline — serving from cache');
      return cached;
    }
    console.log('[getArchivedProjects] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

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
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.ARCHIVES, cacheKey);
    if (cached) {
      console.log('[getArchivedProjects] Server failed — serving from cache');
      return cached;
    }
    return { success: false, data: [] };
  }
}

/**
 * Fetch unarchived projects.
 * Cache-first: reads from IndexedDB, falls back to server.
 */
export async function getUnarchivedProjects(user_email) {
  const cacheKey = `unarchived-projects:${user_email}`;

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.ARCHIVES, cacheKey);
    if (cached) {
      console.log('[getUnarchivedProjects] Offline — serving from cache');
      return cached;
    }
    console.log('[getUnarchivedProjects] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

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
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.ARCHIVES, cacheKey);
    if (cached) {
      console.log('[getUnarchivedProjects] Server failed — serving from cache');
      return cached;
    }
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
    // Offline: reflect the change locally right away, then queue for sync.
    console.log('[archiveProject] Offline — optimistic update + queuing action');
    try {
      // setProjectArchivedFlag hides the project; the cascade hides its
      // entries from the Dashboard feed, mirroring the backend transaction.
      await applyProjectArchive(user_email, project_name, true);
    } catch (err) {
      console.error('[archiveProject] Offline optimistic update failed:', err);
    }
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
      // Cascade the archived flag into ALL_ENTRIES so the Dashboard feed drops
      // the project's entries right away (getEntries only touches the
      // per-project store, which the Dashboard feed doesn't read).
      await cacheSetEntriesArchivedForProject(user_email, project_name, true);
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
    await applyProjectArchive(user_email, project_name, true);
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
    console.log('[unarchiveProject] Offline — optimistic update + queuing action');
    try {
      await applyProjectArchive(user_email, project_name, false);
    } catch (err) {
      console.error('[unarchiveProject] Offline optimistic update failed:', err);
    }
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
      await cacheSetEntriesArchivedForProject(user_email, project_name, false);
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
    await applyProjectArchive(user_email, project_name, false);
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
    console.log('[archiveEntry] Offline — optimistic update + queuing action');
    try {
      // Remove from the active feed and surface it under Archives right away.
      await applyEntryArchive(user_email, project_name, entry_id, true);
    } catch (err) {
      console.error('[archiveEntry] Offline optimistic update failed:', err);
    }
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
      // Optimistically flip the cached flags so the Dashboard feed and the
      // Archives view react immediately (their subscriptions read ALL_ENTRIES
      // and the `${email}:all` archives list, which getEntries won't touch).
      await applyEntryArchive(user_email, project_name, entry_id, true);
      const { getEntries } = await import('./entries.js');
      await getEntries(user_email, project_name);
    }
    return result;
  } catch (err) {
    console.error('[archiveEntry] Failed, queuing for retry:', err);
    await applyEntryArchive(user_email, project_name, entry_id, true);
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
    console.log('[unarchiveEntry] Offline — optimistic update + queuing action');
    try {
      // Bring it back into the active feed and drop it from Archives.
      await applyEntryArchive(user_email, project_name, entry_id, false);
    } catch (err) {
      console.error('[unarchiveEntry] Offline optimistic update failed:', err);
    }
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
      await applyEntryArchive(user_email, project_name, entry_id, false);
      const { getEntries } = await import('./entries.js');
      await getEntries(user_email, project_name);
    }
    return result;
  } catch (err) {
    console.error('[unarchiveEntry] Failed, queuing for retry:', err);
    await applyEntryArchive(user_email, project_name, entry_id, false);
    await addToQueue('unarchiveEntry', 'archives', {
      user_email,
      project_name,
      entry_id,
    });
    return { success: true, queued: true };
  }
}
