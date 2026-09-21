import { describe, it, expect } from 'vitest';
import {
  convertFieldValue,
  buildMigrationPlan,
  applyMigrationToEntry,
  mergeFieldHistory,
} from '../fieldMigration';

describe('convertFieldValue', () => {
  it('returns null for null/undefined input', () => {
    expect(convertFieldValue(null, 'text', 'number')).toBeNull();
    expect(convertFieldValue(undefined, 'text', 'number')).toBeNull();
  });

  it('returns same value for same type', () => {
    expect(convertFieldValue('hello', 'text', 'text')).toBe('hello');
    expect(convertFieldValue(42, 'integer', 'integer')).toBe(42);
  });

  it('converts to text/markdown by stringifying', () => {
    expect(convertFieldValue(42, 'integer', 'text')).toBe('42');
    expect(convertFieldValue(['a', 'b'], 'tags', 'text')).toBe('a, b');
    expect(convertFieldValue({ x: 1 }, 'geolocation', 'markdown')).toBe('{"x":1}');
  });

  it('converts text to numbers', () => {
    expect(convertFieldValue('42', 'text', 'integer')).toBe(42);
    expect(convertFieldValue('3.14', 'text', 'float')).toBeCloseTo(3.14);
    expect(convertFieldValue('not-a-number', 'text', 'integer')).toBeNull();
  });

  it('converts to boolean', () => {
    expect(convertFieldValue('true', 'text', 'boolean')).toBe(true);
    expect(convertFieldValue('false', 'text', 'boolean')).toBe(false);
    expect(convertFieldValue(1, 'integer', 'boolean')).toBe(true);
    expect(convertFieldValue(0, 'integer', 'boolean')).toBe(false);
    expect(convertFieldValue('maybe', 'text', 'boolean')).toBeNull();
  });

  it('converts to tags', () => {
    expect(convertFieldValue('a, b, c', 'text', 'tags')).toEqual(['a', 'b', 'c']);
    expect(convertFieldValue(['x', 'y'], 'tags', 'tags')).toEqual(['x', 'y']);
    expect(convertFieldValue(42, 'integer', 'tags')).toEqual([]);
  });

  it('converts to checklist', () => {
    const result = convertFieldValue('buy milk', 'text', 'checklist');
    expect(result).toEqual([{ id: 'migrated-0', text: 'buy milk', done: false }]);

    const arrResult = convertFieldValue(['task1', 'task2'], 'tags', 'checklist');
    expect(arrResult).toEqual([
      { id: 'migrated-0', text: 'task1', done: false },
      { id: 'migrated-1', text: 'task2', done: false },
    ]);
  });

  it('converts to date', () => {
    expect(convertFieldValue('2026-09-21', 'text', 'date')).toBe('2026-09-21');
    expect(convertFieldValue('not-a-date', 'text', 'date')).toBeNull();
  });
});

describe('buildMigrationPlan', () => {
  const baseField = {
    field_name: 'status',
    data_type: 'text' as const,
    is_required: false,
    is_unique: false,
    rules: {},
    has_default: false,
    options: [],
    display_order: 0,
  };

  it('plans a rename', () => {
    const newField = { ...baseField, field_name: 'state' };
    const plan = buildMigrationPlan(baseField, newField);
    expect(plan.action).toBe('rename');
    expect(plan.old_name).toBe('status');
    expect(plan.new_name).toBe('state');
  });

  it('plans a retype', () => {
    const newField = { ...baseField, data_type: 'tags' as const };
    const plan = buildMigrationPlan(baseField, newField);
    expect(plan.action).toBe('retype');
    expect(plan.old_type).toBe('text');
    expect(plan.new_type).toBe('tags');
  });

  it('plans a drop', () => {
    const plan = buildMigrationPlan(baseField, null);
    expect(plan.action).toBe('drop');
  });

  it('returns no-op for identical fields', () => {
    const plan = buildMigrationPlan(baseField, baseField);
    expect(plan.old_name).toBe('status');
    expect(plan.new_name).toBe('status');
  });
});

describe('applyMigrationToEntry', () => {
  it('renames a field in entry values', () => {
    const entry = { status: 'active', notes: 'test' };
    const migration = {
      field_name: 'status',
      action: 'rename' as const,
      old_name: 'status',
      new_name: 'state',
    };
    const { newValues, archived } = applyMigrationToEntry(entry, migration);
    expect(newValues).toEqual({ state: 'active', notes: 'test' });
    expect(archived).toEqual({ status: 'active' });
  });

  it('retypes a field value', () => {
    const entry = { count: '42' };
    const migration = {
      field_name: 'count',
      action: 'retype' as const,
      old_type: 'text' as const,
      new_type: 'integer' as const,
    };
    const { newValues, archived } = applyMigrationToEntry(entry, migration);
    expect(newValues.count).toBe(42);
    expect(archived['count@text']).toBe('42');
  });

  it('drops a field and archives it', () => {
    const entry = { temp: 'value', keep: 'data' };
    const migration = {
      field_name: 'temp',
      action: 'drop' as const,
    };
    const { newValues, archived } = applyMigrationToEntry(entry, migration);
    expect(newValues).toEqual({ keep: 'data' });
    expect(archived).toEqual({ temp: 'value' });
  });
});

describe('mergeFieldHistory', () => {
  it('creates new history entry', () => {
    const result = mergeFieldHistory(null, { status: 'active' }, '2026-09-21T00:00:00Z');
    expect(result.status).toHaveLength(1);
    expect(result.status[0]).toEqual({ value: 'active', migrated_at: '2026-09-21T00:00:00Z' });
  });

  it('appends to existing history', () => {
    const existing = { status: [{ value: 'old', migrated_at: '2026-01-01T00:00:00Z' }] };
    const result = mergeFieldHistory(existing, { status: 'new' }, '2026-09-21T00:00:00Z');
    expect(result.status).toHaveLength(2);
  });
});
