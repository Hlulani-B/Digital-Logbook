---
kind: logging_system
name: Console-Only Logging with No Centralized Framework
category: logging_system
scope:
  - '**'
source_files:
  - services/auth-service/src/index.js
  - services/dashboard-service/src/index.js
  - services/profile-service/src/index.js
  - services/project-service/src/index.js
  - frontend/src/CacheFunctions/syncService.js
  - frontend/src/CacheFunctions/offlineQueue.js
  - frontend/src/CacheFunctions/queueProcessor.js
---

## What system/approach is used

The repository has **no centralized logging framework**. There are no logging dependencies (e.g., Winston, Pino, Bunyan, Morgan, `debug`) in any of the four Node.js microservices or in the React/Vite frontend. All output goes through Node's built-in `console` API (`console.log`, `console.error`, `console.warn`). The services do not configure log levels, structured fields, sinks, or rotation — they simply write plain text to stdout/stderr.

## Key files and packages

- `services/auth-service/src/index.js` — uses `console.warn` for disallowed CORS origins and `console.error` in the global error handler; `console.log` on startup.
- `services/dashboard-service/src/index.js` — same pattern: `console.warn` for CORS, `console.error` for health-ping errors and unhandled exceptions, `console.log` on startup.
- `services/profile-service/src/index.js` — identical CORS warning + error handler pattern.
- `services/project-service/src/index.js` — adds `console.log('Swagger UI available at /api-docs')` and `console.warn('OpenAPI spec not found ...')` when loading Swagger; otherwise mirrors the same CORS/error/startup logging.
- `frontend/src/CacheFunctions/syncService.js`, `offlineQueue.js`, `queueProcessor.js`, `functions/profile/profile.js` — use bracketed prefixes like `[syncService]`, `[OfflineQueue]`, `[QueueProcessor]` to scope console output in the browser.

No service `package.json` lists a logging library; the only runtime dependencies are `express`, `cors`, `dotenv`, `pg`, plus AI SDKs in project-service.

## Architecture and conventions

- **Per-process stdout/stderr sink**: Each microservice writes directly to the process console. On Render, this means logs are emitted to the platform's standard output stream, which Render captures as its log source. There is no middleware layer that intercepts requests/responses to produce access logs.
- **Ad-hoc severity via method choice**: Developers choose between `console.log` (informational), `console.warn` (CORS rejections, missing optional features like OpenAPI spec), and `console.error` (unhandled exceptions, health-ping failures). There is no formal level hierarchy enforced by code or tooling.
- **Braced prefix convention in the frontend**: Browser-side logging uses a fixed `[ComponentName]` tag at the start of each message (e.g., `[syncService]`, `[OfflineQueue]`, `[QueueProcessor]`) so messages can be visually filtered in the browser DevTools console. This is a naming convention, not enforced by a linter.
- **Error responses are always JSON**: Every service wraps unhandled errors in a global Express error handler that sets CORS headers conditionally and returns `{ error: 'Internal server error', message: err.message }`. The stack trace is logged via `console.error` but never sent to the client.
- **Health endpoints double as log sources**: Services expose `/` and some expose `/service/health-ping` returning `{ status: 'ok' | 'healthy' }`; these are intended for uptime probes rather than structured diagnostics.

## Conventions and constraints

- **Observed convention (not enforced)**: Use `console.warn` for configuration/CORS warnings and `console.error` for unexpected failures; use `console.log` for normal lifecycle events (startup, feature availability).
- **Observed convention (not enforced)**: Frontend console messages are prefixed with a bracketed module name to aid filtering in the browser console.
- **Constraint from deployment**: Because there is no structured logger, log ingestion relies entirely on the hosting platform (Render) capturing stdout/stderr. There is no mechanism to route logs to an external collector, enrich them with request IDs, or filter by level.
- **No log-level control**: There is no environment variable or flag that toggles verbosity; all `console.*` calls execute regardless of environment.
- **No request/response logging**: No HTTP access logs exist in any service; request context is not captured before routing.
