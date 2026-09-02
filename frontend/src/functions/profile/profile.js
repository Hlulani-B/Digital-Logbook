import { request, PROFILE_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';

export async function updateUsername(email, username) {
  const result = await request(`${PROFILE_URL}/service/profile`, {
    method: 'POST',
    body: JSON.stringify({ function: 'username', values: { email, username } }),
  });
  
  // Invalidate profile cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.PROFILE, email);
  }
  
  return result;
}

export async function addEmail(email) {
  const result = await request(`${PROFILE_URL}/service/profile`, {
    method: 'POST',
    body: JSON.stringify({ function: 'email', values: { email } }),
  });
  
  // Invalidate profile cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.PROFILE, email);
  }
  
  return result;
}

export async function updateName(email, new_name) {
  const result = await request(`${PROFILE_URL}/service/profile`, {
    method: 'POST',
    body: JSON.stringify({ function: 'name', values: { email, new_name } }),
  });
  
  // Invalidate profile cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.PROFILE, email);
  }
  
  return result;
}

export async function updateAvatar(email, avatarUrl) {
  const result = await request(`${PROFILE_URL}/service/profile`, {
    method: 'POST',
    body: JSON.stringify({ function: 'avatar', values: { email, url: avatarUrl } }),
  });
  
  // Invalidate profile cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.PROFILE, email);
  }
  
  return result;
}

export async function getProfile(email) {
  // Try cache first
  const cached = await cacheGet(CACHE_STORES.PROFILE, email);
  if (cached) {
    // Return cached data immediately, fetch fresh in background
    const freshPromise = request(`${PROFILE_URL}/service/profile`, {
      method: 'POST',
      body: JSON.stringify({ function: 'getProfile', values: { email } }),
    }).then(async (freshData) => {
      if (freshData?.success) {
        await cacheSet(CACHE_STORES.PROFILE, email, freshData);
      }
      return freshData;
    });
    
    return cached.data !== undefined ? cached.data : cached;
  }
  
  // No cache - fetch and cache
  const result = await request(`${PROFILE_URL}/service/profile`, {
    method: 'POST',
    body: JSON.stringify({ function: 'getProfile', values: { email } }),
  });
  
  if (result?.success) {
    await cacheSet(CACHE_STORES.PROFILE, email, result);
  }
  
  return result;
}

export async function deleteProfile(email) {
  const result = await request(`${PROFILE_URL}/service/profile`, {
    method: 'POST',
    body: JSON.stringify({ function: 'deleteProfile', values: { email } }),
  });
  
  // Clear all caches on profile deletion
  if (result?.success) {
    await cacheDelete(CACHE_STORES.PROFILE, email);
    await cacheDelete(CACHE_STORES.PROJECTS, email);
    await cacheDelete(CACHE_STORES.ALL_ENTRIES, email);
  }
  
  return result;
}
