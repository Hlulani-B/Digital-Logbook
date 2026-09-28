import { describe, it, expect } from 'vitest';
import { getDateGroup } from '../ActivityFeed';

// Helper to create an ISO date string relative to today
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  // Set to noon to avoid timezone edge cases
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

describe('getDateGroup', () => {
  it('returns "Today" for the current day', () => {
    expect(getDateGroup(daysAgo(0))).toBe('Today');
  });

  it('returns "Yesterday" for 1 day ago', () => {
    expect(getDateGroup(daysAgo(1))).toBe('Yesterday');
  });

  it('returns "This Week" for 2-6 days ago', () => {
    expect(getDateGroup(daysAgo(2))).toBe('This Week');
    expect(getDateGroup(daysAgo(3))).toBe('This Week');
    expect(getDateGroup(daysAgo(6))).toBe('This Week');
  });

  it('returns "Last Week" for 7-13 days ago', () => {
    expect(getDateGroup(daysAgo(7))).toBe('Last Week');
    expect(getDateGroup(daysAgo(13))).toBe('Last Week');
  });

  it('returns "This Month" for dates in the same month but >13 days ago', () => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    if (dayOfMonth > 14) {
      const d = new Date(now.getFullYear(), now.getMonth(), dayOfMonth - 14, 12);
      expect(getDateGroup(d.toISOString())).toBe('This Month');
    }
  });

  it('returns month name for dates in a different month but same year', () => {
    const now = new Date();
    const targetMonth = now.getMonth() === 0 ? 6 : 0;
    const d = new Date(now.getFullYear(), targetMonth, 15, 12);
    const result = getDateGroup(d.toISOString());
    const expected = d.toLocaleDateString(undefined, { month: 'long' });
    expect(result).toBe(expected);
  });

  it('returns year string for dates in a different year', () => {
    const d = new Date(2023, 5, 15, 12);
    expect(getDateGroup(d.toISOString())).toBe('2023');
  });
});
