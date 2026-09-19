import { describe, expect, it } from 'vitest';
import { checkThresholds } from '../fieldValidation';
import type { FieldDefinition } from '../fieldSchema';

const makeNumericField = (
  field_name: string,
  rules: Record<string, unknown> = {}
): FieldDefinition => ({
  field_name,
  data_type: 'integer',
  is_required: false,
  is_unique: false,
  rules,
  has_default: false,
  options: [],
  display_order: 0,
});

const makeFloatField = (
  field_name: string,
  rules: Record<string, unknown> = {}
): FieldDefinition => ({
  field_name,
  data_type: 'float',
  is_required: false,
  is_unique: false,
  rules,
  has_default: false,
  options: [],
  display_order: 0,
});

const makeDateField = (
  field_name: string,
  rules: Record<string, unknown> = {}
): FieldDefinition => ({
  field_name,
  data_type: 'date',
  is_required: false,
  is_unique: false,
  rules,
  has_default: false,
  options: [],
  display_order: 0,
});

const makeCurrencyField = (
  field_name: string,
  rules: Record<string, unknown> = {}
): FieldDefinition => ({
  field_name,
  data_type: 'currency',
  is_required: false,
  is_unique: false,
  rules,
  has_default: false,
  options: [],
  display_order: 0,
});

describe('checkThresholds', () => {
  it('returns ok when no threshold rules exist', () => {
    const field = makeNumericField('count');
    expect(checkThresholds(field, 42)).toEqual({ level: 'ok' });
  });

  it('returns ok for empty values', () => {
    const field = makeNumericField('count', { warn_min: 0, warn_max: 100 });
    expect(checkThresholds(field, null)).toEqual({ level: 'ok' });
    expect(checkThresholds(field, undefined)).toEqual({ level: 'ok' });
    expect(checkThresholds(field, '')).toEqual({ level: 'ok' });
  });

  it('returns ok for non-threshold field types', () => {
    const textField: FieldDefinition = {
      field_name: 'name',
      data_type: 'text',
      is_required: false,
      is_unique: false,
      rules: { warn_min: 0 },
      has_default: false,
      options: [],
      display_order: 0,
    };
    expect(checkThresholds(textField, 'hello')).toEqual({ level: 'ok' });
  });

  describe('integer/float fields', () => {
    it('returns warning when value is below warn_min', () => {
      const field = makeNumericField('count', { warn_min: 10 });
      const result = checkThresholds(field, 5);
      expect(result.level).toBe('warning');
      expect(result.message).toContain('below warning minimum');
    });

    it('returns warning when value exceeds warn_max', () => {
      const field = makeNumericField('count', { warn_max: 100 });
      const result = checkThresholds(field, 150);
      expect(result.level).toBe('warning');
      expect(result.message).toContain('exceeds warning maximum');
    });

    it('returns alert when value is below alert_min', () => {
      const field = makeNumericField('count', { alert_min: 0 });
      const result = checkThresholds(field, -5);
      expect(result.level).toBe('alert');
      expect(result.message).toContain('below alert minimum');
    });

    it('returns alert when value exceeds alert_max', () => {
      const field = makeNumericField('count', { alert_max: 200 });
      const result = checkThresholds(field, 250);
      expect(result.level).toBe('alert');
      expect(result.message).toContain('exceeds alert maximum');
    });

    it('returns ok when value is within all thresholds', () => {
      const field = makeNumericField('count', {
        warn_min: 10,
        warn_max: 90,
        alert_min: 0,
        alert_max: 100,
      });
      expect(checkThresholds(field, 50).level).toBe('ok');
    });

    it('alert takes priority over warning', () => {
      const field = makeNumericField('count', {
        warn_min: 10,
        alert_min: 5,
      });
      // Value below alert_min should be alert, not warning
      const result = checkThresholds(field, 3);
      expect(result.level).toBe('alert');
    });

    it('works with float fields', () => {
      const field = makeFloatField('temperature', { warn_max: 37.5, alert_max: 39.0 });
      expect(checkThresholds(field, 36.5).level).toBe('ok');
      expect(checkThresholds(field, 38.0).level).toBe('warning');
      expect(checkThresholds(field, 39.5).level).toBe('alert');
    });
  });

  describe('date fields', () => {
    it('returns warning for dates before warn_min', () => {
      const field = makeDateField('deadline', { warn_min: '2025-01-01' });
      const result = checkThresholds(field, '2024-06-15');
      expect(result.level).toBe('warning');
    });

    it('returns ok for dates within range', () => {
      const field = makeDateField('deadline', {
        warn_min: '2025-01-01',
        warn_max: '2025-12-31',
      });
      expect(checkThresholds(field, '2025-06-15').level).toBe('ok');
    });
  });

  describe('currency fields', () => {
    it('returns warning for amounts below warn_min', () => {
      const field = makeCurrencyField('cost', { warn_min: '10.00' });
      const result = checkThresholds(field, { amount: '5.00', currency: 'USD' });
      expect(result.level).toBe('warning');
    });

    it('returns ok for amounts within range', () => {
      const field = makeCurrencyField('cost', {
        warn_min: '10.00',
        warn_max: '100.00',
      });
      expect(checkThresholds(field, { amount: '50.00', currency: 'USD' }).level).toBe('ok');
    });
  });
});
