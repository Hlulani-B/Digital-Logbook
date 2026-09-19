-- 014_keep_completed_notifications.sql
-- Preserve notifications when entries are marked "Done & Dusted".
-- Previously, the generator deleted notifications for completed entries,
-- but for a logbook it's useful to keep the history of what was overdue.

CREATE OR REPLACE FUNCTION public.generate_due_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted integer;
BEGIN
  -- Only clear notifications for entries that are archived, deleted, or
  -- have no due date. Keep notifications for completed entries so users
  -- can see their history of overdue items.
  DELETE FROM public.notifications n
    USING public.entries e
   WHERE n.entry_id = e.id
     AND (
       e.archived = true
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

  -- Past due and still open (including completed entries — we keep these)
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
