import { request, PROJECT_URL } from '@/lib/api';
import { cacheSet, CACHE_STORES } from '@/lib/cache';

/**
 * Fetch fields for a table.
 * Writes to IndexedDB, returns result for compatibility.
 */
export async function getFields(user_email, table_name) {
  const cacheKey = `${user_email}:${table_name}`;

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
    }
    return result;
  } catch (err) {
    console.error('[getFields] Failed:', err);
    return { success: false, data: [] };
  }
}

/**
 * Add a new field.
 * Syncs to server, then refreshes cache.
 */
export async function addField(user_email, table_name, field_name, data_type, is_required) {
  try {
    const result = await request(`${PROJECT_URL}/service/field`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'add',
        values: { user_email, table_name, field_name, data_type, is_required },
      }),
    });

    // Refresh fields cache on success
    if (result?.success) {
      await getFields(user_email, table_name);
    }
    return result;
  } catch (err) {
    console.error('[addField] Failed:', err);
    return { success: false, message: err.message || 'Failed to add field' };
  }
}

/**
 * Edit a field.
 * Syncs to server, then refreshes cache.
 */
export async function editField(user_email, table_name, field_name, data_type, is_required) {
  try {
    const result = await request(`${PROJECT_URL}/service/field`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'edit',
        values: { user_email, table_name, field_name, data_type, is_required },
      }),
    });

    if (result?.success) {
      await getFields(user_email, table_name);
    }
    return result;
  } catch (err) {
    console.error('[editField] Failed:', err);
    return { success: false, message: err.message || 'Failed to edit field' };
  }
}
