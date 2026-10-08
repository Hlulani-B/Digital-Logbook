import { describe, it, expect } from 'vitest';
import { isOverdue, getOverdueText, isActiveEntry } from '../overdue';

const PAST = () => new Date(Date.now() - 86400000).toISOString();
const FUTURE = () => new Date(Date.now() + 86400000).toISOString();

describe('isOverdue — shared lifecycle rule', () => {
  // Spec scenarios 1–6: the derived overdue state depends on due date,
  // status and archived only — never on which view renders the entry.
  it('1. Up Next + future due → not overdue', () => {
    expect(isOverdue(FUTURE(), 'up_next')).toBe(false);
  });

  it('2. In Motion + future due → not overdue', () => {
    expect(isOverdue(FUTURE(), 'in_motion')).toBe(false);
  });

  it('3. Up Next + past due → overdue', () => {
    expect(isOverdue(PAST(), 'up_next')).toBe(true);
  });

  it('4. In Motion + past due → overdue', () => {
    expect(isOverdue(PAST(), 'in_motion')).toBe(true);
  });

  it('5. Done & Dusted + past due → NOT currently overdue', () => {
    expect(isOverdue(PAST(), 'done_and_dusted')).toBe(false);
  });

  it('6. Archived + past due + Up Next → NOT currently overdue', () => {
    expect(isOverdue(PAST(), 'up_next', true)).toBe(false);
  });

  // 10. Completion removes the current overdue state (status drives it).
  it('completion transitions remove the overdue state', () => {
    expect(isOverdue(PAST(), 'up_next')).toBe(true);
    expect(isOverdue(PAST(), 'done_and_dusted')).toBe(false);
  });

  it('missing status behaves like the up_next default', () => {
    expect(isOverdue(PAST(), null)).toBe(true);
    expect(isOverdue(PAST(), undefined)).toBe(true);
    expect(isOverdue(FUTURE(), null)).toBe(false);
  });

  it('returns false when dueDate is null', () => {
    expect(isOverdue(null, null)).toBe(false);
    expect(isOverdue(null, 'up_next')).toBe(false);
  });

  it('returns false when dueDate is empty string', () => {
    expect(isOverdue('', null)).toBe(false);
  });

  it('returns false for invalid date string', () => {
    expect(isOverdue('not-a-date', 'in_motion')).toBe(false);
  });
});

describe('getOverdueText — shared lifecycle rule', () => {
  it('returns null when not overdue', () => {
    expect(getOverdueText(FUTURE(), 'up_next')).toBeNull();
    expect(getOverdueText(PAST(), 'done_and_dusted')).toBeNull();
    expect(getOverdueText(PAST(), 'up_next', true)).toBeNull();
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

describe('isActiveEntry — shared active-view rule', () => {
  it('a normal active entry appears in active views', () => {
    expect(isActiveEntry({ archived: false, deleted: false })).toBe(true);
  });

  it('an individually archived entry is excluded', () => {
    expect(isActiveEntry({ archived: true, deleted: false })).toBe(false);
  });

  it('a deleted entry is excluded', () => {
    expect(isActiveEntry({ archived: false, deleted: true })).toBe(false);
  });

  it('an entry of an archived project is excluded', () => {
    expect(isActiveEntry({ archived: false, deleted: false }, true)).toBe(false);
  });

  it('a missing/null entry row is excluded', () => {
    expect(isActiveEntry(null)).toBe(false);
  });

  it('missing flags behave like false (active entry)', () => {
    expect(isActiveEntry({})).toBe(true);
    expect(isActiveEntry({}, false)).toBe(true);
  });
});
