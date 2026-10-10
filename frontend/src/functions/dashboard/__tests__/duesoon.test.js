import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isDueSoon, isOverdue, DUE_SOON_WINDOW_DAYS } from '../overdue';
import { computeDueSoon } from '../../../CacheFunctions/syncService';
import { getEffectiveArchivedProjectNames } from '../../project/archiveState';

// Controlled clock — none of these tests may depend on the real current date.
const NOW = new Date('2026-03-15T10:00:00Z');
const hoursFromNow = (h) => new Date(NOW.getTime() + h * 3600000).toISOString();
const daysFromNow = (d) => new Date(NOW.getTime() + d * 86400000).toISOString();

describe('isDueSoon — shared due-soon eligibility rule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Spec §7 transitions
  it('A/B. active entry (Up Next / In Motion) inside the window → due soon', () => {
    expect(isDueSoon(daysFromNow(1), 'up_next')).toBe(true);
    expect(isDueSoon(daysFromNow(2), 'in_motion')).toBe(true);
  });

  it('A/C. entry completed to Done & Dusted → never due soon (QA bug)', () => {
    const due = daysFromNow(1);
    expect(isDueSoon(due, 'up_next')).toBe(true);
    expect(isDueSoon(due, 'in_motion')).toBe(true);
    expect(isDueSoon(due, 'done_and_dusted')).toBe(false);
  });

  it('B. Up Next → In Motion stays due soon while the deadline approaches', () => {
    const due = hoursFromNow(30);
    expect(isDueSoon(due, 'up_next')).toBe(true);
    expect(isDueSoon(due, 'in_motion')).toBe(true);
  });

  it('D. individually archived entry → not due soon', () => {
    expect(isDueSoon(daysFromNow(1), 'up_next', true)).toBe(false);
  });

  it('E. archived entry restored → due soon again only if still eligible', () => {
    const due = daysFromNow(1);
    expect(isDueSoon(due, 'up_next', true)).toBe(false);
    // Restore: the archived flag drops and the entry is due soon again…
    expect(isDueSoon(due, 'up_next', false)).toBe(true);
    // …unless its deadline lapsed while it was archived.
    expect(isDueSoon(hoursFromNow(-1), 'up_next', false)).toBe(false);
  });

  it('E/G. entry of an archived project → not due soon', () => {
    expect(isDueSoon(daysFromNow(1), 'up_next', false, true)).toBe(false);
    // An archived project must not win over an eligible deadline.
    expect(isDueSoon(daysFromNow(1), 'in_motion', false, true)).toBe(false);
  });

  it('F. deadline moved beyond the window → not due soon', () => {
    expect(isDueSoon(daysFromNow(DUE_SOON_WINDOW_DAYS + 1), 'up_next')).toBe(false);
  });

  it('F/H. deadline already passed → overdue territory, never due soon', () => {
    const past = hoursFromNow(-1);
    expect(isDueSoon(past, 'up_next')).toBe(false);
    // …and the Batch 1 rule still classifies it as overdue.
    expect(isOverdue(past, 'up_next')).toBe(true);
  });

  it('I. a completed entry stays excluded regardless of the clock (refresh safety)', () => {
    vi.setSystemTime(new Date(NOW.getTime() + 86400000));
    expect(isDueSoon(daysFromNow(0.5), 'done_and_dusted')).toBe(false);
  });

  it('J. entry without a deadline → never due soon', () => {
    expect(isDueSoon(null, 'up_next')).toBe(false);
    expect(isDueSoon(undefined, 'up_next')).toBe(false);
    expect(isDueSoon('', 'up_next')).toBe(false);
  });

  // Window boundaries — exact edges
  it('deadline exactly now → still due soon (preserves prior cache semantics)', () => {
    expect(isDueSoon(NOW.toISOString(), 'up_next')).toBe(true);
  });

  it('deadline 1ms past now → no longer due soon (it is overdue)', () => {
    expect(isDueSoon(new Date(NOW.getTime() + 1).toISOString(), 'up_next')).toBe(true);
    expect(isDueSoon(new Date(NOW.getTime() - 1).toISOString(), 'up_next')).toBe(false);
  });

  it('deadline exactly at the window end → due soon; 1ms beyond → not', () => {
    const edge = new Date(NOW.getTime() + DUE_SOON_WINDOW_DAYS * 86400000);
    expect(isDueSoon(edge.toISOString(), 'up_next')).toBe(true);
    expect(isDueSoon(new Date(edge.getTime() + 1).toISOString(), 'up_next')).toBe(false);
  });

  it('unknown status vocabulary → not due soon', () => {
    expect(isDueSoon(daysFromNow(1), 'completed')).toBe(false);
  });

  it('unparseable due date → not due soon', () => {
    expect(isDueSoon('not-a-date', 'up_next')).toBe(false);
  });

  // Deadline instants — the app stores due_date as full ISO instants
  // (TIMESTAMPTZ round-trips); the rule compares instants only and never
  // reinterprets date-only strings, so both end-of-day-UTC and
  // local-evening-UTC instants behave identically while inside the window.
  it('end-of-day UTC instant and local-evening instant are both window-compared as instants', () => {
    expect(isDueSoon('2026-03-17T23:59:59.999Z', 'up_next')).toBe(true);
    expect(isDueSoon('2026-03-17T21:59:59.999Z', 'up_next')).toBe(true);
    expect(isDueSoon('2026-03-19T00:00:00.000Z', 'up_next')).toBe(false);
  });
});

describe('computeDueSoon — due-soon cache derivation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const entry = (over) => ({ ...over });

  it('keeps only entries that satisfy the shared eligibility rule', () => {
    const rows = [
      entry({ id: '1', due_date: daysFromNow(1), status: 'up_next' }), // eligible
      entry({ id: '2', due_date: daysFromNow(1), status: 'done_and_dusted' }), // completed
      entry({ id: '3', due_date: daysFromNow(1), status: 'up_next', archived: true }), // archived
      entry({ id: '4', due_date: hoursFromNow(-2), status: 'up_next' }), // overdue
      entry({ id: '5', due_date: daysFromNow(10), status: 'up_next' }), // outside window
      entry({ id: '6', status: 'up_next' }), // no deadline
      entry({ id: '7', due_date: daysFromNow(2), status: 'in_motion' }), // eligible
    ];

    const dueSoon = computeDueSoon(rows);
    expect(dueSoon.map((r) => r.id)).toEqual(['1', '7']);
    // Count and list can never diverge: the cache count IS the list length.
    expect(dueSoon.length).toBe(2);
  });

  it('drops soft-deleted rows defensively', () => {
    const rows = [entry({ id: '8', due_date: daysFromNow(1), status: 'up_next', deleted: true })];
    expect(computeDueSoon(rows)).toEqual([]);
  });

  it('excludes entries of archived projects when the caller passes the set', () => {
    const rows = [
      entry({ id: '9', due_date: daysFromNow(1), status: 'up_next', project_name: 'Archived' }),
      entry({ id: '10', due_date: daysFromNow(1), status: 'up_next', project_name: 'Active' }),
    ];
    expect(computeDueSoon(rows, new Set(['Archived'])).map((r) => r.id)).toEqual(['10']);
    // No project knowledge → entry-level rule only (sync cache contract).
    expect(computeDueSoon(rows).map((r) => r.id)).toEqual(['9', '10']);
  });

  it('non-array input yields an empty list', () => {
    expect(computeDueSoon(null)).toEqual([]);
    expect(computeDueSoon(undefined)).toEqual([]);
  });
});

describe('Dashboard ↔ StatsView due-soon consistency', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  // Both surfaces derive their archived-project set through the same shared
  // helper, then hand it to the same computeDueSoon — this suite pins the
  // end-to-end derivation both call sites perform.
  const dueSoonCount = (projects, entries) =>
    computeDueSoon(entries, getEffectiveArchivedProjectNames('stats@example.test', projects))
      .length;

  const projects = [
    { project_name: 'Active', archived: false },
    { project_name: 'Server archived', archived: true },
    { project_name: 'Locally archived', archived: false },
  ];

  it('counts an eligible entry of an active project on both surfaces', () => {
    const entries = [
      { id: '1', due_date: daysFromNow(1), status: 'up_next', project_name: 'Active' },
    ];
    expect(dueSoonCount(projects, entries)).toBe(1);
  });

  it('excludes entries of server-archived and locally archived projects on both surfaces', () => {
    localStorage.setItem('dl_archived_stats@example.test', JSON.stringify(['Locally archived']));
    const entries = [
      { id: '1', due_date: daysFromNow(1), status: 'up_next', project_name: 'Active' },
      { id: '2', due_date: daysFromNow(1), status: 'up_next', project_name: 'Server archived' },
      {
        id: '3',
        due_date: daysFromNow(1),
        status: 'up_next',
        project_name: 'Locally archived',
      },
    ];
    expect(dueSoonCount(projects, entries)).toBe(1);
    expect(computeDueSoon(entries).map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('a restored project contributes its eligible entries again', () => {
    localStorage.setItem('dl_archived_stats@example.test', JSON.stringify(['Locally archived']));
    const entry = {
      id: '1',
      due_date: daysFromNow(1),
      status: 'up_next',
      project_name: 'Locally archived',
    };
    expect(dueSoonCount(projects, [entry])).toBe(0);
    // The Dashboard's unarchive action removes the fallback entry — the
    // project contributes again purely through the shared derivation.
    localStorage.setItem('dl_archived_stats@example.test', JSON.stringify([]));
    expect(dueSoonCount(projects, [entry])).toBe(1);
  });

  it('completed, past-due and individually archived entries stay excluded on both surfaces', () => {
    const entries = [
      { id: '1', due_date: daysFromNow(1), status: 'up_next', project_name: 'Active' },
      {
        id: '2',
        due_date: daysFromNow(1),
        status: 'done_and_dusted',
        project_name: 'Active',
      },
      { id: '3', due_date: hoursFromNow(-1), status: 'up_next', project_name: 'Active' },
      {
        id: '4',
        due_date: daysFromNow(1),
        status: 'up_next',
        archived: true,
        project_name: 'Active',
      },
    ];
    expect(dueSoonCount(projects, entries)).toBe(1);
  });
});
