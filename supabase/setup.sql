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
