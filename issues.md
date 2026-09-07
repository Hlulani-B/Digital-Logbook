# Issues Fixed in This Session

## 1. Entry Updates Not Persisting to Database

### Problem
When editing entries in the ProjectTaskTable (changing status, priority, due date), the changes appeared to save but were lost on page refresh.

### Root Cause
The `onUpdate` handler in `ProjectDetailPage.tsx` was calling `updateEntry` but:
1. The handler was initially broken - it ignored the `(id, patch)` parameters and only called `loadEntries()` without actually saving
2. Even after fixing, the `handleSetPriority` function updated local state but didn't update IndexedDB, so changes were lost on reload

### Fix
1. **Fixed `onUpdate` handler** to properly call `updateEntry` with all parameters:
   ```typescript
   onUpdate={async (id: string, patch: Record<string, any>) => {
     const row = entries.find((r) => r.id === id);
     if (!row || !email) return;
     setEntries((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
     await updateEntry(
       email, row.project_name, id,
       patch.entries ?? row.entries,
       patch.due_date !== undefined ? patch.due_date : row.due_date,
       patch.priority !== undefined ? patch.priority : row.priority,
       patch.status !== undefined ? patch.status : row.status,
       row.started_at, row.ended_at, row.duration
     );
     await loadEntries();
   }}
   ```

2. **Fixed `handleSetPriority`** to update IndexedDB after server call:
   ```typescript
   // Update IndexedDB cache so it persists across reloads
   const cacheKey = `${email}:${projectName}`;
   const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
   if (cached) {
     const updatedData = currentData.map((e) => 
       e.id === entryId ? { ...e, priority: priorityLabel } : e
     );
     await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: updatedData });
   }
   ```

### Files Modified
- `frontend/src/pages/ProjectDetailPage.tsx`

---

## 2. Loading Spinner Showing Instead of Cached Data

### Problem
Every time the page loaded or data was updated, a loading spinner appeared even though IndexedDB had cached data available.

### Root Cause
The component was setting `loading = true` on every fetch, regardless of whether cached data existed in IndexedDB.

### Fix
Changed the loading logic to only show spinner when there's no cached data:
```typescript
// Read from IndexedDB immediately
const cached = await cacheGet(cacheStore, cacheKey);
const entriesData = (cached?.data as Entry[]) || [];
setEntries(entriesData);
// Only show loading if no cached data exists
setLoading(entriesData.length === 0);

// Loading spinner only shows if no cache
{loading && entries.length === 0 && (
  <div className="feed-loading">...</div>
)}
```

### Files Modified
- `frontend/src/pages/ProjectDetailPage.tsx`

---

## 3. IndexedDB Key Path Mismatch

### Problem
Console errors: `DataError: Failed to execute 'put' on 'IDBObjectStore': Evaluating the object store's key path did not yield a value.`

### Root Cause
IndexedDB stores were created with inconsistent key paths:
- `projects`, `all-entries`, `profile` used `keyPath: 'email'`
- `entries`, `search`, `archives`, `fields` used `keyPath: 'key'`
- But `cacheSet()` wraps all data with `{ key, data }` structure

### Fix
Unified all stores to use `keyPath: 'key'` and bumped DB version to 3 to trigger migration:
```javascript
// cache.js
const DB_VERSION = 3;

upgrade(db, oldVersion) {
  if (oldVersion < 3) {
    // Delete old stores with wrong keyPath
    const storeNames = Object.values(STORES);
    storeNames.forEach((storeName) => {
      if (db.objectStoreNames.contains(storeName)) {
        db.deleteObjectStore(storeName);
      }
      db.createObjectStore(storeName, { keyPath: 'key' });
    });
  }
}
```

### Files Modified
- `frontend/src/lib/cache.js`

---

## 4. Direct Supabase Calls Causing 403 Errors

### Problem
Console errors: `Failed to load resource: the server responded with a status of 403 ()`

### Root Cause
Two places were calling Supabase directly instead of going through the project-service:
1. `Project.tsx` - `seedTestProjects` used `supabase.from('projects').upsert()` with `onConflict`
2. `Dashboard.tsx` - `handleArchiveProject` used direct `fetch()` to Supabase REST API

These direct calls were blocked by Supabase RLS policies.

### Fix
Replaced direct Supabase calls with proper function layer calls:
```typescript
// Project.tsx - before
await supabase.from('projects').upsert(p, { onConflict: 'user_email,project_name' });

// Project.tsx - after
await addProject(email, p.name, p.description);

// Dashboard.tsx - before
await fetch(`${supabaseUrl}/rest/v1/projects?...`, { method: 'PATCH', ... });

// Dashboard.tsx - after
await archiveProject(email, projectName);
```

### Files Modified
- `frontend/src/pages/Project.tsx`
- `frontend/src/pages/Dashboard.tsx`

---

## 5. Entry Editing Handler Completely Broken

### Problem
Editing entries in the table did nothing at all - no server call, no UI update.

### Root Cause
The `onUpdate` handler in `ProjectDetailPage.tsx` was:
```typescript
onUpdate={async () => {
  await loadEntries();  // Just reloads, never saves!
}}
```
It ignored the `(id, patch)` parameters and never called `updateEntry`.

### Fix
Implemented proper handler that:
1. Finds the entry by ID
2. Updates local state for instant UI
3. Calls `updateEntry` to save to server
4. Reloads entries after success
5. Rolls back on failure

### Files Modified
- `frontend/src/pages/ProjectDetailPage.tsx`

---

## 6. White Priority/Status Pills

### Problem
Priority and status dropdowns in the table appeared white with no colors.

### Root Cause
CSS color rules only applied to `.ptt-row` (desktop) but not `.ptt-mobile-card` (mobile). Also missing colors for "Up Next" status.

### Fix
1. Added `data-priority` attribute to mobile cards
2. Added color rules for both desktop and mobile
3. Added "Up Next" status color (blue)
4. Added default fallback colors

```css
/* Status colors for both desktop and mobile */
.ptt-row[data-status='Up Next'] .ptt-select-status,
.ptt-mobile-card[data-status='Up Next'] .ptt-select-status {
  background-color: #dbeafe;
  color: #1e40af;
  border-color: #3b82f6;
}
```

### Files Modified
- `frontend/src/Templates/ProjectTemplates/ProjectTable.css`
- `frontend/src/Templates/ProjectTemplates/ProjectTable.tsx`

---

## 7. Theme Changed to White/Black Light Mode

### Problem
User requested a clean white and black light theme as default.

### Fix
Updated CSS variables in `:root` to use clean neutral colors:
```css
:root {
  --bg: #ffffff;
  --text: #111111;
  --border: #e5e5e5;
  --accent: #111111;
  --font-body: 'Plus Jakarta Sans', sans-serif;
}
```

Also updated ProjectTable.css to use neutral colors instead of vintage earth tones.

### Files Modified
- `frontend/src/index.css`
- `frontend/src/Templates/ProjectTemplates/ProjectTable.css`

---

## 8. Text Edits in Table Not Saving (Priority Value Mismatch)

### Problem
When editing text fields in the ProjectTaskTable (e.g., title), the change appeared briefly then reverted. The update failed silently on the server.

### Root Cause
The DB stores priority as friendly labels (`"Urgent and important"`) but the dropdown used raw values (`"0"`, `"1"`, `"2"`, `"3"`). When editing text:
1. `onUpdate` sends ALL fields including `row.priority`
2. If `row.priority` was a raw value `"0"` (from dropdown), DB rejected it: `invalid input value for enum priority_level: "0"`
3. The entire update failed, including the text change
4. Additionally, the dropdown couldn't display the DB's friendly label (no matching option)

### Fix
1. Added `toFriendlyPriority()` helper to normalize any priority format to the DB-expected friendly label
2. Always normalize priority before calling `updateEntry`, even when priority isn't being changed
3. Added `toRawPriority()` helper in ProjectTable to convert DB values back to raw values for dropdown display
4. Applied fix to both desktop and mobile dropdowns

```typescript
// Normalize priority to friendly label before DB call
function toFriendlyPriority(val: string | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  if (val === '3') return null;
  if (PRIORITY_LABELS[val]) return PRIORITY_LABELS[val]; // raw "0"→label
  return val; // already a friendly label
}

// Always normalize before sending to DB
const dbPriority = toFriendlyPriority(mappedPatch.priority ?? row.priority);
```

### Files Modified
- `frontend/src/pages/ProjectDetailPage.tsx`
- `frontend/src/Templates/ProjectTemplates/ProjectTable.tsx`

---

## Summary

All issues have been fixed and pushed to the `hlulani` branch. The key fixes were:
1. Entry updates now properly save to database via `updateEntry` function
2. IndexedDB cache is updated on all mutations so changes persist
3. Loading spinner only shows when no cached data exists
4. All direct Supabase calls replaced with proper service calls
5. Clean white/black theme applied as default
6. Priority values normalized between dropdown (raw) and database (friendly labels)
