-- 012_add_timer_pause_fields.sql
-- Adds deadline-countdown + pause support to the entries timer.
--
-- Legacy rows: target_duration_ms = NULL (count-up mode, unchanged behaviour),
-- paused_ms = 0, paused_at = NULL. All new columns are additive and nullable
-- (or defaulted) so existing entries and existing queries are unaffected.
--
-- Net worked time for an entry is computed application-side as:
--   anchor - started_at - paused_ms
-- where anchor is ended_at (completed), paused_at (currently paused), or now
-- (running). The generated `duration` column stays as the raw wall-time
-- interval and is intentionally NOT recreated.

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS target_duration_ms BIGINT,
  ADD COLUMN IF NOT EXISTS paused_ms BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- Keep the per-project stats RPC consistent with the frontend net-time
-- calculation: subtract accumulated paused milliseconds. For all legacy rows
-- paused_ms = 0, so results are byte-identical to the previous definition.
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
        WHEN e.ended_at IS NOT NULL AND e.started_at IS NOT NULL
          THEN (e.ended_at - e.started_at) - (e.paused_ms * INTERVAL '1 millisecond')
        WHEN e.started_at IS NOT NULL AND e.paused_at IS NOT NULL
          THEN (e.paused_at - e.started_at) - (e.paused_ms * INTERVAL '1 millisecond')
        WHEN e.started_at IS NOT NULL
          THEN (now() - e.started_at) - (e.paused_ms * INTERVAL '1 millisecond')
        ELSE INTERVAL '0'
      END
    ), INTERVAL '0')::INTERVAL AS total_duration,
    COUNT(*) FILTER (WHERE e.started_at IS NOT NULL
                       AND e.ended_at IS NULL)::BIGINT AS in_progress
  FROM entries e
  WHERE e.user_email = p_user_email
    AND e.archived = false
    AND e.deleted = false
  GROUP BY e.project_name
  ORDER BY total_duration DESC;
END;
$$;
