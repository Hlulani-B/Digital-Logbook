# Client-Side Persistent Caching (IndexedDB)

## Overview

The Digital Logbook frontend implements **client-side persistent caching using IndexedDB, following an IndexedDB-first with optimistic updates pattern**. This is a local-first architecture where:

- **Read operations**: Data is read from IndexedDB immediately (no loading states), then refreshed from the server in the background
- **Write operations**: Data is written to IndexedDB immediately (optimistic update), then synced to the server in the background
- **Event-driven**: Components subscribe to cache changes via `cacheSubscribe()` and re-render automatically when cache updates

This pattern is also known as **offline-first** or **optimistic UI** — the application reads and writes to a local mirror first, then reconciles with the server.

## Why Caching?

| Problem | Solution |
|---|---|
| Network latency on every page load | IndexedDB reads are instant (no network round-trip) |
| Poor UX while waiting for Supabase | UI renders from cache immediately |
| Offline/poor connectivity | Cached data available even when server is unreachable |
| Repeated fetches of same data | Cache serves repeated reads without hitting the server |

## Architecture

### Read Operations (GET)
```
1. Component mounts
2. useCachedData hook reads from IndexedDB immediately → displays data (no loading)
3. Hook subscribes to cache changes for this store+key
4. Background fetch from server → writes to IndexedDB
5. IndexedDB write triggers subscription → component re-renders with fresh data
```

### Write Operations (POST/PUT)
```
1. User triggers action (e.g., add entry)
2. Function writes optimistic data to IndexedDB immediately
3. IndexedDB write triggers subscription → component re-renders with optimistic data
4. Function syncs to server in background
5. On success: re-fetches from server → writes real data to IndexedDB → component updates
6. On failure: rolls back IndexedDB to previous state → component re-renders with rolled-back data
```

## Implementation

### Cache Module (`src/lib/cache.js`)

The cache module provides these core functions:

| Function | Purpose |
|---|---|
| `cacheGet(store, key)` | Read from IndexedDB |
| `cacheSet(store, key, data)` | Write to IndexedDB (triggers subscription events) |
| `cacheDelete(store, key)` | Remove from IndexedDB (triggers subscription events) |
| `cacheSubscribe(store, key, callback)` | Subscribe to cache changes (returns unsubscribe fn) |
| `cacheGetTimestamp(key)` | Check when cache was last updated |
| `clearUserCache(email)` | Clear all cached data for a user (logout) |

### React Hook (`src/hooks/useCachedData.js`)

| Hook | Purpose |
|---|---|
| `useCachedData(store, key, fetchFn, deps)` | Generic hook — reads from IndexedDB, subscribes to changes, triggers background fetch |
| `useCachedProjects(email, fetchFn)` | Convenience hook for projects |
| `useCachedEntries(email, projectName, fetchFn)` | Convenience hook for entries |
| `useCachedProfile(email, fetchFn)` | Convenience hook for profile |

### Cache Stores

| Store | Key Format | Data |
|---|---|---|
| `projects` | `user@email.com` | User's project list |
| `entries` | `user@email.com:project_name` | Entries for a specific project |
| `all-entries` | `user@email.com` | All entries across all projects |
| `profile` | `user@email.com` | User profile (name, avatar, username) |
| `search` | `user@email.com:keyword` | Search results |
| `archives` | Various | Archived projects/entries |
| `fields` | `user@email.com:table_name` | Custom field definitions |

### Read Operations (Cache-First with Event Subscriptions)

All read functions fetch from server and write to IndexedDB. Components use `useCachedData` hook to read from IndexedDB and subscribe to changes:

```javascript
// Function: fetches from server, writes to IndexedDB
export async function getProjectsByEmail(user_email) {
  const result = await request(...);
  if (result?.success) {
    await cacheSet(CACHE_STORES.PROJECTS, user_email, result);
    // cacheSet triggers subscription → components re-render automatically
  }
  return result;
}

// Component: reads from IndexedDB, subscribes to changes
function ProjectsList({ email }) {
  const { data } = useCachedData('projects', email, () => getProjectsByEmail(email), [email]);
  // data is available immediately from IndexedDB (no loading spinner)
  return <div>{data?.projects?.map(p => <span>{p.project_name}</span>)}</div>;
}
```

### Write Operations (Optimistic Updates with Rollback)

All write functions use **optimistic updates**: write to IndexedDB first for instant UI, then sync to server. On failure, roll back IndexedDB:

```javascript
export async function addEntry(user_email, project_name, entry_object, ...) {
  const cacheKey = `${user_email}:${project_name}`;

  // 1. Read current cache for rollback
  const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);

  // 2. Write optimistic data to IndexedDB immediately
  const optimisticEntry = { id: `optimistic-${Date.now()}`, ...entry_object, _optimistic: true };
  await cacheSet(CACHE_STORES.ENTRIES, cacheKey, {
    success: true,
    data: [...(cached?.data || []), optimisticEntry],
  });
  // → Component re-renders immediately with optimistic data

  // 3. Sync to server
  try {
    const result = await request(...);
    if (result?.success) {
      // 4. On success, refresh with real data from server
      await getEntries(user_email, project_name);
    }
    return result;
  } catch (err) {
    // 5. On failure, rollback to previous state
    await cacheSet(CACHE_STORES.ENTRIES, cacheKey, cached);
    return { success: false, message: err.message };
  }
}
```

### Functions with Caching

| Function | Cache Behavior |
|---|---|
| `getProjectsByEmail()` | Fetch → write to IndexedDB → triggers subscription |
| `getEntries()` | Fetch → write to IndexedDB → triggers subscription |
| `getAllEntries()` | Fetch → write to IndexedDB → triggers subscription |
| `getProfile()` | Fetch → write to IndexedDB → triggers subscription |
| `addEntry()` | Optimistic write to IndexedDB → server sync → refresh or rollback |
| `updateEntry()` | Optimistic patch in IndexedDB → server sync → refresh or rollback |
| `deleteEntry()` | Optimistic remove from IndexedDB → server sync → refresh or rollback |
| `addProject()` | Optimistic write to IndexedDB → server sync → refresh or rollback |
| `editProjectName()` | Optimistic rename in IndexedDB → server sync → refresh or rollback |
| `deleteProject()` | Optimistic remove from IndexedDB → server sync → refresh or rollback |
| `updateUsername()` | Optimistic update in IndexedDB → server sync → refresh or rollback |
| `updateName()` | Optimistic update in IndexedDB → server sync → refresh or rollback |
| `updateAvatar()` | Optimistic update in IndexedDB → server sync → refresh or rollback |
| `deleteProfile()` | Clear all caches → server sync |

## Cache Invalidation Strategy

The cache uses **optimistic updates with event-driven subscriptions**:

1. **On write**: Write optimistic data to IndexedDB immediately → UI updates instantly
2. **On server success**: Re-fetch fresh data → write to IndexedDB → UI updates with real data
3. **On server failure**: Roll back IndexedDB to previous state → UI reverts
4. **On logout**: `clearUserCache(email)` wipes all cached data for the user

### What Gets Invalidated

| Write Operation | Cache Entries Invalidated |
|---|---|
| Add entry | `entries:{email}:{project}`, `all-entries:{email}`, `projects:{email}` |
| Update entry | `entries:{email}:{project}`, `all-entries:{email}` |
| Delete entry | `entries:{email}:{project}`, `all-entries:{email}`, `projects:{email}` |
| Add project | `projects:{email}` |
| Edit project name | `projects:{email}`, `entries:{email}:{old_name}`, `all-entries:{email}` |
| Delete project | `projects:{email}`, `entries:{email}:{project}`, `all-entries:{email}` |
| Update profile | `profile:{email}` |
| Delete profile | `profile:{email}`, `projects:{email}`, `all-entries:{email}` |
| **Sign out** | **All stores for user's email** |
| **Delete account** | **All stores for user's email** |

### Authentication & Cache Clearing

The `signOut` and `deleteAccount` functions in `AuthContext.tsx` call `clearUserCache(email)` before the Supabase sign-out completes. This ensures:

- No stale data leaks between sessions on the same browser
- A different user signing in won't see the previous user's cached projects/entries/profile
- Account deletion fully wipes all local data

```javascript
// In AuthContext.tsx
const signOut = async () => {
  const email = state.user?.email;
  if (email) {
    await clearUserCache(email);  // Wipe IndexedDB first
  }
  await getSupabase().auth.signOut();
};
```

## Performance Impact

| Metric | Without Cache | With Cache |
|---|---|---|
| First page load | ~500-1000ms (network) | ~500-1000ms (network, first visit) |
| Subsequent loads | ~500-1000ms (network) | <10ms (IndexedDB read) |
| Navigation between pages | Full network fetch each time | Instant from cache |
| Offline/poor connectivity | App breaks or shows loading | Shows cached data |

## Testing

Tests are in `src/lib/__tests__/cache.test.js` and cover:

- Cache get/set operations
- Cache deletion and timestamp tracking
- User cache clearing
- Stale-while-revalidate pattern
- Error handling for failed fetches

Run tests:
```bash
cd frontend
npm test
```

## Dependencies

- [`idb`](https://www.npmjs.com/package/idb) — Lightweight IndexedDB wrapper (Promise-based API)

## Future Enhancements

1. **Offline write queue**: Buffer writes when offline, sync when connection returns
2. **Conflict resolution**: Handle cases where local and server data diverge
3. **Cache size limits**: Evict oldest entries when cache grows too large
4. **Background sync**: Use Service Workers for true offline-first capability
5. **Version timestamps**: Compare local vs server timestamps to avoid overwriting newer data with stale

## References

- [Stale-While-Revalidate pattern](https://web.dev/stale-while-revalidate/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [idb library documentation](https://github.com/jakearchibald/idb)
- [Offline-first architecture](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Offline_Service_workers)
