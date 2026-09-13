-- ============================================================
-- Supabase SQL Setup — Digital Logbook
-- Run ALL of this in Supabase SQL Editor (one shot):
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Profile service: users table
--    Used by profile-service for checkUser, getProfile, username/email/name/avatar updates.
--    Frontend inserts only { email } on signup; username/name/avatar filled later.
CREATE TABLE IF NOT EXISTS public.users (
  email                   VARCHAR(255) PRIMARY KEY,
  username                VARCHAR(50)  UNIQUE,
  name                    VARCHAR(100),
  avatar                  TEXT,
  created_at              TIMESTAMPTZ  DEFAULT now(),
  deletion_scheduled_at   TIMESTAMPTZ,
  deleted                 BOOLEAN      NOT NULL DEFAULT false
);

-- 1b. Activity log table
--    Tracks user actions (like a Facebook feed) for the activity log feature.
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           BIGSERIAL PRIMARY KEY,
  user_email   VARCHAR(255) NOT NULL,
  action_type  VARCHAR(50)  NOT NULL,
  entity_type  VARCHAR(50),
  entity_name  VARCHAR(255),
  details      JSONB,
  created_at   TIMESTAMPTZ DEFAULT now(),
  deleted      BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_email
  ON public.activity_log (user_email, created_at DESC);

-- 2. Schedule-account-deletion RPC (Settings panel)
--    Marks the account for deletion in 30 days instead of removing data immediately.
--    The user can still sign in during the grace period and restore the account.
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT u.email INTO v_email
    FROM auth.users u
   WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  -- Soft-delete all related data
  UPDATE public.entries SET deleted = true WHERE user_email = v_email;
  UPDATE public.fields SET deleted = true WHERE user_email = v_email;
  UPDATE public.projects SET deleted = true WHERE user_email = v_email;
  UPDATE public.activity_log SET deleted = true WHERE user_email = v_email;

  -- Mark user as deleted and schedule deletion
  INSERT INTO public.users (email, deletion_scheduled_at, deleted)
  VALUES (v_email, now(), true)
  ON CONFLICT (email)
  DO UPDATE SET deletion_scheduled_at = now(), deleted = true;
END;
$$;

-- 2b. Restore-account RPC
--     Cancels a scheduled deletion before the 30-day grace period ends.
CREATE OR REPLACE FUNCTION restore_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT u.email INTO v_email
    FROM auth.users u
   WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  -- Restore all related data
  UPDATE public.entries SET deleted = false WHERE user_email = v_email;
  UPDATE public.fields SET deleted = false WHERE user_email = v_email;
  UPDATE public.projects SET deleted = false WHERE user_email = v_email;
  UPDATE public.activity_log SET deleted = false WHERE user_email = v_email;

  -- Restore user account
  UPDATE public.users
     SET deletion_scheduled_at = NULL, deleted = false
   WHERE email = v_email;
END;
$$;

-- 2c. Purge deleted accounts RPC
--     Permanently removes accounts (and all app data) whose grace period has expired.
--     Intended to be run by a nightly cron job.
CREATE OR REPLACE FUNCTION purge_deleted_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT email
      FROM public.users
     WHERE deleted = true
       AND deletion_scheduled_at IS NOT NULL
       AND deletion_scheduled_at < now() - INTERVAL '30 days'
  LOOP
    -- Clean up app tables
    DELETE FROM public.activity_log al WHERE al.user_email = rec.email;
    DELETE FROM public.entries      e  WHERE e.user_email  = rec.email;
    DELETE FROM public.fields       f  WHERE f.user_email  = rec.email;
    DELETE FROM public.projects     p  WHERE p.user_email  = rec.email;
    DELETE FROM public.users        WHERE email = rec.email;

    -- Remove the auth account
    DELETE FROM auth.users WHERE email = rec.email;
  END LOOP;
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

-- 4. Nightly cron to purge accounts past the 30-day grace period
--    Requires the pg_cron extension to be enabled in Supabase.
--    Unschedule first to avoid duplicate jobs when re-running this script.
SELECT cron.unschedule('purge-deleted-users') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-users');
SELECT cron.schedule('purge-deleted-users', '0 0 * * *', 'SELECT public.purge_deleted_users();');

-- 4b. Purge unconfirmed email sign-ups RPC
--     Removes auth accounts (and their auto-provisioned public.users row)
--     whose confirmation email was never clicked within 3 days of sign-up.
--     Stops Supabase from re-sending confirmation reminders forever and lets
--     the address re-register cleanly. OAuth users are never affected.
CREATE OR REPLACE FUNCTION purge_unconfirmed_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, email
      FROM auth.users
     WHERE email_confirmed_at IS NULL
       AND created_at < now() - INTERVAL '3 days'
  LOOP
    -- Clean up app tables (normally empty — unconfirmed users
    -- cannot sign in — but belt-and-braces before FK removal)
    DELETE FROM public.activity_log WHERE user_email = rec.email;
    DELETE FROM public.entries      WHERE user_email = rec.email;
    DELETE FROM public.fields       WHERE user_email = rec.email;
    DELETE FROM public.projects     WHERE user_email = rec.email;

    -- Remove the auto-provisioned app profile
    DELETE FROM public.users WHERE email = rec.email;

    -- Remove the auth account (stops confirmation reminders)
    DELETE FROM auth.users WHERE id = rec.id;
  END LOOP;
END;
$$;

SELECT cron.unschedule('purge-unconfirmed-users') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-unconfirmed-users');
SELECT cron.schedule('purge-unconfirmed-users', '0 0 * * *', 'SELECT public.purge_unconfirmed_users();');

-- 5. Project statistics RPC
--    Aggregates duration per project for a given user.
--    Computes duration from timestamps (ended_at − started_at) for completed entries,
--    and now() − started_at for in-progress entries.
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
        WHEN e.ended_at IS NOT NULL AND e.started_at IS NOT NULL
          THEN e.ended_at - e.started_at
        WHEN e.started_at IS NOT NULL
          THEN now() - e.started_at
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

-- 6. Generic field-statistics RPC
--    Statistics follow one format wherever they go: any field its owner has
--    defined can be totalled, grouped by value, compared across projects, and
--    plotted over time. The data type comes from the fields table (or is
--    inferred from the data), so nothing about any field is hard-coded.
--    Output mirrors the frontend engine (computeFieldStats):
--      field_name, data_type, entry_count, filled, total,
--      groups -> [{"value": ..., "count": n}]
--      series -> [{"bucket": "YYYY-MM-DD", "value": n}]
--      by_project -> [{"key": ..., "count": n, "total": n}]
CREATE OR REPLACE FUNCTION get_field_stats(
  p_user_email TEXT,
  p_table_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  field_name  TEXT,
  data_type   TEXT,
  entry_count BIGINT,
  filled      BIGINT,
  total       NUMERIC,
  groups      JSONB,
  series      JSONB,
  by_project  JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH user_entries AS (
    SELECT e.project_name, e.entries, e.created_at
    FROM public.entries e
    WHERE e.user_email = p_user_email
      AND (p_table_name IS NULL OR e.project_name = p_table_name)
      AND (e.archived = false OR e.archived IS NULL)
      AND (e.deleted = false OR e.deleted IS NULL)
  ),
  field_defs AS (
    SELECT DISTINCT ON (f.field_name)
           f.field_name AS fname,
           COALESCE(NULLIF(f.data_type, ''), 'text') AS dtype
    FROM public.fields f
    WHERE f.user_email = p_user_email
      AND (p_table_name IS NULL OR f.table_name = p_table_name)
      AND (f.deleted = false OR f.deleted IS NULL)
    ORDER BY f.field_name, f.created_at DESC
  ),
  flat AS (
    SELECT ue.project_name AS proj,
           ue.created_at    AS created,
           kv.key           AS fname,
           kv.value         AS fvalue
    FROM user_entries ue
    CROSS JOIN LATERAL jsonb_each_text(COALESCE(ue.entries, '{}'::jsonb)) kv
    WHERE kv.key <> 'started_at'
      AND kv.key <> 'description'
      AND COALESCE(kv.value, '') <> ''
  ),
  field_types AS (
    SELECT fl.fname,
           COALESCE(
             d.dtype,
             CASE
               WHEN EVERY(fl.fvalue ~ '^-?[0-9]+(\.[0-9]+)?$')       THEN 'number'
               WHEN EVERY(fl.fvalue IN ('true', 'false'))             THEN 'boolean'
               WHEN EVERY(fl.fvalue ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}') THEN 'date'
               ELSE 'text'
             END
           ) AS dtype
    FROM flat fl
    LEFT JOIN field_defs d ON d.fname = fl.fname
    GROUP BY fl.fname, d.dtype
  ),
  typed AS (
    SELECT fl.proj, fl.created, fl.fname, fl.fvalue, ft.dtype
    FROM flat fl
    JOIN field_types ft ON ft.fname = fl.fname
  ),
  totals AS (
    SELECT t.fname, t.dtype,
           COUNT(*) AS filled,
           SUM(CASE WHEN t.dtype = 'number' AND t.fvalue ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN t.fvalue::numeric END) AS ftotal
    FROM typed t
    GROUP BY t.fname, t.dtype
  ),
  grp_stats AS (
    SELECT g.fname,
           jsonb_agg(jsonb_build_object('value', g.fvalue, 'count', g.cnt)
                     ORDER BY g.cnt DESC, g.fvalue) AS groups
    FROM (
      SELECT t.fname, t.fvalue, COUNT(*) AS cnt
      FROM typed t
      GROUP BY t.fname, t.fvalue
    ) g
    GROUP BY g.fname
  ),
  series_stats AS (
    SELECT s.fname,
           jsonb_agg(jsonb_build_object('bucket', s.bkt, 'value', s.val)
                     ORDER BY s.bkt) AS series
    FROM (
      SELECT t.fname,
             to_char(date_trunc('day', t.created), 'YYYY-MM-DD') AS bkt,
             CASE WHEN t.dtype = 'number'
                  THEN COALESCE(SUM(CASE WHEN t.fvalue ~ '^-?[0-9]+(\.[0-9]+)?$'
                                         THEN t.fvalue::numeric END), 0)
                  ELSE COUNT(*) END AS val
      FROM typed t
      GROUP BY t.fname, t.dtype, date_trunc('day', t.created)
    ) s
    GROUP BY s.fname
  ),
  proj_stats AS (
    SELECT p.fname,
           jsonb_agg(jsonb_build_object('key', p.proj, 'count', p.cnt, 'total', p.ptotal)
                     ORDER BY p.ptotal DESC NULLS LAST, p.cnt DESC) AS by_project
    FROM (
      SELECT t.fname, t.proj,
             COUNT(*) AS cnt,
             SUM(CASE WHEN t.dtype = 'number' AND t.fvalue ~ '^-?[0-9]+(\.[0-9]+)?$'
                      THEN t.fvalue::numeric END) AS ptotal
      FROM typed t
      GROUP BY t.fname, t.proj
    ) p
    GROUP BY p.fname
  )
  SELECT tt.fname::TEXT,
         tt.dtype::TEXT,
         (SELECT COUNT(*) FROM user_entries)::BIGINT,
         tt.filled::BIGINT,
         tt.ftotal,
         COALESCE(gs.groups, '[]'::jsonb),
         COALESCE(ss.series, '[]'::jsonb),
         COALESCE(ps.by_project, '[]'::jsonb)
  FROM totals tt
  LEFT JOIN grp_stats gs    ON gs.fname = tt.fname
  LEFT JOIN series_stats ss ON ss.fname = tt.fname
  LEFT JOIN proj_stats ps   ON ps.fname = tt.fname
  ORDER BY tt.fname;
$$;
