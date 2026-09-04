import { describe, it, expect } from 'vitest';
import { calculateStreaks, streakLabel } from '../streaks';

describe('calculateStreaks', () => {
  it('returns zeroes for empty entries', () => {
    const result = calculateStreaks([]);
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalDays: 0,
      lastActiveDay: null,
    });
  });

  it('returns zeroes for entries with no created_at', () => {
    const result = calculateStreaks([{}, {}]);
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalDays: 0,
      lastActiveDay: null,
    });
  });

  it('handles a single entry', () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const result = calculateStreaks([{ created_at: today.toISOString() }]);
    expect(result.totalDays).toBe(1);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.lastActiveDay).toBe(todayStr);
  });

  it('deduplicates entries on the same day', () => {
    const today = new Date();
    const result = calculateStreaks([
      { created_at: today.toISOString() },
      { created_at: new Date(today.getTime() + 3600000).toISOString() },
      { created_at: new Date(today.getTime() + 7200000).toISOString() },
    ]);
    expect(result.totalDays).toBe(1);
  });

  it('calculates consecutive day streak', () => {
    const entries = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      entries.push({ created_at: d.toISOString() });
    }
    const result = calculateStreaks(entries);
    expect(result.totalDays).toBe(5);
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(5);
  });

  it('handles gaps in streak', () => {
    const entries = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      entries.push({ created_at: d.toISOString() });
    }
    for (let i = 6; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      entries.push({ created_at: d.toISOString() });
    }
    const result = calculateStreaks(entries);
    expect(result.totalDays).toBe(5);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('ignores entries with invalid dates', () => {
    const result = calculateStreaks([
      { created_at: 'not-a-date' },
      { created_at: new Date().toISOString() },
    ]);
    expect(result.totalDays).toBe(1);
  });
});

describe('streakLabel', () => {
  it('returns "No active streak" for 0', () => {
    expect(streakLabel(0)).toBe('No active streak');
  });

  it('returns "1 day streak" for 1', () => {
    expect(streakLabel(1)).toBe('1 day streak');
  });

  it('returns "N day streak" for N > 1', () => {
    expect(streakLabel(7)).toBe('7 day streak');
    expect(streakLabel(30)).toBe('30 day streak');
  });
});
