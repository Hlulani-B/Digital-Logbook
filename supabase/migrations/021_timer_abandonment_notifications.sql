-- 021_timer_abandonment_notifications.sql
-- Timer abandonment notifications: alert the user when a session timer
-- has been left running for too long or paused indefinitely.
--
-- Triggers (server-side, hourly pg_cron):
--   timer_running_long  — started_at set, ended_at null, paused_at null,
--                         running for > 2 hours
--   timer_paused_long   — paused_at set, ended_at null, paused for > 30 min
--
-- Client-side (on app load):
--   If the previous session had an active timer that was never stopped
--   (detected via last_known_timer in localStorage), fire an immediate
--   in-app notification.
--
-- The notifications table type CHECK is extended to include the two new
-- types. A new preference column users.timer_abandonment_notifications
-- controls whether emails are sent (default true). In-app bell always
-- shows them.

-- ─ 1. Extend the type CHECK constraint ─────────────────────────────────
-- Drop and recreate to add the new types.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('due_soon', 'overdue', 'timer_running_long', 'timer_paused_long'));

-- ── 2. Preference column ────────────────────────────────────────────────
-- Default ON so existing users get the safety net immediately.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS timer_abandonment_notifications BOOLEAN NOT NULL DEFAULT true;

-- ─ 3. Timer abandonment generator ──────────────────────────────────────
-- Runs hourly. Inserts one notification per (user, entry, type). Skips
-- completed, archived, deleted entries. Idempotent via ON CONFLICT.

CREATE OR REPLACE FUNCTION public.generate_timer_abandonment_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted integer := 0;
  v_count integer;
BEGIN
  -- Clear timer notifications for entries that are no longer active
  DELETE FROM public.notifications n
    USING public.entries e
   WHERE n.entry_id = e.id
     AND n.type IN ('timer_running_long', 'timer_paused_long')
     AND (
       e.ended_at IS NOT NULL
       OR e.archived = true
       OR e.deleted = true
     );

  -- Timer running for > 2 hours (started, not paused, not ended)
  WITH running AS (
    SELECT
      e.id,
      e.user_email,
      e.project_name,
      COALESCE(NULLIF(e.summary, ''), e.project_name || ' entry') AS entry_title,
      e.started_at
    FROM public.entries e
    WHERE e.started_at IS NOT NULL
      AND e.ended_at IS NULL
      AND e.paused_at IS NULL
      AND (e.archived IS NULL OR e.archived = false)
      AND (e.deleted IS NULL OR e.deleted = false)
      AND now() - e.started_at > INTERVAL '2 hours'
  )
  INSERT INTO public.notifications (user_email, entry_id, project_name, entry_title, type, due_at)
  SELECT user_email, id, project_name, entry_title, 'timer_running_long', started_at + INTERVAL '2 hours'
    FROM running
  ON CONFLICT (user_email, entry_id, type) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_inserted := v_inserted + v_count;

  -- Timer paused for > 30 minutes (paused, not resumed, not ended)
  WITH paused AS (
    SELECT
      e.id,
      e.user_email,
      e.project_name,
      COALESCE(NULLIF(e.summary, ''), e.project_name || ' entry') AS entry_title,
      e.paused_at
    FROM public.entries e
    WHERE e.paused_at IS NOT NULL
      AND e.ended_at IS NULL
      AND (e.archived IS NULL OR e.archived = false)
      AND (e.deleted IS NULL OR e.deleted = false)
      AND now() - e.paused_at > INTERVAL '30 minutes'
  )
  INSERT INTO public.notifications (user_email, entry_id, project_name, entry_title, type, due_at)
  SELECT user_email, id, project_name, entry_title, 'timer_paused_long', paused_at + INTERVAL '30 minutes'
    FROM paused
  ON CONFLICT (user_email, entry_id, type) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_inserted := v_inserted + v_count;

  -- Prune old read timer notifications (same 30-day window)
  DELETE FROM public.notifications
   WHERE type IN ('timer_running_long', 'timer_paused_long')
     AND read = true
     AND created_at < now() - INTERVAL '30 days';

  RETURN v_inserted;
END;
$$;

-- ── 4. Extended notification cycle ──────────────────────────────────────
-- Replaces run_due_notification_cycle to also run the timer generator.

CREATE OR REPLACE FUNCTION public.run_due_notification_cycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending integer;
BEGIN
  PERFORM public.generate_due_notifications();
  PERFORM public.generate_timer_abandonment_notifications();

  SELECT COUNT(*) INTO v_pending
    FROM public.notifications
   WHERE emailed = false;

  IF v_pending > 0 AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url      := 'https://project-service-96ml.onrender.com/service/notifications/sendPending',
      headers  := '{"Content-Type": "application/json"}'::jsonb,
      body     := '{}'::jsonb,
      timeout_ms := 30000
    );
  END IF;
END;
$$;
