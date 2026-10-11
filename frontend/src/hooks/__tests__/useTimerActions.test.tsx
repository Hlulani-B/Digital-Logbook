/**
 * Timer protocol contract for the shared useTimerActions hook.
 *
 * Every start / pause / resume / stop travels as the backend's timer_action
 * only - the server owns started_at, ended_at, paused_at and paused_ms - and the
 * card must change the instant an action is accepted (optimistic patch) even
 * when the request ends up in the offline queue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTimerActions, type TimerEntry } from '../useTimerActions';

const mocks = vi.hoisted(() => ({ updateEntry: vi.fn() }));

vi.mock('@/functions/project/entries.js', () => ({ updateEntry: mocks.updateEntry }));

// updateEntry(user_email, project_name, entry_id, new_entry, due_date, priority,
//             status, started_at, ended_at, duration, summary, target_duration_ms,
//             paused_ms, paused_at, timer_action)
const STATUS = 6;
const STARTED_AT = 7;
const ENDED_AT = 8;
const PAUSED_MS = 12;
const PAUSED_AT = 13;
const TIMER_ACTION = 14;

function makeEntry(overrides: Partial<TimerEntry> = {}): TimerEntry {
  return {
    id: 'entry-1',
    user_email: 'student@example.com',
    project_name: 'Alpha',
    started_at: '2026-10-05T08:00:00.000Z',
    ended_at: null,
    paused_at: null,
    paused_ms: 0,
    status: 'in_motion',
    ...overrides,
  };
}

function renderTimer(entry: TimerEntry) {
  const updated: TimerEntry[] = [];
  const view = renderHook(() =>
    useTimerActions({ entry, onUpdated: (next) => updated.push(next) })
  );
  return { result: view.result, updated };
}

function lastCall(): any[] {
  const calls = mocks.updateEntry.mock.calls;
  return calls[calls.length - 1];
}

describe('useTimerActions', () => {
  beforeEach(() => {
    mocks.updateEntry.mockReset();
  });

  it('starts an idle entry with a start action and no timestamps', async () => {
    mocks.updateEntry.mockResolvedValue({ success: true, data: undefined });
    const { result, updated } = renderTimer(makeEntry({ started_at: null, status: 'up_next' }));

    await act(async () => {
      await result.current.start();
    });

    expect(lastCall()[TIMER_ACTION]).toBe('start');
    expect(lastCall()[STATUS]).toBe('in_motion');
    expect(lastCall()[STARTED_AT]).toBeUndefined();
    expect(updated[updated.length - 1].started_at).toBeTruthy();
    expect(updated[updated.length - 1].status).toBe('in_motion');
    expect(result.current.timerAction).toBeNull();
  });

  it('pauses a running timer and adopts the server timestamps', async () => {
    const pausedAt = '2026-10-05T09:00:00.000Z';
    mocks.updateEntry.mockResolvedValue({
      success: true,
      data: { ...makeEntry(), paused_at: pausedAt },
    });
    const { result, updated } = renderTimer(makeEntry());

    await act(async () => {
      await result.current.pause();
    });

    expect(lastCall()[TIMER_ACTION]).toBe('pause');
    // The client never sends pause timestamps - the server derives them.
    expect(lastCall()[PAUSED_AT]).toBeUndefined();
    expect(lastCall()[PAUSED_MS]).toBeUndefined();
    expect(updated[updated.length - 1].paused_at).toBe(pausedAt);
    expect(result.current.timerAction).toBeNull();
  });

  it('resumes a paused timer by folding the open pause into paused_ms', async () => {
    mocks.updateEntry.mockResolvedValue({ success: true, data: undefined });
    const pausedAt = new Date(Date.now() - 90_000).toISOString();
    const { result, updated } = renderTimer(makeEntry({ paused_at: pausedAt, paused_ms: 0 }));

    await act(async () => {
      await result.current.resume();
    });

    expect(lastCall()[TIMER_ACTION]).toBe('resume');
    expect(lastCall()[PAUSED_AT]).toBeUndefined();
    const patch = updated[updated.length - 1];
    expect(patch.paused_at).toBeNull();
    expect(patch.paused_ms).toBeGreaterThanOrEqual(90_000);
    expect(patch.paused_ms).toBeLessThan(120_000);
  });

  it('stops a paused timer, clearing the pause and finishing the entry', async () => {
    mocks.updateEntry.mockResolvedValue({ success: true, data: undefined });
    const pausedAt = new Date(Date.now() - 60_000).toISOString();
    const { result, updated } = renderTimer(makeEntry({ paused_at: pausedAt, paused_ms: 5_000 }));

    await act(async () => {
      await result.current.stop();
    });

    expect(lastCall()[TIMER_ACTION]).toBe('end');
    expect(lastCall()[STATUS]).toBe('done_and_dusted');
    expect(lastCall()[ENDED_AT]).toBeUndefined();
    const patch = updated[updated.length - 1];
    expect(patch.ended_at).toBeTruthy();
    expect(patch.paused_at).toBeNull();
    expect(patch.paused_ms).toBeGreaterThanOrEqual(65_000);
  });

  it('ignores start on a running entry and pause on an already paused entry', async () => {
    mocks.updateEntry.mockResolvedValue({ success: true, data: undefined });

    const running = renderTimer(makeEntry());
    await act(async () => {
      await running.result.current.start();
    });
    expect(mocks.updateEntry).not.toHaveBeenCalled();

    const paused = renderTimer(makeEntry({ paused_at: new Date().toISOString() }));
    await act(async () => {
      await paused.result.current.pause();
    });
    expect(mocks.updateEntry).not.toHaveBeenCalled();
  });

  it('keeps a queued offline action visible and marks it pending sync', async () => {
    mocks.updateEntry.mockResolvedValue({ queued: true });
    const { result, updated } = renderTimer(
      makeEntry({ paused_at: new Date(Date.now() - 30_000).toISOString() })
    );

    await act(async () => {
      await result.current.resume();
    });

    expect(result.current.timerAction).toBe('pending-sync');
    expect(result.current.isActionInFlight).toBe(true);
    expect(updated[updated.length - 1].paused_at).toBeNull();
  });

  it('surfaces a failed action so the card can offer a retry', async () => {
    mocks.updateEntry.mockResolvedValue({ success: false, message: 'Timer unavailable' });
    const { result } = renderTimer(makeEntry());

    await act(async () => {
      await result.current.pause();
    });

    expect(result.current.timerErrorAction).toBe('pause');
    expect(result.current.timerError).toContain('Timer unavailable');
    expect(result.current.timerAction).toBeNull();
  });
});
