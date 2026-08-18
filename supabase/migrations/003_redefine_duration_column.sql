-- ============================================================
-- Migration 003 — Digital Logbook
-- Drop the meaningless `duration` generated column from `entries`.
--
-- Duration is now computed client-side as:
--   completed entries:  ended_at − created_at
--   in-progress entries: now() − created_at
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Drop the unused generated column
ALTER TABLE entries DROP COLUMN IF EXISTS duration;

-- 2. Recreate the get_project_stats RPC without referencing duration.
--    Uses ended_at − created_at (completed) or now() − created_at (in progress).
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
