# SSE (Server-Sent Events) Real-Time Entry Updates

## Overview

The Digital Logbook uses **Server-Sent Events (SSE)** to push parsed natural language entry data to the frontend the moment the AI finishes parsing — before the full POST response cycle completes. This means the user sees their entry appear on screen immediately after parsing, without waiting for database writes and activity logging to finish.

SSE is a type of **web caching and real-time communication** pattern where the server pushes data to the client over a persistent HTTP connection, rather than the client polling for updates.

## Why SSE?

| Problem | Solution |
|---|---|
| Natural language entry takes 2–5s for AI parsing + DB writes | SSE pushes parsed data immediately after AI returns (~1–2s) |
| User stares at spinner waiting for full round-trip | UI updates the moment SSE event arrives |
| IndexedDB cache stays stale until next page load | SSE event triggers immediate cache invalidation |
| No feedback between backend parsing and frontend display | SSE creates a real-time channel for instant updates |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │QuickEntryBar│───▶│ POST /nl-    │───▶│ Backend processes  │  │
│  │  (submit)   │    │ entry        │    │ (AI + DB writes)   │  │
│  └─────────────┘    └──────────────┘    └───────────────────┘  │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ useSSE-     │◀───│ SSE /nl-     │◀───│ sendToUser()      │  │
│  │ Entries     │    │ stream       │    │ (after AI parse)   │  │
│  └──────┬──────┘    └──────────────┘    └───────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │ Invalidate   │───▶│ UI reloads   │                          │
│  │ IndexedDB    │    │ (loadData)   │                          │
│  └──────────────┘    └──────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
```

## Flow

1. **User submits** natural language text in QuickEntryBar
2. **Frontend sends** POST to `/service/natural-language-entry` (standard request)
3. **Frontend also listens** on SSE stream at `/service/nl-stream` (persistent connection)
4. **Backend parses** the text using AI (the slow part — 1–3 seconds)
5. **AI returns** structured data (project, fields, priority, etc.)
6. **Backend pushes** parsed data via SSE to the frontend immediately
7. **Frontend receives** SSE event → invalidates IndexedDB cache → calls `loadData()` to refresh UI
8. **Backend continues** with DB writes (creating projects, adding entries) and activity logging
9. **POST response** arrives later (just for confirmation/error handling)

The key insight: **steps 6–7 happen before step 8–9**, so the UI updates before the full request completes.

## Backend Implementation

### SSE Connection Registry

**File:** `services/project-service/src/functions/sseRegistry.js`

Maintains a `Map<userEmail, Set<Response>>` of active SSE connections. Provides:

| Function | Purpose |
|---|---|
| `registerConnection(email, res)` | Register a new SSE connection for a user |
| `removeConnection(email, res)` | Remove a connection when client disconnects |
| `sendToUser(email, event, data)` | Push an SSE event to all connections for a user |
| `getConnectionCount(email)` | Get active connections for a user |
| `getTotalConnections()` | Get total active connections across all users |

### SSE Endpoint

**Route:** `GET /service/nl-stream`

```javascript
router.get('/nl-stream', async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection confirmation
  res.write(`event: connected\ndata: {"message":"SSE stream established"}\n\n`);

  // Register this connection
  registerConnection(user_email, res);

  // Keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => res.write(`: ping\n\n`), 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    removeConnection(user_email, res);
  });
});
```

### SSE Push in Natural Language Route

After AI parsing completes, the parsed data is pushed via SSE **before** activity logging and the POST response:

```javascript
const result = await nlEntry.entry(user_email, text);

// SSE: Push parsed data immediately
if (result.success) {
  sendToUser(user_email, 'entry_parsed', {
    project: result.project,
    fields: result.fields,
    multi: result.multi,
    results: result.results,
    // ...
  });
}

// Then continue with activity logging and response...
```

### Authentication for SSE

EventSource (the browser's SSE API) doesn't support custom headers. The auth middleware was updated to accept JWT tokens via query parameter for SSE connections:

```javascript
// In middleware/auth.js
let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
if (!token && req.query?.token) {
  token = req.query.token;  // SSE fallback
}
```

## Frontend Implementation

### SSE Connection Manager

**File:** `frontend/src/lib/sse.js`

Manages the persistent SSE connection with:

- **Auto-reconnect** with exponential backoff (1s, 2s, 4s, ... up to 10 attempts)
- **Event dispatching** to registered listeners
- **Connection lifecycle** management (connect, disconnect, status check)

| Export | Purpose |
|---|---|
| `connectSSE()` | Open SSE connection (idempotent) |
| `disconnectSSE()` | Close SSE connection |
| `onSSEEvent(event, cb)` | Register listener, returns unsubscribe function |
| `isSSEConnected()` | Check if connection is open |

### React Hook: useSSEEntries

**File:** `frontend/src/hooks/useSSEEntries.ts`

Connects SSE events to IndexedDB cache invalidation and UI updates:

```typescript
useSSEEntries({
  onEntry: (data) => {
    loadData(); // Refresh the dashboard
  },
});
```

When an `entry_parsed` event arrives:
1. Invalidates relevant IndexedDB cache entries (projects, entries, all-entries)
2. Calls the `onEntry` callback so the UI can refresh

### Integration with AuthContext

The SSE connection is properly managed during authentication:

- **Sign out:** `disconnectSSE()` is called before Supabase sign-out
- **Delete account:** `disconnectSSE()` is called before account deletion
- This ensures no stale SSE connections remain after logout

## SSE Events

| Event | Direction | Description |
|---|---|---|
| `connected` | Server → Client | SSE stream established |
| `entry_parsed` | Server → Client | AI finished parsing, structured data ready |
| `entry_error` | Server → Client | Error occurred during parsing |
| `: ping` | Server → Client | Keep-alive comment (prevents timeout) |

## Performance Impact

| Metric | Without SSE | With SSE |
|---|---|---|
| Time to see entry after submit | 3–5s (full round-trip) | 1–2s (immediate push after AI) |
| UI responsiveness | Blocked until POST completes | Updates as soon as SSE arrives |
| Cache freshness | Stale until next page load | Invalidated immediately on SSE |

## Testing

| Test File | Tests | Coverage |
|---|---|---|
| `services/project-service/src/__tests__/sseRegistry.test.js` | 14 | Registry: register, remove, send, count |
| `frontend/src/lib/__tests__/sse.test.js` | 14 | Connection, events, reconnect, disconnect |

## Web Caching Context

SSE fits into the broader web caching strategy:

- **IndexedDB caching** (stale-while-revalidate) serves cached data instantly on page loads
- **SSE** keeps the cache fresh by pushing updates from the server in real-time
- Together, they form a **local-first architecture** where the UI is always responsive and data stays current

## Future Enhancements

- **Offline write queue:** Buffer SSE events when offline, replay on reconnect
- **Multi-tab sync:** Share SSE events across browser tabs via BroadcastChannel
- **Entry confirmation:** Backend sends `entry_saved` event after DB writes complete
- **Progressive updates:** Stream partial results (e.g., "parsing..." → "creating project..." → "done")
