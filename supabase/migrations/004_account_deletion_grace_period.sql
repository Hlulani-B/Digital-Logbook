-- 30-day account deletion grace period
-- Adds a scheduled-deletion timestamp and the RPCs to schedule/restore/purge accounts.

-- 1. Add deletion_scheduled_at column to public.users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

-- 2. Schedule-account-deletion RPC
--    Marks the account for deletion in 30 days instead of removing data immediately.
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  authenticated_email TEXT;
BEGIN
  SELECT u.email INTO authenticated_email
    FROM auth.users u
   WHERE u.id = auth.uid();

  IF authenticated_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  INSERT INTO public.users AS u (email, deletion_scheduled_at)
  VALUES (authenticated_email, now())
  ON CONFLICT (email)
  DO UPDATE SET deletion_scheduled_at = now()
  WHERE u.email = authenticated_email;
END;
$$;

-- 3. Restore-account RPC
--    Cancels a scheduled deletion before the 30-day grace period ends.
CREATE OR REPLACE FUNCTION restore_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  authenticated_email TEXT;
BEGIN
  SELECT u.email INTO authenticated_email
    FROM auth.users u
   WHERE u.id = auth.uid();

  IF authenticated_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  UPDATE public.users
     SET deletion_scheduled_at = NULL
   WHERE email = authenticated_email;
END;
$$;

-- 4. Purge deleted accounts RPC
--    Permanently removes accounts (and all app data) whose grace period has expired.
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
     WHERE deletion_scheduled_at IS NOT NULL
       AND deletion_scheduled_at < now() - INTERVAL '30 days'
  LOOP
    DELETE FROM public.activity_log al WHERE al.user_email = rec.email;
    DELETE FROM public.entries      e  WHERE e.user_email  = rec.email;
    DELETE FROM public.fields       f  WHERE f.user_email  = rec.email;
    DELETE FROM public.projects     p  WHERE p.user_email  = rec.email;
    DELETE FROM public.users        WHERE email = rec.email;
    DELETE FROM auth.users          WHERE email = rec.email;
  END LOOP;
END;
$$;

-- 5. Nightly cron job to run purge_deleted_users
--    Requires the pg_cron extension to be enabled in Supabase.
SELECT cron.unschedule('purge-deleted-users') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-users');
SELECT cron.schedule('purge-deleted-users', '0 0 * * *', 'SELECT public.purge_deleted_users();');
