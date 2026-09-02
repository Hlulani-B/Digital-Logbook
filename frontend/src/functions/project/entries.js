import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';

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
  
  // Invalidate cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.ENTRIES, `${user_email}:${project_name}`);
    await cacheDelete(CACHE_STORES.ALL_ENTRIES, user_email);
    await cacheDelete(CACHE_STORES.PROJECTS, user_email);
  }
  
  return result;
}

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
  
  // Invalidate cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.ENTRIES, `${user_email}:${project_name}`);
    await cacheDelete(CACHE_STORES.ALL_ENTRIES, user_email);
  }
  
  return result;
}

export async function getEntries(user_email, project_name) {
  const cacheKey = `${user_email}:${project_name}`;
  
  // Try cache first
  const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
  if (cached) {
    // Return cached data immediately, fetch fresh in background
    const freshPromise = request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'get',
        values: { user_email, project_name },
      }),
    }).then(async (freshData) => {
      if (freshData?.success) {
        await cacheSet(CACHE_STORES.ENTRIES, cacheKey, freshData);
      }
      return freshData;
    });
    
    return cached.data !== undefined ? cached.data : cached;
  }
  
  // No cache - fetch and cache
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
}

export async function getAllEntries(user_email) {
  // Try cache first
  const cached = await cacheGet(CACHE_STORES.ALL_ENTRIES, user_email);
  if (cached) {
    // Return cached data immediately, fetch fresh in background
    const freshPromise = request(`${PROJECT_URL}/service/entry`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getAll',
        values: { user_email },
      }),
    }).then(async (freshData) => {
      if (freshData?.success) {
        await cacheSet(CACHE_STORES.ALL_ENTRIES, user_email, freshData);
      }
      return freshData;
    });
    
    return cached.data !== undefined ? cached.data : cached;
  }
  
  // No cache - fetch and cache
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
}

export async function deleteEntry(user_email, project_name, entry) {
  const result = await request(`${PROJECT_URL}/service/entry`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'delete',
      values: { user_email, project_name, entry },
    }),
  });
  
  // Invalidate cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.ENTRIES, `${user_email}:${project_name}`);
    await cacheDelete(CACHE_STORES.ALL_ENTRIES, user_email);
    await cacheDelete(CACHE_STORES.PROJECTS, user_email);
  }
  
  return result;
}

export async function deleteEntryById(user_email, entry_id) {
  const result = await request(`${PROJECT_URL}/service/entry`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'deleteById',
      values: { user_email, entry_id },
    }),
  });
  
  // Invalidate cache on successful write
  if (result?.success) {
    // Clear all entry caches since we don't know which project
    await cacheDelete(CACHE_STORES.ALL_ENTRIES, user_email);
    await cacheDelete(CACHE_STORES.PROJECTS, user_email);
  }
  
  return result;
}

export async function sortUnarchivedEntries(user_email, project_name, sort_type) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'sortUnarchived',
      values: { user_email, project_name, sort_type },
    }),
  });
}

export async function sortArchivedEntries(user_email, project_name, sort_type) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'sortArchived',
      values: { user_email, project_name, sort_type },
    }),
  });
}
