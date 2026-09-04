import { describe, expect, it } from 'vitest';
import {
  STATUS_ORDER,
  buildUpdatedEntry,
  compareDueDates,
  filterEntries,
  getEntryStatus,
  groupEntriesByStatus,
  sortEntriesByDueDate,
} from '@/lib/kanban';
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

describe('getEntryStatus', () => {
  it('returns the entry status when it is valid', () => {
    expect(getEntryStatus(entry({ status: 'in_motion' }))).toBe('in_motion');
  });

  it('defaults to up_next when status is missing', () => {
    expect(getEntryStatus(entry({ status: null }))).toBe('up_next');
  });

  it('defaults to up_next when status is invalid', () => {
    expect(getEntryStatus(entry({ status: 'unknown' }))).toBe('up_next');
  });
});

describe('filterEntries', () => {
  const entries = [
    entry({ id: 1, project_name: 'Alpha', entries: { title: 'Write docs' } }),
    entry({ id: 2, project_name: 'Beta', entries: { task: 'Fix bug' } }),
    entry({ id: 3, project_name: 'Alpha', entries: { title: 'Review PR' } }),
  ];

  it('returns all entries when filters are empty', () => {
    expect(filterEntries(entries, '', '')).toHaveLength(3);
  });

  it('filters by project name', () => {
    const result = filterEntries(entries, 'Alpha', '');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual([1, 3]);
  });

  it('filters by search query in title', () => {
    const result = filterEntries(entries, '', 'review');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('filters by search query in project name', () => {
    const result = filterEntries(entries, '', 'beta');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('applies project and search filters together', () => {
    const result = filterEntries(entries, 'Alpha', 'review');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterEntries(entries, 'Gamma', '')).toHaveLength(0);
  });
});

describe('groupEntriesByStatus', () => {
  const entries = [
    entry({ id: 1, status: 'up_next' }),
    entry({ id: 2, status: 'in_motion' }),
    entry({ id: 3, status: 'done_and_dusted' }),
    entry({ id: 4, status: 'in_motion' }),
    entry({ id: 5, status: null }),
  ];

  it('groups entries into the three status columns', () => {
    const groups = groupEntriesByStatus(entries);
    expect(groups.up_next.map((e) => e.id)).toEqual([1, 5]);
    expect(groups.in_motion.map((e) => e.id)).toEqual([2, 4]);
    expect(groups.done_and_dusted.map((e) => e.id)).toEqual([3]);
  });

  it('returns empty arrays for each group when given no entries', () => {
    const groups = groupEntriesByStatus([]);
    for (const status of STATUS_ORDER) {
      expect(groups[status]).toEqual([]);
    }
  });
});

describe('buildUpdatedEntry', () => {
  const now = '2026-09-04T12:00:00.000Z';

  it('sets started_at when moving to in_motion without a start time', () => {
    const result = buildUpdatedEntry(entry({ started_at: null }), 'in_motion', now);
    expect(result.status).toBe('in_motion');
    expect(result.started_at).toBe(now);
    expect(result.ended_at).toBeNull();
  });

  it('preserves existing started_at when moving to in_motion', () => {
    const started = '2026-09-01T10:00:00.000Z';
    const result = buildUpdatedEntry(entry({ started_at: started }), 'in_motion', now);
    expect(result.started_at).toBe(started);
  });

  it('sets ended_at when moving to done_and_dusted without an end time', () => {
    const result = buildUpdatedEntry(entry({ ended_at: null }), 'done_and_dusted', now);
    expect(result.status).toBe('done_and_dusted');
    expect(result.ended_at).toBe(now);
  });

  it('preserves existing ended_at when moving to done_and_dusted', () => {
    const ended = '2026-09-03T10:00:00.000Z';
    const result = buildUpdatedEntry(entry({ ended_at: ended }), 'done_and_dusted', now);
    expect(result.ended_at).toBe(ended);
  });

  it('does not modify timestamps when moving to up_next', () => {
    const result = buildUpdatedEntry(
      entry({ started_at: '2026-09-01T10:00:00.000Z' }),
      'up_next',
      now
    );
    expect(result.status).toBe('up_next');
    expect(result.started_at).toBe('2026-09-01T10:00:00.000Z');
  });
});

describe('compareDueDates', () => {
  it('sorts earlier dates first', () => {
    expect(compareDueDates('2026-09-01T00:00:00.000Z', '2026-09-04T00:00:00.000Z')).toBeLessThan(0);
  });

  it('sorts later dates second', () => {
    expect(compareDueDates('2026-09-04T00:00:00.000Z', '2026-09-01T00:00:00.000Z')).toBeGreaterThan(
      0
    );
  });

  it('treats missing dates as equal', () => {
    expect(compareDueDates(null, null)).toBe(0);
  });

  it('places missing due dates after present ones', () => {
    expect(compareDueDates(null, '2026-09-01T00:00:00.000Z')).toBeGreaterThan(0);
    expect(compareDueDates('2026-09-01T00:00:00.000Z', null)).toBeLessThan(0);
  });

  it('handles invalid dates gracefully', () => {
    expect(compareDueDates('invalid', 'invalid')).toBe(0);
    expect(compareDueDates('invalid', '2026-09-01T00:00:00.000Z')).toBeGreaterThan(0);
  });
});

describe('sortEntriesByDueDate', () => {
  it('sorts entries by due date ascending', () => {
    const entries = [
      entry({ id: 1, due_date: '2026-09-04T00:00:00.000Z' }),
      entry({ id: 2, due_date: null }),
      entry({ id: 3, due_date: '2026-09-01T00:00:00.000Z' }),
    ];
    const sorted = sortEntriesByDueDate(entries);
    expect(sorted.map((e) => e.id)).toEqual([3, 1, 2]);
  });
});
