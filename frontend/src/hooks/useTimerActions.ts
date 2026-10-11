import { useState, useCallback } from 'react';
import { updateEntry } from '@/functions/project/entries.js';

export type TimerActionState =
  'starting' | 'pausing' | 'resuming' | 'stopping' | 'pending-sync' | null;

export interface TimerEntry {
  id: string;
  user_email: string;
  project_name: string;
  started_at?: string | null;
  ended_at?: string | null;
  paused_at?: string | null;
  paused_ms?: number | string | null;
  status?: string;
  [key: string]: any;
}

interface UseTimerActionsOptions {
  entry: TimerEntry;
  onUpdated: (updatedEntry: TimerEntry) => void;
}

/**
 * Send a timer action through the backend's timer_action protocol.
 *
 * The backend owns the timer clock: its timerPatch handler derives
 * started_at / ended_at / paused_at / paused_ms from the action itself.
 * Requests that also carry explicit timestamps are rejected ("Timer actions
 * cannot supply timestamps or pause totals."), and timestamps sent through
 * the plain columns are silently dropped by date validation — so only the
 * action (plus the in_motion / done_and_dusted status on start/end) travels.
 */
async function sendTimerAction(
  user_email: string,
  project_name: string,
  entry_id: string,
  action: 'start' | 'pause' | 'resume' | 'end',
  status?: string
) {
  return updateEntry(
    user_email,
    project_name,
    entry_id,
    undefined, // new_entry
    undefined, // due_date
    undefined, // priority
    status, // status — in_motion on start, done_and_dusted on end
    undefined, // started_at — server-owned
    undefined, // ended_at — server-owned
    undefined, // duration
    undefined, // summary
    undefined, // target_duration_ms
    undefined, // paused_ms — server-owned
    undefined, // paused_at — server-owned
    action // timer_action
  );
}

/**
 * Shared hook for timer actions (start/pause/resume/stop).
 * Manages in-flight state, failure state, and uses server timestamps as source of truth.
 */
export function useTimerActions({ entry, onUpdated }: UseTimerActionsOptions) {
  const [timerAction, setTimerAction] = useState<TimerActionState>(null);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [timerErrorAction, setTimerErrorAction] = useState<TimerActionState>(null);

  const { id, user_email, project_name, started_at, paused_at, paused_ms } = entry;
  const isPaused = Boolean(started_at && !entry.ended_at && paused_at);

  const handleResult = useCallback(
    (result: any, action: string, optimisticPatch: Partial<TimerEntry>) => {
      // Check if action was queued (offline or network error)
      if (result?.queued) {
        setTimerAction('pending-sync');
        // Apply the optimistic patch so pause/resume/stop take visible effect
        // immediately even while the mutation sits in the offline queue. The
        // queued request re-sends only the timer_action itself, so the server
        // recomputes the timestamps authoritatively on sync and reconciles.
        onUpdated({ ...entry, ...optimisticPatch });
        return;
      }

      // Check for server error
      if (result?.success === false || result?.error) {
        const errorMsg = result?.message || result?.error || `Failed to ${action}`;
        setTimerError(`${errorMsg} — tap to retry`);
        setTimerErrorAction(action as TimerActionState);
        setTimerAction(null);
        return;
      }

      // Success: use server-returned timestamps if available
      const serverEntry = Array.isArray(result?.data) ? result?.data[0] : result?.data;
      if (serverEntry) {
        onUpdated(serverEntry);
      } else {
        // Fallback to optimistic patch if server didn't return data
        onUpdated({ ...entry, ...optimisticPatch });
      }
      setTimerAction(null);
    },
    [entry, onUpdated]
  );

  const start = useCallback(async () => {
    if (!user_email || timerAction || started_at) return;
    setTimerAction('starting');
    setTimerError(null);
    try {
      const result = await sendTimerAction(user_email, project_name, id, 'start', 'in_motion');
      handleResult(result, 'start', {
        started_at: new Date().toISOString(),
        status: 'in_motion',
      });
    } catch (err) {
      setTimerError(err instanceof Error ? err.message : 'Failed to start — tap to retry');
      setTimerErrorAction('starting');
      setTimerAction(null);
    }
  }, [user_email, timerAction, started_at, project_name, id, handleResult]);

  const pause = useCallback(async () => {
    if (!user_email || timerAction || isPaused) return;
    setTimerAction('pausing');
    setTimerError(null);
    try {
      const result = await sendTimerAction(user_email, project_name, id, 'pause');
      handleResult(result, 'pause', { paused_at: new Date().toISOString() });
    } catch (err) {
      setTimerError(err instanceof Error ? err.message : 'Failed to pause — tap to retry');
      setTimerErrorAction('pausing');
      setTimerAction(null);
    }
  }, [user_email, timerAction, isPaused, project_name, id, handleResult]);

  const resume = useCallback(async () => {
    if (!user_email || timerAction || !isPaused) return;
    setTimerAction('resuming');
    setTimerError(null);
    try {
      // Fold the open pause into paused_ms for the optimistic patch so the
      // displayed duration stays correct until the server row lands. The
      // request itself carries no timestamps — the server folds the pause.
      const openPauseMs = paused_at
        ? Math.max(0, Date.now() - new Date(paused_at).getTime())
        : 0;
      const foldedPausedMs = (Number(paused_ms) || 0) + openPauseMs;

      const result = await sendTimerAction(user_email, project_name, id, 'resume');
      handleResult(result, 'resume', { paused_ms: foldedPausedMs, paused_at: null });
    } catch (err) {
      setTimerError(err instanceof Error ? err.message : 'Failed to resume — tap to retry');
      setTimerErrorAction('resuming');
      setTimerAction(null);
    }
  }, [user_email, timerAction, isPaused, paused_at, paused_ms, project_name, id, handleResult]);

  const stop = useCallback(async () => {
    if (!user_email || timerAction) return;
    setTimerAction('stopping');
    setTimerError(null);
    try {
      // If ending while paused, fold the open pause into paused_ms so the
      // optimistic patch nets out all paused time until the server row lands.
      const openPauseMs = paused_at
        ? Math.max(0, Date.now() - new Date(paused_at).getTime())
        : 0;
      const foldedPausedMs = (Number(paused_ms) || 0) + openPauseMs;

      const result = await sendTimerAction(user_email, project_name, id, 'end', 'done_and_dusted');
      handleResult(result, 'stop', {
        ended_at: new Date().toISOString(),
        status: 'done_and_dusted',
        paused_ms: foldedPausedMs,
        paused_at: null,
      });
    } catch (err) {
      setTimerError(err instanceof Error ? err.message : 'Failed to stop — tap to retry');
      setTimerErrorAction('stopping');
      setTimerAction(null);
    }
  }, [user_email, timerAction, paused_at, started_at, paused_ms, project_name, id, handleResult]);

  const clearError = useCallback(() => {
    setTimerError(null);
    setTimerErrorAction(null);
  }, []);

  return {
    timerAction,
    timerError,
    timerErrorAction,
    isActionInFlight: timerAction !== null,
    start,
    pause,
    resume,
    stop,
    clearError,
  };
}
