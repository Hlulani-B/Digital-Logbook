import { describe, it, expect } from 'vitest';
import {
  FIELD_CAPABILITIES,
  BUILTIN_FIELD_DEFS,
  fieldCapabilities,
  inferDataType,
  deriveFieldDefs,
  mergeFieldDefs,
  computeFieldStats,
  groupFieldBy,
  formatStatValue,
  fieldHeadline,
  entryDurationMs,
} from '../stats';

/* ── fixtures ─────────────────────────────────────────────────
 * Entries mirror the Supabase rows: custom field values live in
 * the `entries` JSONB, built-ins sit at the top level.
 */
function entry(project_name, fields, created_at, extra = {}) {
  return { project_name, entries: fields, created_at, ...extra };
}

const DAY = 'T12:00:00.000Z'; // midday UTC — deterministic day buckets

const entries = [
  entry(
    'Alpha',
    { budget: 100, store: 'Pick n Pay', paid: true, shop_date: '2026-01-02' },
    `2026-01-02${DAY}`
  ),
  entry(
    'Alpha',
    { budget: 250, store: 'Checkers', paid: 'false', shop_date: '2026-01-03' },
    `2026-01-03${DAY}`
  ),
  entry(
    'Beta',
    { budget: 50, store: 'Pick n Pay', paid: true, shop_date: '2026-01-02' },
    `2026-01-03${DAY}`
  ),
  entry('Beta', { budget: 'not-a-number', store: 'Checkers' }, `2026-01-04${DAY}`),
  entry('Beta', { budget: 200 }, `2026-01-05${DAY}`),
];

/* Same data without the unparseable value — inference needs clean
 * values to detect a numeric field (a declared type would win). */
const cleanEntries = entries.filter((e) => e.entries.budget !== 'not-a-number');

describe('fieldCapabilities', () => {
  it('exposes total/group/compare/plot for every supported type', () => {
    for (const type of Object.keys(FIELD_CAPABILITIES)) {
      const caps = fieldCapabilities(type);
      expect(caps).toHaveProperty('total');
      expect(caps).toHaveProperty('group');
      expect(caps).toHaveProperty('compare');
      expect(caps).toHaveProperty('plot');
    }
  });

  it('allows totalling numbers and durations but not text/boolean/date', () => {
    expect(fieldCapabilities('number').total).toBe(true);
    expect(fieldCapabilities('duration').total).toBe(true);
    expect(fieldCapabilities('text').total).toBe(false);
    expect(fieldCapabilities('boolean').total).toBe(false);
    expect(fieldCapabilities('date').total).toBe(false);
  });

  it('treats unknown types as text', () => {
    expect(fieldCapabilities('something-new')).toEqual(FIELD_CAPABILITIES.text);
  });
});

describe('inferDataType', () => {
  it('infers number from numeric values and numeric strings', () => {
    expect(inferDataType([1, 2.5, '42'])).toBe('number');
  });

  it('infers boolean from true/false and their string forms', () => {
    expect(inferDataType([true, 'false'])).toBe('boolean');
  });

  it('infers date from ISO date strings', () => {
    expect(inferDataType(['2026-01-02', '2026-01-03T10:00:00.000Z'])).toBe('date');
  });

  it('falls back to text for mixed or free-form values', () => {
    expect(inferDataType(['Pick n Pay', 'Checkers'])).toBe('text');
    expect(inferDataType([1, 'Checkers'])).toBe('text');
  });

  it('returns text for empty input', () => {
    expect(inferDataType([])).toBe('text');
    expect(inferDataType([null, '', undefined])).toBe('text');
  });
});

describe('deriveFieldDefs', () => {
  it('derives definitions from the entries JSONB with inferred types', () => {
    const defs = deriveFieldDefs(cleanEntries);
    const byName = Object.fromEntries(defs.map((d) => [d.field_name, d.data_type]));
    expect(byName['budget']).toBe('number');
    expect(byName['store']).toBe('text');
    expect(byName['paid']).toBe('boolean');
    expect(byName['shop_date']).toBe('date');
  });

  it('falls back to text when a field mixes numbers and free text', () => {
    const defs = deriveFieldDefs(entries);
    expect(defs.find((d) => d.field_name === 'budget').data_type).toBe('text');
  });

  it('skips reserved keys that are not owner fields', () => {
    const defs = deriveFieldDefs([
      entry('A', { description: 'text', started_at: '2026-01-01', budget: 5 }, `2026-01-01${DAY}`),
    ]);
    expect(defs.map((d) => d.field_name)).toEqual(['budget']);
  });

  it('returns [] when entries have no JSONB payload', () => {
    expect(deriveFieldDefs([{ project_name: 'A' }])).toEqual([]);
    expect(deriveFieldDefs([])).toEqual([]);
  });
});

describe('mergeFieldDefs', () => {
  it('lets declared definitions win over derived ones', () => {
    const merged = mergeFieldDefs(
      [{ field_name: 'budget', data_type: 'number' }],
      [{ field_name: 'budget', data_type: 'text' }]
    );
    expect(merged).toEqual([{ field_name: 'budget', data_type: 'number' }]);
  });

  it('keeps derived fields the owner never declared', () => {
    const merged = mergeFieldDefs(
      [{ field_name: 'budget', data_type: 'number' }],
      [{ field_name: 'store', data_type: 'text' }]
    );
    expect(merged).toHaveLength(2);
  });

  it('defaults a missing data_type to text', () => {
    const merged = mergeFieldDefs([{ field_name: 'weird' }], []);
    expect(merged[0].data_type).toBe('text');
  });
});

describe('computeFieldStats', () => {
  const defs = [
    { field_name: 'budget', data_type: 'number' },
    { field_name: 'store', data_type: 'text' },
    { field_name: 'paid', data_type: 'boolean' },
    { field_name: 'shop_date', data_type: 'date' },
  ];

  it('follows the standard format for every field', () => {
    const stats = computeFieldStats(entries, defs);
    for (const stat of stats) {
      expect(stat).toHaveProperty('field');
      expect(stat).toHaveProperty('data_type');
      expect(stat).toHaveProperty('capabilities');
      expect(stat).toHaveProperty('entryCount');
      expect(stat).toHaveProperty('count');
      expect(stat).toHaveProperty('total');
      expect(stat).toHaveProperty('displayTotal');
      expect(stat).toHaveProperty('min');
      expect(stat).toHaveProperty('max');
      expect(stat).toHaveProperty('avg');
      expect(stat).toHaveProperty('groups');
      expect(stat).toHaveProperty('series');
      expect(stat).toHaveProperty('byProject');
    }
  });

  it('totals a numeric field and skips unparseable values', () => {
    const stats = computeFieldStats(entries, defs);
    const budget = stats.find((s) => s.field === 'budget');
    // 100 + 250 + 50 + 200 — 'not-a-number' is skipped, not fatal
    expect(budget.count).toBe(4);
    expect(budget.total).toBe(600);
    expect(budget.min).toBe(50);
    expect(budget.max).toBe(250);
    expect(budget.avg).toBe(150);
  });

  it('groups a text field by value, sorted by count descending', () => {
    const stats = computeFieldStats(entries, defs);
    const store = stats.find((s) => s.field === 'store');
    expect(store.groups).toEqual([
      { value: 'Checkers', count: 2 },
      { value: 'Pick n Pay', count: 2 },
    ]);
    expect(store.total).toBeNull();
    expect(store.displayTotal).toBeNull();
  });

  it('groups a boolean field into true/false', () => {
    const stats = computeFieldStats(entries, defs);
    const paid = stats.find((s) => s.field === 'paid');
    const byValue = Object.fromEntries(paid.groups.map((g) => [g.value, g.count]));
    expect(byValue['true']).toBe(2);
    expect(byValue['false']).toBe(1);
  });

  it('groups a date field by calendar day', () => {
    const stats = computeFieldStats(entries, defs);
    const shopDate = stats.find((s) => s.field === 'shop_date');
    const byValue = Object.fromEntries(shopDate.groups.map((g) => [g.value, g.count]));
    expect(byValue['2026-01-02']).toBe(2);
    expect(byValue['2026-01-03']).toBe(1);
  });

  it('plots a numeric field over time as daily sums', () => {
    const stats = computeFieldStats(entries, defs);
    const budget = stats.find((s) => s.field === 'budget');
    const series = Object.fromEntries(budget.series.map((s) => [s.bucket, s.value]));
    expect(series['2026-01-02']).toBe(100);
    expect(series['2026-01-03']).toBe(300); // 250 + 50
    expect(series['2026-01-04']).toBeUndefined(); // unparseable value skipped
    expect(series['2026-01-05']).toBe(200);
    // chronological order
    const buckets = budget.series.map((s) => s.bucket);
    expect([...buckets].sort()).toEqual(buckets);
  });

  it('plots a text field over time as daily counts', () => {
    const stats = computeFieldStats(entries, defs);
    const store = stats.find((s) => s.field === 'store');
    const series = Object.fromEntries(store.series.map((s) => [s.bucket, s.value]));
    expect(series['2026-01-03']).toBe(2);
    expect(series['2026-01-04']).toBe(1);
  });

  it('compares a numeric field across projects', () => {
    const stats = computeFieldStats(entries, defs);
    const budget = stats.find((s) => s.field === 'budget');
    const byProject = Object.fromEntries(budget.byProject.map((p) => [p.key, p]));
    expect(byProject['Alpha'].total).toBe(350);
    expect(byProject['Beta'].total).toBe(250);
    // sorted by total descending
    expect(budget.byProject[0].key).toBe('Alpha');
  });

  it('compares a text field across projects by entry count', () => {
    const stats = computeFieldStats(entries, defs);
    const store = stats.find((s) => s.field === 'store');
    const alpha = store.byProject.find((p) => p.key === 'Alpha');
    expect(alpha.count).toBe(2);
    expect(alpha.display).toBe('2');
  });

  it('derives stats for fields the logbook was never told about', () => {
    // No definitions passed at all — the engine derives them from data.
    const stats = computeFieldStats(cleanEntries);
    const fields = stats.map((s) => s.field);
    expect(fields).toContain('budget');
    expect(fields).toContain('store');
    const budget = stats.find((s) => s.field === 'budget');
    expect(budget.data_type).toBe('number');
    expect(budget.total).toBe(600);
  });

  it('exposes built-in columns through the same format', () => {
    const withTimer = [
      entry('Alpha', { budget: 10 }, `2026-01-01${DAY}`, {
        started_at: '2026-01-01T10:00:00.000Z',
        ended_at: '2026-01-01T11:30:00.000Z',
      }),
    ];
    const stats = computeFieldStats(withTimer, [], { includeBuiltins: true });
    const duration = stats.find((s) => s.field === 'duration');
    expect(duration.data_type).toBe('duration');
    expect(duration.total).toBe(90 * 60000);
    expect(duration.displayTotal).toBe('1h 30m');
    expect(stats.find((s) => s.field === 'project_name').groups).toEqual([
      { value: 'Alpha', count: 1 },
    ]);
  });

  it('caps the number of groups returned', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      entry('A', { store: `Store ${i}` }, `2026-01-0${(i % 8) + 1}${DAY}`)
    );
    const stats = computeFieldStats(many, [{ field_name: 'store', data_type: 'text' }], {
      maxGroups: 5,
    });
    expect(stats[0].groups).toHaveLength(5);
  });

  it('drops fields with no values at all', () => {
    const stats = computeFieldStats(
      [entry('A', { budget: 5 }, `2026-01-01${DAY}`)],
      [
        { field_name: 'budget', data_type: 'number' },
        { field_name: 'empty', data_type: 'text' },
      ]
    );
    expect(stats.map((s) => s.field)).toEqual(['budget']);
  });

  it('handles non-array entries defensively', () => {
    expect(computeFieldStats(null)).toEqual([]);
    expect(computeFieldStats(undefined)).toEqual([]);
  });
});

describe('groupFieldBy', () => {
  it('sums a numeric field per group key', () => {
    const groups = groupFieldBy(entries, 'budget', 'project_name', {
      data_type: 'number',
    });
    expect(groups).toEqual([
      { key: 'Alpha', count: 2, total: 350, display: '350' },
      { key: 'Beta', count: 2, total: 250, display: '250' },
    ]);
  });

  it('counts a text field per group key when it cannot be totalled', () => {
    const groups = groupFieldBy(entries, 'store', 'project_name', {
      data_type: 'text',
    });
    const alpha = groups.find((g) => g.key === 'Alpha');
    expect(alpha.count).toBe(2);
    expect(alpha.total).toBe(0);
    expect(alpha.display).toBe('2');
  });

  it('infers the data type from the data when not provided', () => {
    const groups = groupFieldBy(cleanEntries, 'budget', 'project_name');
    expect(groups[0].total).toBe(350);
  });

  it('uses "Unknown" for entries without a project', () => {
    const groups = groupFieldBy(
      [entry(null, { budget: 5 }, `2026-01-01${DAY}`)],
      'budget',
      'project_name',
      { data_type: 'number' }
    );
    expect(groups[0].key).toBe('Unknown');
  });

  it('skips entries whose value is missing', () => {
    const groups = groupFieldBy(
      [entry('A', {}, `2026-01-01${DAY}`), entry('A', { budget: 5 }, `2026-01-01${DAY}`)],
      'budget',
      'project_name',
      { data_type: 'number' }
    );
    expect(groups[0].count).toBe(1);
  });
});

describe('formatStatValue', () => {
  it('formats durations with the shared duration formatter', () => {
    expect(formatStatValue(90 * 60000, 'duration')).toBe('1h 30m');
  });

  it('formats numbers with locale separators', () => {
    expect(formatStatValue(4500, 'number')).toBe('4,500');
    expect(formatStatValue(4500.5, 'number')).toBe('4,500.5');
  });

  it('passes strings through', () => {
    expect(formatStatValue('Checkers', 'text')).toBe('Checkers');
  });

  it('returns empty string for nullish values', () => {
    expect(formatStatValue(null, 'number')).toBe('');
    expect(formatStatValue(undefined, 'text')).toBe('');
  });
});

describe('fieldHeadline', () => {
  it('summarises total-able fields with their total and fill count', () => {
    const stats = computeFieldStats(entries, [{ field_name: 'budget', data_type: 'number' }]);
    expect(fieldHeadline(stats[0])).toBe('600 total · 4 filled');
  });

  it('summarises non-total fields with their top group', () => {
    const stats = computeFieldStats(entries, [{ field_name: 'store', data_type: 'text' }]);
    expect(fieldHeadline(stats[0])).toMatch(/^top: (Checkers|Pick n Pay) × 2$/);
  });

  it('falls back to the fill count when there are no groups', () => {
    expect(fieldHeadline({ capabilities: { total: false }, count: 3, groups: [] })).toBe(
      '3 filled'
    );
    expect(fieldHeadline(null)).toBe('');
  });
});

describe('BUILTIN_FIELD_DEFS', () => {
  it('declares built-in columns with the same shape as owner fields', () => {
    for (const def of BUILTIN_FIELD_DEFS) {
      expect(def).toHaveProperty('field_name');
      expect(def).toHaveProperty('data_type');
    }
    expect(BUILTIN_FIELD_DEFS.map((d) => d.field_name)).toContain('duration');
  });

  it('duration builtin matches entryDurationMs', () => {
    const e = entry('A', {}, `2026-01-01${DAY}`, {
      started_at: '2026-01-01T10:00:00.000Z',
      ended_at: '2026-01-01T11:00:00.000Z',
    });
    const stats = computeFieldStats([e], [], { includeBuiltins: true });
    expect(stats.find((s) => s.field === 'duration').total).toBe(entryDurationMs(e));
  });
});
