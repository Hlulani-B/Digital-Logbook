---
kind: error_handling
name: Express Error Handling with Global Middleware and Per-Route Try/Catch
category: error_handling
scope:
  - '**'
source_files:
  - services/project-service/src/index.js
  - services/profile-service/src/index.js
  - services/dashboard-service/src/index.js
  - services/auth-service/src/index.js
  - services/project-service/src/middleware/auth.js
  - services/project-service/src/Routes/entries.js
  - services/profile-service/src/Routes/login.js
  - services/dashboard-service/src/functions/search.js
  - frontend/src/lib/api.ts
---

## Overview

The Digital Logbook monorepo uses a consistent, lightweight error-handling strategy across its four Node/Express microservices (auth-service, dashboard-service, profile-service, project-service) and the React/Vite frontend. There is no shared error library or custom error class hierarchy; instead, each service defines its own Express global error handler that logs unhandled errors and returns a uniform `{ error, message }` JSON body with HTTP 500, while route handlers use per-route `try/catch` blocks to return structured success/failure responses.

## Backend (Express services)

### Global error middleware

Every service registers an Express error-handling middleware as the last middleware in `index.js`:

- **project-service** (`src/index.js`, line 95–103): catches all unhandled errors, ensures CORS headers are attached even on error responses, then responds with `res.status(500).json({ error: 'Internal server error', message: err.message })`.
- **profile-service** (`src/index.js`, line 58–72): identical pattern — logs via `console.error('Unhandled error:', err)`, injects CORS headers based on `allowedOrigins`, returns 500 JSON.
- **dashboard-service** (`src/index.js`, line 70–78): same shape, plus a dedicated `/service/health-ping` endpoint that returns 503 `{ status: 'degraded' }` for degraded DB connectivity and 500 for unexpected failures.
- **auth-service** (`src/index.js`, line 61–69): exposes the `errorHandler` as a named export so tests can mount it after test routes; otherwise identical behavior.

All four services share the same CORS origin allowlist and attach `Access-Control-Allow-Origin` / `Access-Control-Allow-Credentials` only when the request's `origin` is in that list — this prevents leaking credentials to unknown origins on error paths.

### Route-level handling

Routes do not throw; they return structured JSON responses directly:

- Validation errors return `400` with `{ success: false, error: '...' }` or `{ error: 'Missing required parameters' }` (e.g., `entries.js` lines 30, 54, 94, 135, 145, 154, 181).
- Authentication failures are handled by the `requireAuth` middleware in `middleware/auth.js`, which responds with `401 { error: 'Unauthorized: ...' }` for missing tokens, malformed JWTs, or tokens without an email.
- Unexpected runtime errors inside a route are caught by a local `try/catch` block that logs via `console.error` and returns `500 { success: false, error: 'Internal Server Error', message: ... }` (e.g., `entries.js` lines 183–190, `login.js` lines 42–48).

### Service-layer conventions

Business logic classes (e.g., `Search` in `dashboard-service/src/functions/search.js`) catch their own internal errors and return a `{ success: boolean, message: string, data? }` envelope rather than throwing. The route layer then decides whether to forward that envelope to the client or wrap it in an error response. This makes the API surface predictable: callers inspect `success` rather than relying on HTTP status codes alone.

### SSE-specific error propagation

For the Server-Sent Events stream (`/service/nl-stream` in `entries.js`), errors during long-running AI parsing are pushed back to the connected client via `sendToUser(req.userEmail, 'entry_error', { success: false, error: error.message })` before returning a 500 JSON response. This gives the frontend immediate feedback even if the HTTP response is delayed.

## Frontend (React/Vite)

The single source of truth for HTTP error handling is `frontend/src/lib/api.ts`. The `request<T>()` function:

- Attaches the Supabase access token from the current session to every outbound request.
- Enforces a configurable timeout (default 90 s, accounting for Render free-tier cold starts and AI processing) using `AbortController`; aborts raise a `DOMException` whose name is checked and rethrown as `Error('Request timed out after Xs')`.
- Treats any non-`ok` response as an error by reading the response text and throwing `Error('API error ${status}: ${body}')`.
- Logs timing and errors via `console.log` prefixed with `[api] →`, `[api] ←`, and `[api] ✗`.

Callers (pages, hooks, components) handle these thrown `Error` objects locally — there is no global Axios interceptor or React error boundary for network errors. Network failures bubble up to component state, typically surfaced through UI banners like `OfflineBanner` and `OfflineSyncToasts`.

## Conventions and constraints observed

| Area                     | Observed convention                                                                                           | Evidence                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Unhandled Express errors | Always caught by a final `app.use((err, req, res, next) => {...})` middleware that logs and returns 500 JSON  | All four `index.js` files                                                                |
| CORS on errors           | Error middleware explicitly sets `Access-Control-Allow-Origin` / `Credentials` when the origin is whitelisted | `project-service`, `profile-service`, `dashboard-service`, `auth-service` error handlers |
| Route validation         | Return `400 { error: '...' }` immediately for missing/invalid fields                                          | `entries.js`, `login.js`, `profile.js`                                                   |
| Auth failures            | Centralized in `middleware/auth.js`, always `401 { error: 'Unauthorized: ...' }`                              | `requireAuth` function                                                                   |
| Business logic errors    | Functions return `{ success, message, data? }` envelopes instead of throwing                                  | `dashboard-service/functions/search.js`                                                  |
| Frontend HTTP errors     | Single `request()` wrapper throws typed `Error`s; timeouts become explicit messages                           | `frontend/src/lib/api.ts`                                                                |
| SSE errors               | Pushed to the live stream via `sendToUser(..., 'entry_error', ...)` before HTTP response                      | `entries.js` natural-language entry handler                                              |
| No custom error types    | No `HttpError`, `NotFoundError`, or domain error classes exist anywhere in the codebase                       | grep across all services and frontend                                                    |
| No `throw` in routes     | Routes use `return res.status(...)` rather than throwing; only the global middleware handles thrown errors    | Verified in all route files                                                              |

## Key files

- `services/project-service/src/index.js` — app bootstrap, global error handler, OpenAPI swagger setup
- `services/profile-service/src/index.js` — global error handler
- `services/dashboard-service/src/index.js` — global error handler + health-ping error shaping
- `services/auth-service/src/index.js` — exported `createApp` and `errorHandler` for testability
- `services/project-service/src/middleware/auth.js` — JWT verification, 401 responses
- `services/project-service/src/Routes/entries.js` — per-route try/catch, SSE error push
- `services/profile-service/src/Routes/login.js` — per-route try/catch pattern
- `services/dashboard-service/src/functions/search.js` — service-layer `{ success, message }` envelope
- `frontend/src/lib/api.ts` — centralized fetch wrapper, timeout handling, error throwing

## Summary

Error handling in this monorepo is intentionally simple: Express services rely on a uniform global error middleware for uncaught exceptions, route handlers validate input and return structured JSON, business functions swallow internal errors and report them via envelopes, and the frontend funnels all HTTP errors through one `request()` helper. There is no shared error taxonomy, no custom error classes, and no centralized logging framework — consistency comes from copying the same `index.js` template into each service and following the same `try/catch` + `{ success, message }` pattern in routes.
