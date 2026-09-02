import { request, PROJECT_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';

export async function addProject(user_email, project_name, description) {
  const result = await request(`${PROJECT_URL}/service/project`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'add',
      values: { user_email, project_name, description },
    }),
  });
  
  // Invalidate projects cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.PROJECTS, user_email);
  }
  
  return result;
}

export async function editProjectName(user_email, new_project_name, old_project_name) {
  const result = await request(`${PROJECT_URL}/service/project`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'edit',
      values: { user_email, new_project_name, old_project_name },
    }),
  });
  
  // Invalidate projects and entries cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.PROJECTS, user_email);
    await cacheDelete(CACHE_STORES.ENTRIES, `${user_email}:${old_project_name}`);
    await cacheDelete(CACHE_STORES.ALL_ENTRIES, user_email);
  }
  
  return result;
}

export async function deleteProject(user_email, project_name) {
  const result = await request(`${PROJECT_URL}/service/project`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'delete',
      values: { user_email, project_name },
    }),
  });
  
  // Invalidate projects and entries cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.PROJECTS, user_email);
    await cacheDelete(CACHE_STORES.ENTRIES, `${user_email}:${project_name}`);
    await cacheDelete(CACHE_STORES.ALL_ENTRIES, user_email);
  }
  
  return result;
}

export async function getProjectsByEmail(user_email) {
  // Try cache first
  const cached = await cacheGet(CACHE_STORES.PROJECTS, user_email);
  if (cached) {
    // Return cached data immediately, fetch fresh in background
    const freshPromise = request(`${PROJECT_URL}/service/project`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'getProjects',
        values: { user_email },
      }),
    }).then(async (freshData) => {
      if (freshData?.success) {
        await cacheSet(CACHE_STORES.PROJECTS, user_email, freshData);
      }
      return freshData;
    });
    
    return cached.data !== undefined ? cached.data : cached;
  }
  
  // No cache - fetch and cache
  const result = await request(`${PROJECT_URL}/service/project`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'getProjects',
      values: { user_email },
    }),
  });
  
  if (result?.success) {
    await cacheSet(CACHE_STORES.PROJECTS, user_email, result);
  }
  
  return result;
}
