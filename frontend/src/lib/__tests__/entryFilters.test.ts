import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  activeProjectFilterCount,
  applyFieldFilters,
  applyProjectFilters,
  defaultProjectFilters,
  isPinnedEntry,
  matchesTextQuery,
  pinFirst,
  projectMatchesSearch,
  type FieldFilters,
} from '../entryFilters';

const makeEntry = (
  id: string,
  payload: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) => ({ id, entries: payload, ...extra });

const caloriesFilter = (mode: 'above' | 'below' | 'between', value: string) =>
  ({
    Calories: { mode, value, min: '', max: '' },
  }) as FieldFilters;

describe('applyFieldFilters', () => {
  const entries = [
    makeEntry('a', { Food: 'Pizza', Calories: 900 }),
    makeEntry('b', { Food: 'Salad', Calories: 150 }),
    makeEntry('c', { Food: 'Pasta', Calories: 500 }),
  ];

  it('filters numeric fields above a value', () => {
    const result = applyFieldFilters(entries, caloriesFilter('above', '500'));
    expect(result.map((e) => e.id)).toEqual(['a']);
  });

  it('filters numeric fields below a value', () => {
    const result = applyFieldFilters(entries, caloriesFilter('below', '500'));
    expect(result.map((e) => e.id)).toEqual(['b']);
  });

  it('filters numeric fields between a range (inclusive)', () => {
    const filters = {
      Calories: { mode: 'between', value: '', min: '150', max: '500' },
    } as FieldFilters;
    const result = applyFieldFilters(entries, filters);
    expect(result.map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('treats an empty bound as unbounded', () => {
    const filters = {
      Calories: { mode: 'between', value: '', min: '500', max: '' },
    } as FieldFilters;
    const result = applyFieldFilters(entries, filters);
    expect(result.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('filters text fields by substring, case-insensitively', () => {
    const filters = {
      Food: { mode: 'contains', value: 'piz', min: '', max: '' },
    } as FieldFilters;
    const result = applyFieldFilters(entries, filters);
    expect(result.map((e) => e.id)).toEqual(['a']);
  });

  it('ignores inactive filters and non-numeric values for numeric filters', () => {
    const inactive = {
      Calories: { mode: 'above', value: '', min: '', max: '' },
    } as FieldFilters;
    expect(applyFieldFilters(entries, inactive)).toHaveLength(3);

    const withText = [...entries, makeEntry('d', { Food: 'Soup', Calories: 'many' })];
    expect(applyFieldFilters(withText, caloriesFilter('above', '0')).map((e) => e.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('counts only active filters', () => {
    const filters = {
      Calories: { mode: 'above', value: '500', min: '', max: '' },
      Food: { mode: 'contains', value: '', min: '', max: '' },
    } as FieldFilters;
    expect(activeFilterCount(filters)).toBe(1);
  });
});

describe('pin helpers', () => {
  const pinned = makeEntry('p', { Food: 'Pizza', _pinned: true });
  const normal = makeEntry('n', { Food: 'Salad' });

  it('detects the reserved _pinned key', () => {
    expect(isPinnedEntry(pinned)).toBe(true);
    expect(isPinnedEntry(normal)).toBe(false);
  });

  it('sorts pinned entries first without reordering the rest', () => {
    const result = pinFirst([normal, pinned, makeEntry('n2', { Food: 'Pasta' })]);
    expect(result.map((e) => e.id)).toEqual(['p', 'n', 'n2']);
  });
});

describe('matchesTextQuery', () => {
  const entry = makeEntry(
    'a',
    { Food: 'Pizza', Calories: 900 },
    {
      summary: 'Lunch',
      project_name: 'Food',
    }
  );

  it('matches summary, project name and field values', () => {
    expect(matchesTextQuery(entry, 'lunch')).toBe(true);
    expect(matchesTextQuery(entry, 'food')).toBe(true);
    expect(matchesTextQuery(entry, 'pizza')).toBe(true);
    expect(matchesTextQuery(entry, '900')).toBe(true);
    expect(matchesTextQuery(entry, 'burger')).toBe(false);
  });

  it('matches field names even when no value contains the query', () => {
    const named = makeEntry(
      'c',
      { Ingredients: 'Flour', Notes: 'x' },
      { summary: 'Baking', project_name: 'Kitchen' }
    );
    expect(matchesTextQuery(named, 'ingredients')).toBe(true);
    expect(matchesTextQuery(named, 'ingr')).toBe(true);
    expect(matchesTextQuery(named, 'protein')).toBe(false);
  });

  it('ignores reserved keys', () => {
    const withReserved = makeEntry('b', { _project_ref: { project_name: 'Secret' } });
    expect(matchesTextQuery(withReserved, 'secret')).toBe(false);
    // The reserved key's own name is not searchable either.
    expect(matchesTextQuery(withReserved, 'project_ref')).toBe(false);
  });
});

describe('project filters', () => {
  const rows = [
    { id: 'a', project_name: 'Alpha' },
    { id: 'b', project_name: 'Beta' },
    { id: 'c', project_name: 'Gamma' },
  ];
  const counts = {
    entryCounts: { Alpha: 3, Beta: 1, Gamma: 0 },
    fieldCounts: { Alpha: 2, Beta: 0, Gamma: 4 },
    fieldTypes: { Alpha: ['text', 'integer'], Beta: [], Gamma: ['date'] },
  };

  it('filters by field type', () => {
    const filters = { ...defaultProjectFilters(), fieldType: 'date' };
    expect(applyProjectFilters(rows, filters, counts).map((r) => r.id)).toEqual(['c']);
  });

  it('matches a project when any of its fields uses the type', () => {
    const filters = { ...defaultProjectFilters(), fieldType: 'integer' };
    expect(applyProjectFilters(rows, filters, counts).map((r) => r.id)).toEqual(['a']);
  });

  it('counts the field type among the active filters', () => {
    expect(activeProjectFilterCount({ ...defaultProjectFilters(), fieldType: 'text' })).toBe(1);
  });

  it('combines the field type with the count filters (AND logic)', () => {
    const filters = {
      ...defaultProjectFilters(),
      entryCount: { mode: 'above' as const, value: '0', min: '', max: '' },
      fieldType: 'text',
    };
    expect(applyProjectFilters(rows, filters, counts).map((r) => r.id)).toEqual(['a']);
  });
});

describe('projectMatchesSearch', () => {
  it('matches the project name', () => {
    expect(projectMatchesSearch('Food Log', [], 'food')).toBe(true);
    expect(projectMatchesSearch('Food Log', [], 'steps')).toBe(false);
  });

  it('matches any of the project field names', () => {
    expect(projectMatchesSearch('Food Log', ['Calories', 'Meal type'], 'meal')).toBe(true);
    expect(projectMatchesSearch('Food Log', ['Calories'], 'cal')).toBe(true);
    expect(projectMatchesSearch('Food Log', ['Calories'], 'steps')).toBe(false);
  });

  it('treats an empty query as a match', () => {
    expect(projectMatchesSearch('Food Log', [], '  ')).toBe(true);
  });
});
