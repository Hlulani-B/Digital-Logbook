BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS schema_revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS provenance JSONB;

ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS is_unique BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS has_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_value JSONB,
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Existing type strings and entry payloads remain untouched. The read adapter
-- exposes legacy custom selections as canonical select definitions.
CREATE INDEX IF NOT EXISTS fields_active_schema_order
  ON public.fields (user_email, table_name, display_order, created_at, id)
  WHERE deleted IS NOT TRUE;
CREATE INDEX IF NOT EXISTS entries_active_schema_validation
  ON public.entries (user_email, project_name, id)
  WHERE deleted IS NOT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fields_custom_rules_shape' AND conrelid = 'public.fields'::regclass) THEN
    ALTER TABLE public.fields ADD CONSTRAINT fields_custom_rules_shape CHECK (
      jsonb_typeof(rules) = 'object' AND jsonb_typeof(options) = 'array'
      AND display_order >= 0
      AND (has_default OR default_value IS NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_schema_revision_positive' AND conrelid = 'public.projects'::regclass) THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_schema_revision_positive CHECK (schema_revision > 0);
  END IF;
END $$;

-- Application writes must pass through the owner-locked backend boundary.
-- Do not alter read grants or unrelated tables/account lifecycle functions.
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.projects, public.fields, public.entries FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.projects, public.fields, public.entries FROM PUBLIC;

COMMIT;
