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
        // Always apply optimistic patch so the UI reflects the user's intent immediately.
        // The server timestamps will be reconciled on sync.
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
      const result = await updateEntry(
        user_email,
        project_name,
        id,
        undefined,
        undefined,
        undefined,
        'in_motion',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'start'
      );
      handleResult(result, 'start', { started_at: new Date().toISOString(), status: 'in_motion' });
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
      const result = await updateEntry(
        user_email,
        project_name,
        id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'pause'
      );
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
      const result = await updateEntry(
        user_email,
        project_name,
        id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'resume'
      );
      handleResult(result, 'resume', { paused_at: null });
    } catch (err) {
      setTimerError(err instanceof Error ? err.message : 'Failed to resume — tap to retry');
      setTimerErrorAction('resuming');
      setTimerAction(null);
    }
  }, [user_email, timerAction, isPaused, project_name, id, handleResult]);

  const stop = useCallback(async () => {
    if (!user_email || timerAction) return;
    setTimerAction('stopping');
    setTimerError(null);
    try {
      const result = await updateEntry(
        user_email,
        project_name,
        id,
        undefined,
        undefined,
        undefined,
        'done_and_dusted',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'end'
      );
      handleResult(result, 'stop', {
        ended_at: new Date().toISOString(),
        status: 'done_and_dusted',
        paused_at: null,
      });
    } catch (err) {
      setTimerError(err instanceof Error ? err.message : 'Failed to stop — tap to retry');
      setTimerErrorAction('stopping');
      setTimerAction(null);
    }
  }, [user_email, timerAction, project_name, id, handleResult]);

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
