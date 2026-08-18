-- ============================================================
-- Supabase SQL Setup — Digital Logbook
-- Run ALL of this in Supabase SQL Editor (one shot):
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Profile service: users table
--    Used by profile-service for checkUser, getProfile, username/email/name/avatar updates.
--    Frontend inserts only { email } on signup; username/name/avatar filled later.
CREATE TABLE IF NOT EXISTS public.users (
  email      VARCHAR(255) PRIMARY KEY,
  username   VARCHAR(50)  UNIQUE,
  name       VARCHAR(100),
  avatar     TEXT,
  created_at TIMESTAMPTZ  DEFAULT now()
);

-- 2. Delete-user RPC (account deletion from Settings panel)
--    Looks up the user's email from auth, cleans up app tables, then removes the auth account.
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

  -- Clean up profile-service table
  DELETE FROM public.users   WHERE email = user_email;

  -- Finally remove the auth account itself
  DELETE FROM auth.users WHERE id = auth.uid();
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

-- 4. Project statistics RPC
--    Aggregates duration per project for a given user.
--    Duration = ended_at − created_at (completed) or now() − created_at (in progress).
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
        WHEN e.ended_at IS NOT NULL THEN e.ended_at - e.created_at
        ELSE now() - e.created_at
      END
    ), INTERVAL '0')::INTERVAL AS total_duration,
    COUNT(*) FILTER (WHERE e.ended_at IS NULL)::BIGINT AS in_progress
  FROM entries e
  WHERE e.user_email = p_user_email
    AND e.archived = false
  GROUP BY e.project_name
  ORDER BY total_duration DESC;
END;
$$;
