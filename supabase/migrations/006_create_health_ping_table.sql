-- 006: Create health_ping table for Supabase keep-alive daemon
--
-- Supabase free-tier projects are paused after prolonged inactivity.
-- This table is used by a daemon in the dashboard-service that
-- periodically inserts and deletes a row to keep the database active.

CREATE TABLE IF NOT EXISTS public.health_ping (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message     TEXT        NOT NULL DEFAULT 'hello hlulani',
  pinged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow the service-role key to manage this table (RLS bypassed for daemon)
ALTER TABLE public.health_ping ENABLE ROW LEVEL SECURITY;

-- No user-facing policies needed — only the service-role key (used by backend)
-- can access this table. Authenticated and anon roles get no access.

COMMENT ON TABLE  public.health_ping              IS 'Keep-alive table for the Supabase inactivity daemon';
COMMENT ON COLUMN public.health_ping.message       IS 'Daemon message (always "hello hlulani")';
COMMENT ON COLUMN public.health_ping.pinged_at     IS 'Timestamp of the ping';
