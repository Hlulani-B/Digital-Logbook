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

### Why a local-first (SQLite) architecture

The frontend uses SQLite (via sql.js) as the primary data source, not a cache. This design decision was driven by three factors:

1. **Instant UI.** Every page render reads from SQLite synchronously — no loading spinners, no waiting for network round-trips to Render's free-tier instances (which may be cold-starting). The user sees their data in under 16 ms.
2. **Offline resilience.** If the backend is down (Render free instances sleep after 15 minutes of inactivity), the user can still browse, search, and review their existing entries. Mutations queue for the next sync.
3. **Reduced server load.** Each page view generates zero API calls for data the user has already seen. Only mutations and initial sync hit the backend, keeping us within Render's free-tier bandwidth limits.

### Why SQLite (sql.js) over IndexedDB

The original implementation used IndexedDB via the `idb` library. This was replaced with SQLite (compiled to WebAssembly via sql.js) for the following reasons:

1. **Version conflicts between branches.** When multiple branches of the app are deployed to the same origin (e.g., main at DB version 4, hlulani at version 5), IndexedDB's one-way versioning causes silent hangs. The browser refuses to downgrade, and `openDB()` blocks indefinitely waiting for old connections to close.

2. **Complex upgrade logic.** IndexedDB requires manual `onupgradeneeded` handlers with version checks and store creation/deletion logic. Every schema change requires careful migration code. SQLite uses standard `CREATE TABLE IF NOT EXISTS` — no version negotiation needed.

3. **SQL query support.** IndexedDB's key-value API requires loading entire stores into memory and filtering in JavaScript. SQLite supports indexed queries (`WHERE user_email = ?`, `ORDER BY created_at DESC`), making it easier to reason about data access and more efficient for large datasets.

4. **Schema alignment with Supabase.** SQLite tables can mirror the PostgreSQL schema 1:1 with proper columns and types. This makes the local-first layer a true offline replica rather than a transformed cache blob.

5. **Familiar debugging.** SQLite databases can be inspected with standard tools (DB Browser for SQLite, `sqlite3` CLI). IndexedDB's opaque object stores are harder to debug when data goes missing.

**sql.js** is SQLite compiled to WebAssembly — the entire database engine runs in the browser. The WASM file (~1MB) loads once on first visit, then the app works 100% offline. Data persists to IndexedDB as a binary blob for durability across page refreshes.

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

| Column                 | Type         | Notes                                         |
| ---------------------- | ------------ | --------------------------------------------- |
| email                  | VARCHAR(255) | PK, NOT NULL, UNIQUE                          |
| username               | VARCHAR(50)  | UNIQUE, nullable                              |
| name                   | VARCHAR(100) | nullable                                      |
| avatar                 | TEXT         | nullable                                      |
| created_at             | TIMESTAMPTZ  | default now()                                 |
| deletion_scheduled_at  | TIMESTAMPTZ  | set when the user schedules account deletion  |
| deleted                | BOOLEAN      | NOT NULL default false — soft-delete flag     |
| email_notifications    | BOOLEAN      | NOT NULL default true — email preference      |
| notification_lead_time | TEXT         | default '24 hours' — due-date alert lead time |

## projects

| Column          | Type         | Notes                                                          |
| --------------- | ------------ | -------------------------------------------------------------- |
| id              | BIGSERIAL    | PK, auto-generated                                             |
| project_name    | VARCHAR(255) | NOT NULL                                                       |
| user_email      | VARCHAR(255) | NOT NULL, FK → users(email)                                    |
| description     | TEXT         | nullable                                                       |
| archived        | BOOLEAN      | default false                                                  |
| deleted         | BOOLEAN      | NOT NULL default false — soft-delete flag                      |
| project_color   | VARCHAR(7)   | nullable hex string (e.g. `#ec4899`), NULL = fall back to hash |
| schema_revision | INTEGER      | NOT NULL default 1 — schema version tracking                   |
| provenance      | JSONB        | nullable — template fork source info                           |
| created_at      | TIMESTAMPTZ  | default now()                                                  |

The pair `(user_email, project_name)` is unique, so one user cannot have two
projects with the same name. `description` was added after the initial schema
to let users record a short project summary. `project_color` was added in
Sprint 2 in response to user feedback asking for per-project personalisation
(see `testing.md` — Quick-Survey feature request "different colours so that
every project can have its own colour"). Chosen from an 18-swatch picker in
the project settings panel; when NULL the frontend falls back to a
name-derived colour.

## fields

| Column        | Type         | Notes                                                       |
| ------------- | ------------ | ----------------------------------------------------------- |
| id            | UUID         | PK, default gen_random_uuid()                               |
| user_email    | VARCHAR(255) | NOT NULL                                                    |
| table_name    | VARCHAR(100) | NOT NULL                                                    |
| field_name    | VARCHAR(100) | NOT NULL                                                    |
| data_type     | VARCHAR(50)  | e.g. text, number, boolean, date, select, multiselect, tags |
| is_required   | BOOLEAN      | default false                                               |
| is_unique     | BOOLEAN      | NOT NULL default false — unique value constraint            |
| rules         | JSONB        | NOT NULL default '{}' — custom validation rules             |
| has_default   | BOOLEAN      | NOT NULL default false — whether field has default          |
| default_value | JSONB        | nullable — default value                                    |
| options       | JSONB        | NOT NULL default '[]' — available options for select fields |
| display_order | INTEGER      | NOT NULL default 0 — field ordering                         |
| deleted       | BOOLEAN      | default false — soft-delete flag                            |
| created_at    | TIMESTAMPTZ  | default CURRENT_TIMESTAMP                                   |

### Field Data Types

The `data_type` column defines how a field behaves, what UI component renders it, and how values are validated. Supported types:

| Type          | UI Component      | Storage Format          | Description                                                |
| ------------- | ----------------- | ----------------------- | ---------------------------------------------------------- |
| `text`        | Text input        | `string`                | Single-line plain text                                     |
| `markdown`    | Markdown editor   | `string` (Markdown)     | Multi-line text with Markdown formatting                   |
| `integer`     | Number input      | `integer`               | Whole numbers only                                         |
| `float`       | Number input      | `float`                 | Decimal numbers                                            |
| `number`      | Number input      | `number`                | Generic numeric (auto-detects int/float)                   |
| `date`        | Date picker       | `YYYY-MM-DD`            | Calendar date without time                                 |
| `timestamp`   | DateTime picker   | ISO 8601 string         | Date and time combined                                     |
| `boolean`     | Toggle/Checkbox   | `boolean`               | True/false value                                           |
| `geolocation` | Map picker        | `{lat, lng}` object     | GPS coordinates                                            |
| `currency`    | Currency input    | `number`                | Monetary values with currency symbol                       |
| `file`        | File upload       | `{url, name, size}`     | File attachment metadata                                   |
| `image`       | Image upload      | `{url, name, size}`     | Image file with preview                                    |
| `entity_link` | Link picker       | `{id, type}` object     | Reference to another entry or project                      |
| `tags`        | Tag input         | `string[]`              | Multiple free-form tags                                    |
| `select`      | Dropdown          | `string` (option ID)    | Single selection from predefined options                   |
| `multiselect` | Multi-dropdown    | `string[]` (option IDs) | Multiple selections from predefined options (deduplicated) |
| `checklist`   | Checkbox list     | `{label, done}[]`       | List of items with completion state                        |
| `computed`    | Read-only display | varies                  | Auto-calculated value (not user-editable)                  |
| `custom`      | Custom renderer   | varies                  | Legacy type — becomes `select` when options are present    |

### Field Rules

The `rules` JSONB column stores validation constraints:

```typescript
interface FieldRules {
  min?: number | string; // Minimum value (numeric fields)
  max?: number | string; // Maximum value (numeric fields)
  minLength?: number; // Minimum length (text fields)
  maxLength?: number; // Maximum length (text fields)
  pattern?: string; // Regex pattern (text fields)
  warn_min?: number | string; // Warning threshold (low)
  warn_max?: number | string; // Warning threshold (high)
  alert_min?: number | string; // Alert threshold (low)
  alert_max?: number | string; // Alert threshold (high)
}
```

Warning and alert thresholds enable the **Dynamic Taxonomy** feature — fields can trigger visual warnings or alerts when values fall outside acceptable ranges.

### Field Options

The `options` JSONB column stores predefined choices for `select` and `multiselect` fields:

```typescript
interface FieldOption {
  id: string; // Unique identifier for the option
  label: string; // Display text
  value?: string; // Optional separate value (defaults to id)
  parent_id?: string; // For hierarchical/dynamic taxonomy options
}
```

The `parent_id` enables **Dynamic Taxonomy** — options can reference parent options to create hierarchical selection structures.

## entries

| Column             | Type                  | Notes                                         |
| ------------------ | --------------------- | --------------------------------------------- |
| id                 | UUID                  | PK, default gen_random_uuid()                 |
| user_email         | VARCHAR(255)          | NOT NULL, indexed                             |
| project_name       | VARCHAR(255)          | NOT NULL, indexed                             |
| entries            | JSONB                 | NOT NULL, dynamic field values                |
| due_date           | TIMESTAMPTZ           | nullable, indexed                             |
| priority           | priority_level (ENUM) | nullable                                      |
| status             | entry_status (ENUM)   | NOT NULL, default `'up_next'` — see below     |
| archived           | BOOLEAN               | default false                                 |
| started_at         | TIMESTAMPTZ           | nullable, set when user starts a work session |
| ended_at           | TIMESTAMPTZ           | nullable, set when user stops the session     |
| duration           | INTERVAL              | generated, `ended_at - started_at`            |
| target_duration_ms | BIGINT                | nullable — deadline countdown target          |
| paused_ms          | BIGINT                | NOT NULL default 0 — accumulated paused ms    |
| paused_at          | TIMESTAMPTZ           | nullable — when timer was paused              |
| summary            | TEXT                  | nullable, AI-generated one-sentence summary   |
| deleted            | BOOLEAN               | default false — soft-delete flag              |
| created_at         | TIMESTAMPTZ           | default CURRENT_TIMESTAMP                     |

!!! warning "Migration drift on `status`"
The baseline migration declares `status VARCHAR(30) DEFAULT 'up_next'`,
but the production database has been updated out-of-band to use an
`entry_status` ENUM. `000_baseline_full_schema.sql` should be re-aligned
with production so a fresh `npm run db:migrate` on a new environment
produces the same shape as the live DB.

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

| Column    | Type        | Notes                               |
| --------- | ----------- | ----------------------------------- |
| id        | BIGINT      | PK, auto-generated identity         |
| message   | TEXT        | NOT NULL, default `'hello hlulani'` |
| pinged_at | TIMESTAMPTZ | NOT NULL, default now()             |

Internal keep-alive table. Supabase free-tier projects are paused after prolonged inactivity. The dashboard-service daemon periodically inserts and deletes a row in this table to prevent the database from sleeping. Row Level Security is enabled but no user-facing policies exist — only the service-role key (used by the backend daemon) can access it.

## notes

| Column     | Type        | Notes                                                         |
| ---------- | ----------- | ------------------------------------------------------------- |
| id         | UUID        | PK, default gen_random_uuid()                                 |
| email      | TEXT        | NOT NULL, owner of the note                                   |
| entry_id   | UUID        | NOT NULL, FK → entries(id) ON DELETE CASCADE                  |
| entry_type | TEXT        | NOT NULL, CHECK (entry_type IN ('text','image','pdf','link')) |
| value      | TEXT        | NOT NULL, the note content                                    |
| created_at | TIMESTAMPTZ | default now()                                                 |
| deleted    | BOOLEAN     | default false — soft-delete flag                              |

Per-entry personalisation table. Lets users attach free-form notes (text snippets, image URLs, PDF references, or web links) to any entry. The `entry_type` check constraint keeps the type column to a known set of values, and the cascade delete ensures notes are cleaned up automatically when their parent entry is removed. Added based on user feedback requesting more personalisation options.

## ai_provider_cooldowns

| Column         | Type         | Notes                                                                       |
| -------------- | ------------ | --------------------------------------------------------------------------- |
| provider       | VARCHAR(100) | PK — the AI provider identifier (e.g. `groq`, `openrouter`)                 |
| cooldown_until | TIMESTAMPTZ  | NOT NULL, default `now()` — wall-clock time the provider is retryable again |
| deleted        | BOOLEAN      | NOT NULL default false — soft-delete flag                                   |

Small state table used by the project-service AI router to rate-limit calls
across multiple upstream providers. When a provider returns HTTP 429 or
throws a network error, the service stamps `cooldown_until` with a backoff
deadline and skips that provider on subsequent requests until the deadline
passes. This keeps the entry-summary and Quick-Add features working even
when one provider is throttled, without needing to store cooldown state in
process memory (which would be lost on cold start of a Render free instance).

## notifications

| Column        | Type        | Notes                                                |
| ------------- | ----------- | ---------------------------------------------------- |
| id            | UUID        | PK, default gen_random_uuid()                        |
| user_email    | TEXT        | NOT NULL                                             |
| entry_id      | UUID        | nullable, FK → entries(id)                           |
| project_name  | TEXT        | nullable — denormalized for display                  |
| entry_title   | TEXT        | nullable — denormalized for display                  |
| type          | TEXT        | NOT NULL, CHECK (type IN ('due_soon', 'overdue'))    |
| due_at        | TIMESTAMPTZ | nullable — when the entry is/was due                 |
| read          | BOOLEAN     | NOT NULL default false                               |
| emailed       | BOOLEAN     | NOT NULL default false — whether email was sent      |
| snoozed_until | TIMESTAMPTZ | nullable — when snooze expires                       |
| dismissed     | BOOLEAN     | NOT NULL default false — user dismissed notification |
| created_at    | TIMESTAMPTZ | NOT NULL default now()                               |

In-app notification feed for due-soon and overdue entries. One row per
(user, entry, type) — the UNIQUE constraint prevents duplicates. The
`generate_due_notifications()` RPC runs hourly via pg_cron to populate
this table. Indexed on `(user_email, read)` for unread counts and
`(emailed)` for pending email batches.

## schema_templates

| Column      | Type         | Notes                                                         |
| ----------- | ------------ | ------------------------------------------------------------- |
| id          | UUID         | PK, default gen_random_uuid()                                 |
| user_email  | VARCHAR(255) | nullable — NULL for built-in templates                        |
| scope       | TEXT         | NOT NULL, CHECK (scope IN ('built_in', 'personal', 'global')) |
| name        | VARCHAR(255) | NOT NULL                                                      |
| description | TEXT         | nullable                                                      |
| fields      | JSONB        | NOT NULL default '[]' — field definitions                     |
| version     | INTEGER      | NOT NULL default 1                                            |
| is_fork     | BOOLEAN      | NOT NULL default false                                        |
| forked_from | UUID         | nullable — source template if forked                          |
| deleted     | BOOLEAN      | NOT NULL default false                                        |
| deleted_at  | TIMESTAMPTZ  | nullable                                                      |
| created_at  | TIMESTAMPTZ  | NOT NULL default now()                                        |
| updated_at  | TIMESTAMPTZ  | NOT NULL default now()                                        |

Template system for pre-defined field schemas. Templates are deep-copied
into projects on creation (no live inheritance). Three scopes:

- **built_in**: Platform-provided templates (user_email is NULL)
- **personal**: User-created templates (user_email is set)
- **global**: Shared templates visible to all users

Row Level Security is enabled with restrictive policies — only the
backend service-role key can modify templates.

### Template Scopes

| Scope      | user_email | Visibility              | Managed By         |
| ---------- | ---------- | ----------------------- | ------------------ |
| `built_in` | NULL       | All users (read-only)   | Platform (seeds)   |
| `global`   | Set        | All users (read-only)   | Admins via backend |
| `personal` | Set        | Owner only (read/write) | Individual users   |

### Template Forking

Templates can be forked to create variations:

- `is_fork = true` indicates the template was copied from another
- `forked_from` stores the UUID of the source template
- `source_text` (migration 020) preserves the original template's field definitions as JSONB for reference
- Forked templates are independent — changes to the source don't affect forks

### Seeded Global Templates

Migration 022 seeds four built-in templates available to all users:

| Template Name         | Purpose                                   | Key Fields                                                                 |
| --------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| **Lab Report**        | Laboratory experiment reports             | Experiment Title, Date, Hypothesis, Methodology, Results, Conclusion, Tags |
| **Meeting Notes**     | Meeting documentation                     | Meeting Title, Date & Time, Attendees, Agenda, Decisions, Action Items     |
| **Field Observation** | Field research observations               | Observation Title, Date, Location (geolocation), Weather, Photos           |
| **Daily Log**         | Simple daily task and reflection tracking | Date, Tasks Completed (checklist), Notes, Reflections, Mood (select)       |

### Template Fields Structure

The `fields` JSONB column stores an array of field definitions matching the `fields` table schema:

```typescript
interface TemplateField {
  field_name: string;
  data_type: FieldType; // See Field Data Types table above
  is_required: boolean;
  is_unique: boolean;
  rules: FieldRules;
  has_default: boolean;
  default_value?: unknown;
  options: FieldOption[];
  display_order: number;
}
```

When a project is created from a template, these field definitions are deep-copied into the project's `fields` table rows — there is no live inheritance or synchronization after creation.

```sql
CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('text', 'image', 'pdf', 'link')),
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
```

## RPC Functions

### delete_user()

Soft-deletes the authenticated user's account. Marks all related rows (entries, fields, projects, activity_log) as `deleted = true` and inserts/updates the user row with `deleted = true` and `deletion_scheduled_at = now()`. Uses `v_email` variable to avoid PL/pgSQL ambiguity with the `user_email` column name.

### restore_user()

Reverses a soft-delete. Sets `deleted = false` and clears `deletion_scheduled_at` on the user row and all related rows. Called automatically when a soft-deleted user signs back in.

### purge_deleted_users()

Permanently removes accounts whose 30-day grace period has expired. Iterates over all users where `deleted = true` and `deletion_scheduled_at < now() - INTERVAL '30 days'`, hard-deletes their rows from every table (`activity_log`, `entries`, `fields`, `projects`, `users`), and removes the corresponding `auth.users` row. Runs nightly via a `pg_cron` job scheduled at `0 0 * * *` (midnight UTC). Uses `SECURITY DEFINER` to bypass Row Level Security.

### get_project_stats()

Aggregates per-project statistics for the Stats page. Accepts a user email and returns `project_name`, `entry_count`, `total_duration` (sum of `ended_at - started_at` for completed entries, or `now() - started_at` for in-progress entries), and `in_progress` count. Only includes non-archived, non-deleted entries. Ordered by `total_duration DESC` so the most time-intensive projects appear first.

### get_field_stats()

Generic field-statistics RPC. Where `get_project_stats()` hard-codes one metric (time per project), `get_field_stats()` knows nothing about any field in advance. It takes a user email and an optional project name, flattens every entry's `entries` JSONB with `jsonb_each_text`, resolves each field's `data_type` from the `fields` table (inferring it from the values themselves when the owner never declared one), and returns one row per field in the standard statistics format:

| Column        | Type    | Meaning                                                                                             |
| ------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `field_name`  | TEXT    | the owner-defined field name                                                                        |
| `data_type`   | TEXT    | declared or inferred type (`number`, `text`, `boolean`, `date`)                                     |
| `entry_count` | BIGINT  | entries considered                                                                                  |
| `filled`      | BIGINT  | entries where the field has a value                                                                 |
| `total`       | NUMERIC | sum of values — `NULL` for types that cannot be totalled                                            |
| `groups`      | JSONB   | `[{"value", "count"}]` — group by value                                                             |
| `series`      | JSONB   | `[{"bucket", "value"}]` — daily buckets for plotting over time (sums for numbers, counts otherwise) |
| `by_project`  | JSONB   | `[{"key", "count", "total"}]` — compare across projects                                             |

#### The standard statistics format

Statistics follow one format wherever they go: the frontend engine (`computeFieldStats` in `frontend/src/functions/dashboard/stats.js`), the Quick Stats panel, the My Stats page, and this RPC all express a field's statistics the same way — a **total** where the type allows it, a **group-by** of value counts, a **compare** across projects, and a daily **series** for plotting over time. Capabilities come from the field's `data_type` (the owner's declaration), never from hard-coded knowledge of a particular field, so a field defined tomorrow works everywhere without further changes.

## Trade-off

This design trades some query complexity — values have to be interpreted
using their corresponding `fields` definition — for schema flexibility that
directly matches the brief's requirement to let users "customise the format"
of their logbook.

## SQLite (Client-Side Local Store)

The frontend maintains a local SQLite database (via sql.js WebAssembly) that mirrors the
PostgreSQL schema. This is the **primary data source** for all UI
rendering — pages never query the server directly. The architecture is
local-first: reads come from SQLite instantly, and mutations write to
SQLite before syncing to the server.

**Library:** [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly)
**WASM file:** `frontend/public/sql-wasm.wasm` (~1MB, loaded once on first visit)
**Persistence:** Binary blob stored in IndexedDB under key `sqlitedb`
**Source file:** `frontend/src/lib/cache.js`

### Tables

SQLite tables mirror the PostgreSQL schema. Each table stores data as JSON blobs
for compatibility with the existing cache API, keyed by user email.

| Table           | Key format               | Contents                                                                                                           | Mirrors PG table                |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `projects`      | `{email}`                | All projects for the user. Shape: `{ success, projects: [...], key }`                                              | `projects`                      |
| `entries`       | `{email}:{project_name}` | Per-project entries. Shape: `{ success, data: [...], key }`. Also `{email}:due-soon` for computed due-soon entries | `entries`                       |
| `all_entries`   | `{email}`                | All entries across all projects. Shape: `{ success, data: [...], key }`                                            | `entries`                       |
| `profile`       | `{email}`                | User profile (username, avatar, name). Shape: `{ success, data: {...}, key }`                                      | `users`                         |
| `search`        | `{email}`                | Cached search results                                                                                              | —                               |
| `archives`      | `{email}:all`            | Archived entries and projects. Also `archived-projects:{email}` and `unarchived-projects:{email}`                  | `projects`/`entries` (archived) |
| `fields`        | `{email}`                | Custom field definitions per table                                                                                 | `fields`                        |
| `notes`         | `notes:{entry_id}`       | Per-entry notes (text, image, pdf, link)                                                                           | `notes`                         |
| `cache_meta`    | `{key}`                  | Timestamps for stale-while-revalidate checks. Shape: `{ key, timestamp }`                                          | —                               |
| `offline_queue` | Auto-increment `id`      | Queued offline actions. Shape: `{ action, module, payload, timestamp, attempts }`                                  | —                               |

### How Tables Map to PostgreSQL

```
PostgreSQL (Supabase)           SQLite (Browser via sql.js)
─────────────────────────       ─────────────────────────────
users          ──────────→      profile table
projects       ──────────→      projects table
entries        ──────────→      all_entries table (all rows)
                                entries table (per-project slices)
fields         ──────────→      fields table
notes          ──────────→      notes table
activity_log   ──────────→      (not cached — server-only)
```

### Data Flow

1. **App load** — `syncAllData(email)` fetches all data from the server and populates every SQLite table. This runs once on login before any page renders.
2. **Reads** — Pages read exclusively from SQLite via the `useCachedData` hook. No server calls during navigation.
3. **Mutations** — Write to SQLite first (optimistic update), then sync to the server. On server failure, the optimistic update is rolled back.
4. **Real-time** — SSE (Server-Sent Events) invalidate relevant cache stores when other clients make changes.
5. **Persistence** — After every write, the SQLite database is exported as a binary blob and stored in IndexedDB for durability across page refreshes.

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

| File                                          | Purpose                                                |
| --------------------------------------------- | ------------------------------------------------------ |
| `frontend/src/lib/cache.js`                   | SQLite layer: cacheGet, cacheSet, cacheSubscribe, etc. |
| `frontend/public/sql-wasm.wasm`               | SQLite WebAssembly binary (~1MB)                       |
| `frontend/src/hooks/useCachedData.js`         | React hook: reads SQLite, subscribes, triggers fetch   |
| `frontend/src/CacheFunctions/syncService.js`  | Central sync: populates all tables from server         |
| `frontend/src/CacheFunctions/offlineQueue.js` | Offline action queue using SQLite                      |
| `frontend/src/functions/project/entries.js`   | Entry CRUD with optimistic updates and rollback        |
| `frontend/src/functions/project/project.js`   | Project CRUD with SQLite-first pattern                 |
| `frontend/src/functions/profile/profile.js`   | Profile fetch with SQLite caching                      |

## Schema Migrations

Database changes are tracked through versioned SQL migration files in `supabase/migrations/`, applied in filename order.

### Migration Files

| File                                              | Purpose                                                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000_baseline_full_schema.sql`                    | Idempotent baseline — creates all tables, types, indexes from scratch                                                                                       |
| `001_add_project_description_and_unique_name.sql` | `description` column on projects + unique constraint on `(user_email, project_name)`                                                                        |
| `002_auto_provision_public_users_for_auth.sql`    | Backfills `auth.users` into `public.users` for existing accounts                                                                                            |
| `003_create_activity_log_table.sql`               | Creates `activity_log` table with composite index                                                                                                           |
| `004_account_deletion_grace_period.sql`           | Soft-delete columns, `delete_user()`/`restore_user()`/`purge_deleted_users()` RPCs, nightly cron job                                                        |
| `005_add_soft_delete_column.sql`                  | Adds `deleted` boolean to all remaining tables                                                                                                              |
| `006_create_health_ping_table.sql`                | `health_ping` table for Supabase keep-alive daemon with RLS                                                                                                 |
| `007_add_summary_column.sql`                      | `summary TEXT` column on entries for AI-generated one-liners                                                                                                |
| `008_add_project_color.sql`                       | `project_color VARCHAR(7)` column on projects for custom colour picker                                                                                      |
| `008_create_field_stats_rpc.sql`                  | `get_field_stats()` RPC — generic per-field statistics (total, groups, series, by-project)                                                                  |
| `009_create_notes_table.sql`                      | `notes` table for per-entry personalisation (text, image, pdf, link)                                                                                        |
| `010_purge_unconfirmed_signups.sql`               | `purge_unconfirmed_users()` RPC + nightly cron purging email sign-ups unconfirmed for 3 days                                                                |
| `011_create_notifications.sql`                    | `notifications` table (due-soon/overdue feed), `users.email_notifications` preference, `generate_due_notifications()` RPC + hourly pg_cron/pg_net cycle     |
| `012_add_timer_pause_fields.sql`                  | Timer pause support: `target_duration_ms`, `paused_ms`, `paused_at` columns on `entries`; updated `get_project_stats()` to subtract paused time             |
| `013_notification_enhancements.sql`               | Snooze (`snoozed_until`), dismiss (`dismissed`) columns on `notifications`; `notification_lead_time` on `users`; updated generator with per-user lead time  |
| `014_keep_completed_notifications.sql`            | Preserve notifications for completed entries instead of auto-deleting them                                                                                  |
| `015_custom_field_rules.sql`                      | Field validation: `is_unique`, `rules`, `has_default`, `default_value`, `options`, `display_order` on `fields`; `schema_revision`, `provenance` on projects |
| `016_schema_templates.sql`                        | `schema_templates` table for built-in, personal, and global field templates with RLS                                                                        |
| `017_field_attachments.sql`                       | File attachments for custom fields — stores upload metadata and S3 references                                                                               |
| `018_entity_linking.sql`                          | Cross-entry and cross-project linking support                                                                                                               |
| `019_field_permissions.sql`                       | Per-field visibility and edit permissions                                                                                                                   |
| `020_template_fork_source_text.sql`               | Stores original template source text for forked templates                                                                                                   |
| `021_timer_abandonment_notifications.sql`         | Alerts when timers run >2 hours or pause >30 minutes; `users.timer_abandonment_notifications` preference                                                    |
| `022_seed_global_templates.sql`                   | Seeds built-in templates (Daily Log, Weekly Review, Project Tracker, etc.)                                                                                  |

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
  ssl: { rejectUnauthorized: false }, // Required for Supabase
});
```

- **`DATABASE_URL`** — Supabase's direct connection string (provided in the Supabase dashboard under Settings > Database). Contains host, port, database name, user, and password in one URL.
- **SSL required** — Supabase enforces SSL for all connections. `rejectUnauthorized: false` is needed because Supabase uses a self-signed certificate on the free tier.
- **Connection pooling** — The `pg.Pool` manages up to 10 concurrent connections per service instance, reusing them across requests. This prevents connection exhaustion on Supabase's free-tier limit of 60 concurrent connections.
- **Startup verification** — Each service runs `SELECT 1` on startup to verify the pool is connected. If it fails, an error is logged but the service still starts (graceful degradation).

### Environment Variables

| Variable                    | Used by                            | Purpose                                                           |
| --------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`              | project-service, dashboard-service | PostgreSQL connection string                                      |
| `SUPABASE_URL`              | All 4 services, frontend           | Supabase project URL (for Auth client)                            |
| `SUPABASE_KEY`              | All 4 services                     | Supabase anon/public key (for client-side auth)                   |
| `SUPABASE_SERVICE_ROLE_KEY` | project-service                    | Supabase service-role key (bypasses RLS for server operations)    |
| `VITE_SUPABASE_URL`         | frontend                           | Build-time Supabase URL (exposed to the browser)                  |
| `VITE_SUPABASE_ANON_KEY`    | frontend                           | Build-time Supabase anon key (safe to expose — RLS protects data) |
| `BREVO_API_KEY`             | project-service                    | Brevo transactional-email API key (due-date notification emails)  |
| `BREVO_SENDER_EMAIL`        | project-service                    | Verified Brevo sender address used for notification emails        |

All secrets are configured through the Render dashboard (not in the repository) and injected as environment variables at runtime. Locally, they are loaded from `.env` files via `dotenv`.

### Which Services Connect

| Service               | Connects to PostgreSQL? | How                                                                                          |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| **project-service**   | Yes                     | Direct `pg.Pool` via `DATABASE_URL` — owns projects, entries, fields, archives, activity_log |
| **dashboard-service** | Yes                     | Direct `pg.Pool` via `DATABASE_URL` — read-only aggregation for stats and search             |
| **auth-service**      | No                      | Uses Supabase Auth SDK (`SUPABASE_URL` + `SUPABASE_KEY`) — never touches PostgreSQL directly |
| **profile-service**   | No                      | Uses Supabase Auth SDK — reads/writes `public.users` through Supabase client, not raw SQL    |

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

| Job                      | Schedule                         | Purpose                                                                                                            |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `purge-deleted-users`    | `0 0 * * *` (midnight UTC daily) | Permanently removes soft-deleted accounts past the 30-day grace period                                             |
| `due-notification-cycle` | `7 * * * *` (hourly)             | Inserts due-soon (24h) / overdue notification rows, then pokes project-service to send pending emails via `pg_net` |

Requires the `pg_cron` Supabase extension. The job calls `purge_deleted_users()`, which hard-deletes from all tables and removes the `auth.users` row.

The notification cycle uses `pg_net` (best-effort — if project-service is asleep on Render's free tier the POST fails silently and the next hourly run retries, since pending rows keep `emailed = false`). Any active app session also flushes pending emails opportunistically on its bell polls.
