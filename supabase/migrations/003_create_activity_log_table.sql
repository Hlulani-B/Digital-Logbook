-- ============================================================
-- Migration 003 — Digital Logbook
-- Activity log table: tracks user actions (like a Facebook feed)
--
-- Records events such as project created, entry added/updated,
-- archive toggled, field added, priority set, etc.
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id           BIGSERIAL PRIMARY KEY,
  user_email   VARCHAR(255) NOT NULL,
  action_type  VARCHAR(50)  NOT NULL,   -- e.g. PROJECT_CREATED, ENTRY_ADDED
  entity_type  VARCHAR(50),             -- e.g. project, entry, field
  entity_name  VARCHAR(255),            -- human-readable identifier (project name, field name, ...)
  details      JSONB,                   -- extra context (old/new names, priority level, etc.)
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by user, newest first
CREATE INDEX IF NOT EXISTS idx_activity_log_user_email
  ON public.activity_log (user_email, created_at DESC);

-- Foreign key to the users table (cascade on delete so profile cleanup is clean)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_activity_log_user'
      AND table_name = 'activity_log'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.activity_log
      ADD CONSTRAINT fk_activity_log_user
      FOREIGN KEY (user_email)
      REFERENCES public.users (email)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Update the delete_user RPC so account deletion also wipes activity logs
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

  -- Clean up activity log
  DELETE FROM public.activity_log WHERE user_email = user_email;

  -- Clean up entries table
  DELETE FROM public.entries WHERE user_email = user_email;

  -- Clean up fields table
  DELETE FROM public.fields WHERE user_email = user_email;

  -- Clean up projects table
  DELETE FROM public.projects WHERE user_email = user_email;

  -- Clean up profile-service table
  DELETE FROM public.users WHERE email = user_email;

  -- Finally remove the auth account itself
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
