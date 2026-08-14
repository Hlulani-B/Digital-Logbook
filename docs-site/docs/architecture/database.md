# Database Schema

**Database:** PostgreSQL, hosted via Supabase.
**Access pattern:** the frontend never queries Supabase directly — every
request goes through our own Express services first.

## Why a dynamic schema instead of fixed columns

A logbook's structure needs to be customisable per project — different
projects track different kinds of information, and the brief requires that
the owner, not the platform, decides the shape of an entry.

A fixed set of columns (e.g. `hours`, `supervisor`, `notes`) would force every
user into the same entry shape, which doesn't satisfy that requirement. Two
tables solve this without needing a schema migration every time a user adds a
field.

## users

| Column | Type | Notes |
|---|---|---|
| email | VARCHAR(255) | PK, NOT NULL, UNIQUE |
| username | VARCHAR(50) | NOT NULL, UNIQUE |
| name | VARCHAR(100) | NOT NULL |
| avatar | TEXT | |
| created_at | TIMESTAMP | default CURRENT_TIMESTAMP |

## projects

| Column | Type | Notes |
|---|---|---|
| project_name | VARCHAR(150) | PK, NOT NULL |
| user_email | VARCHAR(255) | NOT NULL, FK → users(email) |
| is_archived | BOOLEAN | default false |
| archived | BOOLEAN | default false |
| created_at | TIMESTAMP | default CURRENT_TIMESTAMP |

## fields

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, default gen_random_uuid() |
| user_email | VARCHAR(255) | NOT NULL |
| table_name | VARCHAR(100) | NOT NULL |
| field_name | VARCHAR(100) | NOT NULL |
| data_type | VARCHAR(50) | e.g. text, number, boolean, date |
| is_required | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | default CURRENT_TIMESTAMP |

## entries

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, default gen_random_uuid() |
| user_email | VARCHAR(255) | NOT NULL, indexed |
| project_name | VARCHAR(255) | NOT NULL, indexed |
| entries | JSONB | NOT NULL, dynamic field values |
| due_date | TIMESTAMPTZ | nullable, indexed |
| priority | priority_level (ENUM) | nullable |
| archived | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | default CURRENT_TIMESTAMP |

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
ADD COLUMN is_archived BOOLEAN DEFAULT false;

ALTER TABLE projects
ADD COLUMN archived BOOLEAN DEFAULT false;

ALTER TABLE entries
ADD COLUMN archived BOOLEAN DEFAULT false;

CREATE INDEX idx_projects_is_archived ON projects(is_archived);
CREATE INDEX idx_projects_archived ON projects(archived);
CREATE INDEX idx_entries_archived ON entries(archived);
```

## Design rationale

| Decision | Why |
|---|---|
| `email` as PK on `users` | Supabase Auth already identifies sessions by email rather than an internal id, so making it the PK removes a redundant surrogate key and matches how other tables already reference users |
| `id` as `UUID` on `fields`/`entries` | These rows get referenced from the frontend and possibly across services, so UUIDs avoid leaking a guessable sequential count and avoid collisions if entries are ever created offline before syncing |
| `projects` has no surrogate `id` | Now that `users` is keyed by `email`, `projects` doesn't need its own auto-incrementing id either — `user_email` + `project_name` is enough to identify a project without carrying an extra unused key |
| `user_email` FK with `ON DELETE CASCADE` on `projects` | If a user account is deleted, their projects have no owner and no reason to exist, so cascading avoids orphaned rows and manual cleanup |
| `user_email` directly on `fields`/`entries` (not a FK) | Keeps lookups simple at this project's scale, rather than joining through `users` every time; also matches Supabase Auth, which identifies sessions by email |
| `table_name` on `fields` | Scopes multiple field-sets independently per user (e.g. `logbook` vs `profile`) without needing a separate physical table for each one |
| Field definitions stored as **rows**, not columns | Avoids `ALTER TABLE` migrations every time a user adds or changes a custom field — the database structure itself never has to change |
| `entries` stored as `JSONB` | The shape of an entry varies per user/project, so a fixed set of SQL columns can't represent it. JSONB stores the submitted values as one flexible object while staying natively indexable and queryable in Postgres |
| `due_date` as a real column, not inside `entries` JSONB | Overdue checks need to run a fast, indexed comparison against `now()` across every row. A value buried in JSONB can't be indexed the same way, so pulling it out keeps "show me anything overdue" cheap even as entries grow |
| `priority` as a Postgres ENUM, not inside `entries` JSONB | Priority is a fixed, small set of values shared by every project regardless of their custom fields, so it belongs alongside `due_date` as a real column rather than something the user defines per-project. An ENUM also stops bad values from ever being written, which JSONB can't guarantee |
| `priority` nullable | Not every entry needs a priority assigned, so the column has no default and no `NOT NULL` — it's opt-in |
| Indexes on `user_email` and `project_name` | These are the two columns entries will constantly be filtered by (a user viewing their own logbook, scoped to one project), so indexing keeps those lookups fast as data grows |
| Index on `due_date` | Lets the app flag overdue entries with a simple query like `WHERE due_date < now()` without scanning the whole table |
| `is_archived` on `projects`, `archived` on `entries` | Soft-archive support lets users hide projects/entries without deleting data. Projects use the more explicit `is_archived` name because the table already represents a noun (`projects`), so a boolean predicate (`is_archived`) reads more clearly in queries; entries keep `archived` because it was the original naming convention. Both default `false` so existing rows remain visible |
| Indexes on `is_archived` / `archived` | Keeps "show only active" / "show only archived" filters fast as data grows |

## Trade-off

This design trades some query complexity — values have to be interpreted
using their corresponding `fields` definition — for schema flexibility that
directly matches the brief's requirement to let users "customise the format"
of their logbook.
