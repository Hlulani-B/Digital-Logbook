import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatInterval,
  calculateTotalTimeTracked,
  calculateProjectStats,
  entryDurationMs,
  entryRemainingMs,
} from '../stats';

describe('formatDuration', () => {
  it('returns "0m" for 0 milliseconds', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats minutes only', () => {
    expect(formatDuration(45 * 60000)).toBe('45m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(2 * 3600000 + 30 * 60000)).toBe('2h 30m');
  });

  it('formats days, hours, and minutes', () => {
    expect(formatDuration(3 * 86400000 + 4 * 3600000 + 15 * 60000)).toBe('3d 4h 15m');
  });

  it('rounds down partial minutes', () => {
    expect(formatDuration(90000)).toBe('1m');
  });

  it('handles large durations', () => {
    expect(formatDuration(10 * 86400000)).toBe('10d 0h 0m');
  });
});

describe('formatInterval', () => {
  it('formats a Postgres interval with days', () => {
    expect(formatInterval('2 days 06:27:39.557')).toBe('2d 6h 27m');
  });

  it('formats a Postgres interval with 1 day', () => {
    expect(formatInterval('1 day 02:00:00')).toBe('1d 2h 0m');
  });

  it('formats HH:MM:SS without days', () => {
    expect(formatInterval('01:30:00')).toBe('1h 30m');
  });

  it('formats MM:SS', () => {
    expect(formatInterval('45:30')).toBe('45m');
  });

  it('returns "0m" for null/undefined', () => {
    expect(formatInterval(null)).toBe('0m');
    expect(formatInterval(undefined)).toBe('0m');
  });

  it('returns "0m" for unparseable strings', () => {
    expect(formatInterval('not-a-duration')).toBe('0m');
  });
});

describe('calculateTotalTimeTracked', () => {
  it('returns 0 and 0 in-progress for empty entries', () => {
    const result = calculateTotalTimeTracked([]);
    expect(result.display).toBe('0m');
    expect(result.inProgressCount).toBe(0);
  });

  it('counts in-progress entries', () => {
    const now = Date.now();
    const entries = [
      { started_at: new Date(now - 1800000).toISOString(), ended_at: null, duration: null },
    ];
    const result = calculateTotalTimeTracked(entries);
    expect(result.inProgressCount).toBe(1);
  });

  it('handles completed entries with duration column', () => {
    const entries = [
      {
        started_at: '2026-01-01T10:00:00Z',
        ended_at: '2026-01-01T12:00:00Z',
        duration: '02:00:00',
      },
    ];
    const result = calculateTotalTimeTracked(entries);
    expect(result.inProgressCount).toBe(0);
    expect(result.display).toBe('2h 0m');
  });

  it('skips entries without started_at or duration', () => {
    const entries = [{ started_at: null, ended_at: null, duration: null }];
    const result = calculateTotalTimeTracked(entries);
    expect(result.display).toBe('0m');
    expect(result.inProgressCount).toBe(0);
  });
});

describe('calculateProjectStats', () => {
  it('returns empty array for no entries', () => {
    expect(calculateProjectStats([])).toEqual([]);
  });

  it('groups entries by project_name', () => {
    const now = Date.now();
    const entries = [
      {
        project_name: 'Alpha',
        started_at: new Date(now - 3600000).toISOString(),
        ended_at: new Date(now).toISOString(),
        duration: '01:00:00',
      },
      {
        project_name: 'Beta',
        started_at: new Date(now - 1800000).toISOString(),
        ended_at: new Date(now).toISOString(),
        duration: '00:30:00',
      },
      {
        project_name: 'Alpha',
        started_at: new Date(now - 7200000).toISOString(),
        ended_at: new Date(now - 3600000).toISOString(),
        duration: '01:00:00',
      },
    ];
    const stats = calculateProjectStats(entries);
    expect(stats).toHaveLength(2);
    expect(stats[0].project_name).toBe('Alpha');
    expect(stats[0].entryCount).toBe(2);
    expect(stats[1].project_name).toBe('Beta');
    expect(stats[1].entryCount).toBe(1);
  });

  it('sorts by total time descending', () => {
    const now = Date.now();
    const entries = [
      {
        project_name: 'Short',
        started_at: new Date(now - 60000).toISOString(),
        ended_at: new Date(now).toISOString(),
        duration: '00:01:00',
      },
      {
        project_name: 'Long',
        started_at: new Date(now - 7200000).toISOString(),
        ended_at: new Date(now).toISOString(),
        duration: '02:00:00',
      },
    ];
    const stats = calculateProjectStats(entries);
    expect(stats[0].project_name).toBe('Long');
    expect(stats[1].project_name).toBe('Short');
  });

  it('uses "Unknown" for entries without project_name', () => {
    const now = Date.now();
    const entries = [
      {
        project_name: null,
        started_at: new Date(now - 3600000).toISOString(),
        ended_at: new Date(now).toISOString(),
        duration: '01:00:00',
      },
    ];
    const stats = calculateProjectStats(entries);
    expect(stats[0].project_name).toBe('Unknown');
  });

  it('tracks in-progress count per project', () => {
    const now = Date.now();
    const entries = [
      {
        project_name: 'Alpha',
        started_at: new Date(now - 1800000).toISOString(),
        ended_at: null,
        duration: null,
      },
      {
        project_name: 'Alpha',
        started_at: new Date(now - 3600000).toISOString(),
        ended_at: new Date(now).toISOString(),
        duration: '01:00:00',
      },
    ];
    const stats = calculateProjectStats(entries);
    expect(stats[0].inProgressCount).toBe(1);
    expect(stats[0].entryCount).toBe(2);
  });
});

/* ── Countdown + pause infrastructure ─────────────────────────
 * Pause fields are additive-optional: entries without them (all legacy
 * rows) must behave exactly as before. These cases lock that in.
 */
describe('entryDurationMs with pause fields', () => {
  const T0 = '2026-01-01T10:00:00.000Z';

  it('completed entry nets out accumulated paused_ms', () => {
    const entry = {
      started_at: T0,
      ended_at: '2026-01-01T12:00:00.000Z',
      paused_ms: 30 * 60000,
    };
    expect(entryDurationMs(entry)).toBe(2 * 3600000 - 30 * 60000);
  });

  it('completed entry with string paused_ms (node-pg BIGINT) coerces correctly', () => {
    const entry = {
      started_at: T0,
      ended_at: '2026-01-01T12:00:00.000Z',
      paused_ms: '1800000',
    };
    expect(entryDurationMs(entry)).toBe(2 * 3600000 - 30 * 60000);
  });

  it('clamps to 0 when paused_ms exceeds wall time', () => {
    const entry = {
      started_at: T0,
      ended_at: '2026-01-01T10:30:00.000Z',
      paused_ms: 45 * 60000,
    };
    expect(entryDurationMs(entry)).toBe(0);
  });

  it('paused in-progress entry freezes at paused_at and does not accrue', () => {
    const entry = {
      started_at: T0,
      paused_at: '2026-01-01T10:45:00.000Z',
      paused_ms: 15 * 60000,
    };
    const atNoon = new Date('2026-01-01T12:00:00.000Z').getTime();
    expect(entryDurationMs(entry, atNoon)).toBe(45 * 60000 - 15 * 60000);
    // Same value an hour later — paused time must not grow
    expect(entryDurationMs(entry, atNoon + 3600000)).toBe(entryDurationMs(entry, atNoon));
  });

  it('running in-progress entry subtracts paused_ms from live elapsed', () => {
    const startedAt = new Date(T0).getTime();
    const now = startedAt + 60 * 60000;
    const entry = { started_at: T0, paused_ms: 10 * 60000 };
    expect(entryDurationMs(entry, now)).toBe(50 * 60000);
  });

  it('legacy entries without pause fields behave exactly as before', () => {
    const completed = { started_at: T0, ended_at: '2026-01-01T11:00:00.000Z' };
    expect(entryDurationMs(completed)).toBe(3600000);
    const legacyFallback = { created_at: T0, ended_at: '2026-01-01T11:00:00.000Z' };
    expect(entryDurationMs(legacyFallback)).toBe(3600000);
    expect(entryDurationMs({})).toBe(0);
  });
});

describe('entryRemainingMs (deadline countdown)', () => {
  const T0 = '2026-01-01T10:00:00.000Z';

  it('returns null for entries without a target (legacy count-up mode)', () => {
    expect(entryRemainingMs({ started_at: T0 })).toBe(null);
    expect(entryRemainingMs({ started_at: T0, target_duration_ms: null })).toBe(null);
  });

  it('counts down from the target and floors at 0', () => {
    const now = new Date(T0).getTime() + 10 * 60000;
    const onTrack = { started_at: T0, target_duration_ms: 30 * 60000 };
    expect(entryRemainingMs(onTrack, now)).toBe(20 * 60000);
    const expired = { started_at: T0, target_duration_ms: 5 * 60000 };
    expect(entryRemainingMs(expired, now)).toBe(0);
  });

  it('paused entry keeps its remaining time frozen', () => {
    const entry = {
      started_at: T0,
      paused_at: '2026-01-01T10:10:00.000Z',
      target_duration_ms: 60 * 60000,
    };
    const atNoon = new Date('2026-01-01T12:00:00.000Z').getTime();
    const remaining = entryRemainingMs(entry, atNoon);
    expect(remaining).toBe(60 * 60000 - 10 * 60000);
    expect(entryRemainingMs(entry, atNoon + 3600000)).toBe(remaining);
  });
});

describe('stats aggregation with paused entries', () => {
  it('calculateTotalTimeTracked nets out paused time', () => {
    const entries = [
      {
        started_at: '2026-01-01T10:00:00.000Z',
        ended_at: '2026-01-01T11:00:00.000Z',
        paused_ms: 15 * 60000,
      },
    ];
    const result = calculateTotalTimeTracked(entries);
    expect(result.display).toBe('45m');
    expect(result.inProgressCount).toBe(0);
  });

  it('paused entries still count as in-progress but stop accruing', () => {
    const now = new Date('2026-01-01T12:00:00.000Z').getTime();
    const entries = [
      {
        started_at: '2026-01-01T10:00:00.000Z',
        paused_at: '2026-01-01T10:30:00.000Z',
        paused_ms: 5 * 60000,
      },
    ];
    const result = calculateTotalTimeTracked(entries, now);
    expect(result.inProgressCount).toBe(1);
    expect(result.display).toBe('25m'); // frozen at 30m − 5m paused
  });
});
