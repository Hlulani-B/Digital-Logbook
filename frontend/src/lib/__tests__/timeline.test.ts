import { describe, expect, it } from 'vitest';
import {
  buildDependencyArrows,
  computeTimelineRenderLayout,
  ensureMinimumRange,
  getTimelineBounds,
  layoutTimelineRows,
  parseTimelineEntries,
} from '@/lib/timeline';
import { type CalendarEntry } from '@/lib/calendar';

function entry(values: Partial<CalendarEntry>): CalendarEntry {
  return {
    id: 1,
    user_email: 'a@b.com',
    project_name: 'Default',
    entries: {},
    due_date: null,
    priority: null,
    created_at: '2026-09-01T10:00:00.000Z',
    ...values,
  } as CalendarEntry;
}

describe('parseTimelineEntries', () => {
  it('creates timeline entries with start and due dates', () => {
    const entries = [
      entry({
        id: 1,
        started_at: '2026-09-01T10:00:00.000Z',
        due_date: '2026-09-05T10:00:00.000Z',
        entries: { title: 'Task A' },
      }),
    ];
    const result = parseTimelineEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].startDate.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    expect(result[0].endDate.toISOString()).toBe('2026-09-05T10:00:00.000Z');
    expect(result[0].title).toBe('Task A');
  });

  it('falls back to created_at when started_at is missing', () => {
    const entries = [entry({ id: 1, started_at: null, due_date: '2026-09-05T10:00:00.000Z' })];
    const result = parseTimelineEntries(entries);
    expect(result[0].startDate.toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });

  it('falls back to one day after start when due_date is missing', () => {
    const entries = [entry({ id: 1, started_at: '2026-09-01T10:00:00.000Z', due_date: null })];
    const result = parseTimelineEntries(entries);
    expect(result[0].endDate.toISOString()).toBe('2026-09-02T10:00:00.000Z');
  });

  it('reads dependencies from entries object', () => {
    const entries = [entry({ id: 1, entries: { dependencies: [2, '3'] } })];
    const result = parseTimelineEntries(entries);
    expect(result[0].dependencies).toEqual([2, '3']);
  });

  it('supports depends_on as an alias for dependencies', () => {
    const entries = [entry({ id: 1, entries: { depends_on: [2] } })];
    const result = parseTimelineEntries(entries);
    expect(result[0].dependencies).toEqual([2]);
  });

  it('skips archived and completed entries', () => {
    const entries = [
      entry({ id: 1, archived: true }),
      entry({ id: 2, status: 'done_and_dusted' }),
      entry({
        id: 3,
        started_at: '2026-09-01T10:00:00.000Z',
        due_date: '2026-09-02T10:00:00.000Z',
      }),
    ];
    const result = parseTimelineEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });
});

describe('getTimelineBounds', () => {
  it('returns the earliest start and latest end', () => {
    const entries = [
      entry({
        id: 1,
        started_at: '2026-09-01T10:00:00.000Z',
        due_date: '2026-09-03T10:00:00.000Z',
      }),
      entry({
        id: 2,
        started_at: '2026-09-05T10:00:00.000Z',
        due_date: '2026-09-10T10:00:00.000Z',
      }),
    ];
    const timeline = parseTimelineEntries(entries);
    const bounds = getTimelineBounds(timeline);
    expect(bounds?.start.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    expect(bounds?.end.toISOString()).toBe('2026-09-10T10:00:00.000Z');
  });

  it('returns null for no entries', () => {
    expect(getTimelineBounds([])).toBeNull();
  });
});

describe('ensureMinimumRange', () => {
  it('expands short ranges to the minimum number of days', () => {
    const bounds = {
      start: new Date('2026-09-01T00:00:00.000Z'),
      end: new Date('2026-09-02T00:00:00.000Z'),
    };
    const result = ensureMinimumRange(bounds, 7);
    const days = (result.end.getTime() - result.start.getTime()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThanOrEqual(7);
  });

  it('leaves long ranges unchanged', () => {
    const bounds = {
      start: new Date('2026-09-01T00:00:00.000Z'),
      end: new Date('2026-10-15T00:00:00.000Z'),
    };
    const result = ensureMinimumRange(bounds, 7);
    expect(result.end.toISOString()).toBe(bounds.end.toISOString());
  });
});

describe('layoutTimelineRows', () => {
  it('places non-overlapping entries on the same row', () => {
    const entries = [
      entry({
        id: 1,
        started_at: '2026-09-01T10:00:00.000Z',
        due_date: '2026-09-02T10:00:00.000Z',
      }),
      entry({
        id: 2,
        started_at: '2026-09-03T10:00:00.000Z',
        due_date: '2026-09-04T10:00:00.000Z',
      }),
    ];
    const timeline = parseTimelineEntries(entries);
    const layout = layoutTimelineRows(timeline);
    expect(layout.rowCount).toBe(1);
  });

  it('places overlapping entries on different rows', () => {
    const entries = [
      entry({
        id: 1,
        started_at: '2026-09-01T10:00:00.000Z',
        due_date: '2026-09-05T10:00:00.000Z',
      }),
      entry({
        id: 2,
        started_at: '2026-09-03T10:00:00.000Z',
        due_date: '2026-09-06T10:00:00.000Z',
      }),
    ];
    const timeline = parseTimelineEntries(entries);
    const layout = layoutTimelineRows(timeline);
    expect(layout.rowCount).toBe(2);
  });
});

describe('computeTimelineRenderLayout', () => {
  it('computes pixel positions based on day width', () => {
    const entries = [
      entry({
        id: 1,
        started_at: '2026-09-01T10:00:00.000Z',
        due_date: '2026-09-03T10:00:00.000Z',
      }),
    ];
    const timeline = parseTimelineEntries(entries);
    const layout = layoutTimelineRows(timeline);
    const render = computeTimelineRenderLayout(layout, {
      dayWidth: 80,
      rowHeight: 56,
      barHeight: 32,
      range: {
        start: new Date('2026-09-01T00:00:00.000Z'),
        end: new Date('2026-09-10T00:00:00.000Z'),
      },
      paddingX: 16,
      paddingY: 24,
    });

    expect(render.items[0].x).toBeCloseTo(16 + (10 / 24) * 80, 0);
    expect(render.items[0].width).toBeCloseTo(2 * 80, 0);
    expect(render.totalWidth).toBeGreaterThan(0);
    expect(render.totalHeight).toBeGreaterThan(0);
  });
});

describe('buildDependencyArrows', () => {
  it('draws arrows between dependent entries', () => {
    const entries = [
      entry({
        id: 1,
        started_at: '2026-09-01T10:00:00.000Z',
        due_date: '2026-09-02T10:00:00.000Z',
        entries: {},
      }),
      entry({
        id: 2,
        started_at: '2026-09-03T10:00:00.000Z',
        due_date: '2026-09-04T10:00:00.000Z',
        entries: { dependencies: [1] },
      }),
    ];
    const timeline = parseTimelineEntries(entries);
    const layout = layoutTimelineRows(timeline);
    const render = computeTimelineRenderLayout(layout, {
      dayWidth: 80,
      rowHeight: 56,
      barHeight: 32,
      range: {
        start: new Date('2026-09-01T00:00:00.000Z'),
        end: new Date('2026-09-10T00:00:00.000Z'),
      },
      paddingX: 16,
      paddingY: 24,
    });
    const arrows = buildDependencyArrows(render.items);
    expect(arrows).toHaveLength(1);
    expect(arrows[0].id).toBe('1-2');
    expect(arrows[0].d).toContain('M');
    expect(arrows[0].d).toContain('C');
  });

  it('ignores missing dependencies', () => {
    const entries = [
      entry({
        id: 1,
        started_at: '2026-09-01T10:00:00.000Z',
        due_date: '2026-09-02T10:00:00.000Z',
        entries: { dependencies: [99] },
      }),
    ];
    const timeline = parseTimelineEntries(entries);
    const layout = layoutTimelineRows(timeline);
    const render = computeTimelineRenderLayout(layout, {
      dayWidth: 80,
      rowHeight: 56,
      barHeight: 32,
      range: {
        start: new Date('2026-09-01T00:00:00.000Z'),
        end: new Date('2026-09-10T00:00:00.000Z'),
      },
      paddingX: 16,
      paddingY: 24,
    });
    const arrows = buildDependencyArrows(render.items);
    expect(arrows).toHaveLength(0);
  });
});
