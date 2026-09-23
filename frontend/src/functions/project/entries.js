import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';
import { addToQueue } from '@/CacheFunctions/offlineQueue';
import { isNotesPayload } from '@/lib/entryPayload';
import { getFields } from './fields';
import { validateEntryDates, ENTRY_DATE_COLUMNS } from '@/lib/newEntryDates';

function withoutUndefined(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

// ── GET functions — write to IndexedDB, don't return ──────────

/**
 * Fetch entries for a specific project.
 * Cache-first: reads from IndexedDB, falls back to server.
 */
export async function getEntries(user_email, project_name) {
  const cacheKey = `${user_email}:${project_name}`;

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
    if (cached) {
      console.log('[getEntries] Offline — serving from cache');
      return cached;
    }
    console.log('[getEntries] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

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
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
    if (cached) {
      console.log('[getEntries] Server failed — serving from cache');
      return cached;
    }
    return { success: false, data: [] };
  }
}

/**
 * Fetch ALL entries for a user.
 * Cache-first: reads from IndexedDB, falls back to server.
 * Guard: never overwrites non-empty cache with empty server data.
 */
export async function getAllEntries(user_email) {
  console.log('[getAllEntries] called for', user_email);

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);
    if (cached) {
      console.log('[getAllEntries] Offline — serving from cache');
      return cached;
    }
    console.log('[getAllEntries] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getAll',
        values: { user_email },
      }),
    });
    console.log(
      '[getAllEntries] server returned:',
      result?.success,
      Array.isArray(result?.data) ? `len=${result.data.length}` : 'no-data'
    );

    if (result?.success) {
      const data = Array.isArray(result.data) ? result.data : [];
      // Don't clobber good cache with empty server response
      if (data.length === 0) {
        const existing = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);
        const existingData = existing?.data || [];
        if (Array.isArray(existingData) && existingData.length > 0) {
          console.warn(
            '[getAllEntries] Server returned 0 entries but cache has',
            existingData.length,
            '— keeping cache'
          );
          return result; // return without writing to cache
        }
      }
      await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, result);
    }
    return result;
  } catch (err) {
    console.error('[getAllEntries] Failed:', err);
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);
    if (cached) {
      console.log('[getAllEntries] Server failed — serving from cache');
      return cached;
    }
    return { success: false, data: [] };
  }
}

/**
 * Fetch sorted unarchived entries for a project.
 * Cache-first: reads from IndexedDB, falls back to server.
 */
export async function sortUnarchivedEntries(user_email, project_name, sort_type) {
  const cacheKey = `${user_email}:${project_name}`;

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
    if (cached) {
      console.log('[sortUnarchivedEntries] Offline — serving from cache');
      return cached;
    }
    console.log('[sortUnarchivedEntries] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'sortUnarchived',
        values: { user_email, project_name, sort_type },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ENTRIES, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[sortUnarchivedEntries] Failed:', err);
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
    if (cached) {
      console.log('[sortUnarchivedEntries] Server failed — serving from cache');
      return cached;
    }
    return { success: false, data: [] };
  }
}

/**
 * Fetch sorted archived entries for a project.
 * Cache-first: reads from IndexedDB, falls back to server.
 */
export async function sortArchivedEntries(user_email, project_name, sort_type) {
  const cacheKey = `${user_email}:${project_name}:archived`;

  // Offline: serve from cache immediately
  if (!navigator.onLine) {
    const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
    if (cached) {
      console.log('[sortArchivedEntries] Offline — serving from cache');
      return cached;
    }
    console.log('[sortArchivedEntries] Offline and no cache');
    return { success: false, offline: true, data: [] };
  }

  try {
    const result = await request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'sortArchived',
        values: { user_email, project_name, sort_type },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.ENTRIES, cacheKey, result);
    }
    return result;
  } catch (err) {
    console.error('[sortArchivedEntries] Failed:', err);
    // Fallback to cache on server failure
    const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
    if (cached) {
      console.log('[sortArchivedEntries] Server failed — serving from cache');
      return cached;
    }
    return { success: false, data: [] };
  }
}

// Entry writes share US54 prevalidation and an awaited server result. Queue
// replay uses the server-only functions below and cannot recursively requeue.
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const rowsOf = (cached) =>
  Array.isArray(cached?.data) ? cached.data : Array.isArray(cached) ? cached : [];
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cacheLocations = (payload) => [
  [CACHE_STORES.ENTRIES, `${payload.user_email}:${payload.project_name}`],
  [CACHE_STORES.ALL_ENTRIES, payload.user_email],
];

const cacheWrites = new Map();
async function changeEntryCaches(payload, transform) {
  for (const [store, key] of cacheLocations(payload)) {
    const lock = `${store}:${key}`;
    const write = (cacheWrites.get(lock) || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const cached = await cacheGet(store, key);
        await cacheSet(store, key, { success: true, data: transform(rowsOf(cached)) });
      });
    cacheWrites.set(lock, write);
    try {
      await write;
    } finally {
      if (cacheWrites.get(lock) === write) cacheWrites.delete(lock);
    }
  }
}

function reconcileEntry(row, current, local) {
  if (!local) return row;
  const expected = { ...local.before, ...local.patch };
  if (record(local.patch.entries) && record(local.before.entries))
    expected.entries = { ...local.before.entries, ...local.patch.entries };
  const merged = { ...row };
  for (const [key, value] of Object.entries(current)) {
    if (['id', 'created_at', '_optimistic'].includes(key)) continue;
    if (key === 'entries' && record(value) && record(expected.entries) && record(row.entries)) {
      merged.entries = { ...row.entries };
      for (const [field, assigned] of Object.entries(value)) {
        if (!sameValue(assigned, expected.entries[field])) merged.entries[field] = assigned;
      }
    } else if (!sameValue(value, expected[key])) merged[key] = value;
  }
  return merged;
}

// Roll back only values still owned by this optimistic operation, preserving
// unrelated entries and subsequent edits. Metadata remains local, never in RPC.
export async function rollbackEntryMutation(payload) {
  const local = payload._local;
  if (!local) return;
  await changeEntryCaches(payload, (rows) => {
    if (local.created) return rows.filter((row) => String(row.id) !== String(local.id));
    return rows.map((row) => {
      if (String(row.id) !== String(local.id)) return row;
      const restored = { ...row };
      for (const [key, value] of Object.entries(local.patch)) {
        if (key === 'entries' && record(value) && record(row.entries)) {
          restored.entries = { ...row.entries };
          for (const [field, assigned] of Object.entries(value)) {
            if (!sameValue(row.entries[field], assigned)) continue;
            if (Object.prototype.hasOwnProperty.call(local.before.entries || {}, field))
              restored.entries[field] = local.before.entries[field];
            else delete restored.entries[field];
          }
        } else if (sameValue(row[key], value)) {
          if (Object.prototype.hasOwnProperty.call(local.before, key))
            restored[key] = local.before[key];
          else delete restored[key];
        }
      }
      return restored;
    });
  });
}

async function syncEntryMutation(action, payload) {
  const { _local, ...values } = payload;
  let result = await request(`${PROJECT_URL}/service/entry`, {
    method: 'POST',
    body: JSON.stringify({ function: action, values: withoutUndefined(values) }),
  });
  const confirmed = Array.isArray(result?.data) ? result.data[0] : result?.data;
  if (result?.success !== false && (result?.success !== true || !confirmed?.id)) {
    result = {
      success: false,
      code: 'ENTRY_RESPONSE_INVALID',
      retryable: false,
      message: 'The server did not confirm the saved entry. Reload before trying again.',
    };
  }
  if (result?.success && result.data) {
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (row)
      await changeEntryCaches(payload, (rows) => {
        const id = _local?.id ?? payload.entry_id;
        const present = rows.some(
          (item) => String(item.id) === String(id) || String(item.id) === String(row.id)
        );
        return present
          ? rows.map((item) =>
              String(item.id) === String(id) || String(item.id) === String(row.id)
                ? reconcileEntry(row, item, _local)
                : item
            )
          : action === 'add'
            ? [...rows, row]
            : rows;
      });
  } else if (result?.success === false && result.retryable !== true) {
    await rollbackEntryMutation(payload);
  }
  return result;
}

export const addEntrySync = (payload) => syncEntryMutation('add', payload);
export const updateEntrySync = (payload) => syncEntryMutation('update', payload);

async function mutateEntry(action, input, options = { requireServer: false }) {
  if (options.requireServer && !navigator.onLine)
    return { success: false, message: 'Connect to the internet to import entries.' };
  const payload = withoutUndefined(input);
  const cached = await cacheGet(
    CACHE_STORES.ENTRIES,
    `${payload.user_email}:${payload.project_name}`
  );
  const cachedAll = await cacheGet(CACHE_STORES.ALL_ENTRIES, payload.user_email);
  let before = [...rowsOf(cached), ...rowsOf(cachedAll)].find(
    (row) => String(row.id) === String(payload.entry_id)
  );
  if (action === 'update' && !before && navigator.onLine) {
    before = rowsOf(await getEntries(payload.user_email, payload.project_name)).find(
      (row) => String(row.id) === String(payload.entry_id)
    );
  }
  if (action === 'update' && !before)
    return { success: false, message: 'Load the entry before editing its dates.' };
  const schema = await getFields(payload.user_email, payload.project_name);
  if (schema?.success !== true || !Array.isArray(schema.data))
    return {
      success: false,
      code: 'ENTRY_SCHEMA_UNAVAILABLE',
      message: 'Cannot validate entry dates until project fields are loaded.',
    };
  const checked = validateEntryDates({
    dates: payload,
    values: action === 'add' ? payload.entry_object : payload.new_entry,
    fields: schema.data,
    previous: action === 'update' ? before : undefined,
  });
  if (!checked.success) return checked;
  for (const key of ENTRY_DATE_COLUMNS) delete payload[key];
  Object.assign(payload, checked.dates);
  payload[action === 'add' ? 'entry_object' : 'new_entry'] = checked.values;
  // Match the existing backend's null-as-no-change start/end semantics.
  if (action === 'update') {
    for (const key of ['started_at', 'ended_at']) if (payload[key] === null) delete payload[key];
  }
  const id = action === 'add' ? `optimistic-${crypto.randomUUID()}` : payload.entry_id;
  const patch = withoutUndefined(
    Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) =>
          !['entry_id', 'entry_object', 'new_entry', 'notes', 'timer_action', 'duration'].includes(
            key
          )
      )
    )
  );
  if (checked.values !== undefined) patch.entries = checked.values;
  const timerPending =
    action === 'update' &&
    (payload.timer_action ||
      (payload.status !== before?.status &&
        ['in_motion', 'done_and_dusted'].includes(payload.status)));
  if (timerPending) patch._timerPending = true;
  const optimistic =
    action === 'add'
      ? { ...patch, id, created_at: new Date().toISOString(), _optimistic: true }
      : {
          ...before,
          ...patch,
          entries:
            record(patch.entries) && record(before.entries)
              ? { ...before.entries, ...patch.entries }
              : (patch.entries ?? before.entries),
        };
  payload._local = { id, created: action === 'add', before: before || {}, patch };
  await changeEntryCaches(payload, (rows) =>
    action === 'add'
      ? [...rows, optimistic]
      : rows.map((row) =>
          String(row.id) === String(id)
            ? {
                ...row,
                ...patch,
                entries:
                  record(patch.entries) && record(row.entries)
                    ? { ...row.entries, ...patch.entries }
                    : (patch.entries ?? row.entries),
              }
            : row
        )
  );
  const queue = async () => {
    try {
      await addToQueue(action === 'add' ? 'addEntry' : 'updateEntry', 'entries', payload);
    } catch (error) {
      await rollbackEntryMutation(payload);
      return { success: false, message: error.message || 'Could not store the pending change.' };
    }
    return {
      success: true,
      queued: true,
      data: optimistic,
      message: timerPending
        ? 'Pending sync — timer timing takes effect on synchronization.'
        : 'Saved locally; pending server validation.',
    };
  };
  if (!navigator.onLine) return queue();
  try {
    const result = await syncEntryMutation(action, payload);
    if (result?.success === false && result.retryable === true && !options.requireServer)
      return queue();
    if (result?.success === false) await rollbackEntryMutation(payload);
    return result;
  } catch (error) {
    // Only transport failures are queued. Known HTTP failures remain failures.
    if (options.requireServer || /^API error \d+:/.test(error.message || '')) {
      await rollbackEntryMutation(payload);
      return { success: false, message: error.message || 'Entry could not be saved.' };
    }
    return queue();
  }
}

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
  notes,
  options = { requireServer: false }
) {
  if (summary != null && (Array.isArray(summary) || isNotesPayload(summary))) {
    if (notes == null) notes = summary;
    summary = null;
  }
  return mutateEntry(
    'add',
    {
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
    },
    options
  );
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
  summary,
  target_duration_ms,
  paused_ms,
  paused_at,
  timer_action
) {
  return mutateEntry('update', {
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
    target_duration_ms,
    paused_ms,
    paused_at,
    timer_action,
  });
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
