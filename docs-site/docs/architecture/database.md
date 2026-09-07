# Database Schema

**Database:** PostgreSQL, hosted via Supabase.
**Access pattern:** the frontend never queries Supabase directly — every
request goes through our own Express services first.

## Architecture Motivation

### Why Supabase (PostgreSQL) over alternatives

The database layer needed to satisfy three constraints simultaneously: relational integrity, flexible per-user schemas, and zero-cost hosting for a student project.

**PostgreSQL over MongoDB/NoSQL.** A logbook is inherently relational — entries belong to projects, projects belong to users, fields define the shape of entries. Enforcing these relationships with foreign keys and cascade deletes prevents orphaned rows at the database level, something NoSQL stores leave to application code. PostgreSQL's JSONB support then gives us document-style flexibility for the entry payload itself — the best of both worlds.

**Supabase over self-hosted PostgreSQL.** Supabase provides a managed PostgreSQL instance with built-in authentication, Row Level Security, real-time subscriptions, and a web-based SQL editor — all on a free tier with 500 MB of storage and 50,000 monthly active auth users. Self-hosting PostgreSQL on Render would require a paid plan ($7/month minimum for a persistent disk) and manual setup of auth, SSL, backups, and connection pooling. Supabase eliminates all of that.

**Supabase over Firebase.** Firebase's Realtime Database and Firestore are NoSQL by design — they cannot enforce foreign keys, support joins, or run complex aggregation queries. Our stats page needs `SUM(duration)` across entries grouped by project, and our overdue check needs `WHERE due_date < now()` across all rows. These are trivial in PostgreSQL and awkward or impossible in Firestore.

### Why a local-first (IndexedDB) architecture

The frontend uses IndexedDB as the primary data source, not a cache. This design decision was driven by three factors:

1. **Instant UI.** Every page render reads from IndexedDB synchronously — no loading spinners, no waiting for network round-trips to Render's free-tier instances (which may be cold-starting). The user sees their data in under 16 ms.
2. **Offline resilience.** If the backend is down (Render free instances sleep after 15 minutes of inactivity), the user can still browse, search, and review their existing entries. Mutations queue for the next sync.
3. **Reduced server load.** Each page view generates zero API calls for data the user has already seen. Only mutations and initial sync hit the backend, keeping us within Render's free-tier bandwidth limits.

### Why dynamic fields (JSONB) instead of fixed columns

The course brief requires that users "customise the format" of their logbook. Different projects track different information — a coding project might have fields for `language` and `pull_request_url`, while a cooking project needs `recipe_name` and `servings`. A fixed column schema would either force all projects into the same shape or require an `ALTER TABLE` every time a user adds a field. Storing custom field definitions as rows in the `fields` table and the actual values as a JSONB blob in `entries.entries` gives us unlimited per-project flexibility with zero migrations.

### Why soft-delete instead of hard-delete

Account deletion is a 30-day grace period, not an immediate action. Users who accidentally delete their account can sign back in and restore everything. This is implemented with a `deleted` boolean on every table and a nightly `pg_cron` job that permanently purges accounts past the grace period. Hard-deleting immediately would be irreversible and frustrating for users.

## Why a dynamic schema instead of fixed columns

A logbook's structure needs to be customisable per project — different
projects track different kinds of information, and the brief requires that
the owner, not the platform, decides the shape of an entry.

A fixed set of columns (e.g. `hours`, `supervisor`, `notes`) would force every
user into the same entry shape, which doesn't satisfy that requirement. Two
tables solve this without needing a schema migration every time a user adds a
field.

## users

| Column                | Type         | Notes                                        |
| --------------------- | ------------ | -------------------------------------------- |
| email                 | VARCHAR(255) | PK, NOT NULL, UNIQUE                         |
| username              | VARCHAR(50)  | UNIQUE, nullable                             |
| name                  | VARCHAR(100) | nullable                                     |
| avatar                | TEXT         | nullable                                     |
| created_at            | TIMESTAMPTZ  | default now()                                |
| deletion_scheduled_at | TIMESTAMPTZ  | set when the user schedules account deletion |
| deleted               | BOOLEAN      | NOT NULL default false — soft-delete flag    |

## projects

| Column       | Type         | Notes                                     |
| ------------ | ------------ | ----------------------------------------- |
| id           | BIGSERIAL    | PK, auto-generated                        |
| project_name | VARCHAR(255) | NOT NULL                                  |
| user_email   | VARCHAR(255) | NOT NULL, FK → users(email)               |
| description  | TEXT         | nullable                                  |
| archived     | BOOLEAN      | default false                             |
| deleted      | BOOLEAN      | NOT NULL default false — soft-delete flag |
| created_at   | TIMESTAMPTZ  | default now()                             |

The pair `(user_email, project_name)` is unique, so one user cannot have two
projects with the same name. `description` was added after the initial schema
to let users record a short project summary.

## fields

| Column      | Type         | Notes                            |
| ----------- | ------------ | -------------------------------- |
| id          | UUID         | PK, default gen_random_uuid()    |
| user_email  | VARCHAR(255) | NOT NULL                         |
| table_name  | VARCHAR(100) | NOT NULL                         |
| field_name  | VARCHAR(100) | NOT NULL                         |
| data_type   | VARCHAR(50)  | e.g. text, number, boolean, date |
| is_required | BOOLEAN      | default false                    |
| deleted     | BOOLEAN      | default false — soft-delete flag |
| created_at  | TIMESTAMPTZ  | default CURRENT_TIMESTAMP        |

## entries

| Column       | Type                  | Notes                                         |
| ------------ | --------------------- | --------------------------------------------- |
| id           | UUID                  | PK, default gen_random_uuid()                 |
| user_email   | VARCHAR(255)          | NOT NULL, indexed                             |
| project_name | VARCHAR(255)          | NOT NULL, indexed                             |
| entries      | JSONB                 | NOT NULL, dynamic field values                |
| due_date     | TIMESTAMPTZ           | nullable, indexed                             |
| priority     | priority_level (ENUM) | nullable                                      |
| archived     | BOOLEAN               | default false                                 |
| started_at   | TIMESTAMPTZ           | nullable, set when user starts a work session |
| ended_at     | TIMESTAMPTZ           | nullable, set when user stops the session     |
| duration     | INTERVAL              | generated, `ended_at - started_at`            |
| summary      | TEXT                  | nullable, AI-generated one-sentence summary         |
| deleted      | BOOLEAN               | default false — soft-delete flag              |
| created_at   | TIMESTAMPTZ           | default CURRENT_TIMESTAMP                     |

```sql
ALTER TABLE entries
ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_entries_due_date ON entries(due_date);

CREATE TYPE priority_level AS ENUM (
  'Urgent and important',
  'Urgent but not important',
  'Not urgent, not important'
);

ALTER TABLE entries
ADD COLUMN priority priority_level;

ALTER TABLE projects
ADD COLUMN archived BOOLEAN DEFAULT false;

ALTER TABLE entries
ADD COLUMN archived BOOLEAN DEFAULT false;

CREATE INDEX idx_projects_archived ON projects(archived);
CREATE INDEX idx_entries_archived ON entries(archived);

ALTER TABLE entries
ADD COLUMN started_at TIMESTAMPTZ,
ADD COLUMN ended_at TIMESTAMPTZ,
ADD COLUMN duration INTERVAL GENERATED ALWAYS AS (ended_at - started_at) STORED;
```

## Design rationale

| Decision                                                              | Why                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email` as PK on `users`                                              | Supabase Auth already identifies sessions by email rather than an internal id, so making it the PK removes a redundant surrogate key and matches how other tables already reference users                                                                                                      |
| `id` as `UUID` on `fields`/`entries`                                  | These rows get referenced from the frontend and possibly across services, so UUIDs avoid leaking a guessable sequential count and avoid collisions if entries are ever created offline before syncing                                                                                          |
| `projects` has a surrogate `id` plus a unique natural key             | A `BIGSERIAL` `id` keeps internal references simple, while the `(user_email, project_name)` unique constraint enforces the business rule that one user cannot have two projects with the same name                                                                                             |
| `(user_email, project_name)` unique on `projects`                     | Prevents duplicate project names per user and gives the frontend a stable, human-readable identifier                                                                                                                                                                                           |
| `description` on `projects`                                           | Added to support a short project summary shown on the dashboard and project page                                                                                                                                                                                                               |
| `user_email` FK with `ON DELETE CASCADE` on `projects`                | If a user account is deleted, their projects have no owner and no reason to exist, so cascading avoids orphaned rows and manual cleanup                                                                                                                                                        |
| `user_email` directly on `fields`/`entries` (not a FK)                | Keeps lookups simple at this project's scale, rather than joining through `users` every time; also matches Supabase Auth, which identifies sessions by email                                                                                                                                   |
| `table_name` on `fields`                                              | Scopes multiple field-sets independently per user (e.g. `logbook` vs `profile`) without needing a separate physical table for each one                                                                                                                                                         |
| Field definitions stored as **rows**, not columns                     | Avoids `ALTER TABLE` migrations every time a user adds or changes a custom field — the database structure itself never has to change                                                                                                                                                           |
| `entries` stored as `JSONB`                                           | The shape of an entry varies per user/project, so a fixed set of SQL columns can't represent it. JSONB stores the submitted values as one flexible object while staying natively indexable and queryable in Postgres                                                                           |
| `due_date` as a real column, not inside `entries` JSONB               | Overdue checks need to run a fast, indexed comparison against `now()` across every row. A value buried in JSONB can't be indexed the same way, so pulling it out keeps "show me anything overdue" cheap even as entries grow                                                                   |
| `priority` as a Postgres ENUM, not inside `entries` JSONB             | Priority is a fixed, small set of values shared by every project regardless of their custom fields, so it belongs alongside `due_date` as a real column rather than something the user defines per-project. An ENUM also stops bad values from ever being written, which JSONB can't guarantee |
| `priority` nullable                                                   | Not every entry needs a priority assigned, so the column has no default and no `NOT NULL` — it's opt-in                                                                                                                                                                                        |
| `started_at` / `ended_at` as real columns, not inside `entries` JSONB | Time tracking totals need fast, native date-math (`SUM(duration)` per project), which JSONB values can't do efficiently. Keeping them as real timestamp columns also lets `duration` be a generated column instead of something recalculated manually every time                               |
| `duration` as a `GENERATED ALWAYS AS ... STORED` column               | Postgres computes `ended_at - started_at` automatically whenever those two columns are set, so the app never risks the stored duration going stale or being calculated inconsistently across different code paths                                                                              |
| `started_at` / `ended_at` both nullable                               | Supports two logging styles: a live "start/stop" timer flow (set `started_at` immediately, `ended_at` on stop) and a manual after-the-fact entry (both set at once when saving) — neither is forced on the user                                                                                |
| Indexes on `user_email` and `project_name`                            | These are the two columns entries will constantly be filtered by (a user viewing their own logbook, scoped to one project), so indexing keeps those lookups fast as data grows                                                                                                                 |
| Index on `due_date`                                                   | Lets the app flag overdue entries with a simple query like `WHERE due_date < now()` without scanning the whole table                                                                                                                                                                           |
| `archived` on `projects`/`entries`                                    | Soft-archive support lets users hide projects/entries without deleting data. Both default `false` so existing rows remain visible                                                                                                                                                              |
| Indexes on `archived`                                                 | Keeps "show only active" / "show only archived" filters fast as data grows                                                                                                                                                                                                                     |
| `deleted` on all tables                                               | Soft-delete support — users can delete their account and restore it within a grace period. All related rows (entries, fields, projects, activity_log) are marked `deleted = true` instead of being hard-deleted, so the data can be recovered if the user signs back in                        |
| `deletion_scheduled_at` on `users`                                    | Records when the soft-delete happened, enabling future expiry logic (e.g. hard-delete after 30 days)                                                                                                                                                                                           |
| `description` on `projects`                                           | Optional free-text description so users can note what a project is about                                                                                                                                                                                                                       |
| `unique_name` on `projects`                                           | A per-user slug for URL-friendly project references                                                                                                                                                                                                                                            |

## activity_log

| Column      | Type         | Notes                            |
| ----------- | ------------ | -------------------------------- |
| id          | UUID         | PK, default gen_random_uuid()    |
| user_email  | VARCHAR(255) | NOT NULL                         |
| action      | VARCHAR(50)  | e.g. CREATE, UPDATE, DELETE      |
| entity_type | VARCHAR(50)  | e.g. PROJECT, ENTRY              |
| entity_name | VARCHAR(150) | name of the affected entity      |
| details     | JSONB        | optional structured metadata     |
| deleted     | BOOLEAN      | default false — soft-delete flag |
| created_at  | TIMESTAMPTZ  | default CURRENT_TIMESTAMP        |

Append-only table — rows are inserted on every create/update/delete action and never modified. Used by the Activity Feed page to show a chronological stream of user actions. Indexed on `(user_email, created_at DESC)` for fast per-user lookups.

## health_ping

| Column    | Type         | Notes                                         |
| --------- | ------------ | --------------------------------------------- |
| id        | BIGINT       | PK, auto-generated identity                   |
| message   | TEXT         | NOT NULL, default `'hello hlulani'`           |
| pinged_at | TIMESTAMPTZ  | NOT NULL, default now()                       |

Internal keep-alive table. Supabase free-tier projects are paused after prolonged inactivity. The dashboard-service daemon periodically inserts and deletes a row in this table to prevent the database from sleeping. Row Level Security is enabled but no user-facing policies exist — only the service-role key (used by the backend daemon) can access it.

## RPC Functions

### delete_user()

Soft-deletes the authenticated user's account. Marks all related rows (entries, fields, projects, activity_log) as `deleted = true` and inserts/updates the user row with `deleted = true` and `deletion_scheduled_at = now()`. Uses `v_email` variable to avoid PL/pgSQL ambiguity with the `user_email` column name.

### restore_user()

Reverses a soft-delete. Sets `deleted = false` and clears `deletion_scheduled_at` on the user row and all related rows. Called automatically when a soft-deleted user signs back in.

### purge_deleted_users()

Permanently removes accounts whose 30-day grace period has expired. Iterates over all users where `deleted = true` and `deletion_scheduled_at < now() - INTERVAL '30 days'`, hard-deletes their rows from every table (`activity_log`, `entries`, `fields`, `projects`, `users`), and removes the corresponding `auth.users` row. Runs nightly via a `pg_cron` job scheduled at `0 0 * * *` (midnight UTC). Uses `SECURITY DEFINER` to bypass Row Level Security.

### get_project_stats()

Aggregates per-project statistics for the Stats page. Accepts a user email and returns `project_name`, `entry_count`, `total_duration` (sum of `ended_at - started_at` for completed entries, or `now() - started_at` for in-progress entries), and `in_progress` count. Only includes non-archived, non-deleted entries. Ordered by `total_duration DESC` so the most time-intensive projects appear first.

## Trade-off

This design trades some query complexity — values have to be interpreted
using their corresponding `fields` definition — for schema flexibility that
directly matches the brief's requirement to let users "customise the format"
of their logbook.

## IndexedDB (Client-Side Local Store)

The frontend maintains a local IndexedDB database that mirrors the
PostgreSQL schema. This is the **primary data source** for all UI
rendering — pages never query the server directly. The architecture is
local-first: reads come from IndexedDB instantly, and mutations write to
IndexedDB before syncing to the server.

**Database name:** `digital-logbook-cache`
**Version:** 3
**Library:** [idb](https://www.npmjs.com/package/idb) (lightweight IndexedDB wrapper)
**Source file:** `frontend/src/lib/cache.js`

### Object Stores

All stores use `key` as the keyPath. Data is scoped per user by storing
records under the user's email as the key.

| Store         | Key format                     | Contents                                                                                         | Mirrors PG table |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------- |
| `projects`    | `{email}`                      | All projects for the user. Shape: `{ success, projects: [...], key }`                           | `projects`       |
| `entries`     | `{email}:{project_name}`       | Per-project entries. Shape: `{ success, data: [...], key }`. Also `{email}:due-soon` for computed due-soon entries | `entries`        |
| `all-entries` | `{email}`                      | All entries across all projects. Shape: `{ success, data: [...], key }`                         | `entries`        |
| `profile`     | `{email}`                      | User profile (username, avatar, name). Shape: `{ success, data: {...}, key }`                   | `users`          |
| `search`      | `{email}`                      | Cached search results                                                                           | —                |
| `archives`    | `{email}:all`                  | Archived entries and projects. Also `archived-projects:{email}` and `unarchived-projects:{email}` | `projects`/`entries` (archived) |
| `fields`      | `{email}`                      | Custom field definitions per table                                                               | `fields`         |
| `cache-meta`  | `{key}`                        | Timestamps for stale-while-revalidate checks. Shape: `{ key, timestamp }`                       | —                |

### How Stores Map to PostgreSQL Tables

```
PostgreSQL (Supabase)           IndexedDB (Browser)
─────────────────────────       ─────────────────────────────
users          ──────────→      profile store
projects       ──────────→      projects store
entries        ──────────→      all-entries store (all rows)
                                entries store (per-project slices)
fields         ──────────→      fields store
activity_log   ──────────→      (not cached — server-only)
```

### Data Flow

1. **App load** — `syncAllData(email)` fetches all data from the server and populates every IndexedDB store. This runs once on login before any page renders.
2. **Reads** — Pages read exclusively from IndexedDB via the `useCachedData` hook. No server calls during navigation.
3. **Mutations** — Write to IndexedDB first (optimistic update), then sync to the server. On server failure, the optimistic update is rolled back.
4. **Real-time** — SSE (Server-Sent Events) invalidate relevant cache stores when other clients make changes.

### Event Subscription System

Components subscribe to cache changes via `cacheSubscribe(store, key, callback)`. When `cacheSet` is called, all subscribers for that store+key are notified with the new data. This is what makes the UI reactive without polling.

```javascript
// Example: subscribe to project changes
const unsub = cacheSubscribe('projects', email, (newProjects) => {
  // Re-render with new projects
});
// Later: unsub() to clean up
```

### Key Files

| File                                        | Purpose                                                    |
| ------------------------------------------- | ---------------------------------------------------------- |
| `frontend/src/lib/cache.js`                 | IndexedDB layer: cacheGet, cacheSet, cacheSubscribe, etc.  |
| `frontend/src/hooks/useCachedData.js`       | React hook: reads IndexedDB, subscribes, triggers fetch    |
| `frontend/src/CacheFunctions/syncService.js`| Central sync: populates all stores from server             |
| `frontend/src/functions/project/entries.js` | Entry CRUD with optimistic updates and rollback            |
| `frontend/src/functions/project/project.js` | Project CRUD with IndexedDB-first pattern                  |
| `frontend/src/functions/profile/profile.js` | Profile fetch with IndexedDB caching                       |

## Schema Migrations

Database changes are tracked through versioned SQL migration files in `supabase/migrations/`, applied in filename order.

### Migration Files

| File                             | Purpose                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `000_baseline_full_schema.sql`   | Idempotent baseline — creates all tables, types, indexes from scratch       |
| `001_add_project_description_and_unique_name.sql` | `description` column on projects + unique constraint on `(user_email, project_name)` |
| `002_auto_provision_public_users_for_auth.sql`    | Backfills `auth.users` into `public.users` for existing accounts           |
| `003_create_activity_log_table.sql`               | Creates `activity_log` table with composite index                          |
| `004_account_deletion_grace_period.sql`           | Soft-delete columns, `delete_user()`/`restore_user()`/`purge_deleted_users()` RPCs, nightly cron job |
| `005_add_soft_delete_column.sql`                  | Adds `deleted` boolean to all remaining tables                              |
| `006_create_health_ping_table.sql`                | `health_ping` table for Supabase keep-alive daemon with RLS                 |
| `007_add_summary_column.sql`                      | `summary TEXT` column on entries for AI-generated one-liners                |

### CLI Commands

```bash
# Apply all pending migrations (run from project root)
npm run db:migrate

# Full database backup (data + schema)
npm run db:backup

# Restore from backup
npm run db:restore
```

All migration scripts are in the `scripts/` directory and require the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.

### Key Files

- `supabase/setup.sql` — Original full schema (for fresh installs)
- `supabase/migrations/` — Incremental migration files
- `scripts/backup.js` — Backup utility
- `scripts/restore.js` — Restore utility
- `scripts/migrate.js` — Migration runner

---

## Deployment

### Hosting

The database is a **Supabase-managed PostgreSQL** instance. Supabase provides the PostgreSQL engine, SSL certificates, automatic backups (daily on the free tier), and a web-based SQL editor at `supabase.com/dashboard/project/_/sql`. There is no self-hosted database server — all infrastructure is managed by Supabase.

### Connection Architecture

Each backend service connects to PostgreSQL through a `pg.Pool` (connection pool) configured in `services/project-service/src/db.js` and equivalent files in dashboard-service:

```javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },  // Required for Supabase
});
```

- **`DATABASE_URL`** — Supabase's direct connection string (provided in the Supabase dashboard under Settings > Database). Contains host, port, database name, user, and password in one URL.
- **SSL required** — Supabase enforces SSL for all connections. `rejectUnauthorized: false` is needed because Supabase uses a self-signed certificate on the free tier.
- **Connection pooling** — The `pg.Pool` manages up to 10 concurrent connections per service instance, reusing them across requests. This prevents connection exhaustion on Supabase's free-tier limit of 60 concurrent connections.
- **Startup verification** — Each service runs `SELECT 1` on startup to verify the pool is connected. If it fails, an error is logged but the service still starts (graceful degradation).

### Environment Variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | project-service, dashboard-service | PostgreSQL connection string |
| `SUPABASE_URL` | All 4 services, frontend | Supabase project URL (for Auth client) |
| `SUPABASE_KEY` | All 4 services | Supabase anon/public key (for client-side auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | project-service | Supabase service-role key (bypasses RLS for server operations) |
| `VITE_SUPABASE_URL` | frontend | Build-time Supabase URL (exposed to the browser) |
| `VITE_SUPABASE_ANON_KEY` | frontend | Build-time Supabase anon key (safe to expose — RLS protects data) |

All secrets are configured through the Render dashboard (not in the repository) and injected as environment variables at runtime. Locally, they are loaded from `.env` files via `dotenv`.

### Which Services Connect

| Service | Connects to PostgreSQL? | How |
| --- | --- | --- |
| **project-service** | Yes | Direct `pg.Pool` via `DATABASE_URL` — owns projects, entries, fields, archives, activity_log |
| **dashboard-service** | Yes | Direct `pg.Pool` via `DATABASE_URL` — read-only aggregation for stats and search |
| **auth-service** | No | Uses Supabase Auth SDK (`SUPABASE_URL` + `SUPABASE_KEY`) — never touches PostgreSQL directly |
| **profile-service** | No | Uses Supabase Auth SDK — reads/writes `public.users` through Supabase client, not raw SQL |

### Backups and Restore

Supabase provides automatic daily backups on all plans (7-day retention on the free tier). Additionally, the project includes custom backup scripts:

```bash
# Full database backup (data + schema) — outputs to backups/ directory
npm run db:backup

# Restore from a backup file
npm run db:restore
```

These scripts (`scripts/backup.js` and `scripts/restore.js`) use the Supabase service-role key to dump and restore all tables. They require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.

### Health Monitoring

Two mechanisms keep the database active and detect issues:

1. **Keep-alive daemon** — The dashboard-service runs a background interval that inserts and deletes a row in the `health_ping` table every 5 minutes. This prevents Supabase's free tier from pausing the database due to inactivity.
2. **Render health endpoint** — Each service exposes a `/service/health-ping` endpoint that the keep-alive GitHub/Gitea Action pings every 15 minutes. If the service cannot connect to the database, the health check fails and the action logs a warning.

### Row Level Security (RLS)

Supabase enforces Row Level Security on all tables. The backend services use the **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) which bypasses RLS — this is intentional because the services implement their own authorization (JWT verification in middleware). The frontend's Supabase client uses the anon key, which is subject to RLS policies, but the frontend never queries Supabase directly anyway.

### Scheduled Jobs

| Job | Schedule | Purpose |
| --- | --- | --- |
| `purge-deleted-users` | `0 0 * * *` (midnight UTC daily) | Permanently removes soft-deleted accounts past the 30-day grace period |

Requires the `pg_cron` Supabase extension. The job calls `purge_deleted_users()`, which hard-deletes from all tables and removes the `auth.users` row.
