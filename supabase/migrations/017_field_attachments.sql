-- Private field attachments. Apply with the backend database owner.
CREATE TABLE IF NOT EXISTS public.field_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL,
  project_id BIGINT NOT NULL,
  field_id UUID NOT NULL,
  entry_id UUID,
  storage_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 180),
  mime_type TEXT NOT NULL,
  expected_size INTEGER NOT NULL CHECK (expected_size BETWEEN 1 AND 10485760),
  size INTEGER CHECK (size BETWEEN 1 AND 10485760),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'finalized', 'cleanup_pending')),
  uploaded_at TIMESTAMPTZ,
  upload_token UUID,
  lease_until TIMESTAMPTZ,
  cleanup_attempts INTEGER NOT NULL DEFAULT 0,
  cleanup_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((upload_token IS NULL) = (lease_until IS NULL)),
  CHECK ((uploaded_at IS NULL) = (size IS NULL)),
  CHECK ((status = 'finalized') = (entry_id IS NOT NULL)),
  CHECK (status <> 'finalized' OR uploaded_at IS NOT NULL)
);
-- Intentionally no cascading parent FKs: purges must not discard storage cleanup
-- keys, and field edits must not delete historical objects. Every application
-- operation checks the current parent ownership; finalization checks the entry.
CREATE INDEX IF NOT EXISTS field_attachments_owner_idx
  ON public.field_attachments (user_email, project_id, field_id);
CREATE INDEX IF NOT EXISTS field_attachments_entry_idx
  ON public.field_attachments (entry_id) WHERE entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS field_attachments_cleanup_idx
  ON public.field_attachments (cleanup_after, created_at) WHERE status <> 'finalized';

ALTER TABLE public.field_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.field_attachments FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.field_attachments FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.field_attachments FROM authenticated;
  END IF;
  -- Explicit restrictive policy also protects against future permissive policies.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'field_attachments' AND policyname = 'deny_client_metadata') THEN
    CREATE POLICY deny_client_metadata ON public.field_attachments
      AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
  END IF;
  -- Plain PostgreSQL test databases do not contain the Supabase storage schema.
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('field-attachments', 'field-attachments', false, 10485760,
      ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf',
            'text/plain', 'text/csv', 'text/markdown', 'application/json',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
    ON CONFLICT (id) DO UPDATE SET public = false,
      file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage'
                   AND tablename = 'objects' AND policyname = 'field_attachments_server_only') THEN
      CREATE POLICY field_attachments_server_only ON storage.objects
        AS RESTRICTIVE FOR ALL TO PUBLIC
        USING (bucket_id <> 'field-attachments')
        WITH CHECK (bucket_id <> 'field-attachments');
    END IF;
  END IF;
END $$;
