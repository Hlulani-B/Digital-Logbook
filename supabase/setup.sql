-- ============================================================
-- Supabase SQL Setup — Digital Logbook
-- Run ALL of this in Supabase SQL Editor (one shot):
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Profile service: users table
--    Used by profile-service for checkUser, getProfile, username/email/name/avatar updates.
--    Frontend inserts only { email } on signup; username/name/avatar filled later.
CREATE TABLE IF NOT EXISTS public.users (
  email                   VARCHAR(255) PRIMARY KEY,
  username                VARCHAR(50)  UNIQUE,
  name                    VARCHAR(100),
  avatar                  TEXT,
  created_at              TIMESTAMPTZ  DEFAULT now(),
  deletion_scheduled_at   TIMESTAMPTZ,
  deleted                 BOOLEAN      NOT NULL DEFAULT false
);

-- 1b. Activity log table
--    Tracks user actions (like a Facebook feed) for the activity log feature.
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           BIGSERIAL PRIMARY KEY,
  user_email   VARCHAR(255) NOT NULL,
  action_type  VARCHAR(50)  NOT NULL,
  entity_type  VARCHAR(50),
  entity_name  VARCHAR(255),
  details      JSONB,
  created_at   TIMESTAMPTZ DEFAULT now(),
  deleted      BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_email
  ON public.activity_log (user_email, created_at DESC);

-- 2. Schedule-account-deletion RPC (Settings panel)
--    Marks the account for deletion in 30 days instead of removing data immediately.
--    The user can still sign in during the grace period and restore the account.
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT u.email INTO v_email
    FROM auth.users u
   WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  -- Soft-delete all related data
  UPDATE public.entries SET deleted = true WHERE user_email = v_email;
  UPDATE public.fields SET deleted = true WHERE user_email = v_email;
  UPDATE public.projects SET deleted = true WHERE user_email = v_email;
  UPDATE public.activity_log SET deleted = true WHERE user_email = v_email;

  -- Mark user as deleted and schedule deletion
  INSERT INTO public.users (email, deletion_scheduled_at, deleted)
  VALUES (v_email, now(), true)
  ON CONFLICT (email)
  DO UPDATE SET deletion_scheduled_at = now(), deleted = true;
END;
$$;

-- 2b. Restore-account RPC
--     Cancels a scheduled deletion before the 30-day grace period ends.
CREATE OR REPLACE FUNCTION restore_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT u.email INTO v_email
    FROM auth.users u
   WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  -- Restore all related data
  UPDATE public.entries SET deleted = false WHERE user_email = v_email;
  UPDATE public.fields SET deleted = false WHERE user_email = v_email;
  UPDATE public.projects SET deleted = false WHERE user_email = v_email;
  UPDATE public.activity_log SET deleted = false WHERE user_email = v_email;

  -- Restore user account
  UPDATE public.users
     SET deletion_scheduled_at = NULL, deleted = false
   WHERE email = v_email;
END;
$$;

-- 2c. Purge deleted accounts RPC
--     Permanently removes accounts (and all app data) whose grace period has expired.
--     Intended to be run by a nightly cron job.
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
    -- Clean up app tables
    DELETE FROM public.activity_log al WHERE al.user_email = rec.email;
    DELETE FROM public.entries      e  WHERE e.user_email  = rec.email;
    DELETE FROM public.fields       f  WHERE f.user_email  = rec.email;
    DELETE FROM public.projects     p  WHERE p.user_email  = rec.email;
    DELETE FROM public.users        WHERE email = rec.email;

    -- Remove the auth account
    DELETE FROM auth.users WHERE email = rec.email;
  END LOOP;
END;
$$;

-- 3. Backfill existing auth users into public.users
--    Run this once after creating the table to avoid FK errors for users who signed up before.
INSERT INTO public.users (email)
SELECT DISTINCT email
FROM auth.users
WHERE email IS NOT NULL
  AND email NOT IN (SELECT email FROM public.users)
ON CONFLICT (email) DO NOTHING;

-- 4. Nightly cron to purge accounts past the 30-day grace period
--    Requires the pg_cron extension to be enabled in Supabase.
--    Unschedule first to avoid duplicate jobs when re-running this script.
SELECT cron.unschedule('purge-deleted-users') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-users');
SELECT cron.schedule('purge-deleted-users', '0 0 * * *', 'SELECT public.purge_deleted_users();');

-- 5. Project statistics RPC
--    Aggregates duration per project for a given user.
--    Uses the stored `duration` column (ended_at − started_at) for completed entries,
--    and now() − started_at for in-progress entries.
--    Returns project_name, entry count, total duration, and in-progress count.
CREATE OR REPLACE FUNCTION get_project_stats(p_user_email TEXT)
RETURNS TABLE (
  project_name   TEXT,
  entry_count    BIGINT,
  total_duration INTERVAL,
  in_progress    BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.project_name::TEXT,
    COUNT(*)::BIGINT AS entry_count,
    COALESCE(SUM(
      CASE
        WHEN e.ended_at IS NOT NULL THEN e.duration
        WHEN e.started_at IS NOT NULL THEN now() - e.started_at
        ELSE INTERVAL '0'
      END
    ), INTERVAL '0')::INTERVAL AS total_duration,
    COUNT(*) FILTER (WHERE e.started_at IS NOT NULL
                       AND e.ended_at IS NULL)::BIGINT AS in_progress
  FROM entries e
  WHERE e.user_email = p_user_email
    AND e.archived = false
    AND e.deleted = false
  GROUP BY e.project_name
  ORDER BY total_duration DESC;
END;
$$;
