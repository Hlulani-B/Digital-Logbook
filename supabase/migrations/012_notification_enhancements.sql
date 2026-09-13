-- Notification enhancements: snooze, dismiss, configurable lead time,
-- and better filtering support.
--
-- 1. snoozed_until — when set, the notification is hidden from the bell
--    feed and treated as read until the snooze expires; then it re-appears
--    as unread.
-- 2. dismissed — soft-delete for notifications the user wants gone without
--    completing the underlying entry. Dismissed rows are excluded from all
--    feeds but stay in the table for the 30-day prune window.
-- 3. notification_lead_time — per-user preference controlling when the
--    due_soon notification fires (1h, 24h, 48h, 1 week). The generator in
--    migration 011 is replaced with a version that reads this column.

-- ── 1. New columns on notifications ──────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed     BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient filtering of visible (non-dismissed, non-snoozed) rows
CREATE INDEX IF NOT EXISTS idx_notifications_visible
  ON public.notifications (user_email, created_at DESC)
  WHERE dismissed = false;

-- ── 2. Per-user notification lead time ───────────────────────────────────
-- Default 24 hours to match the previous hardcoded behaviour.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_lead_time INTERVAL NOT NULL DEFAULT '24 hours';

-- ── 3. Updated generator — honours per-user lead time ───────────────────

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

  -- Unsnooze expired snoozes: re-mark as unread so they surface again
  UPDATE public.notifications
     SET snoozed_until = NULL, read = false
   WHERE snoozed_until IS NOT NULL
     AND snoozed_until <= now()
     AND dismissed = false;

  -- Due within the user's lead-time window (per-user)
  WITH due AS (
    SELECT
      e.id,
      e.user_email,
      e.project_name,
      e.due_date,
      COALESCE(NULLIF(e.summary, ''), e.project_name || ' entry') AS entry_title
    FROM public.entries e
    JOIN public.users u ON u.email = e.user_email
    WHERE e.due_date IS NOT NULL
      AND e.due_date > now()
      AND e.due_date <= now() + COALESCE(u.notification_lead_time, INTERVAL '24 hours')
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

  -- Prune old read or dismissed notifications
  DELETE FROM public.notifications
   WHERE (read = true OR dismissed = true)
     AND created_at < now() - INTERVAL '30 days';

  RETURN v_inserted;
END;
$$;
