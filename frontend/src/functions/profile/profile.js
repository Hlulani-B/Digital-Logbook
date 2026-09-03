import { request, PROFILE_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';

// ── GET functions ──────────────────────────────────────────────

/**
 * Fetch user profile.
 * Writes to IndexedDB (triggers subscription), returns result for compatibility.
 */
export async function getProfile(email) {
  try {
    const result = await request(`${PROFILE_URL}/service/profile`, {
      method: 'POST',
      body: JSON.stringify({ function: 'getProfile', values: { email } }),
    });

    if (result?.success) {
      await cacheSet(CACHE_STORES.PROFILE, email, result);
    }
    return result;
  } catch (err) {
    console.error('[getProfile] Failed:', err);
    return { success: false };
  }
}

// ── POST/PUT functions — optimistic IndexedDB first ──────────

/**
 * Update username.
 * Updates IndexedDB immediately, then syncs to server.
 */
export async function updateUsername(email, username) {
  const cached = await cacheGet(CACHE_STORES.PROFILE, email);

  // 1. Optimistic: update in cache
  if (cached) {
    const currentData = cached.data || cached;
    await cacheSet(CACHE_STORES.PROFILE, email, {
      success: true,
      profile: { ...currentData, ...(currentData?.profile || {}), username },
    });
  }

  // 2. Sync to server
  try {
    const result = await request(`${PROFILE_URL}/service/profile`, {
      method: 'POST',
      body: JSON.stringify({ function: 'username', values: { email, username } }),
    });

    if (result?.success) {
      await getProfile(email);
    }
    return result;
  } catch (err) {
    console.error('[updateUsername] Server sync failed, rolling back:', err);
    if (cached) await cacheSet(CACHE_STORES.PROFILE, email, cached);
    return { success: false, message: err.message || 'Failed to update username' };
  }
}

/**
 * Add/update email.
 */
export async function addEmail(email) {
  try {
    const result = await request(`${PROFILE_URL}/service/profile`, {
      method: 'POST',
      body: JSON.stringify({ function: 'email', values: { email } }),
    });

    if (result?.success) {
      await getProfile(email);
    }
    return result;
  } catch (err) {
    console.error('[addEmail] Failed:', err);
    return { success: false, message: err.message || 'Failed to add email' };
  }
}

/**
 * Update display name.
 * Updates IndexedDB immediately, then syncs to server.
 */
export async function updateName(email, new_name) {
  const cached = await cacheGet(CACHE_STORES.PROFILE, email);

  // 1. Optimistic: update in cache
  if (cached) {
    const currentData = cached.data || cached;
    await cacheSet(CACHE_STORES.PROFILE, email, {
      success: true,
      profile: { ...currentData, ...(currentData?.profile || {}), name: new_name },
    });
  }

  // 2. Sync to server
  try {
    const result = await request(`${PROFILE_URL}/service/profile`, {
      method: 'POST',
      body: JSON.stringify({ function: 'name', values: { email, new_name } }),
    });

    if (result?.success) {
      await getProfile(email);
    }
    return result;
  } catch (err) {
    console.error('[updateName] Server sync failed, rolling back:', err);
    if (cached) await cacheSet(CACHE_STORES.PROFILE, email, cached);
    return { success: false, message: err.message || 'Failed to update name' };
  }
}

/**
 * Update avatar URL.
 * Updates IndexedDB immediately, then syncs to server.
 */
export async function updateAvatar(email, avatarUrl) {
  const cached = await cacheGet(CACHE_STORES.PROFILE, email);

  // 1. Optimistic: update in cache
  if (cached) {
    const currentData = cached.data || cached;
    await cacheSet(CACHE_STORES.PROFILE, email, {
      success: true,
      profile: { ...currentData, ...(currentData?.profile || {}), avatar_url: avatarUrl },
    });
  }

  // 2. Sync to server
  try {
    const result = await request(`${PROFILE_URL}/service/profile`, {
      method: 'POST',
      body: JSON.stringify({ function: 'avatar', values: { email, url: avatarUrl } }),
    });

    if (result?.success) {
      await getProfile(email);
    }
    return result;
  } catch (err) {
    console.error('[updateAvatar] Server sync failed, rolling back:', err);
    if (cached) await cacheSet(CACHE_STORES.PROFILE, email, cached);
    return { success: false, message: err.message || 'Failed to update avatar' };
  }
}

/**
 * Delete profile.
 * Clears all caches, then syncs to server.
 */
export async function deleteProfile(email) {
  // 1. Clear all caches immediately
  await cacheDelete(CACHE_STORES.PROFILE, email);
  await cacheDelete(CACHE_STORES.PROJECTS, email);
  await cacheDelete(CACHE_STORES.ALL_ENTRIES, email);

  // 2. Sync to server
  try {
    const result = await request(`${PROFILE_URL}/service/profile`, {
      method: 'POST',
      body: JSON.stringify({ function: 'deleteProfile', values: { email } }),
    });
    return result;
  } catch (err) {
    console.error('[deleteProfile] Failed:', err);
    return { success: false, message: err.message || 'Failed to delete profile' };
  }
}
