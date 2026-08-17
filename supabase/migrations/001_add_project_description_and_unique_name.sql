-- ============================================================
-- Migration 001 — Digital Logbook
-- Adds an optional description column to projects and enforces
-- unique project names per user.
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- Ensure the projects table exists for fresh environments.
-- If the table already exists, this statement does nothing.
CREATE TABLE IF NOT EXISTS public.projects (
  id            BIGSERIAL PRIMARY KEY,
  user_email    VARCHAR(255) NOT NULL,
  project_name  VARCHAR(255) NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  archived      BOOLEAN DEFAULT false
);

-- Add the optional description column if it is missing.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Enforce unique project names scoped to each user.
-- This prevents duplicate project names and surfaces a clear,
-- specific error (PostgreSQL code 23505) instead of a generic 500.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_user_email_project_name_unique'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_user_email_project_name_unique
      UNIQUE (user_email, project_name);
  END IF;
END $$;
