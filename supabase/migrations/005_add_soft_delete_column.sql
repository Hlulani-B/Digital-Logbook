-- Soft delete: add `deleted` boolean column to all tables
-- Records are never physically removed — they are marked deleted=true

-- 1. Add deleted column to all tables
ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ai_provider_cooldowns
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- 2. Update purge_deleted_users to only purge soft-deleted records
--    (users where deleted=true AND grace period has expired)
CREATE OR REPLACE FUNCTION purge_deleted_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT email
      FROM public.users
     WHERE deleted = true
       AND deletion_scheduled_at IS NOT NULL
       AND deletion_scheduled_at < now() - INTERVAL '30 days'
  LOOP
    -- Soft-deleted records are already marked — now permanently remove them
    DELETE FROM public.activity_log WHERE user_email = rec.email;
    DELETE FROM public.entries      WHERE user_email = rec.email;
    DELETE FROM public.fields       WHERE user_email = rec.email;
    DELETE FROM public.projects     WHERE user_email = rec.email;
    DELETE FROM public.users        WHERE email = rec.email;
    DELETE FROM auth.users          WHERE email = rec.email;
  END LOOP;
END;
$$;
