-- Migration 008 — Add project_color column to projects table
-- Allows each project to have its own accent colour.
-- Stored as a hex string (e.g. '#ec4899'). NULL = use default hash-based colour.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_color VARCHAR(7);
