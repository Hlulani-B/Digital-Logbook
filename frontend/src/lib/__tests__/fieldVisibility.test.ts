import { describe, expect, it } from 'vitest';
import { evaluateVisibility, hasCircularVisibility } from '../fieldVisibility';
import type { FieldDefinition, VisibilityConfig } from '../fieldSchema';

const makeField = (field_name: string, visibility?: VisibilityConfig): FieldDefinition => ({
  field_name,
  data_type: 'text',
  is_required: false,
  is_unique: false,
  rules: {},
  has_default: false,
  options: [],
  display_order: 0,
  ...(visibility ? { visibility } : {}),
});

describe('evaluateVisibility', () => {
  it('returns true when no visibility config exists', () => {
    const field = makeField('status');
    expect(evaluateVisibility(field, {})).toBe(true);
  });

  it('returns true when visibility rules are empty', () => {
    const field = makeField('status', { rules: [] });
    expect(evaluateVisibility(field, {})).toBe(true);
  });

  describe('eq operator', () => {
    const field = makeField('details', {
      rules: [{ field: 'status', operator: 'eq', value: 'active' }],
    });

    it('returns true when values match', () => {
      expect(evaluateVisibility(field, { status: 'active' })).toBe(true);
    });

    it('returns false when values do not match', () => {
      expect(evaluateVisibility(field, { status: 'closed' })).toBe(false);
    });
  });

  describe('neq operator', () => {
    const field = makeField('details', {
      rules: [{ field: 'status', operator: 'neq', value: 'closed' }],
    });

    it('returns true when values differ', () => {
      expect(evaluateVisibility(field, { status: 'active' })).toBe(true);
    });

    it('returns false when values match', () => {
      expect(evaluateVisibility(field, { status: 'closed' })).toBe(false);
    });
  });

  describe('in operator', () => {
    const field = makeField('details', {
      rules: [{ field: 'priority', operator: 'in', value: ['high', 'critical'] }],
    });

    it('returns true when value is in the list', () => {
      expect(evaluateVisibility(field, { priority: 'high' })).toBe(true);
    });

    it('returns false when value is not in the list', () => {
      expect(evaluateVisibility(field, { priority: 'low' })).toBe(false);
    });
  });

  describe('not_in operator', () => {
    const field = makeField('details', {
      rules: [{ field: 'priority', operator: 'not_in', value: ['low', 'none'] }],
    });

    it('returns true when value is not in the list', () => {
      expect(evaluateVisibility(field, { priority: 'high' })).toBe(true);
    });

    it('returns false when value is in the list', () => {
      expect(evaluateVisibility(field, { priority: 'low' })).toBe(false);
    });
  });

  describe('exists operator', () => {
    const field = makeField('details', {
      rules: [{ field: 'description', operator: 'exists' }],
    });

    it('returns true when field has a value', () => {
      expect(evaluateVisibility(field, { description: 'some text' })).toBe(true);
    });

    it('returns false when field is null', () => {
      expect(evaluateVisibility(field, { description: null })).toBe(false);
    });

    it('returns false when field is missing', () => {
      expect(evaluateVisibility(field, {})).toBe(false);
    });
  });

  describe('not_exists operator', () => {
    const field = makeField('details', {
      rules: [{ field: 'description', operator: 'not_exists' }],
    });

    it('returns true when field is missing', () => {
      expect(evaluateVisibility(field, {})).toBe(true);
    });

    it('returns false when field has a value', () => {
      expect(evaluateVisibility(field, { description: 'text' })).toBe(false);
    });
  });

  describe('gt/lt/gte/lte operators', () => {
    it('gt: returns true when field > value', () => {
      const f = makeField('x', { rules: [{ field: 'count', operator: 'gt', value: 5 }] });
      expect(evaluateVisibility(f, { count: 10 })).toBe(true);
      expect(evaluateVisibility(f, { count: 5 })).toBe(false);
      expect(evaluateVisibility(f, { count: 3 })).toBe(false);
    });

    it('lt: returns true when field < value', () => {
      const f = makeField('x', { rules: [{ field: 'count', operator: 'lt', value: 5 }] });
      expect(evaluateVisibility(f, { count: 3 })).toBe(true);
      expect(evaluateVisibility(f, { count: 5 })).toBe(false);
    });

    it('gte: returns true when field >= value', () => {
      const f = makeField('x', { rules: [{ field: 'count', operator: 'gte', value: 5 }] });
      expect(evaluateVisibility(f, { count: 5 })).toBe(true);
      expect(evaluateVisibility(f, { count: 4 })).toBe(false);
    });

    it('lte: returns true when field <= value', () => {
      const f = makeField('x', { rules: [{ field: 'count', operator: 'lte', value: 5 }] });
      expect(evaluateVisibility(f, { count: 5 })).toBe(true);
      expect(evaluateVisibility(f, { count: 6 })).toBe(false);
    });

    it('returns false for non-numeric comparisons', () => {
      const f = makeField('x', { rules: [{ field: 'count', operator: 'gt', value: 5 }] });
      expect(evaluateVisibility(f, { count: 'not a number' })).toBe(false);
    });
  });

  describe('AND logic (default)', () => {
    const field = makeField('details', {
      rules: [
        { field: 'status', operator: 'eq', value: 'active' },
        { field: 'priority', operator: 'eq', value: 'high' },
      ],
    });

    it('returns true when all rules match', () => {
      expect(evaluateVisibility(field, { status: 'active', priority: 'high' })).toBe(true);
    });

    it('returns false when only one rule matches', () => {
      expect(evaluateVisibility(field, { status: 'active', priority: 'low' })).toBe(false);
    });
  });

  describe('OR logic', () => {
    const field = makeField('details', {
      rules: [
        { field: 'status', operator: 'eq', value: 'active' },
        { field: 'priority', operator: 'eq', value: 'high' },
      ],
      logic: 'or',
    });

    it('returns true when any rule matches', () => {
      expect(evaluateVisibility(field, { status: 'active', priority: 'low' })).toBe(true);
    });

    it('returns false when no rules match', () => {
      expect(evaluateVisibility(field, { status: 'closed', priority: 'low' })).toBe(false);
    });
  });
});

describe('hasCircularVisibility', () => {
  it('returns false for fields with no visibility rules', () => {
    const fields = [makeField('a'), makeField('b')];
    expect(hasCircularVisibility(fields)).toBe(false);
  });

  it('returns false for acyclic visibility dependencies', () => {
    const fields = [
      makeField('a', { rules: [{ field: 'b', operator: 'eq', value: 'x' }] }),
      makeField('b'),
    ];
    expect(hasCircularVisibility(fields)).toBe(false);
  });

  it('detects direct circular dependency', () => {
    const fields = [
      makeField('a', { rules: [{ field: 'b', operator: 'eq', value: 'x' }] }),
      makeField('b', { rules: [{ field: 'a', operator: 'eq', value: 'y' }] }),
    ];
    expect(hasCircularVisibility(fields)).toBe(true);
  });

  it('detects indirect circular dependency', () => {
    const fields = [
      makeField('a', { rules: [{ field: 'b', operator: 'eq', value: 'x' }] }),
      makeField('b', { rules: [{ field: 'c', operator: 'eq', value: 'y' }] }),
      makeField('c', { rules: [{ field: 'a', operator: 'eq', value: 'z' }] }),
    ];
    expect(hasCircularVisibility(fields)).toBe(true);
  });
});
