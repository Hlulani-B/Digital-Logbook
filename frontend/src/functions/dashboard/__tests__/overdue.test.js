import { describe, it, expect } from 'vitest';
import { isActiveEntry, isOverdue, getOverdueText } from '../overdue';

describe('isOverdue', () => {
  it('returns false when dueDate is null', () => {
    expect(isOverdue(null, null)).toBe(false);
  });

  it('returns false when dueDate is empty string', () => {
    expect(isOverdue('', null)).toBe(false);
  });

  it('returns false when status is done_and_dusted', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(isOverdue(pastDate, 'done_and_dusted')).toBe(false);
  });

  it('returns false for a future date', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    expect(isOverdue(futureDate, 'in_progress')).toBe(false);
  });

  it('returns true for active Up Next and In Motion entries past due', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(isOverdue(pastDate, 'up_next')).toBe(true);
    expect(isOverdue(pastDate, 'in_motion')).toBe(true);
  });

  it('returns true for a past date with null status', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(isOverdue(pastDate, null)).toBe(true);
  });

  it('returns false for archived active entries', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(isOverdue(pastDate, 'up_next', true)).toBe(false);
  });

  it('returns false for invalid date string', () => {
    expect(isOverdue('not-a-date', 'in_motion')).toBe(false);
  });
});

describe('getOverdueText', () => {
  it('returns null when not overdue', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    expect(getOverdueText(futureDate, 'in_motion')).toBeNull();
  });

  it('returns null when dueDate is null', () => {
    expect(getOverdueText(null, null)).toBeNull();
  });

  it('returns "Overdue today" for a date earlier today', () => {
    const earlierToday = new Date(Date.now() - 3600000).toISOString();
    expect(getOverdueText(earlierToday, 'in_motion')).toBe('Overdue today');
  });

  it('returns "Overdue by 1 day" for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000 * 1.5).toISOString();
    expect(getOverdueText(yesterday, 'in_motion')).toBe('Overdue by 1 day');
  });

  it('returns "Overdue by N days" for older dates', () => {
    const fiveDaysAgo = new Date(Date.now() - 86400000 * 5.5).toISOString();
    expect(getOverdueText(fiveDaysAgo, 'in_motion')).toBe('Overdue by 5 days');
  });
});

describe('isActiveEntry', () => {
  it('keeps a plain active entry visible', () => {
    expect(isActiveEntry({ archived: false, deleted: false })).toBe(true);
    expect(isActiveEntry({})).toBe(true);
  });

  it('excludes individually archived entries', () => {
    expect(isActiveEntry({ archived: true, deleted: false })).toBe(false);
  });

  it('excludes soft-deleted entries', () => {
    expect(isActiveEntry({ archived: false, deleted: true })).toBe(false);
  });

  it('excludes entries of an archived parent project', () => {
    expect(isActiveEntry({ archived: false, deleted: false }, true)).toBe(false);
  });

  it('excludes flagged entries of an archived project too', () => {
    expect(isActiveEntry({ archived: true, deleted: false }, true)).toBe(false);
    expect(isActiveEntry({ archived: false, deleted: true }, true)).toBe(false);
  });

  it('treats missing or null rows as inactive', () => {
    expect(isActiveEntry(null)).toBe(false);
    expect(isActiveEntry(undefined)).toBe(false);
  });
});
