import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';
import { addToQueue } from '@/CacheFunctions/offlineQueue';

/**
 * Fields are stored per-project: the backend keys them by `table_name`, which
 * equals the project name (see services/project-service fields). All reads are
 * cache-first so columns render instantly and still appear while offline; all
 * mutations write the local SQLite cache first (optimistic) and only then sync
 * to the server, queueing for replay when offline or when the sync fails.
 */

/** Upsert `row` into `rows` (matched by field_name), returning a new array. */
function mergeFieldRow(rows, row) {
  const idx = rows.findIndex((r) => r?.field_name === row.field_name);
  if (idx >= 0) {
    const copy = [...rows];
    copy[idx] = { ...copy[idx], ...row };
    return copy;
  }
  return [...rows, row];
}

/** Read the cached field rows for a project, or null when nothing is cached. */
async function readCachedFields(user_email, table_name) {
  const cached = await cacheGet(CACHE_STORES.FIELDS, `${user_email}:${table_name}`);
  return Array.isArray(cached?.data) ? cached.data : null;
}

/**
 * Fetch fields for a project.
 * Cache-first: offline returns the local cache; online refreshes the cache.
 */
export async function getFields(user_email, table_name) {
  const cacheKey = `${user_email}:${table_name}`;
  const cached = await cacheGet(CACHE_STORES.FIELDS, cacheKey);

  // Offline: serve the local cache (empty list if never fetched).
  if (!navigator.onLine) {
    return cached && Array.isArray(cached.data) ? cached : { success: false, data: [] };
  }

  try {
    const result = await request(`${PROJECT_URL}/service/field`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'get',
        values: { user_email, table_name },
      }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.FIELDS, cacheKey, result);
      return result;
    }
    // Server returned an error shape — prefer the cache so the UI keeps showing columns.
    return cached ?? result;
  } catch (err) {
    console.error('[getFields] Failed:', err);
    return cached ?? { success: false, data: [] };
  }
}

/**
 * Server-only field add. Used both by the online path of `addField` and by the
 * offline queue dispatcher (replay). Refreshes the cache from the server on
 * success so optimistic rows are replaced with authoritative data.
 * This never queues, so replaying it cannot create duplicate queue entries.
 */
export async function addFieldSync({ user_email, table_name, field_name, data_type, is_required }) {
  const result = await request(`${PROJECT_URL}/service/field`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'add',
      values: { user_email, table_name, field_name, data_type, is_required },
    }),
  });
  if (result?.success) {
    try {
      await getFields(user_email, table_name);
    } catch {
      /* keep the optimistic cache rows if the refresh fails */
    }
  }
  return result;
}

/**
 * Server-only field edit. Mirrors `addFieldSync` for replay safety.
 */
export async function editFieldSync({ user_email, table_name, field_name, data_type, is_required }) {
  const result = await request(`${PROJECT_URL}/service/field`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'edit',
      values: { user_email, table_name, field_name, data_type, is_required },
    }),
  });
  if (result?.success) {
    try {
      await getFields(user_email, table_name);
    } catch {
      /* keep the optimistic cache rows if the refresh fails */
    }
  }
  return result;
}

/**
 * Add a new field.
 * Writes the column to the local cache immediately, then syncs to the server.
 * Queues for replay when offline or when the server sync fails.
 */
export async function addField(user_email, table_name, field_name, data_type, is_required) {
  const cacheKey = `${user_email}:${table_name}`;

  // 1. Optimistic: show the column locally right away.
  const existing = (await readCachedFields(user_email, table_name)) ?? [];
  const optimisticRow = { field_name, data_type, is_required: !!is_required, _optimistic: true };
  await cacheSet(CACHE_STORES.FIELDS, cacheKey, {
    success: true,
    data: mergeFieldRow(existing, optimisticRow),
  });

  const payload = { user_email, table_name, field_name, data_type, is_required };

  // 2. Offline: queued action already reflected optimistically.
  if (!navigator.onLine) {
    console.log('[addField] Offline, queuing action');
    await addToQueue('addField', 'fields', payload);
    return { success: true, queued: true };
  }

  // 3. Online: sync to server.
  try {
    const result = await addFieldSync(payload);
    if (result?.success === false) {
      await addToQueue('addField', 'fields', payload);
    }
    return result;
  } catch (err) {
    console.error('[addField] Server sync failed, queuing for retry:', err);
    await addToQueue('addField', 'fields', payload);
    return { success: true, queued: true };
  }
}

/**
 * Edit a field.
 * Updates the local cache immediately, then syncs to the server.
 * Queues for replay when offline or when the server sync fails.
 */
export async function editField(user_email, table_name, field_name, data_type, is_required) {
  const cacheKey = `${user_email}:${table_name}`;

  // 1. Optimistic: update the column locally right away.
  const existing = await readCachedFields(user_email, table_name);
  if (existing) {
    const nextRows = existing.map((r) =>
      r?.field_name === field_name ? { ...r, data_type, is_required: !!is_required } : r
    );
    await cacheSet(CACHE_STORES.FIELDS, cacheKey, { success: true, data: nextRows });
  }

  const payload = { user_email, table_name, field_name, data_type, is_required };

  // 2. Offline: queue for later sync.
  if (!navigator.onLine) {
    console.log('[editField] Offline, queuing action');
    await addToQueue('editField', 'fields', payload);
    return { success: true, queued: true };
  }

  // 3. Online: sync to server.
  try {
    const result = await editFieldSync(payload);
    if (result?.success === false) {
      await addToQueue('editField', 'fields', payload);
    }
    return result;
  } catch (err) {
    console.error('[editField] Server sync failed, queuing for retry:', err);
    await addToQueue('editField', 'fields', payload);
    return { success: true, queued: true };
  }
}
