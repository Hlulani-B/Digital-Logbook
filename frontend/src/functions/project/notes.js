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
    if (result?.success && Array.isArray(result.data)) {
      // Preserve any in-flight optimistic notes so a background refresh can't
      // wipe a note the user just added before its POST has landed. Once the
      // real row arrives (or the optimistic is replaced in addNote) it is gone.
      const existing = await cacheGet(CACHE_STORES.NOTES, cacheKey);
      const existingData = Array.isArray(existing?.data) ? existing.data : [];
      const serverIds = new Set(result.data.map((n) => String(n.id)));
      const optimistic = existingData.filter(
        (n) => n._optimistic && !serverIds.has(String(n.id))
      );
      await cacheSet(CACHE_STORES.NOTES, cacheKey, {
        ...result,
        data: [...result.data, ...optimistic],
      });
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
 * Cache-first: returns cached data immediately, refreshes from server in background.
 * For file/image notes, fetches the actual file and returns base64 data.
 */
export async function viewNote(note_id) {
  const cacheKey = `note:${note_id}`;
  console.log('[viewNote] called for note_id=', note_id);

  // 1. Return cached data first (instant)
  const cached = await cacheGet(CACHE_STORES.NOTES, cacheKey);
  if (cached?.success && cached.data) {
    console.log('[viewNote] Serving from cache, refreshing in background');
    // Refresh from server in background (don't block the caller)
    _refreshNoteFromServer(note_id, cacheKey);
    return { ...cached, _fromCache: true };
  }

  // 2. No cache — must wait for server
  console.log('[viewNote] No cache, fetching from server...');
  return _fetchNoteFromServer(note_id, cacheKey);
}

/** Internal: fetch note from server and write to cache */
async function _fetchNoteFromServer(note_id, cacheKey) {
  console.log('[_fetchNoteFromServer] Fetching from server for note_id=', note_id);
  try {
    const result = await request(`${PROJECT_URL}/service/notes`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'view',
        values: { note_id },
      }),
    });

    console.log('[_fetchNoteFromServer] server returned: success=', result?.success, 'hasData=', !!result?.data);

    // Cache the note data (including file_data if present)
    if (result?.success && result.data) {
      await cacheSet(CACHE_STORES.NOTES, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[_fetchNoteFromServer] Failed:', err);
    return { success: false, message: err.message };
  }
}

/** Internal: background refresh of note from server */
function _refreshNoteFromServer(note_id, cacheKey) {
  _fetchNoteFromServer(note_id, cacheKey).catch(() => {});
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
  console.log('[addNote] START, entry_type=', entry_type, 'entry_id=', entry_id, 'value type=', typeof value, 'value length=', typeof value === 'string' ? value.length : 'N/A');

  // 1. Optimistic: add to cache (always, so the note shows instantly even on
  // the very first note when the list cache is still empty).
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

  const currentData = cached ? cached.data || cached : [];
  const notesArray = Array.isArray(currentData) ? currentData : [];
  await cacheSet(CACHE_STORES.NOTES, cacheKey, {
    success: true,
    data: [...notesArray, optimisticNote],
  });

  // 2. Check online
  if (!navigator.onLine) {
    console.log('[addNote] Offline, queuing action');
    await addToQueue('addNote', 'notes', { email, entry_id, entry_type, value });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    console.log('[addNote] sending to server, payload size=', JSON.stringify({ email, entry_id, entry_type, value }).length, 'bytes');
    const result = await request(`${PROJECT_URL}/service/notes`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'add',
        values: { email, entry_id, entry_type, value },
      }),
    });

    console.log('[addNote] server returned: success=', result?.success, 'hasData=', !!result?.data, 'dataId=', result?.data?.id, 'dataValue=', result?.data?.value?.substring(0, 80), 'message=', result?.message);

    // 4. Replace the optimistic note with the authoritative row. Re-read the
    // current cache (a background refresh may have changed it) and drop *this*
    // optimistic id specifically so concurrent adds aren't clobbered.
    if (result?.success && result.data) {
      const fresh = await cacheGet(CACHE_STORES.NOTES, cacheKey);
      const freshData = Array.isArray(fresh?.data) ? fresh.data : notesArray;
      const withoutOptimistic = freshData.filter((n) => n.id !== optimisticNote.id);
      const hasReal = withoutOptimistic.some((n) => String(n.id) === String(result.data.id));
      const updated = hasReal
        ? withoutOptimistic
        : [...withoutOptimistic, result.data];
      await cacheSet(CACHE_STORES.NOTES, cacheKey, { success: true, data: updated });
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
