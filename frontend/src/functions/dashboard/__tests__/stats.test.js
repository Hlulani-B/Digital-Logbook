import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatInterval,
  calculateTotalTimeTracked,
  calculateProjectStats,
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
      { started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T12:00:00Z', duration: '02:00:00' },
    ];
    const result = calculateTotalTimeTracked(entries);
    expect(result.inProgressCount).toBe(0);
    expect(result.display).toBe('2h 0m');
  });

  it('skips entries without started_at or duration', () => {
    const entries = [
      { started_at: null, ended_at: null, duration: null },
    ];
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
      { project_name: 'Alpha', started_at: new Date(now - 3600000).toISOString(), ended_at: new Date(now).toISOString(), duration: '01:00:00' },
      { project_name: 'Beta', started_at: new Date(now - 1800000).toISOString(), ended_at: new Date(now).toISOString(), duration: '00:30:00' },
      { project_name: 'Alpha', started_at: new Date(now - 7200000).toISOString(), ended_at: new Date(now - 3600000).toISOString(), duration: '01:00:00' },
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
      { project_name: 'Short', started_at: new Date(now - 60000).toISOString(), ended_at: new Date(now).toISOString(), duration: '00:01:00' },
      { project_name: 'Long', started_at: new Date(now - 7200000).toISOString(), ended_at: new Date(now).toISOString(), duration: '02:00:00' },
    ];
    const stats = calculateProjectStats(entries);
    expect(stats[0].project_name).toBe('Long');
    expect(stats[1].project_name).toBe('Short');
  });

  it('uses "Unknown" for entries without project_name', () => {
    const now = Date.now();
    const entries = [
      { project_name: null, started_at: new Date(now - 3600000).toISOString(), ended_at: new Date(now).toISOString(), duration: '01:00:00' },
    ];
    const stats = calculateProjectStats(entries);
    expect(stats[0].project_name).toBe('Unknown');
  });

  it('tracks in-progress count per project', () => {
    const now = Date.now();
    const entries = [
      { project_name: 'Alpha', started_at: new Date(now - 1800000).toISOString(), ended_at: null, duration: null },
      { project_name: 'Alpha', started_at: new Date(now - 3600000).toISOString(), ended_at: new Date(now).toISOString(), duration: '01:00:00' },
    ];
    const stats = calculateProjectStats(entries);
    expect(stats[0].inProgressCount).toBe(1);
    expect(stats[0].entryCount).toBe(2);
  });
});
