-- Notification system: in-app feed + due-date email triggers.
--
-- 1. notifications table — one row per (user, entry, type). The
--    UNIQUE(user_email, entry_id, type) constraint is the dedupe mechanism:
--    a due_soon notification is created once when the entry enters the 24h
--    window, an overdue notification once when the deadline passes.
-- 2. users.email_notifications — server-visible copy of the SettingsPanel
--    "Email notifications" toggle so the sender can honour the preference.
-- 3. generate_due_notifications() — called hourly by pg_cron; pure SQL, no
--    side effects beyond table rows (idempotent, safe to re-run).
-- 4. run_due_notification_cycle() — wraps the generator plus a pg_net HTTP
--    poke to project-service, which sends the actual emails via Brevo.
--    If the service is asleep (Render free tier) the POST fails silently;
--    pending rows keep emailed=false and the next hourly run retries.

CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email   TEXT NOT NULL,
  entry_id     UUID,
  project_name TEXT,
  entry_title  TEXT,
  type         TEXT NOT NULL CHECK (type IN ('due_soon', 'overdue')),
  due_at       TIMESTAMPTZ,
  read         BOOLEAN NOT NULL DEFAULT false,
  emailed      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_email, entry_id, type)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_email, read)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_pending_email
  ON public.notifications (emailed)
  WHERE emailed = false;

-- Preference column: mirrors the SettingsPanel "Email notifications" toggle.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true;

-- Creates notification rows for entries that are due within 24 hours
-- (due_soon) or already past due (overdue). Skips completed, archived,
-- deleted and cancelled entries. Also clears notifications whose entry
-- no longer needs attention, and prunes read notifications older than 30 days.
CREATE OR REPLACE FUNCTION public.generate_due_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted integer;
BEGIN
  -- Clear notifications for entries that no longer need attention
  DELETE FROM public.notifications n
    USING public.entries e
   WHERE n.entry_id = e.id
     AND (
       e.status = 'done_and_dusted'
       OR e.archived = true
       OR e.deleted = true
       OR e.due_date IS NULL
     );

  -- Due within the next 24 hours
  WITH due AS (
    SELECT
      e.id,
      e.user_email,
      e.project_name,
      e.due_date,
      COALESCE(NULLIF(e.summary, ''), e.project_name || ' entry') AS entry_title
    FROM public.entries e
    WHERE e.due_date IS NOT NULL
      AND e.due_date > now()
      AND e.due_date <= now() + INTERVAL '24 hours'
      AND (e.status IS NULL OR e.status <> 'done_and_dusted')
      AND (e.archived IS NULL OR e.archived = false)
      AND (e.deleted IS NULL OR e.deleted = false)
  )
  INSERT INTO public.notifications (user_email, entry_id, project_name, entry_title, type, due_at)
  SELECT user_email, id, project_name, entry_title, 'due_soon', due_date
    FROM due
  ON CONFLICT (user_email, entry_id, type) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Past due and still open
  WITH ove AS (
    SELECT
      e.id,
      e.user_email,
      e.project_name,
      e.due_date,
      COALESCE(NULLIF(e.summary, ''), e.project_name || ' entry') AS entry_title
    FROM public.entries e
    WHERE e.due_date IS NOT NULL
      AND e.due_date < now()
      AND (e.status IS NULL OR e.status <> 'done_and_dusted')
      AND (e.archived IS NULL OR e.archived = false)
      AND (e.deleted IS NULL OR e.deleted = false)
  )
  INSERT INTO public.notifications (user_email, entry_id, project_name, entry_title, type, due_at)
  SELECT user_email, id, project_name, entry_title, 'overdue', due_date
    FROM ove
  ON CONFLICT (user_email, entry_id, type) DO NOTHING;

  -- Prune old read notifications
  DELETE FROM public.notifications
   WHERE read = true
     AND created_at < now() - INTERVAL '30 days';

  RETURN v_inserted;
END;
$$;

-- Best-effort activation of pg_net (needed for the HTTP poke). Wrapped so a
-- restricted environment degrades to app-traffic-triggered sending instead
-- of failing the whole migration.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net extension unavailable (%); email sending relies on app traffic to flush pending notifications', SQLERRM;
END $$;

-- Hourly cycle: regenerate due/overdue rows, then poke project-service to
-- send any pending emails. Skips the HTTP call when nothing is pending and
-- when pg_net is not installed.
CREATE OR REPLACE FUNCTION public.run_due_notification_cycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending integer;
BEGIN
  PERFORM public.generate_due_notifications();

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

SELECT cron.unschedule('due-notification-cycle')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'due-notification-cycle');

SELECT cron.schedule(
  'due-notification-cycle',
  '7 * * * *',
  'SELECT public.run_due_notification_cycle();'
);
