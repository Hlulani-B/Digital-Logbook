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

-- 3. Project statistics RPC (used by the frontend "My Stats" view)
--    Sums the `duration` (interval) column per project for the signed-in user.
--    EXTRACT(EPOCH FROM ...) converts the summed interval to seconds for easy
--    client-side formatting. LEFT JOIN projects<->entries so zero-entry projects
--    still appear (count 0, time 0). SECURITY DEFINER + auth.uid() means the
--    caller can only see their own data (no spoofable parameter).
CREATE OR REPLACE FUNCTION public.get_project_stats()
RETURNS TABLE (
  project_name   TEXT,
  archived       BOOLEAN,
  entry_count    BIGINT,
  total_seconds  DOUBLE PRECISION,
  last_activity  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    p.project_name::TEXT,
    COALESCE(p.archived, false)::BOOLEAN,
    COUNT(e.project_name)::BIGINT,
    COALESCE(EXTRACT(EPOCH FROM SUM(e.duration))::DOUBLE PRECISION, 0),
    MAX(e.created_at)
  FROM public.projects p
  LEFT JOIN public.entries e
    ON e.project_name = p.project_name
   AND e.user_email = p.user_email
  WHERE p.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  GROUP BY p.project_name, p.archived;
$$;
