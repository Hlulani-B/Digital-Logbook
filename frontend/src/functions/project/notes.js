import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';
import { addToQueue } from '@/CacheFunctions/offlineQueue';

// ── GET functions ──────────────────────────────────────────────

/**
 * Fetch all notes for a specific entry.
 * Cache-first: returns cached data immediately, refreshes from server in background.
 */
export async function getNotes(entry_id) {
  const cacheKey = `notes:${entry_id}`;
  console.log('[getNotes] called for entry_id=', entry_id);

  // 1. Return cached data first (instant)
  const cached = await cacheGet(CACHE_STORES.NOTES, cacheKey);
  console.log('[getNotes] cache result:', cached?.success, Array.isArray(cached?.data) ? `dataLen=${cached.data.length}` : 'no-data');
  if (cached?.success && Array.isArray(cached.data)) {
    // Refresh from server in background (don't block the caller)
    _refreshNotesFromServer(entry_id, cacheKey);
    return { ...cached, _fromCache: true };
  }

  // 2. No cache — must wait for server
  console.log('[getNotes] No cache, fetching from server...');
  return _fetchNotesFromServer(entry_id, cacheKey);
}

/** Internal: fetch notes from server and write to cache */
async function _fetchNotesFromServer(entry_id, cacheKey) {
  console.log('[_fetchNotesFromServer] Fetching from server for entry_id=', entry_id);
  try {
    const result = await request(`${PROJECT_URL}/service/notes`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getByEntry',
        values: { entry_id },
      }),
    });
    console.log('[_fetchNotesFromServer] Server returned:', result?.success, Array.isArray(result?.data) ? `dataLen=${result.data.length}` : 'no-data');
    if (result?.success) {
      await cacheSet(CACHE_STORES.NOTES, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[_fetchNotesFromServer] Failed:', err);
    return { success: false, data: [] };
  }
}

/** Internal: background refresh of notes from server */
function _refreshNotesFromServer(entry_id, cacheKey) {
  _fetchNotesFromServer(entry_id, cacheKey).catch(() => {});
}

/**
 * View a single note by ID.
 * For file/image notes, fetches the actual file and returns base64 data.
 */
export async function viewNote(note_id) {
  try {
    const result = await request(`${PROJECT_URL}/service/notes`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'view',
        values: { note_id },
      }),
    });

    // Cache the note data (including file_data if present)
    if (result?.success && result.data) {
      await cacheSet(CACHE_STORES.NOTES, `note:${note_id}`, result);
    }
    return result;
  } catch (err) {
    console.error('[viewNote] Failed:', err);
    return { success: false, message: err.message };
  }
}

// ── POST/PUT functions — IndexedDB-first, then sync ───────────

/**
 * Add a note to an entry.
 * Writes optimistic data to IndexedDB, then syncs to server.
 *
 * @param {string} email       Owner email
 * @param {string} entry_id    Parent entry UUID
 * @param {string} entry_type  'text' | 'image' | 'pdf' | 'link'
 * @param {*} value            Text content, URL, or file (Buffer/base64)
 */
export async function addNote(email, entry_id, entry_type, value) {
  const cacheKey = `notes:${entry_id}`;

  // 1. Optimistic: add to cache
  const cached = await cacheGet(CACHE_STORES.NOTES, cacheKey);
  const optimisticNote = {
    id: `optimistic-note-${Date.now()}`,
    email,
    entry_id,
    entry_type,
    value: entry_type === 'text' || entry_type === 'link' ? value : '(uploading...)',
    created_at: new Date().toISOString(),
    deleted: false,
    _optimistic: true,
  };

  if (cached) {
    const currentData = cached.data || cached;
    const notes = Array.isArray(currentData) ? currentData : [];
    await cacheSet(CACHE_STORES.NOTES, cacheKey, {
      success: true,
      data: [...notes, optimisticNote],
    });
  }

  // 2. Check online
  if (!navigator.onLine) {
    console.log('[addNote] Offline, queuing action');
    await addToQueue('addNote', 'notes', { email, entry_id, entry_type, value });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/notes`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'add',
        values: { email, entry_id, entry_type, value },
      }),
    });

    // 4. Replace optimistic note with real data
    if (result?.success && result.data) {
      if (cached) {
        const currentData = cached.data || cached;
        const notes = Array.isArray(currentData) ? currentData : [];
        const updated = notes.map((n) =>
          n._optimistic && n.entry_id === entry_id && n.entry_type === entry_type
            ? result.data
            : n
        );
        await cacheSet(CACHE_STORES.NOTES, cacheKey, { success: true, data: updated });
      }
    }
    return result;
  } catch (err) {
    console.error('[addNote] Server sync failed, queuing:', err);
    await addToQueue('addNote', 'notes', { email, entry_id, entry_type, value });
    return { success: true, queued: true };
  }
}

/**
 * Update a text note.
 * Only text notes can be updated.
 */
export async function updateNote(note_id, new_value) {
  // 1. Optimistic: update in cache
  // We don't know the entry_id here, so we update the individual note cache
  const noteCacheKey = `note:${note_id}`;
  const cachedNote = await cacheGet(CACHE_STORES.NOTES, noteCacheKey);

  if (cachedNote?.data) {
    cachedNote.data.value = new_value;
    await cacheSet(CACHE_STORES.NOTES, noteCacheKey, cachedNote);
  }

  // 2. Check online
  if (!navigator.onLine) {
    console.log('[updateNote] Offline, queuing action');
    await addToQueue('updateNote', 'notes', { note_id, new_value });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/notes`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'update',
        values: { note_id, new_value },
      }),
    });

    // Update cache with authoritative data
    if (result?.success && result.data) {
      await cacheSet(CACHE_STORES.NOTES, noteCacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[updateNote] Server sync failed, queuing:', err);
    await addToQueue('updateNote', 'notes', { note_id, new_value });
    return { success: true, queued: true };
  }
}

/**
 * Soft-delete a note (sets deleted = true).
 */
export async function deleteNote(note_id, entry_id) {
  const cacheKey = `notes:${entry_id}`;

  // 1. Optimistic: remove from cache
  const cached = await cacheGet(CACHE_STORES.NOTES, cacheKey);
  if (cached) {
    const currentData = cached.data || cached;
    const notes = Array.isArray(currentData) ? currentData : [];
    const filtered = notes.filter(
      (n) => n.id !== note_id && n.id?.toString() !== note_id?.toString()
    );
    await cacheSet(CACHE_STORES.NOTES, cacheKey, { success: true, data: filtered });
  }

  // Also remove individual note cache
  await cacheDelete(CACHE_STORES.NOTES, `note:${note_id}`);

  // 2. Check online
  if (!navigator.onLine) {
    console.log('[deleteNote] Offline, queuing action');
    await addToQueue('deleteNote', 'notes', { note_id, entry_id });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    const result = await request(`${PROJECT_URL}/service/notes`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'delete',
        values: { note_id },
      }),
    });

    return result;
  } catch (err) {
    console.error('[deleteNote] Server sync failed, queuing:', err);
    await addToQueue('deleteNote', 'notes', { note_id, entry_id });
    return { success: true, queued: true };
  }
}
