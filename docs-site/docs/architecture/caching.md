# Local-First Architecture (IndexedDB)

## Overview

The Digital Logbook frontend implements a **local-first architecture** using IndexedDB as the primary data source for all pages. The app reads from and writes to IndexedDB first — the server is only used to keep IndexedDB in sync.

**Core principle:** Pages never call server APIs directly. They read from IndexedDB via `useEffect` and display data instantly. A centralized sync service (`CacheFunctions/syncService.js`) handles all server communication.

## Why the Previous Approach Failed

Before the local-first architecture, the app had a **scattered cache-first pattern** that looked like caching but didn't actually work reliably. Here's what was wrong:

### 1. No Centralized Cache Warm-Up
Each page had its own `loadData` function that independently fetched from the server and wrote to IndexedDB. There was no global "warm-up" on app load. If you visited Dashboard first, only Dashboard's data was cached — AllEntries, Stats, Today, Calendar all had to fetch from scratch. Pages never benefited from each other's cache.

### 2. Inconsistent Cache Stores
Different pages used different IndexedDB stores for the same data. For example, Dashboard stored entries in `CACHE_STORES.ALL_ENTRIES` while AllEntries stored them in `CACHE_STORES.ENTRIES`. They never shared cached data — visiting one page didn't help the other.

### 3. `hasCache` Checks Were Incomplete
Dashboard's `hasCache` check only looked at `cachedEntries?.data || cachedProjects?.data` — it ignored `cachedDueSoon?.data`. So even if due-soon data was cached, the page would still show a spinner if entries/projects weren't cached yet.

### 4. `dueSoon()` Always Hit the Server
The `dueSoon()` function called `getUnarchived()` which made a server API call every single time. Even though all entries were already in IndexedDB, `dueSoon` ignored the cache and fetched from the network. This defeated the entire purpose of caching.

### 5. `setPriority()` Had No IndexedDB Integration
The `setPriority()` function called the server directly without writing to IndexedDB first. The UI wouldn't update until the next full page reload or `loadData()` call. Users would change a priority and see no change — then wonder if it worked.

### 6. Pages Still Depended on Server Responses
Even with cache-first reads, every page's `loadData` still called individual server fetch functions (`getProjectsByEmail`, `sortUnarchivedEntries`, `dueSoon`, etc.) in the background. These functions each made their own network requests, so a single page load could trigger 3-5 parallel server calls. If the server was slow, the "fresh data" phase would stall and the UI would flicker between cached and fresh data.

### 7. No Single Source of Truth
Without a centralized sync service, there was no guarantee that IndexedDB had complete, consistent data. Each page wrote to cache independently, sometimes with different key formats or store names. The result: cached data was often incomplete, stale, or missing entirely for pages the user hadn't visited yet.

### The Fix
The local-first architecture solves all of these by:
- **One sync service** (`syncAllData`) that fetches ALL data in one call and populates all IndexedDB stores
- **One trigger point** (`DataSyncInitializer` in App.tsx) that warms up cache on login
- **Pages read only from IndexedDB** — no direct server calls from pages
- **`dueSoon` computes from cache** — no server call needed
- **All mutations write IndexedDB first** — instant UI, then server sync

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        App Load                              │
│  DataSyncInitializer (App.tsx) → syncAllData(email)          │
│  Fetches ALL data from server → populates IndexedDB          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     IndexedDB (local)                        │
│                                                              │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐      │
│  │ projects │ │all-entries│ │ entries  │ │ profile  │      │
│  │          │ │           │ │(per-proj)│ │          │      │
│  └──────────┘ └───────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐                   │
│  │ archives │ │  fields   │ │ due-soon │                   │
│  └──────────┘ └───────────┘ └──────────┘                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Dashboard    AllEntries     StatsView
         (reads       (reads        (reads
          from IDB)    from IDB)     from IDB)
```

### Read Flow (Pages → IndexedDB)
```
1. User navigates to a page
2. Page reads from IndexedDB via cacheGet() in useEffect
3. If cache exists → display immediately (no spinner, no network)
4. If no cache → show loading spinner (first visit only)
5. Page calls syncAllData() in background → server data → IndexedDB
6. Page re-reads from IndexedDB → updates UI with fresh data
```

### Write Flow (Mutations → IndexedDB → Server)
```
1. User triggers action (e.g., add entry, change priority)
2. Function writes to IndexedDB immediately (optimistic update)
3. UI updates instantly from IndexedDB
4. Function syncs to server in background
5. On success: IndexedDB already has the data (or refreshes)
6. On failure: Roll back IndexedDB to previous state
```

## CacheFunctions Module (`src/CacheFunctions/`)

The centralized sync service that populates IndexedDB from the server.

### `syncAllData(email, options)`

Fetches ALL user data from the server and writes to IndexedDB. Called on app load and when pages need a refresh.

```javascript
import { syncAllData } from '@/CacheFunctions';

// On app load or page refresh
await syncAllData(email, { force: true });
```

**What it syncs:**

| Store | Source Function | Cache Key |
|---|---|---|
| `projects` | `getProjectsByEmail()` | `email` |
| `all-entries` | `getAllEntries()` | `email` |
| `entries` (per-project) | Derived from all-entries | `email:projectName` |
| `profile` | `getProfile()` | `email` |
| `archives` | `getArchives()`, `getArchivedProjects()`, `getUnarchivedProjects()` | Various |
| `due-soon` | Computed from cached entries (no server call) | `email:due-soon` |

**Features:**
- Prevents duplicate concurrent syncs
- Throttles to one sync per 10 seconds (unless forced)
- Populates per-project entry caches from the all-entries data
- Computes `due-soon` from cached entries (no extra server call)

### `syncProjectEntries(email, projectName)`

Syncs entries for a single project. Used when navigating to a project detail page.

### `computeDueSoon(entries)`

Pure function that filters entries to find those due within 3 days. Used by both the sync service and the `dueSoon()` function.

## IndexedDB Schema (mirrors database tables)

| Store | Key Format | Data |
|---|---|---|
| `projects` | `user@email.com` | All user projects |
| `all-entries` | `user@email.com` | All entries across all projects |
| `entries` | `user@email.com:project_name` | Entries for a specific project |
| `profile` | `user@email.com` | User profile (name, avatar, username) |
| `archives` | Various | Archived projects/entries |
| `fields` | `user@email.com:table_name` | Custom field definitions |
| `due-soon` (entries store) | `user@email.com:due-soon` | Entries due within 3 days (computed) |

## Page Implementation Pattern

Every page follows the same local-first pattern:

```javascript
const loadData = useCallback(async () => {
  if (!email) return;

  // 1. Read from IndexedDB first — show cached data immediately
  try {
    const cached = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
    if (cached?.data) {
      setEntries(Array.isArray(cached.data) ? cached.data : []);
      // No spinner — data is already displayed
    } else {
      setLoading(true); // First visit — show spinner
    }
  } catch { setLoading(true); }

  // 2. Sync from server → IndexedDB (background)
  try {
    await syncAllData(email, { force: true });

    // 3. Re-read from IndexedDB (syncAllData has updated it)
    const fresh = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
    if (fresh?.data) setEntries(Array.isArray(fresh.data) ? fresh.data : []);
  } catch (err) {
    console.error('Load failed:', err);
  } finally {
    setLoading(false);
  }
}, [email]);

useEffect(() => { loadData(); }, [loadData]);
```

## Mutation Functions (Optimistic Updates)

All mutation functions write to IndexedDB first, then sync to the server:

| Function | IndexedDB Behavior |
|---|---|
| `addEntry()` | Optimistic write → server sync → replace or rollback |
| `updateEntry()` | Optimistic patch → server sync → replace or rollback |
| `deleteEntry()` | Optimistic remove → server sync → rollback on failure |
| `addProject()` | Optimistic write → server sync → refresh or rollback |
| `editProjectName()` | Optimistic rename → server sync → refresh or rollback |
| `deleteProject()` | Optimistic remove → server sync → rollback on failure |
| `setPriority()` | Optimistic patch → server sync → rollback on failure |
| `updateUsername()` | Optimistic update → server sync → refresh or rollback |
| `updateName()` | Optimistic update → server sync → refresh or rollback |
| `updateAvatar()` | Optimistic update → server sync → refresh or rollback |

### Example: setPriority (IndexedDB-first)

```javascript
export async function setPriority(user_email, priorityValue, project_name, entry_id) {
  // 1. Save current cache for rollback
  const cachedBefore = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);

  // 2. Update IndexedDB immediately (instant UI)
  await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: patchedData });

  // 3. Sync to server
  try {
    const result = await request(...);
    return result;
  } catch (err) {
    // 4. Rollback on failure
    await cacheSet(CACHE_STORES.ENTRIES, cacheKey, cachedBefore);
    return { success: false, message: err.message };
  }
}
```

## dueSoon — Computed from Cache (No Server Call)

The `dueSoon()` function reads from IndexedDB instead of calling the server:

```javascript
export async function dueSoon(user_email, project_name) {
  // 1. Read from IndexedDB (instant, no network)
  const cached = await cacheGet(store, cacheKey);
  if (cached?.data) {
    return { success: true, data: computeDueSoon(cached.data) };
  }

  // 2. Fallback: fetch from server only if no cache
  const result = await getUnarchived(user_email, project_name);
  return { success: true, data: computeDueSoon(result?.data || []) };
}
```

## App Initialization

The `DataSyncInitializer` component in `App.tsx` triggers the initial sync when the user logs in:

```javascript
function DataSyncInitializer({ children }) {
  const { user } = useAuth();
  const email = user?.email;

  useEffect(() => {
    if (email) {
      syncAllData(email).catch(err => {
        console.warn('[App] Initial data sync failed:', err);
      });
    }
  }, [email]);

  return <>{children}</>;
}
```

## Cache Invalidation

| Event | Action |
|---|---|
| Write operation | Optimistic IndexedDB update → server sync → rollback on failure |
| Sign out | `clearUserCache(email)` wipes all IndexedDB data |
| Delete account | `clearUserCache(email)` wipes all IndexedDB data |
| SSE push | Invalidate cache → call `loadData()` to re-read from IndexedDB |

## Performance Impact

| Metric | Before (server-first) | After (local-first) |
|---|---|---|
| First page load | 500-1000ms (network) | 500-1000ms (first visit only) |
| Subsequent loads | 500-1000ms (network) | <10ms (IndexedDB read) |
| Navigation | Full network fetch | Instant from cache |
| Offline/poor connectivity | App breaks | Shows cached data |
| Mutations | Wait for server | Instant UI, background sync |

## Dependencies

- [`idb`](https://www.npmjs.com/package/idb) — Lightweight IndexedDB wrapper (Promise-based API)

## File Reference

| File | Purpose |
|---|---|
| `src/CacheFunctions/syncService.js` | Central sync — fetches all data → IndexedDB |
| `src/CacheFunctions/index.js` | Barrel export |
| `src/lib/cache.js` | IndexedDB CRUD + event subscriptions |
| `src/hooks/useCachedData.js` | React hook for IndexedDB-first loading |
| `src/functions/project/project.js` | Project mutations (optimistic) |
| `src/functions/project/entries.js` | Entry mutations (optimistic) |
| `src/functions/project/priority.js` | Priority mutation (optimistic) |
| `src/functions/profile/profile.js` | Profile mutations (optimistic) |
| `src/functions/dashboard.js` | `dueSoon()` — reads from cache |
| `src/App.tsx` | `DataSyncInitializer` — triggers sync on login |
