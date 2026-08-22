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

-- 2. Update delete_user RPC to soft-delete all data
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT u.email INTO user_email
    FROM auth.users u
   WHERE u.id = auth.uid();

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  -- Soft-delete all related data
  UPDATE public.entries SET deleted = true WHERE user_email = user_email;
  UPDATE public.fields SET deleted = true WHERE user_email = user_email;
  UPDATE public.projects SET deleted = true WHERE user_email = user_email;
  UPDATE public.activity_log SET deleted = true WHERE user_email = user_email;

  -- Mark user as deleted and schedule deletion
  INSERT INTO public.users (email, deletion_scheduled_at, deleted)
  VALUES (user_email, now(), true)
  ON CONFLICT (email)
  DO UPDATE SET deletion_scheduled_at = now(), deleted = true;
END;
$$;

-- 3. Update restore_user RPC to restore all soft-deleted data
CREATE OR REPLACE FUNCTION restore_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT u.email INTO user_email
    FROM auth.users u
   WHERE u.id = auth.uid();

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  -- Restore all related data
  UPDATE public.entries SET deleted = false WHERE user_email = user_email;
  UPDATE public.fields SET deleted = false WHERE user_email = user_email;
  UPDATE public.projects SET deleted = false WHERE user_email = user_email;
  UPDATE public.activity_log SET deleted = false WHERE user_email = user_email;

  -- Restore user account
  UPDATE public.users
     SET deletion_scheduled_at = NULL, deleted = false
   WHERE email = user_email;
END;
$$;

-- 4. Update purge_deleted_users to only purge soft-deleted records
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
    DELETE FROM public.activity_log WHERE user_email = rec.email;
    DELETE FROM public.entries      WHERE user_email = rec.email;
    DELETE FROM public.fields       WHERE user_email = rec.email;
    DELETE FROM public.projects     WHERE user_email = rec.email;
    DELETE FROM public.users        WHERE email = rec.email;
    DELETE FROM auth.users          WHERE email = rec.email;
  END LOOP;
END;
$$;
