-- 022_weekly_digest.sql
-- Weekly digest: Friday email summarising pending + overdue tasks for the week ahead.
--
-- 1. users.weekly_digest_enabled — toggle for the digest (default true)
-- 2. users.weekly_digest_day — day of week to receive (default 'friday')
-- 3. generate_weekly_digest() — creates one digest row per opted-in user
-- 4. pg_cron job — runs weekly on the configured day at 8am UTC

-- ── 1. User preferences ──────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_digest_day     TEXT NOT NULL DEFAULT 'friday'
    CHECK (weekly_digest_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday'));

-- ── 2. Extend notifications type CHECK ───────────────────────────────────

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('due_soon', 'overdue', 'timer_running_long', 'timer_paused_long', 'weekly_digest'));

-- ── 3. Weekly digest generator ──────────────────────────────────────────
-- Creates ONE notification row per opted-in user. The sendPending handler
-- detects type = 'weekly_digest' and builds a summary email from the user's
-- actual entries at send time (so the email always reflects current state).

CREATE OR REPLACE FUNCTION public.generate_weekly_digest()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO public.notifications (user_email, entry_id, project_name, entry_title, type, due_at)
  SELECT
    u.email,
    NULL,                          -- no single entry; this is a summary
    NULL,
    'Weekly digest',
    'weekly_digest',
    now() + INTERVAL '7 days'      -- due_at not used for digests
  FROM public.users u
  WHERE u.weekly_digest_enabled = true
    AND u.weekly_digest_day = LOWER(TO_CHAR(now(), 'day'))
  ON CONFLICT (user_email, entry_id, type) DO UPDATE
    SET created_at = now(),        -- refresh timestamp so it re-enters the flush queue
        emailed = false;           -- ensure it gets re-sent
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN v_inserted;
END;
$$;

-- ─ 4. Weekly cron job ───────────────────────────────────────────────────
-- Runs at 8am UTC every day; the function itself filters by day of week.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('weekly-digest')
     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-digest');
    PERFORM cron.schedule(
      'weekly-digest',
      '0 8 * * *',
      'SELECT public.generate_weekly_digest();'
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled; skipping weekly digest schedule';
  END IF;
END $$;
