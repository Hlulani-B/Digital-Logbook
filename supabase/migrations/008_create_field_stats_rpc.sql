-- ============================================================
-- Migration 008 — Digital Logbook
-- Generic field-statistics RPC (get_field_stats)
--
-- Statistics follow one format wherever they go: any field its
-- owner has defined can be totalled, grouped by value, compared
-- across projects, and plotted over time. This function learns
-- each field's data type from the fields table (or infers it
-- from the data itself when no definition exists), so the
-- logbook never hard-codes knowledge of a particular field.
--
-- Output mirrors the frontend engine (computeFieldStats in
-- frontend/src/functions/dashboard/stats.js):
--   field_name, data_type, entry_count, filled, total,
--   groups     -> [{"value": "...", "count": n}, ...]
--   series     -> [{"bucket": "YYYY-MM-DD", "value": n}, ...]
--   by_project -> [{"key": "...", "count": n, "total": n}, ...]
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

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
    -- One declared type per field name (fields are scoped per project,
    -- but the same field name may appear in several projects).
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
    -- Flatten every entry's JSONB payload into one row per (entry, field).
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
    -- Declared type wins; otherwise infer from the values themselves.
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
    -- Group by value: count entries per distinct value.
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
    -- Plot over time: daily buckets, summed for numeric fields and
    -- counted for everything else.
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
    -- Compare across projects: count and (for numeric fields) sum per project.
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
