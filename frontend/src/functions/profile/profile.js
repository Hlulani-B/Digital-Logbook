import { request, PROFILE_URL } from '@/lib/api';
import { cacheGet, cacheSet, cacheDelete, CACHE_STORES } from '@/lib/cache';
import { addToQueue } from '@/CacheFunctions/offlineQueue';

// ── GET functions ──────────────────────────────────────────────

/**
 * Fetch user profile.
 * Local-first: returns cached data immediately (instant UI), refreshes from server in background.
 */
export async function getProfile(email) {
  const cached = await cacheGet(CACHE_STORES.PROFILE, email);

  // 1. Return cached data first (instant) if available
  if (cached?.data || cached?.profile || cached?.success) {
    if (navigator.onLine) {
      // Refresh in background — don't block the caller
      _refreshProfileFromServer(email).catch(() => {});
    }
    return { ...cached, _fromCache: true };
  }

  // 2. No cache — must go to server
  if (!navigator.onLine) {
    console.log('[getProfile] Offline and no cache');
    return { success: false, offline: true };
  }

  return _fetchProfileFromServer(email);
}

/** Internal: fetch profile from server and write to cache */
async function _fetchProfileFromServer(email) {
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
    // Fallback to cache on any server failure
    const cached = await cacheGet(CACHE_STORES.PROFILE, email);
    if (cached) {
      console.log('[getProfile] Server failed — serving from cache');
      return cached;
    }
    return { success: false };
  }
}

/** Internal: background refresh of profile from server */
async function _refreshProfileFromServer(email) {
  await _fetchProfileFromServer(email);
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

  // 2. Check online status
  if (!navigator.onLine) {
    // Offline: queue for later sync
    console.log('[updateUsername] Offline, queuing action');
    await addToQueue('updateUsername', 'profile', {
      email,
      username,
    });
    return { success: true, queued: true };
  }

  // 3. Sync to server
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
    // 4. On failure, queue for retry (don't rollback)
    console.error('[updateUsername] Server sync failed, queuing for retry:', err);
    await addToQueue('updateUsername', 'profile', {
      email,
      username,
    });
    return { success: true, queued: true };
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

  // 2. Check online status
  if (!navigator.onLine) {
    console.log('[updateName] Offline, queuing action');
    await addToQueue('updateName', 'profile', {
      email,
      new_name,
    });
    return { success: true, queued: true };
  }

  // 3. Sync to server
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
    console.error('[updateName] Server sync failed, queuing for retry:', err);
    await addToQueue('updateName', 'profile', {
      email,
      new_name,
    });
    return { success: true, queued: true };
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

  // 2. Check online status
  if (!navigator.onLine) {
    console.log('[updateAvatar] Offline, queuing action');
    await addToQueue('updateAvatar', 'profile', {
      email,
      avatarUrl,
    });
    return { success: true, queued: true };
  }

  // 3. Sync to server
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
    console.error('[updateAvatar] Server sync failed, queuing for retry:', err);
    await addToQueue('updateAvatar', 'profile', {
      email,
      avatarUrl,
    });
    return { success: true, queued: true };
  }
}

/**
 * Persist the "Email notifications" preference server-side so the
 * due-date email sender can honour it. localStorage remains the UI
 * source of truth; this is a fire-and-forget sync.
 */
export async function setEmailNotifications(email, enabled) {
  if (!navigator.onLine) {
    console.log('[setEmailNotifications] Offline, skipping server sync');
    return { success: true, skipped: true };
  }

  try {
    return await request(`${PROFILE_URL}/service/profile`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'emailNotifications',
        values: { email, enabled: Boolean(enabled) },
      }),
    });
  } catch (err) {
    console.error('[setEmailNotifications] Failed:', err);
    return { success: false, message: err.message };
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
