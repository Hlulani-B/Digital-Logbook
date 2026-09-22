/**
 * Timer Abandonment Check — client-side safety net.
 *
 * When the app loads, checks if any entries have active timers that
 * have been running/paused beyond the thresholds. If so, returns them
 * so the UI can show an immediate in-app notification.
 *
 * This complements the server-side pg_cron job (migration 021) which
 * catches abandoned timers even if the user never reopens the app.
 *
 * Thresholds (fixed):
 *   - Running: > 2 hours (started_at set, ended_at null, paused_at null)
 *   - Paused:  > 30 minutes (paused_at set, ended_at null)
 */

import type { CalendarEntry } from '@/lib/calendar';

// Extended entry type with timer fields
interface TimerEntry extends CalendarEntry {
  paused_at?: string | null;
  deleted?: boolean;
}

const RUNNING_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const PAUSED_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface AbandonedTimer {
  entry: TimerEntry;
  type: 'timer_running_long' | 'timer_paused_long';
  durationMs: number;
}

/**
 * Check entries for abandoned timers.
 * Returns an array of abandoned timer info objects.
 */
export function checkAbandonedTimers(entries: TimerEntry[]): AbandonedTimer[] {
  const now = Date.now();
  const abandoned: AbandonedTimer[] = [];

  for (const entry of entries) {
    // Skip completed, archived, or deleted entries
    if (entry.ended_at || entry.archived || entry.deleted) continue;

    // Check running timer (started, not paused, not ended)
    if (entry.started_at && !entry.paused_at) {
      const startedAt = new Date(entry.started_at).getTime();
      if (!isNaN(startedAt)) {
        const elapsed = now - startedAt;
        if (elapsed > RUNNING_THRESHOLD_MS) {
          abandoned.push({
            entry,
            type: 'timer_running_long',
            durationMs: elapsed,
          });
        }
      }
    }

    // Check paused timer (paused, not resumed, not ended)
    if (entry.paused_at && !entry.ended_at) {
      const pausedAt = new Date(entry.paused_at).getTime();
      if (!isNaN(pausedAt)) {
        const pausedDuration = now - pausedAt;
        if (pausedDuration > PAUSED_THRESHOLD_MS) {
          abandoned.push({
            entry,
            type: 'timer_paused_long',
            durationMs: pausedDuration,
          });
        }
      }
    }
  }

  return abandoned;
}

/**
 * Format a duration in ms to a human-readable string.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
