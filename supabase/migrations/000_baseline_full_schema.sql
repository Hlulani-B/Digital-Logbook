-- ============================================================
-- Migration 000 — Baseline full schema
-- Digital Logbook
--
-- Captures the ENTIRE current schema in one idempotent file.
-- Safe to run against:
--   • a fresh Supabase project   → creates everything
--   • an existing database       → IF NOT EXISTS / IF NOT EXISTS
--                                  guards make this a no-op
--
-- Run with: npm run db:migrate   (from repo root)
-- ============================================================

-- ─── 0. ENUM types ──────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_level') THEN
    CREATE TYPE priority_level AS ENUM (
      'Urgent and important',
      'Urgent but not important',
      'Not urgent, not important'
    );
  END IF;
END $$;

-- ─── 1. users (profile-service) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  email                   VARCHAR(255) PRIMARY KEY,
  username                VARCHAR(50)  UNIQUE,
  name                    VARCHAR(100),
  avatar                  TEXT,
  created_at              TIMESTAMPTZ  DEFAULT now(),
  deletion_scheduled_at   TIMESTAMPTZ,
  deleted                 BOOLEAN      NOT NULL DEFAULT false
);

-- ─── 2. projects (project-service) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id            BIGSERIAL PRIMARY KEY,
  user_email    VARCHAR(255) NOT NULL,
  project_name  VARCHAR(255) NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  archived      BOOLEAN DEFAULT false,
  deleted       BOOLEAN NOT NULL DEFAULT false
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_user_email_project_name_unique'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_user_email_project_name_unique
      UNIQUE (user_email, project_name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_archived
  ON public.projects (archived);

-- ─── 3. entries (project-service) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    VARCHAR(255) NOT NULL,
  project_name  VARCHAR(255) NOT NULL,
  entries       JSONB NOT NULL,
  due_date      TIMESTAMPTZ,
  priority      priority_level,
  status        VARCHAR(30) DEFAULT 'up_next',
  archived      BOOLEAN DEFAULT false,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  duration      INTERVAL GENERATED ALWAYS AS (ended_at - started_at) STORED,
  deleted       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  summary       TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_user_email
  ON public.entries (user_email);
CREATE INDEX IF NOT EXISTS idx_entries_project_name
  ON public.entries (project_name);
CREATE INDEX IF NOT EXISTS idx_entries_due_date
  ON public.entries (due_date);
CREATE INDEX IF NOT EXISTS idx_entries_archived
  ON public.entries (archived);

-- ─── 4. fields (project-service) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    VARCHAR(255) NOT NULL,
  table_name    VARCHAR(100) NOT NULL,
  field_name    VARCHAR(100) NOT NULL,
  data_type     VARCHAR(50),
  is_required   BOOLEAN DEFAULT false,
  deleted       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 5. activity_log ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_log (
  id           BIGSERIAL PRIMARY KEY,
  user_email   VARCHAR(255) NOT NULL,
  action_type  VARCHAR(50)  NOT NULL,
  entity_type  VARCHAR(50),
  entity_name  VARCHAR(255),
  details      JSONB,
  created_at   TIMESTAMPTZ DEFAULT now(),
  deleted      BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_email
  ON public.activity_log (user_email, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
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

-- ─── 6. health_ping (keep-alive daemon) ─────────────────────

CREATE TABLE IF NOT EXISTS public.health_ping (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message   TEXT NOT NULL DEFAULT 'hello hlulani',
  pinged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_ping ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.health_ping IS 'Keep-alive table for the Supabase inactivity daemon';

-- ─── 7. ai_provider_cooldowns ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_provider_cooldowns (
  provider       VARCHAR(100) PRIMARY KEY,
  cooldown_until TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted        BOOLEAN NOT NULL DEFAULT false
);

-- ─── 8. RPC Functions ───────────────────────────────────────

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

  UPDATE public.entries SET deleted = true WHERE user_email = v_email;
  UPDATE public.fields SET deleted = true WHERE user_email = v_email;
  UPDATE public.projects SET deleted = true WHERE user_email = v_email;
  UPDATE public.activity_log SET deleted = true WHERE user_email = v_email;

  INSERT INTO public.users (email, deletion_scheduled_at, deleted)
  VALUES (v_email, now(), true)
  ON CONFLICT (email)
  DO UPDATE SET deletion_scheduled_at = now(), deleted = true;
END;
$$;

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

  UPDATE public.entries SET deleted = false WHERE user_email = v_email;
  UPDATE public.fields SET deleted = false WHERE user_email = v_email;
  UPDATE public.projects SET deleted = false WHERE user_email = v_email;
  UPDATE public.activity_log SET deleted = false WHERE user_email = v_email;

  UPDATE public.users
     SET deletion_scheduled_at = NULL, deleted = false
   WHERE email = v_email;
END;
$$;

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
    DELETE FROM public.activity_log WHERE user_email = rec.email;
    DELETE FROM public.entries      WHERE user_email = rec.email;
    DELETE FROM public.fields       WHERE user_email = rec.email;
    DELETE FROM public.projects     WHERE user_email = rec.email;
    DELETE FROM public.users        WHERE email = rec.email;
    DELETE FROM auth.users          WHERE email = rec.email;
  END LOOP;
END;
$$;

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

-- ─── 9. Auth trigger ────────────────────────────────────────

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── 10. Backfill auth users ────────────────────────────────

INSERT INTO public.users (email)
SELECT DISTINCT email
FROM auth.users
WHERE email IS NOT NULL
  AND email NOT IN (SELECT email FROM public.users)
ON CONFLICT (email) DO NOTHING;

-- ─── 11. pg_cron (nightly purge) ────────────────────────────
-- Requires pg_cron extension to be enabled in Supabase.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-deleted-users')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-users');
    PERFORM cron.schedule('purge-deleted-users', '0 0 * * *', 'SELECT public.purge_deleted_users();');
  END IF;
END $$;
