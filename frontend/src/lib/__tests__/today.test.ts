import { describe, expect, it } from 'vitest';
import {
  getTodayBounds,
  getTodaySections,
  hasNothingToDo,
  isDueToday,
  isEntryOverdue,
  isInProgress,
} from '@/lib/today';
import { type CalendarEntry } from '@/lib/calendar';

function entry(values: Partial<CalendarEntry>): CalendarEntry {
  return {
    id: 1,
    user_email: 'a@b.com',
    project_name: 'Default',
    entries: {},
    due_date: null,
    priority: null,
    ...values,
  } as CalendarEntry;
}

describe('getTodayBounds', () => {
  it('returns local midnight and end-of-day for the given date', () => {
    const now = new Date('2026-09-04T14:30:00.000Z');
    const { start, end } = getTodayBounds(now);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});

describe('isDueToday', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');

  it('returns true for an entry due today', () => {
    expect(isDueToday(entry({ due_date: '2026-09-04T10:00:00.000Z' }), now)).toBe(true);
  });

  it('returns false for an entry due tomorrow', () => {
    expect(isDueToday(entry({ due_date: '2026-09-05T10:00:00.000Z' }), now)).toBe(false);
  });

  it('returns false for an entry due yesterday', () => {
    expect(isDueToday(entry({ due_date: '2026-09-03T10:00:00.000Z' }), now)).toBe(false);
  });

  it('returns false when there is no due date', () => {
    expect(isDueToday(entry({ due_date: null }), now)).toBe(false);
  });

  it('returns false for completed entries', () => {
    expect(
      isDueToday(entry({ due_date: '2026-09-04T10:00:00.000Z', status: 'done_and_dusted' }), now)
    ).toBe(false);
  });
});

describe('isEntryOverdue', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');

  it('returns true for an entry due before today', () => {
    expect(isEntryOverdue(entry({ due_date: '2026-09-03T10:00:00.000Z' }), now)).toBe(true);
  });

  it('returns false for an entry due today', () => {
    expect(isEntryOverdue(entry({ due_date: '2026-09-04T10:00:00.000Z' }), now)).toBe(false);
  });

  it('returns false for an entry due tomorrow', () => {
    expect(isEntryOverdue(entry({ due_date: '2026-09-05T10:00:00.000Z' }), now)).toBe(false);
  });

  it('returns false for completed entries', () => {
    expect(
      isEntryOverdue(
        entry({ due_date: '2026-09-03T10:00:00.000Z', status: 'done_and_dusted' }),
        now
      )
    ).toBe(false);
  });
});

describe('isInProgress', () => {
  it('returns true when status is in_motion', () => {
    expect(isInProgress(entry({ status: 'in_motion' }))).toBe(true);
  });

  it('returns true when started_at is set and ended_at is missing', () => {
    expect(isInProgress(entry({ started_at: '2026-09-04T10:00:00.000Z', ended_at: null }))).toBe(
      true
    );
  });

  it('returns false when ended_at is set', () => {
    expect(
      isInProgress(
        entry({ started_at: '2026-09-04T10:00:00.000Z', ended_at: '2026-09-04T11:00:00.000Z' })
      )
    ).toBe(false);
  });

  it('returns false for completed entries', () => {
    expect(
      isInProgress(
        entry({ started_at: '2026-09-04T10:00:00.000Z', ended_at: null, status: 'done_and_dusted' })
      )
    ).toBe(false);
  });
});

describe('getTodaySections', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');

  it('places overdue, due-today, and in-progress entries in separate sections', () => {
    const entries = [
      entry({ id: 1, due_date: '2026-09-03T10:00:00.000Z', status: 'up_next' }),
      entry({ id: 2, due_date: '2026-09-04T10:00:00.000Z', status: 'up_next' }),
      entry({ id: 3, started_at: '2026-09-04T09:00:00.000Z', ended_at: null }),
    ];
    const sections = getTodaySections(entries, now);
    expect(sections.overdue.map((e) => e.id)).toEqual([1]);
    expect(sections.dueToday.map((e) => e.id)).toEqual([2]);
    expect(sections.inProgress.map((e) => e.id)).toEqual([3]);
  });

  it('skips archived entries', () => {
    const entries = [entry({ id: 1, archived: true, due_date: '2026-09-03T10:00:00.000Z' })];
    const sections = getTodaySections(entries, now);
    expect(hasNothingToDo(sections)).toBe(true);
  });

  it('skips completed entries', () => {
    const entries = [
      entry({ id: 1, due_date: '2026-09-04T10:00:00.000Z', status: 'done_and_dusted' }),
      entry({
        id: 2,
        started_at: '2026-09-04T09:00:00.000Z',
        ended_at: '2026-09-04T10:00:00.000Z',
      }),
    ];
    const sections = getTodaySections(entries, now);
    expect(hasNothingToDo(sections)).toBe(true);
  });

  it('prioritises overdue over in-progress when an entry has a past due date and is in motion', () => {
    const entries = [entry({ id: 1, due_date: '2026-09-03T10:00:00.000Z', status: 'in_motion' })];
    const sections = getTodaySections(entries, now);
    expect(sections.overdue.map((e) => e.id)).toEqual([1]);
    expect(sections.inProgress).toHaveLength(0);
  });

  it('prioritises due-today over in-progress', () => {
    const entries = [entry({ id: 1, due_date: '2026-09-04T10:00:00.000Z', status: 'in_motion' })];
    const sections = getTodaySections(entries, now);
    expect(sections.dueToday.map((e) => e.id)).toEqual([1]);
    expect(sections.inProgress).toHaveLength(0);
  });
});

describe('hasNothingToDo', () => {
  it('returns true when all sections are empty', () => {
    expect(hasNothingToDo({ overdue: [], dueToday: [], inProgress: [] })).toBe(true);
  });

  it('returns false when any section has an entry', () => {
    expect(hasNothingToDo({ overdue: [entry({})], dueToday: [], inProgress: [] })).toBe(false);
    expect(hasNothingToDo({ overdue: [], dueToday: [entry({})], inProgress: [] })).toBe(false);
    expect(hasNothingToDo({ overdue: [], dueToday: [], inProgress: [entry({})] })).toBe(false);
  });
});
