-- ============================================================
-- Migration 002 — Digital Logbook
-- Auto-provision public.users rows for every auth user.
--
-- Problem:
--   Email/password users go through Create Profile, which inserts a row
--   into public.users. Google OAuth users skip that page, so they exist in
--   auth.users but not in public.users. Any operation that relies on the
--   foreign key from public.projects (or other app tables) to public.users
--   then fails with:
--     "insert or update on table \"projects\" violates foreign key
--      constraint \"fk_projects_user\""
--
-- Fix:
--   1. Backfill public.users with every email that already exists in
--      auth.users but is missing from public.users.
--   2. Add a trigger on auth.users so any newly created auth account
--      automatically gets a matching public.users row.
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Backfill existing auth users into the app users table.
INSERT INTO public.users (email)
SELECT email
FROM auth.users
WHERE email IS NOT NULL
  AND email NOT IN (SELECT email FROM public.users)
ON CONFLICT (email) DO NOTHING;

-- 2. Trigger function: creates the public.users row when auth.users grows.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (email)
  VALUES (NEW.email)
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Attach the trigger to new auth sign-ups.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();
