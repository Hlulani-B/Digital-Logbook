---
kind: configuration_system
name: Environment-Based Configuration via dotenv and Vite Build-Time Env
category: configuration_system
scope:
  - '**'
source_files:
  - services/dashboard-service/src/config.js
  - services/profile-service/src/config.js
  - services/project-service/src/config.js
  - services/project-service/.env.example
  - services/auth-service/src/index.js
  - services/dashboard-service/src/db.js
  - services/profile-service/src/db.js
  - services/project-service/src/db.js
  - frontend/.env.example
  - frontend/.env
  - frontend/src/lib/supabase.ts
  - render.yaml
---

## What system/approach is used

The monorepo uses a plain **environment-variable-driven configuration** strategy with no centralized config library. Each runtime component loads its own settings from `process.env` (Node services) or `import.meta.env` (Vite frontend), populated by `.env` files in development and by the deployment platform (Render) in production.

- **Backend microservices** (auth, dashboard, profile, project): load `.env` at startup via `dotenv.config()` (ESM `import dotenv from 'dotenv'` in dashboard/profile/project; CommonJS `require('dotenv').config()` in auth-service).
- **Frontend SPA**: reads build-time variables prefixed with `VITE_` through `import.meta.env.VITE_*`, defined in `frontend/.env` and `frontend/.env.example`.
- **Deployment**: Render declaratively injects environment variables per service via `render.yaml` (`envVars` blocks with `sync: false` for secrets).

There is no schema validation, default-value merging, or feature-flag system — configuration is purely key/value pairs consumed directly by each module that needs them.

## Key files and packages

- `services/dashboard-service/src/config.js` — minimal `dotenv.config()` loader shared by the service entrypoint.
- `services/profile-service/src/config.js` — same pattern as dashboard.
- `services/project-service/src/config.js` — same pattern as dashboard.
- `services/auth-service/src/index.js` — calls `require('dotenv').config()` inline before reading `process.env.PORT` and other values.
- `services/*/src/db.js` — constructs the PostgreSQL connection pool exclusively from `process.env.DATABASE_URL`; warns or errors if missing.
- `services/project-service/.env.example` — authoritative list of every variable the project-service expects (`PORT`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `HF_API_KEY`, `OPENROUTER_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`).
- `frontend/.env` and `frontend/.env.example` — defines `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_SERVICE_URL`, `VITE_DASHBOARD_SERVICE_URL`, `VITE_PROJECT_SERVICE_URL`, `VITE_PROFILE_SERVICE_URL`, `VITE_TURNSTILE_SITE_KEY`, `VITE_DEV_BYPASS`.
- `frontend/src/lib/supabase.ts` — reads `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, validates they are non-empty URLs/keys, and throws a descriptive error if the Supabase client cannot be created.
- `render.yaml` — declares six Render web services (`digital-logbook`, `auth-service`, `dashboard-service`, `project-service`, `profile-service`, `docs-site`) and maps environment variables into each service's process at deploy time.

## Architecture and conventions

1. **Per-service `.env` + `.env.example`**: Every backend service ships an example env file documenting required keys. The project-service's `.env.example` includes comments explaining each variable's purpose (e.g., `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS server-side; optional AI provider keys fall back gracefully when absent).
2. **No config object layer**: Services read `process.env.*` directly where needed rather than importing a central config module. The `src/config.js` files exist only to ensure `dotenv.config()` runs before any code accesses `process.env`.
3. **Database connections are opt-in**: All three DB-backed services (`dashboard`, `profile`, `project`) create a `pg.Pool` only if `DATABASE_URL` is set; missing it logs a warning (or critical error in project-service) but does not abort startup. A `SELECT 1` probe verifies connectivity on boot.
4. **Frontend build-time env**: Vite requires all exposed variables to start with `VITE_`. The frontend never reads arbitrary `process.env`; `supabase.ts` explicitly checks that both URL and anon key are present and that the URL matches `https?://.+` before instantiating the client, throwing a clear error otherwise.
5. **Secrets live outside source control**: `.env` files are gitignored (per the comment in `services/project-service/.env.example`: "NEVER commit .env — it is gitignored"). Secrets are injected by Render via `render.yaml` using `sync: false` so they are not logged.
6. **Service discovery via env**: The frontend points at backend microservice endpoints through `VITE_*_SERVICE_URL` variables rather than hardcoding hostnames, allowing different deployments to route traffic independently.
7. **Optional integrations gated by presence**: Optional providers (Brevo email, HF/OpenRouter/Cerebras/Gemini/Groq AI keys) are treated as optional — the project-service tries each provider in turn and returns a graceful error when no keys are configured.

## Conventions and constraints

- **Every Node service must call `dotenv.config()` before accessing `process.env`** — enforced by the presence of `src/config.js` in three services and the inline `require('dotenv').config()` in auth-service's `index.js`.
- **Supabase credentials are split between client and server**: the frontend uses the public anon key (`VITE_SUPABASE_ANON_KEY`); backend services use the service-role key (`SUPABASE_SERVICE_ROLE_KEY`) which bypasses Row Level Security — this separation is documented in the project-service `.env.example`.
- **PostgreSQL connections require `ssl: { rejectUnauthorized: false }`** because Supabase-hosted databases enforce SSL; this is duplicated identically across all three `db.js` modules.
- **Missing `DATABASE_URL` does not crash services** — they log a warning/critical message and continue, so database calls will fail later. This is a deliberate soft-failure convention observed in all three services.
- **Frontend env vars must be prefixed `VITE_`** — enforced by Vite's build system; attempting to access an unprefixed variable results in a compile-time error.
- **CORS origins are whitelisted in code** (auth-service) rather than driven by env, limiting dynamic origin configuration to the hardcoded array plus localhost patterns.
- **Render is the single source of truth for production env**: `render.yaml` enumerates every secret/service variable injected per service; there is no separate Dockerfile or CI step that sets env beyond what Render declares.
