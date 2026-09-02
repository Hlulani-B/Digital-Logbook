# Client-Side Persistent Caching (IndexedDB)

## Overview

The Digital Logbook frontend implements **client-side persistent caching using IndexedDB, following a stale-while-revalidate pattern**. This is a specific type of web caching where data is stored in the browser's IndexedDB — a local mini-database — so it survives page refreshes and can serve instant reads on subsequent visits.

"Web caching" is the umbrella term for storing data closer to where it's used instead of fetching it fresh every time. IndexedDB caching is one legitimate branch of web caching:

| Type | Persists across reloads? | Handles structured data? | Use case |
|---|---|---|---|
| In-memory (e.g. React Query) | No | Limited | Fast but ephemeral |
| LocalStorage | Yes | No (key-value only) | Simple flags/tokens |
| **IndexedDB** | **Yes** | **Yes (mini local database)** | **Structured/relational data** |
| Server-side (Express) | N/A | N/A | Backend API response caching |
| HTTP/browser (cache headers) | Varies | N/A | Low-level resource caching |

IndexedDB caching is arguably stronger than in-memory caching because it survives refreshes and can support offline behaviour too.

The pattern is also known as **local-first** or **offline-first** architecture — the application reads from a local mirror first, then reconciles with the server.

## Why Caching?

| Problem | Solution |
|---|---|
| Network latency on every page load | IndexedDB reads are instant (no network round-trip) |
| Poor UX while waiting for Supabase | UI renders from cache immediately |
| Offline/poor connectivity | Cached data available even when server is unreachable |
| Repeated fetches of same data | Cache serves repeated reads without hitting the server |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Action                         │
│                  (click, page load)                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │  Check IndexedDB │◄──── Cache hit? Return immediately
            │     (local)      │      + fetch fresh in background
            └────────┬────────┘
                     │ Cache miss
                     ▼
            ┌─────────────────┐
            │  Fetch from     │
            │  Supabase/API   │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  Update IndexedDB│
            │  + Return data  │
            └─────────────────┘
```

## Implementation

### Cache Module (`src/lib/cache.js`)

The cache module provides these core functions:

| Function | Purpose |
|---|---|
| `cacheGet(store, key)` | Read from IndexedDB |
| `cacheSet(store, key, data)` | Write to IndexedDB |
| `cacheDelete(store, key)` | Remove from IndexedDB |
| `cacheGetTimestamp(key)` | Check when cache was last updated |
| `clearUserCache(email)` | Clear all cached data for a user (logout) |
| `staleWhileRevalidate(options)` | Full SWR pattern with background refresh |
| `cachedFetch(store, key, fetchFn)` | Simple cache-or-fetch wrapper |

### Cache Stores

| Store | Key Format | Data |
|---|---|---|
| `projects` | `user@email.com` | User's project list |
| `entries` | `user@email.com:project_name` | Entries for a specific project |
| `all-entries` | `user@email.com` | All entries across all projects |
| `profile` | `user@email.com` | User profile (name, avatar, username) |
| `search` | `user@email.com:keyword` | Search results |

### Read Operations (Cache-First)

All read functions follow this pattern:

```javascript
export async function getProjectsByEmail(user_email) {
  // 1. Try cache first
  const cached = await cacheGet(CACHE_STORES.PROJECTS, user_email);
  if (cached) {
    // 2. Return cached data immediately
    // 3. Fetch fresh data in background (fire-and-forget)
    const freshPromise = request(...)
      .then(async (freshData) => {
        if (freshData?.success) {
          await cacheSet(CACHE_STORES.PROJECTS, user_email, freshData);
        }
        return freshData;
      });
    
    return cached.data !== undefined ? cached.data : cached;
  }
  
  // 4. No cache — must wait for fetch
  const result = await request(...);
  if (result?.success) {
    await cacheSet(CACHE_STORES.PROJECTS, user_email, result);
  }
  return result;
}
```

### Write Operations (Invalidate-on-Write)

All write functions invalidate relevant caches after a successful write:

```javascript
export async function addEntry(user_email, project_name, ...) {
  const result = await request(...);
  
  // Invalidate cache on successful write
  if (result?.success) {
    await cacheDelete(CACHE_STORES.ENTRIES, `${user_email}:${project_name}`);
    await cacheDelete(CACHE_STORES.ALL_ENTRIES, user_email);
    await cacheDelete(CACHE_STORES.PROJECTS, user_email);
  }
  
  return result;
}
```

### Functions with Caching

| Function | Cache Behavior |
|---|---|
| `getProjectsByEmail()` | Cache-first, invalidate on add/edit/delete project |
| `getEntries()` | Cache-first, invalidate on add/update/delete entry |
| `getAllEntries()` | Cache-first, invalidate on any entry change |
| `getProfile()` | Cache-first, invalidate on profile update |
| `addEntry()` | Invalidate entries + projects cache on success |
| `updateEntry()` | Invalidate entries cache on success |
| `deleteEntry()` | Invalidate entries + projects cache on success |
| `addProject()` | Invalidate projects cache on success |
| `editProjectName()` | Invalidate projects + entries cache on success |
| `deleteProject()` | Invalidate projects + entries cache on success |
| `updateUsername()` | Invalidate profile cache on success |
| `updateName()` | Invalidate profile cache on success |
| `updateAvatar()` | Invalidate profile cache on success |
| `deleteProfile()` | Clear all caches on success |

## Cache Invalidation Strategy

The cache uses **write-through invalidation**:

1. **On write**: Delete relevant cache entries so next read fetches fresh data
2. **On read**: If cache exists, return it immediately; background fetch updates cache for next time
3. **On logout**: `clearUserCache(email)` wipes all cached data for the user

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
