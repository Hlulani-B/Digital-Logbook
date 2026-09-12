-- 011_add_countdown_timer.sql
-- Adds countdown timer support: target duration, pause state, and paused remaining time.
-- Backward compatible: NULL values preserve the legacy count-up behavior.

-- Target countdown duration in milliseconds (NULL = legacy count-up mode)
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS target_duration_ms BIGINT;

-- Remaining milliseconds when paused (NULL = not paused or not countdown)
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS paused_remaining_ms BIGINT;

-- Pause state flag
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;
