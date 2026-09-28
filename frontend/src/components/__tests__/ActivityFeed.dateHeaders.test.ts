import { describe, it, expect } from 'vitest';
import { getDateGroup } from '../ActivityFeed';

function daysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  // Set to noon to avoid timezone edge cases
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

describe('getDateGroup', () => {
  it('returns "Today" for today', () => {
    expect(getDateGroup(daysAgo(0))).toBe('Today');
  });

  it('returns "Yesterday" for yesterday', () => {
    expect(getDateGroup(daysAgo(1))).toBe('Yesterday');
  });

  it('returns "This Week" for 2-6 days ago', () => {
    expect(getDateGroup(daysAgo(2))).toBe('This Week');
    expect(getDateGroup(daysAgo(3))).toBe('This Week');
    expect(getDateGroup(daysAgo(5))).toBe('This Week');
    expect(getDateGroup(daysAgo(6))).toBe('This Week');
  });

  it('returns "Last Week" for 7-13 days ago', () => {
    expect(getDateGroup(daysAgo(7))).toBe('Last Week');
    expect(getDateGroup(daysAgo(10))).toBe('Last Week');
    expect(getDateGroup(daysAgo(13))).toBe('Last Week');
  });

  it('returns "This Month" for dates in the current calendar month (14+ days ago)', () => {
    // Only test if we're past the 14th of the month
    const today = new Date();
    if (today.getDate() >= 15) {
      expect(getDateGroup(daysAgo(14))).toBe('This Month');
    }
  });

  it('returns "Last Month" for dates in the previous calendar month', () => {
    const today = new Date();
    // Create a date in the previous month
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    lastMonth.setHours(12, 0, 0, 0);
    const result = getDateGroup(lastMonth.toISOString());
    expect(result).toBe('Last Month');
  });

  it('returns month name for earlier dates in the same year', () => {
    const today = new Date();
    // Create a date 3 months ago (different month, same year)
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 15);
    threeMonthsAgo.setHours(12, 0, 0, 0);
    const result = getDateGroup(threeMonthsAgo.toISOString());
    // Should be a month name (not "Last Month" since it's 3 months ago)
    expect(result).not.toBe('Last Month');
    expect(result).not.toBe('This Month');
    expect(result).not.toBe('Today');
    expect(result).not.toBe('Yesterday');
    expect(result).not.toBe('This Week');
    expect(result).not.toBe('Last Week');
  });

  it('returns month and year for dates in a different year', () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    lastYear.setMonth(5); // June
    lastYear.setDate(15);
    lastYear.setHours(12, 0, 0, 0);
    const result = getDateGroup(lastYear.toISOString());
    // Should contain the year
    expect(result).toContain(String(lastYear.getFullYear()));
  });
});
