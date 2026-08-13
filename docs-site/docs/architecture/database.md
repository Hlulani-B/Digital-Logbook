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
| project_name | VARCHAR(150) | NOT NULL |
| user_email | VARCHAR(255) | NOT NULL, FK → users(email) |
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
| created_at | TIMESTAMPTZ | default CURRENT_TIMESTAMP |

```sql
ALTER TABLE entries
ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_entries_due_date ON entries(due_date);
```

## Design rationale

| Decision | Why |
|---|---|
| `id` as `INT GENERATED ALWAYS AS IDENTITY` on `users`/`projects` | Simple auto-incrementing keys are enough for tables that stay small and relational — no need for UUIDs here since these rows are rarely referenced outside the database itself |
| `id` as `UUID` on `fields`/`entries` | These rows get referenced from the frontend and possibly across services, so UUIDs avoid leaking a guessable sequential count and avoid collisions if entries are ever created offline before syncing |
| `user_id` FK with `ON DELETE CASCADE` on `projects` | If a user account is deleted, their projects have no owner and no reason to exist, so cascading avoids orphaned rows and manual cleanup |
| `user_email` directly on `fields`/`entries` (not a FK) | Keeps lookups simple at this project's scale, rather than joining through `users` every time; also matches Supabase Auth, which identifies sessions by email rather than the internal `users.id` |
| `table_name` on `fields` | Scopes multiple field-sets independently per user (e.g. `logbook` vs `profile`) without needing a separate physical table for each one |
| Field definitions stored as **rows**, not columns | Avoids `ALTER TABLE` migrations every time a user adds or changes a custom field — the database structure itself never has to change |
| `entries` stored as `JSONB` | The shape of an entry varies per user/project, so a fixed set of SQL columns can't represent it. JSONB stores the submitted values as one flexible object while staying natively indexable and queryable in Postgres |
| `due_date` as a real column, not inside `entries` JSONB | Overdue checks need to run a fast, indexed comparison against `now()` across every row. A value buried in JSONB can't be indexed the same way, so pulling it out keeps "show me anything overdue" cheap even as entries grow |
| Indexes on `user_email` and `project_name` | These are the two columns entries will constantly be filtered by (a user viewing their own logbook, scoped to one project), so indexing keeps those lookups fast as data grows |
| Index on `due_date` | Lets the app flag overdue entries with a simple query like `WHERE due_date < now()` without scanning the whole table |

## Trade-off

This design trades some query complexity — values have to be interpreted
using their corresponding `fields` definition — for schema flexibility that
directly matches the brief's requirement to let users "customise the format"
of their logbook.