-- ============================================================
-- Migration 008 — Digital Logbook
-- Purge email sign-ups that never confirmed within 3 days.
--
-- Problem:
--   Email/password sign-ups sit in auth.users with
--   email_confirmed_at = NULL until the user clicks the
--   confirmation link. Supabase keeps re-sending confirmation
--   reminders indefinitely, which spams stale addresses and
--   blocks the address from being re-registered cleanly.
--
-- Fix:
--   1. purge_unconfirmed_users() RPC removes auth accounts (and
--      their auto-provisioned public.users row) whose email was
--      never confirmed more than 3 days after sign-up.
--   2. A nightly cron job runs the purge automatically.
--
-- Notes:
--   - OAuth users (Google/GitHub) always have email_confirmed_at
--     set at creation, so they are never affected.
--   - A purged address can immediately sign up again and receive
--     a fresh confirmation email.
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Purge unconfirmed sign-ups RPC
CREATE OR REPLACE FUNCTION purge_unconfirmed_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, email
      FROM auth.users
     WHERE email_confirmed_at IS NULL
       AND created_at < now() - INTERVAL '3 days'
  LOOP
    -- Clean up app tables (normally empty — unconfirmed users
    -- cannot sign in — but belt-and-braces before FK removal)
    DELETE FROM public.activity_log WHERE user_email = rec.email;
    DELETE FROM public.entries      WHERE user_email = rec.email;
    DELETE FROM public.fields       WHERE user_email = rec.email;
    DELETE FROM public.projects     WHERE user_email = rec.email;

    -- Remove the auto-provisioned app profile
    DELETE FROM public.users WHERE email = rec.email;

    -- Remove the auth account (stops confirmation reminders)
    DELETE FROM auth.users WHERE id = rec.id;
  END LOOP;
END;
$$;

-- 2. Nightly cron job to run purge_unconfirmed_users
--    Requires the pg_cron extension to be enabled in Supabase.
--    Unschedule first to avoid duplicate jobs when re-running.
SELECT cron.unschedule('purge-unconfirmed-users') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-unconfirmed-users');
SELECT cron.schedule('purge-unconfirmed-users', '0 0 * * *', 'SELECT public.purge_unconfirmed_users();');
