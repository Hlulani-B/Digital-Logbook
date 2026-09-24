import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  applyFieldFilters,
  isPinnedEntry,
  matchesTextQuery,
  pinFirst,
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

  it('ignores reserved keys', () => {
    const withReserved = makeEntry('b', { _project_ref: { project_name: 'Secret' } });
    expect(matchesTextQuery(withReserved, 'secret')).toBe(false);
  });
});
