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
  analysisFieldDefs,
  fieldAnalysisPolicy,
  dailyWindow,
  computeFieldAnalysis,
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

  it('duration builtin nets out paused_ms and still matches entryDurationMs', () => {
    const e = entry('A', {}, `2026-01-01${DAY}`, {
      started_at: '2026-01-01T10:00:00.000Z',
      ended_at: '2026-01-01T11:00:00.000Z',
      paused_ms: 20 * 60000,
    });
    const stats = computeFieldStats([e], [], { includeBuiltins: true });
    const durationStat = stats.find((s) => s.field === 'duration').total;
    expect(durationStat).toBe(entryDurationMs(e));
    expect(durationStat).toBe(40 * 60000);
  });
});

const numberDef = { field_name: 'value', data_type: 'number' };
const selectDef = { field_name: 'value', data_type: 'select' };
const partnerDef = { field_name: 'partner', data_type: 'select' };
const rowsFor = (values) => values.map((value) => entry('A', { value }, '2026-03-01'));
const frequenciesByKey = (items) => Object.fromEntries(items.map((item) => [item.key, item.count]));
const matrixTotal = (matrix) => matrix.values.flat().reduce((sum, value) => sum + (value ?? 0), 0);
const matrixCell = (matrix, row, column) =>
  matrix.values[matrix.rows.findIndex((item) => item.key === row)][
    matrix.columns.findIndex((item) => item.key === column)
  ];

// These contracts are consumed by the separate type-aware stats UI.
describe('fieldAnalysisPolicy', () => {
  it.each([
    ['number', 'numeric', ['bars', 'trend', 'grouped']],
    ['integer', 'numeric', ['bars', 'trend', 'grouped']],
    ['float', 'numeric', ['bars', 'trend', 'grouped']],
    ['duration', 'numeric', ['bars', 'trend', 'grouped']],
    ['select', 'category', ['bars', 'donut', 'grouped']],
    ['custom', 'category', ['bars', 'donut', 'grouped']],
    ['custom:One,Two', 'category', ['bars', 'donut', 'grouped']],
    ['boolean', 'boolean', ['donut', 'bars', 'grouped']],
    ['multiselect', 'multi', ['bars']],
    ['multi', 'multi', ['bars']],
    ['date', 'date', ['trend']],
    ['timestamp', 'date', ['trend']],
    ['text', 'text', ['search']],
    ['markdown', 'text', ['search']],
    ['file', 'summary', ['summary']],
    ['currency', 'summary', ['summary']],
    ['unknown', 'summary', ['summary']],
    [undefined, 'summary', ['summary']],
  ])('assigns the exact policy for %s', (type, kind, views) => {
    expect(fieldAnalysisPolicy(type)).toEqual({ kind, views, defaultView: views[0] });
  });

  it('does not repurpose legacy capabilities as chart policies', () => {
    expect(fieldCapabilities('text')).toEqual({
      total: false,
      group: true,
      compare: true,
      plot: true,
    });
    expect(fieldAnalysisPolicy('text').views).toEqual(['search']);
  });
});

describe('analysisFieldDefs and metadata', () => {
  it('preserves declared metadata and normalizes legacy option IDs without mutating the input', () => {
    const declared = [
      {
        field_name: 'value',
        data_type: 'custom',
        id: 'field-id',
        is_required: true,
        rules: { min: 1 },
        field_permissions: { guest: 'hidden' },
        options: [{ id: 'red', label: 'Red', value: 'r', parent_id: 'color', color: '#f00' }],
      },
      { field_name: 'empty', data_type: 'integer' },
    ];
    const before = JSON.stringify(declared);
    expect(mergeFieldDefs(declared, [{ field_name: 'value', data_type: 'text' }])[0]).toEqual(
      declared[0]
    );
    const defs = analysisFieldDefs(rowsFor(['r']), declared);
    expect(defs[0]).toMatchObject({ ...declared[0], data_type: 'select' });
    expect(defs[1]).toMatchObject({ field_name: 'empty', data_type: 'integer' });
    expect(JSON.stringify(declared)).toBe(before);
    expect(analysisFieldDefs(null, declared)).toHaveLength(2);
  });

  it('never treats low-cardinality text or complex inferred data as categories', () => {
    const defs = analysisFieldDefs([
      entry('A', {
        repeated: 'same',
        payload: { nested: 1 },
        list: ['a'],
        description: 'reserved',
      }),
      entry('A', { repeated: 'same', payload: 'mixed', list: ['b'] }),
    ]);
    expect(
      Object.fromEntries(
        defs.map((def) => [def.field_name, fieldAnalysisPolicy(def.data_type).kind])
      )
    ).toEqual({ repeated: 'text', payload: 'summary', list: 'summary' });
  });

  it('adds a duration for running or legacy completed timers, but never shadows a same-name field', () => {
    const running = [{ started_at: '2026-01-01' }];
    expect(analysisFieldDefs(running)).toMatchObject([
      { field_name: 'duration', data_type: 'duration' },
    ]);
    expect(analysisFieldDefs([{ ended_at: '2026-01-01' }])).toHaveLength(1);
    expect(analysisFieldDefs([{}])).toEqual([]);
    const custom = { field_name: 'duration', data_type: 'number', rules: { min: 0 } };
    expect(analysisFieldDefs(running, [custom])).toMatchObject([custom]);
    const data = [entry('A', { duration: 7 }, '2026-03-01', running[0])];
    expect(analysisFieldDefs(data)).toMatchObject([
      { field_name: 'duration', data_type: 'number' },
    ]);
    expect(computeFieldAnalysis(data, custom).numeric.total).toBe(7);
  });
});

describe('numeric analysis and legacy aliases', () => {
  it.each(['number', 'integer', 'float'])(
    'keeps legacy result shapes while fixing %s coercion',
    (data_type) => {
      const data = rowsFor([2, '3', false, true, Infinity, '0x10', {}, 'bad']);
      expect(fieldCapabilities(data_type).total).toBe(true);
      const stats = computeFieldStats(data, [{ ...numberDef, data_type }])[0];
      expect(stats).toMatchObject({
        count: 2,
        total: 5,
        min: 2,
        max: 3,
        avg: 2.5,
        displayTotal: '5',
      });
      expect(groupFieldBy(data, 'value', 'project_name', { data_type })).toEqual([
        { key: 'A', count: 2, total: 5, display: '5' },
      ]);
    }
  );

  it('separates missing, present-invalid, and valid values, including zero and negatives', () => {
    const data = rowsFor([
      null,
      undefined,
      '',
      ' \t ',
      [],
      0,
      '0',
      -2,
      '.5',
      '2e1',
      '0x10',
      true,
      false,
      Infinity,
      -Infinity,
      NaN,
      'Infinity',
      'nope',
      {},
      [1],
    ]);
    const result = computeFieldAnalysis(data, numberDef);
    expect(result.coverage).toEqual({ total: 20, filled: 15, missing: 5, invalid: 10 });
    expect(result.numeric).toEqual({ total: 18.5, average: 3.7, min: -2, max: 20 });
    expect(result.series.at(-1)).toEqual({ bucket: '2026-03-01', value: 18.5 });
    expect(result.frequencies).toEqual([]);
  });

  it('rejects fractional integers but accepts fractional floats', () => {
    const data = rowsFor([0, '-2', '2.5', 3.25, true, '0b11', ' ', Infinity]);
    const integer = computeFieldAnalysis(data, { ...numberDef, data_type: 'integer' });
    expect(integer.coverage).toEqual({ total: 8, filled: 7, missing: 1, invalid: 5 });
    expect(integer.numeric).toEqual({ total: -2, average: -1, min: -2, max: 0 });
    expect(computeFieldAnalysis(data, { ...numberDef, data_type: 'float' }).numeric.total).toBe(
      3.75
    );
  });

  it('returns the exact empty API shape and retains all-missing declared fields', () => {
    const defs = analysisFieldDefs(rowsFor([null]), [numberDef]);
    expect(computeFieldAnalysis(rowsFor([null]), defs[0])).toEqual({
      field: 'value',
      data_type: 'number',
      kind: 'numeric',
      coverage: { total: 1, filled: 0, missing: 1, invalid: 0 },
      numeric: null,
      frequencies: [],
      displayFrequencies: [],
      series: [],
      range: null,
      undatedCount: 0,
      comparison: null,
    });
    expect(computeFieldAnalysis(rowsFor(['bad']), numberDef).numeric).toBeNull();
    expect(computeFieldAnalysis(null, numberDef).coverage.total).toBe(0);
  });

  it('computes extrema without spreading large arrays', () => {
    const data = Array.from({ length: 130000 }, (_, index) =>
      entry('A', { value: index % 2 ? -4 : 6 })
    );
    expect(computeFieldAnalysis(data, numberDef).numeric).toEqual({
      total: 130000,
      average: 1,
      min: -4,
      max: 6,
    });
    expect(computeFieldStats(data, [numberDef])[0]).toMatchObject({
      total: 130000,
      avg: 1,
      min: -4,
      max: 6,
    });
  });
});

describe('categories, booleans, multiselects, and safe summaries', () => {
  const options = [
    { id: 'a', label: 'Alpha', value: 'a-value' },
    { id: 'b', label: 'Beta', value: 'b-value' },
  ];

  it('resolves IDs, values, and labels to canonical IDs, retaining unmatched scalar labels', () => {
    const result = computeFieldAnalysis(
      rowsFor([
        'a',
        'Alpha',
        'a-value',
        'b',
        'Beta',
        'b-value',
        'Unlisted',
        0,
        {},
        false,
        [1],
        null,
      ]),
      { ...selectDef, options }
    );
    expect(result.coverage).toEqual({ total: 12, filled: 11, missing: 1, invalid: 3 });
    expect(result.frequencies).toEqual([
      { key: 'a', label: 'Alpha', count: 3 },
      { key: 'b', label: 'Beta', count: 3 },
      { key: '0', label: '0', count: 1 },
      { key: 'Unlisted', label: 'Unlisted', count: 1 },
    ]);
    expect(result.series).toEqual([]);
    expect(result.numeric).toBeNull();
  });

  it('sorts tied labels by canonical key', () => {
    const def = {
      ...selectDef,
      options: [
        { id: 'z', label: 'Same', value: 'a' },
        { id: 'a', label: 'Same', value: 'z' },
      ],
    };
    expect(computeFieldAnalysis(rowsFor(['z', 'a']), def).frequencies).toEqual([
      { key: 'a', label: 'Same', count: 1 },
      { key: 'z', label: 'Same', count: 1 },
    ]);
  });

  it('resolves overlapping option values and IDs according to each stored field type', () => {
    const def = {
      ...selectDef,
      options: [
        { id: 'first', label: 'First option', value: 'second' },
        { id: 'second', label: 'Second option', value: 'elsewhere' },
      ],
    };
    expect(computeFieldAnalysis(rowsFor(['second', 'second']), def).frequencies).toEqual([
      { key: 'first', label: 'First option', count: 2 },
    ]);
    expect(
      computeFieldAnalysis(rowsFor([['second']]), { ...def, data_type: 'multiselect' }).frequencies
    ).toEqual([{ key: 'second', label: 'Second option', count: 1 }]);
  });

  it('preserves meaningful whitespace in persisted option values', () => {
    const result = computeFieldAnalysis(rowsFor([' spaced ', 'spaced']), {
      ...selectDef,
      options: [{ id: 'space', label: 'With spaces', value: ' spaced ' }],
    });
    expect(result.frequencies).toEqual([
      { key: 'space', label: 'With spaces', count: 1 },
      { key: 'spaced', label: 'spaced', count: 1 },
    ]);
  });

  it.each(['custom:Alpha,Beta', 'custom', 'select'])(
    'normalizes %s legacy string options',
    (data_type) => {
      const def = {
        ...selectDef,
        data_type,
        ...(data_type === 'custom:Alpha,Beta' ? {} : { options: ['Alpha', 'Beta'] }),
      };
      const result = computeFieldAnalysis(rowsFor(['Alpha', 'option-1', 'Beta']), def);
      expect(result.data_type).toBe('select');
      expect(frequenciesByKey(result.frequencies)).toEqual({ 'option-1': 2, 'option-2': 1 });
    }
  );

  it('keeps false valid, rejects non-boolean representations, and always includes both boolean axes', () => {
    const def = { ...numberDef, data_type: 'boolean' };
    const result = computeFieldAnalysis(
      rowsFor([false, 0, 'false', true, ' TRUE ', 'yes', {}, ['true'], null, ' ', []]),
      def
    );
    expect(result.coverage).toEqual({ total: 11, filled: 8, missing: 3, invalid: 4 });
    expect(result.frequencies).toEqual([
      { key: 'false', label: 'No', count: 2 },
      { key: 'true', label: 'Yes', count: 2 },
    ]);
    expect(frequenciesByKey(computeFieldAnalysis(rowsFor([true, true]), def).frequencies)).toEqual({
      true: 2,
      false: 0,
    });
    expect(frequenciesByKey(computeFieldAnalysis([], def).frequencies)).toEqual({
      false: 0,
      true: 0,
    });
  });

  it('deduplicates multiselect IDs per entry and rejects whole arrays with any unusable member', () => {
    const data = rowsFor([
      ['a', 'a', 'Alpha', 'a-value'],
      ['a', 'b', 'b'],
      [],
      null,
      ['a', {}],
      ['b', null],
      'a',
      [false],
      [0],
    ]);
    const result = computeFieldAnalysis(data, { ...selectDef, data_type: 'multiselect', options });
    expect(result.coverage).toEqual({ total: 9, filled: 7, missing: 2, invalid: 4 });
    expect(frequenciesByKey(result.frequencies)).toEqual({ a: 2, b: 1, 0: 1 });
    expect(result.frequencies.reduce((sum, item) => sum + item.count, 0)).toBe(4);
    expect(result.series).toEqual([]);
    expect(fieldAnalysisPolicy('multiselect').views).toEqual(['bars']);
  });

  it('preserves literal text rather than interpreting JSON or stringifying objects', () => {
    const result = computeFieldAnalysis(rowsFor(['{"a":1}', 'same', 0, false, {}, ['a'], ' ']), {
      ...numberDef,
      data_type: 'markdown',
    });
    expect(result.coverage).toEqual({ total: 7, filled: 6, missing: 1, invalid: 2 });
    expect(result.frequencies.map((item) => item.label)).toEqual(['0', 'false', 'same', '{"a":1}']);
    expect(result.series).toEqual([]);
  });

  it.each(['file', 'image', 'geolocation', 'entity_link', 'unknown', 'summary'])(
    'summarizes %s without fabricating categories',
    (data_type) => {
      const result = computeFieldAnalysis(rowsFor([{ nested: 1 }, ['a'], 'opaque', null]), {
        ...numberDef,
        data_type,
      });
      expect(result.kind).toBe('summary');
      expect(result.coverage).toEqual({ total: 4, filled: 3, missing: 1, invalid: 0 });
      expect(result.frequencies).toEqual([]);
      expect(result.displayFrequencies).toEqual([]);
      expect(result.series).toEqual([]);
      expect(result.numeric).toBeNull();
    }
  );

  it('caps only above six, preserving totals with collision-safe Other keys and labels', () => {
    const labels = ['Other', 'Other (remaining)', 'C', 'D', 'E', 'F', 'G', 'H'];
    const options = labels.map((label, index) => ({
      id: index ? `id-${index}` : '__other__',
      label,
    }));
    const data = rowsFor(options.flatMap((option, index) => Array(9 - index).fill(option.id)));
    const result = computeFieldAnalysis(data, { ...selectDef, options });
    expect(result.frequencies).toHaveLength(8);
    expect(result.displayFrequencies).toHaveLength(6);
    expect(result.displayFrequencies.slice(0, 5)).toEqual(result.frequencies.slice(0, 5));
    const other = result.displayFrequencies.at(-1);
    expect(other.count).toBe(9);
    expect(
      result.frequencies.some((item) => item.key === other.key || item.label === other.label)
    ).toBe(false);
    expect(result.displayFrequencies.reduce((sum, item) => sum + item.count, 0)).toBe(data.length);
    expect(
      computeFieldAnalysis([...data].reverse(), { ...selectDef, options }).frequencies
    ).toEqual(result.frequencies);
    const six = computeFieldAnalysis(rowsFor(labels.slice(0, 6)), selectDef);
    expect(six.displayFrequencies).toEqual(six.frequencies);
  });
});

describe('UTC daily windows and date analysis', () => {
  it('returns exactly 60 sorted calendar days, keeps the first day, and ignores invalid latest points', () => {
    const series = dailyWindow([
      { bucket: '2026-03-01', value: -2 },
      { bucket: '2025-12-31', value: 500 },
      { bucket: '2026-01-01', value: 1 },
      { bucket: '2030-01-01', value: Infinity },
      { bucket: '2026-02-30', value: 10 },
      { bucket: '2031-01-01', value: NaN },
    ]);
    expect(series).toHaveLength(60);
    expect(series[0]).toEqual({ bucket: '2026-01-01', value: 1 });
    expect(series.at(-1)).toEqual({ bucket: '2026-03-01', value: -2 });
    expect(series[1]).toEqual({ bucket: '2026-01-02', value: 0 });
    expect(series.map((point) => point.bucket)).toEqual(series.map((point) => point.bucket).sort());
    expect(series.reduce((sum, point) => sum + point.value, 0)).toBe(-1);
  });

  it('uses UTC for timestamps, respects null gaps and observed zero, and has no empty-data window', () => {
    const series = dailyWindow([{ bucket: '2026-02-28T23:30:00-02:00', value: 0 }], null);
    expect(series.at(-1)).toEqual({ bucket: '2026-03-01', value: 0 });
    expect(series[0].value).toBeNull();
    expect(dailyWindow([{ bucket: '2026-03-01', value: null }], null).at(-1).value).toBeNull();
    expect(dailyWindow([])).toEqual([]);
    expect(dailyWindow(null)).toEqual([]);
    expect(
      dailyWindow([
        { bucket: 'bad', value: 1 },
        { bucket: '2026-01-01', value: Infinity },
      ])
    ).toEqual([]);
  });

  it.each(['date', 'timestamp'])(
    'counts the actual selected %s, not creation dates',
    (data_type) => {
      const result = computeFieldAnalysis(
        rowsFor([
          '2026-03-01T23:30:00-02:00',
          '2026-03-02T00:30:00Z',
          '2026-03-01T01:00:00+02:00',
          '2026-03-02T01:00',
        ]),
        { ...numberDef, data_type }
      );
      expect(result.series.at(-1)).toEqual({ bucket: '2026-03-02', value: 3 });
      expect(result.series.find((point) => point.bucket === '2026-02-28').value).toBe(1);
      expect(result.series.find((point) => point.bucket === '2026-03-01').value).toBe(0);
      expect(result.numeric).toBeNull();
      expect(result.undatedCount).toBe(0);
    }
  );

  it('rejects impossible calendar dates, invalid timestamps, and non-string dates', () => {
    const bad = [
      '2026-02-29',
      '2024-02-30',
      '2026-04-31',
      '2026-13-01',
      '2026-00-01',
      '2026-01-00',
      '2026-02-30T10:00:00Z',
      '2026-01-01T24:00:00Z',
      '2026-01-01T12:60:00Z',
      '2026-01-01T12:00:60Z',
      '2026-01-01T12:00:00+24:00',
      '2026-01-01T12:00:00+01:99',
      'bad',
      0,
      Infinity,
      false,
      {},
    ];
    const result = computeFieldAnalysis(rowsFor(bad), { ...numberDef, data_type: 'date' });
    expect(result.coverage).toEqual({
      total: bad.length,
      filled: bad.length,
      missing: 0,
      invalid: bad.length,
    });
    expect(result.series).toEqual([]);
    expect(result.range).toBeNull();
    expect(
      computeFieldAnalysis(rowsFor(['2024-02-29']), { ...numberDef, data_type: 'date' }).series.at(
        -1
      ).value
    ).toBe(1);
  });

  it('uses valid primary creation dates for numeric sums, counts, weighted daily averages, and gaps', () => {
    const data = [
      entry('A', { value: 10 }, '2026-01-01'),
      entry('A', { value: -10 }, '2026-01-01'),
      entry('A', { value: 12 }, '2026-03-01'),
      entry('A', { value: 6 }, '2026-03-01'),
      entry('A', { value: 99 }, '2026-02-30'),
      entry('A', { value: 5 }),
      entry('A', { value: 1000 }, '2025-12-31'),
      entry('A', { value: Infinity }, '2030-01-01'),
    ];
    const sum = computeFieldAnalysis(data, numberDef);
    expect(sum.numeric.total).toBe(1122);
    expect(sum.undatedCount).toBe(2);
    expect(sum.range).toEqual({ start: '2026-01-01', end: '2026-03-01' });
    expect(sum.series.at(-1).value).toBe(18);
    const average = computeFieldAnalysis(data, numberDef, { aggregation: 'average' });
    expect(average.series[0].value).toBe(0);
    expect(average.series[1].value).toBeNull();
    expect(average.series.at(-1).value).toBe(9);
    expect(
      computeFieldAnalysis(data, numberDef, { aggregation: 'count' }).series.at(-1).value
    ).toBe(2);
    const undated = computeFieldAnalysis([entry('A', { value: 0 })], numberDef);
    expect(undated.series).toEqual([]);
    expect(undated.undatedCount).toBe(1);
  });
});

describe('comparison matrices', () => {
  it('collapses numeric series using sums and counts, never averages of averages or Other dates', () => {
    const data = ['a', 'b', 'c', 'd', 'e'].flatMap((partner, index) =>
      Array.from({ length: 8 - index }, () => entry('A', { value: -2, partner }, '2026-03-01'))
    );
    data.push(
      ...Array.from({ length: 3 }, () => entry('A', { value: 0, partner: 'f' }, '2026-03-01')),
      entry('A', { value: 100, partner: 'g' }, '2026-03-01')
    );
    const { full, display, excluded } = computeFieldAnalysis(data, numberDef, {
      aggregation: 'average',
      compareDef: partnerDef,
    }).comparison;
    expect(full.rows).toHaveLength(60);
    expect(display.rows).toEqual(full.rows);
    expect(full.columns).toHaveLength(7);
    expect(display.columns).toHaveLength(6);
    expect(matrixCell(full, '2026-03-01', 'f')).toBe(0);
    expect(matrixCell(full, '2026-03-01', 'g')).toBe(100);
    expect(matrixCell(display, '2026-03-01', display.columns.at(-1).key)).toBe(25);
    expect(display.values[0].every((value) => value === null)).toBe(true);
    expect(excluded).toBe(0);
    const sum = computeFieldAnalysis(data, numberDef, { compareDef: partnerDef }).comparison;
    expect(matrixTotal(sum.full)).toBe(40);
    expect(matrixTotal(sum.display)).toBe(40);
    expect(sum.display.values[0].every((value) => value === 0)).toBe(true);
    const count = computeFieldAnalysis(data, numberDef, {
      aggregation: 'count',
      compareDef: partnerDef,
    }).comparison;
    expect(matrixTotal(count.display)).toBe(data.length);
  });

  it('keeps full categorical matrices and independently caps both axes with row-major totals', () => {
    const data = [];
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 7; column++) {
        for (let count = 0; count < (8 - row) * (column + 1); count++) {
          data.push(entry('A', { value: `A${row}`, partner: `B${column}` }));
        }
      }
    }
    const { full, display, excluded } = computeFieldAnalysis(data, selectDef, {
      compareDef: partnerDef,
    }).comparison;
    expect(full.rows).toHaveLength(8);
    expect(full.columns).toHaveLength(7);
    expect(display.rows).toHaveLength(6);
    expect(display.columns).toHaveLength(6);
    expect(full.rows[0]).toEqual({ key: 'A0', label: 'A0' });
    expect(full.columns[0]).toEqual({ key: 'B6', label: 'B6' });
    expect(full.values[0][0]).toBe(56);
    expect(display.values[5][5]).toBe(18);
    expect(matrixTotal(full)).toBe(data.length);
    expect(matrixTotal(display)).toBe(data.length);
    expect(excluded).toBe(0);
  });

  it('keeps Yes/No axes, including empty boolean comparisons, and counts each incomplete pair once', () => {
    const def = { ...numberDef, data_type: 'boolean' };
    const compareDef = { ...partnerDef, data_type: 'boolean' };
    const data = [
      [true, true],
      [false, false],
      [null, true],
      ['bad', false],
      [true, null],
      [false, 'bad'],
    ].map(([value, partner]) => entry('A', { value, partner }));
    const { full, excluded } = computeFieldAnalysis(data, def, { compareDef }).comparison;
    expect(full.rows.map((item) => item.label).sort()).toEqual(['No', 'Yes']);
    expect(full.columns.map((item) => item.label).sort()).toEqual(['No', 'Yes']);
    expect(matrixCell(full, 'true', 'true')).toBe(1);
    expect(matrixCell(full, 'true', 'false')).toBe(0);
    expect(excluded).toBe(4);
    expect(computeFieldAnalysis([], def, { compareDef }).comparison.full.values).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('anchors numeric windows independently of partner validity and separates range from incomplete exclusions', () => {
    const data = [
      entry('A', { value: 9, partner: 'a' }, '2025-12-31'),
      entry('A', { value: 9, partner: null }, '2025-12-31'),
      entry('A', { value: 2, partner: 'a' }, '2026-01-01'),
      entry('A', { value: 4, partner: null }, '2026-03-01'),
      entry('A', { value: Infinity, partner: 'a' }, '2030-01-01'),
      entry('A', { value: 3, partner: 'a' }, 'bad'),
      entry('A', { value: 6, partner: {} }, '2026-01-02'),
      entry('A', { partner: 'a' }, '2026-01-03'),
      entry('A', { value: 0, partner: false }, '2026-01-04'),
    ];
    const result = computeFieldAnalysis(data, numberDef, { compareDef: partnerDef });
    expect(result.range).toEqual({ start: '2026-01-01', end: '2026-03-01' });
    expect(result.comparison.full.rows).toHaveLength(60);
    expect(result.comparison.full.rows.at(-1).key).toBe('2026-03-01');
    expect(result.comparison.excluded).toBe(6);
    expect(matrixCell(result.comparison.full, '2026-01-01', 'a')).toBe(2);
    expect(matrixTotal(result.comparison.full)).toBe(2);
    expect(result.undatedCount).toBe(1);
  });

  it('permits only distinct select/boolean partners and numeric/select/boolean primaries', () => {
    expect(computeFieldAnalysis([], selectDef, { compareDef: selectDef }).comparison).toBeNull();
    for (const data_type of ['number', 'text', 'multiselect', 'date', 'unknown']) {
      expect(
        computeFieldAnalysis([], numberDef, { compareDef: { ...partnerDef, data_type } }).comparison
      ).toBeNull();
    }
    for (const data_type of ['text', 'markdown', 'multiselect', 'date', 'unknown']) {
      expect(
        computeFieldAnalysis([], { ...numberDef, data_type }, { compareDef: partnerDef }).comparison
      ).toBeNull();
    }
    expect(
      computeFieldAnalysis([], numberDef, {
        compareDef: { ...partnerDef, data_type: 'custom:A,B' },
      }).comparison
    ).not.toBeNull();
  });
});

describe('analysis virtual duration', () => {
  it('shares the supplied clock while preserving paused, completed, and legacy timer semantics', () => {
    const start = '2026-01-01T10:00:00Z';
    const now = Date.parse('2026-01-01T12:00:00Z');
    const data = [
      {
        created_at: start,
        started_at: start,
        paused_at: '2026-01-01T10:30:00Z',
        paused_ms: '600000',
      },
      { created_at: start, started_at: start, paused_ms: 600000 },
      {
        created_at: start,
        started_at: start,
        ended_at: '2026-01-01T11:00:00Z',
        paused_ms: 1200000,
      },
      { created_at: start, ended_at: '2026-01-01T11:00:00Z' },
      { created_at: start },
    ];
    const def = analysisFieldDefs(data)[0];
    const result = computeFieldAnalysis(data, def, { now });
    expect(result.coverage).toEqual({ total: 5, filled: 4, missing: 1, invalid: 0 });
    expect(result.numeric.total).toBe(230 * 60000);
    expect(result.series.at(-1).value).toBe(230 * 60000);
    expect(computeFieldAnalysis(data, def, { now: now + 3600000 }).numeric.total).toBe(290 * 60000);
    const paused = computeFieldAnalysis([data[0]], def, { now });
    expect(paused.numeric.total).toBe(20 * 60000);
    expect(computeFieldAnalysis([data[0]], def, { now: now + 3600000 })).toEqual(paused);
  });
});
