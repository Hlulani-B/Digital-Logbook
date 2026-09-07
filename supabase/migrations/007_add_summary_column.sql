-- Migration 007 — Add summary column to entries table
-- Stores a one-sentence AI-generated summary of each entry.
-- Used for calendar views, activity feeds, and quick scanning.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS summary TEXT;
