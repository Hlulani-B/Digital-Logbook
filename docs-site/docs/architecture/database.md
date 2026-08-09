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

## `fields` table

Defines the shape of a user's custom entry form.

```sql
CREATE TABLE fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fields_user_email ON fields(user_email);
```

## `entries` table

Stores the actual submitted data as a flexible object.

```sql
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    entries JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entries_user_email ON entries(user_email);
CREATE INDEX idx_entries_project_name ON entries(project_name);
```

## Design rationale

| Decision | Why |
|---|---|
| `user_email` directly on each table | Keeps lookups simple at this project's scale, rather than joining through a separate `users` table via foreign key |
| `table_name` on `fields` | Scopes multiple field-sets independently per user (e.g. `logbook` vs `profile`) without needing a separate physical table for each one |
| Field definitions stored as **rows**, not columns | Avoids `ALTER TABLE` migrations every time a user adds or changes a custom field — the database structure itself never has to change |
| `entries` stored as `JSONB` | The shape of an entry varies per user/project, so a fixed set of SQL columns can't represent it. JSONB stores the submitted values as one flexible object while staying natively indexable and queryable in Postgres |
| Indexes on `user_email` and `project_name` | These are the two columns entries will constantly be filtered by (a user viewing their own logbook, scoped to one project), so indexing keeps those lookups fast as data grows |

## Trade-off

This design trades some query complexity — values have to be interpreted
using their corresponding `fields` definition — for schema flexibility that
directly matches the brief's requirement to let users "customise the format"
of their logbook.
