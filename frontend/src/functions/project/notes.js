import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';
import { addToQueue, getQueue, updateQueueEntry } from '@/CacheFunctions/offlineQueue';

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
    // Refresh from server in background (don't block the caller). Offline this
    // can only fail, and a failed refresh is logged as an error — skip it.
    if (navigator.onLine) _refreshNotesFromServer(entry_id, cacheKey);
    return { ...cached, _fromCache: true };
  }

  // 2. No cache — must wait for the server
  if (!navigator.onLine) {
    console.log('[getNotes] Offline and no cache');
    return { success: true, offline: true, data: [] };
  }
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
    await queueNote({ email, entry_id, entry_type, value });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    console.log('[addNote] sending to server, payload size=', JSON.stringify({ email, entry_id, entry_type, value }).length, 'bytes');
    const result = await addNoteSync({ email, entry_id, entry_type, value, optimistic_id: optimisticNote.id });

    console.log('[addNote] server returned: success=', result?.success, 'hasData=', !!result?.data, 'dataId=', result?.data?.id, 'dataValue=', result?.data?.value?.substring(0, 80), 'message=', result?.message);

    return result;
  } catch (err) {
    console.error('[addNote] Server sync failed, queuing:', err);
    await queueNote({ email, entry_id, entry_type, value });
    return { success: true, queued: true };
  }
}

/**
 * Server-only add — no optimistic write, no re-queueing.
 * Used to replay a queued addNote: the note is already on screen, and calling
 * the public addNote again would append a second optimistic row and swallow the
 * failure back into the queue instead of letting the processor retry it.
 */
export async function addNoteSync(payload) {
  const { email, entry_id, entry_type, value } = payload;
  const cacheKey = `notes:${entry_id}`;
  const result = await request(`${PROJECT_URL}/service/notes`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'add',
      values: { email, entry_id, entry_type, value },
    }),
  });

  // Replace the pending optimistic note with the authoritative row. Only ONE
  // pending row is consumed, so adding the same text twice keeps both notes.
  if (result?.success && result.data) {
    const fresh = await cacheGet(CACHE_STORES.NOTES, cacheKey);
    const rows = Array.isArray(fresh?.data) ? fresh.data : [];
    const matchesPending = (n) =>
      !!n._optimistic &&
      (payload.optimistic_id
        ? String(n.id) === String(payload.optimistic_id)
        : n.entry_type === entry_type && n.value === value);
    let consumed = false;
    const withoutPending = rows.filter((n) => {
      if (!consumed && matchesPending(n)) {
        consumed = true;
        return false;
      }
      return true;
    });
    const hasReal = withoutPending.some((n) => String(n.id) === String(result.data.id));
    await cacheSet(CACHE_STORES.NOTES, cacheKey, {
      success: true,
      data: hasReal ? withoutPending : [...withoutPending, result.data],
    });
  }
  return result;
}

/**
 * Queue a note action, resolving the entry id first.
 *
 * A note added to an entry that is itself still queued has no server id yet, so
 * posting it later would fail on a foreign-key error and the note would be
 * dropped after the retries. In that case the note is merged into the pending
 * addEntry payload instead — the server then creates the entry and its notes in
 * one go, in the right order.
 *
 * @returns {Promise<boolean>} true when a dedicated queue entry was created
 */
async function queueNote(payload) {
  const { entry_id } = payload;
  if (typeof entry_id === 'string' && entry_id.startsWith('optimistic-')) {
    const pending = await getQueue();
    const host = pending.find(
      (q) => q.action === 'addEntry' && q.payload?.optimistic_id === entry_id
    );
    if (host) {
      host.payload.notes = [...(host.payload.notes || []), { entry_type: payload.entry_type, value: payload.value }];
      await updateQueueEntry(host);
      console.log('[addNote] Merged into pending addEntry queue item', host.id);
      return false;
    }
  }
  await addToQueue('addNote', 'notes', payload);
  return true;
}

/**
 * Update a text note.
 * Only text notes can be updated.
 * @param {string} [entry_id] Owner entry, so the visible notes *list* cache can
 *   be patched too — without it the edit only lands in the single-note cache and
 *   the change disappears on the next render/reload.
 */
export async function updateNote(note_id, new_value, entry_id) {
  // 1. Optimistic: update in cache
  // We don't know the entry_id here, so we update the individual note cache
  const noteCacheKey = `note:${note_id}`;
  const cachedNote = await cacheGet(CACHE_STORES.NOTES, noteCacheKey);

  if (cachedNote?.data) {
    cachedNote.data.value = new_value;
    await cacheSet(CACHE_STORES.NOTES, noteCacheKey, cachedNote);
  }
  if (entry_id) {
    await patchNoteRow(`notes:${entry_id}`, note_id, { value: new_value });
  }

  // 2. Check online
  if (!navigator.onLine) {
    console.log('[updateNote] Offline, queuing action');
    await addToQueue('updateNote', 'notes', { note_id, new_value });
    return { success: true, queued: true };
  }

  // 3. Sync to server
  try {
    const result = await updateNoteSync({ note_id, new_value });
    return result;
  } catch (err) {
    console.error('[updateNote] Server sync failed, queuing:', err);
    await addToQueue('updateNote', 'notes', { note_id, new_value });
    return { success: true, queued: true };
  }
}

/** Server-only update, for replaying a queued action. */
export async function updateNoteSync(payload) {
  const { note_id, new_value } = payload;
  const result = await request(`${PROJECT_URL}/service/notes`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'update',
      values: { note_id, new_value },
    }),
  });

  if (result?.success && result.data) {
    const row = result.data;
    await cacheSet(CACHE_STORES.NOTES, `note:${note_id}`, result);
    if (row.entry_id) {
      await patchNoteRow(`notes:${row.entry_id}`, note_id, { value: row.value, deleted: row.deleted });
    }
  }
  return result;
}

/** Patch one note row inside a cached notes list. */
async function patchNoteRow(cacheKey, note_id, patch) {
  const cached = await cacheGet(CACHE_STORES.NOTES, cacheKey);
  const rows = Array.isArray(cached?.data) ? cached.data : [];
  if (!rows.length) return;
  await cacheSet(CACHE_STORES.NOTES, cacheKey, {
    success: true,
    data: rows.map((n) =>
      String(n.id) === String(note_id) ? { ...n, ...patch } : n
    ),
  });
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
    return await deleteNoteSync({ note_id, entry_id });
  } catch (err) {
    console.error('[deleteNote] Server sync failed, queuing:', err);
    await addToQueue('deleteNote', 'notes', { note_id, entry_id });
    return { success: true, queued: true };
  }
}

/** Server-only delete, for replaying a queued action. */
export async function deleteNoteSync(payload) {
  const { note_id, entry_id } = payload;
  const result = await request(`${PROJECT_URL}/service/notes`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'delete',
      values: { note_id },
    }),
  });

  // Drop both cache views of the deleted note (the list keeps its other rows).
  if (result?.success) {
    await cacheDelete(CACHE_STORES.NOTES, `note:${note_id}`);
    if (entry_id) await removeNoteRow(`notes:${entry_id}`, note_id);
  }
  return result;
}

/** Remove one note row from a cached notes list. */
async function removeNoteRow(cacheKey, note_id) {
  const cached = await cacheGet(CACHE_STORES.NOTES, cacheKey);
  const rows = Array.isArray(cached?.data) ? cached.data : [];
  if (!rows.length) return;
  await cacheSet(CACHE_STORES.NOTES, cacheKey, {
    success: true,
    data: rows.filter((n) => String(n.id) !== String(note_id)),
  });
}
