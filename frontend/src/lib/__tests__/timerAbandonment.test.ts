import { describe, it, expect } from 'vitest';
import { checkAbandonedTimers, formatDuration } from '../timerAbandonment';

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    project_name: 'Test',
    title: 'Task',
    started_at: null as string | null,
    ended_at: null as string | null,
    paused_at: null as string | null,
    archived: false,
    deleted: false,
    ...overrides,
  };
}

describe('checkAbandonedTimers', () => {
  it('returns empty for entries with no timers', () => {
    expect(checkAbandonedTimers([makeEntry()])).toEqual([]);
  });

  it('ignores completed entries (ended_at set)', () => {
    const entry = makeEntry({
      started_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      ended_at: new Date().toISOString(),
    });
    expect(checkAbandonedTimers([entry])).toEqual([]);
  });

  it('ignores archived entries', () => {
    const entry = makeEntry({
      started_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      archived: true,
    });
    expect(checkAbandonedTimers([entry])).toEqual([]);
  });

  it('ignores deleted entries', () => {
    const entry = makeEntry({
      started_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      deleted: true,
    });
    expect(checkAbandonedTimers([entry])).toEqual([]);
  });

  it('detects a running timer beyond 2 hours', () => {
    const entry = makeEntry({
      started_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    });
    const result = checkAbandonedTimers([entry]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('timer_running_long');
    expect(result[0].entry).toBe(entry);
    expect(result[0].durationMs).toBeGreaterThan(2 * 60 * 60 * 1000);
  });

  it('does not flag a running timer under 2 hours', () => {
    const entry = makeEntry({
      started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    expect(checkAbandonedTimers([entry])).toEqual([]);
  });

  it('detects a paused timer beyond 30 minutes', () => {
    const entry = makeEntry({
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      paused_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    });
    const result = checkAbandonedTimers([entry]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('timer_paused_long');
  });

  it('does not flag a paused timer under 30 minutes', () => {
    const entry = makeEntry({
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      paused_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });
    expect(checkAbandonedTimers([entry])).toEqual([]);
  });

  it('does not flag a paused timer that was resumed (ended_at set)', () => {
    const entry = makeEntry({
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      paused_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      ended_at: new Date().toISOString(),
    });
    expect(checkAbandonedTimers([entry])).toEqual([]);
  });

  it('handles multiple entries with mixed states', () => {
    const entries = [
      makeEntry({ id: 'a', started_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }),
      makeEntry({ id: 'b' }),
      makeEntry({ id: 'c', started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() }),
    ];
    const result = checkAbandonedTimers(entries);
    expect(result).toHaveLength(1);
    expect(result[0].entry.id).toBe('a');
  });

  it('ignores entries with invalid started_at dates', () => {
    const entry = makeEntry({ started_at: 'not-a-date' });
    expect(checkAbandonedTimers([entry])).toEqual([]);
  });
});

describe('formatDuration', () => {
  it('formats minutes only when under 1 hour', () => {
    expect(formatDuration(5 * 60 * 1000)).toBe('5m');
    expect(formatDuration(29 * 60 * 1000)).toBe('29m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe('2h 15m');
  });

  it('formats exactly 1 hour', () => {
    expect(formatDuration(60 * 60 * 1000)).toBe('1h 0m');
  });

  it('rounds down partial minutes', () => {
    expect(formatDuration(90 * 1000)).toBe('1m');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0m');
  });
});
