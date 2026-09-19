-- Schema templates: built-in, personal, and global.
-- Templates are deep-copied into projects on creation; no live inheritance.
BEGIN;

CREATE TABLE IF NOT EXISTS public.schema_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255),
  scope TEXT NOT NULL DEFAULT 'personal'
    CHECK (scope IN ('built_in', 'personal', 'global')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  is_fork BOOLEAN NOT NULL DEFAULT false,
  forked_from UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schema_templates_name_length CHECK (length(name) BETWEEN 1 AND 255),
  CONSTRAINT schema_templates_description_length CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT schema_templates_version_positive CHECK (version > 0),
  CONSTRAINT schema_templates_user_scope CHECK (
    (scope = 'built_in' AND user_email IS NULL) OR
    (scope IN ('personal', 'global') AND user_email IS NOT NULL)
  ),
  CONSTRAINT schema_templates_fork_consistency CHECK (
    (is_fork = true AND forked_from IS NOT NULL) OR
    (is_fork = false AND forked_from IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS schema_templates_scope_idx
  ON public.schema_templates (scope, user_email) WHERE deleted IS NOT TRUE;
CREATE INDEX IF NOT EXISTS schema_templates_fork_idx
  ON public.schema_templates (forked_from) WHERE is_fork = true;

ALTER TABLE public.schema_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schema_templates FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.schema_templates FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.schema_templates FROM authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'schema_templates' AND policyname = 'deny_client_template_writes') THEN
    CREATE POLICY deny_client_template_writes ON public.schema_templates
      AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
  END IF;
END $$;

COMMIT;
