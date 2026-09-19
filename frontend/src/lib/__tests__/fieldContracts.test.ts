import { describe, expect, it } from 'vitest';
import { normalizeField, normalizeFields } from '../fieldSchema';
import type { FieldType } from '../fieldSchema';
import {
  canonicalUniqueValue,
  currencyFractionDigits,
  normalizeDecimal,
  validateEntryValues,
  validateFieldDefinitions,
} from '../fieldValidation';

const field = (data_type: FieldType = 'text', extra = {}) =>
  normalizeField({
    field_name: 'Value',
    data_type,
    ...extra,
  });
const check = (type: FieldType, value: unknown, extra = {}) =>
  validateEntryValues([field(type, extra)], { Value: value });

describe('field normalization and definitions', () => {
  it('normalizes legacy CSV options without changing persisted strings', () => {
    const normalized = normalizeField({
      field_name: 'Status',
      data_type: 'custom: Open,Closed',
      extension: { keep: true },
    });
    expect(normalized.data_type).toBe('select');
    expect(normalized.options.map((option) => option.label)).toEqual(['Open', 'Closed']);
    expect(normalized.extension).toEqual({ keep: true });
    expect(normalizeField({ data_type: 'custom', options: ['Yes'] }).data_type).toBe('select');
    expect(normalizeFields([{}, {}]).map((item) => item.display_order)).toEqual([0, 1]);
  });
  it('keeps explicit no-default and JSON null distinct', () => {
    expect(normalizeField({ default_value: null }).has_default).toBe(false);
    expect(normalizeField({ has_default: true, default_value: null }).has_default).toBe(true);
    expect(normalizeField({ has_default: false, default_value: 'old' }).has_default).toBe(false);
  });
  it.each([
    { field_name: '' },
    { data_type: 'mystery' },
    { display_order: -1 },
    { is_required: 'true' },
    { rules: [] },
    { options: 'no' },
    { rules: { minLength: -1 } },
    { rules: { minLength: 3, maxLength: 2 } },
    { rules: { pattern: '(?=x)x' } },
    { rules: { pattern: '(a)\\1' } },
    { rules: { pattern: 'x'.repeat(513) } },
    { has_default: true },
  ])('rejects invalid schema %j', (extra) => {
    expect(
      validateFieldDefinitions([{ field_name: 'Value', data_type: 'text', ...extra }]).valid
    ).toBe(false);
  });
  it('rejects duplicate names, IDs and select values', () => {
    expect(
      validateFieldDefinitions([field(), field()]).errors.some(
        (error) => error.code === 'duplicate_name'
      )
    ).toBe(true);
    expect(
      validateFieldDefinitions([
        field('text', { id: 'same' }),
        field('text', { id: 'same', field_name: 'Other' }),
      ]).valid
    ).toBe(false);
    expect(
      validateFieldDefinitions([
        field('select', {
          options: [
            { id: 'a', label: 'A', value: 'same' },
            { id: 'b', label: 'B', value: 'same' },
          ],
        }),
      ]).valid
    ).toBe(false);
  });
  it.each(['multiselect', 'geolocation', 'file', 'image'] as FieldType[])(
    'rejects compound uniqueness for %s',
    (type) => {
      expect(validateFieldDefinitions([field(type, { is_unique: true })]).valid).toBe(false);
    }
  );
  it.each(['file', 'image'] as FieldType[])('rejects attachment defaults for %s', (type) => {
    expect(
      validateFieldDefinitions([
        field(type, { has_default: true, default_value: { attachmentId: 'x' } }),
      ]).valid
    ).toBe(false);
  });
  it('rejects incompatible rules and reversed bounds', () => {
    expect(
      validateFieldDefinitions([field('boolean', { rules: { pattern: 'true', min: 0 } })]).valid
    ).toBe(false);
    expect(validateFieldDefinitions([field('integer', { rules: { min: 1.5 } })]).valid).toBe(false);
    expect(
      validateFieldDefinitions([field('currency', { rules: { min: '10.2', max: '10.1' } })]).valid
    ).toBe(false);
    expect(validateFieldDefinitions([field('date', { rules: { min: '2024-02-30' } })]).valid).toBe(
      false
    );
  });
});

describe('typed values', () => {
  it.each([
    ['text', 'hello'],
    ['markdown', '**hello**'],
    ['integer', 0],
    ['float', -1.5],
    ['number', 2.25],
    ['boolean', false],
    ['date', '2024-02-29'],
    ['timestamp', '2024-02-29T23:30:00-02:00'],
    ['geolocation', { latitude: -90, longitude: 180 }],
    ['file', { attachmentId: 'private-id' }],
    ['image', { attachmentId: 'private-image-id' }],
    ['currency', { amount: '0', currency: 'USD' }],
  ] as [FieldType, unknown][])('accepts %s %j', (type, value) => {
    expect(check(type, value, { is_required: true }).valid).toBe(true);
  });
  it.each([
    ['text', 1],
    ['markdown', {}],
    ['integer', 1.5],
    ['integer', Number.MAX_SAFE_INTEGER + 1],
    ['float', Infinity],
    ['float', NaN],
    ['float', 1e30],
    ['number', '2'],
    ['boolean', 'false'],
    ['date', '2023-02-29'],
    ['date', '2024-04-31'],
    ['date', '0000-01-01'],
    ['timestamp', '2024-02-30T00:00:00Z'],
    ['timestamp', '2024-01-01T24:00:00Z'],
    ['timestamp', '2024-01-01T00:00:00'],
    ['timestamp', '2024-01-01T00:00:00+24:00'],
    ['geolocation', { latitude: 91, longitude: 0 }],
    ['geolocation', { latitude: '0', longitude: 0 }],
    ['file', { attachmentId: 'x', url: 'https://public.example' }],
    ['image', 'https://public.example'],
    ['currency', { amount: 1.23, currency: 'USD' }],
    ['currency', { amount: '1.234', currency: 'USD' }],
    ['currency', { amount: '1.5', currency: 'JPY' }],
    ['currency', { amount: '1', currency: 'ZZZ' }],
    ['currency', { amount: 'NaN', currency: 'USD' }],
    ['currency', { amount: '1e2', currency: 'USD' }],
  ] as [FieldType, unknown][])('rejects %s %j', (type, value) => {
    expect(check(type, value).valid).toBe(false);
  });
  it('uses persisted strings for single selection and deduplicated IDs for tags', () => {
    const options = [
      { id: 'id-a', label: 'Alpha', value: 'legacy' },
      { id: 'id-b', label: 'Beta' },
    ];
    expect(check('select', 'legacy', { options }).valid).toBe(true);
    expect(check('select', 'Beta', { options }).valid).toBe(true);
    expect(check('select', 'id-a', { options }).valid).toBe(false);
    expect(check('multiselect', ['id-a', 'id-a'], { options }).values).toEqual({ Value: ['id-a'] });
    expect(check('multiselect', ['legacy'], { options }).valid).toBe(false);
  });
  it('normalizes timestamps and exact currency without numeric rounding', () => {
    expect(check('timestamp', '2024-02-29T23:30:00-02:00').values).toEqual({
      Value: '2024-03-01T01:30:00.000Z',
    });
    expect(check('currency', { amount: '009007199254740993.01', currency: 'USD' }).values).toEqual({
      Value: { amount: '9007199254740993.01', currency: 'USD' },
    });
    expect(check('currency', { amount: '-0', currency: 'KWD' }).values).toEqual({
      Value: { amount: '0.000', currency: 'KWD' },
    });
    expect(currencyFractionDigits('JPY')).toBe(0);
    expect(currencyFractionDigits('ZZZ')).toBeNull();
    expect(normalizeDecimal('001.2300')).toBe('1.23');
  });
});

describe('rules, defaults, preservation and scalar keys', () => {
  it.each([null, '', undefined, []])('required rejects empty %j', (value) => {
    expect(
      check('text', value, { is_required: true }).errors.some((error) => error.code === 'required')
    ).toBe(true);
  });
  it('applies defaults only to absent keys on explicit creation', () => {
    const fields = [field('integer', { has_default: true, default_value: 7 })];
    expect(validateEntryValues(fields, {}).values).toEqual({});
    expect(validateEntryValues(fields, {}, { applyDefaults: true }).values).toEqual({ Value: 7 });
    for (const value of [0, null, '', undefined])
      expect(validateEntryValues(fields, { Value: value }, { applyDefaults: true }).values).toEqual(
        { Value: value }
      );
  });
  it('does not mutate schemas, compound defaults, or unknown entry keys', () => {
    const fields = [
      field('geolocation', { has_default: true, default_value: { latitude: 1, longitude: 2 } }),
    ];
    const payload = { Removed: '{"not":"parsed"}' };
    const result = validateEntryValues(fields, payload, { applyDefaults: true });
    expect(result.values).toEqual({
      Removed: payload.Removed,
      Value: { latitude: 1, longitude: 2 },
    });
    expect((result.values as Record<string, unknown>).Value).not.toBe(fields[0].default_value);
    expect(payload).toEqual({ Removed: '{"not":"parsed"}' });
  });
  it('preserves opaque payloads but refuses implicit structured conversion', () => {
    for (const payload of ['historical content', '{"Value":"old"}', ['old']]) {
      const result = validateEntryValues([field()], payload);
      expect(result.values).toBe(payload);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('payload');
    }
  });
  it('handles a prototype-looking field name as an own data property', () => {
    const result = validateEntryValues(
      [field('text', { field_name: '__proto__', has_default: true, default_value: 'safe' })],
      {},
      { applyDefaults: true }
    );
    expect(Object.getPrototypeOf(result.values)).toBe(Object.prototype);
    expect(Object.hasOwn(result.values as object, '__proto__')).toBe(true);
  });
  it('enforces whole-string RE2 matching and bounded input, including nested quantifiers', () => {
    expect(check('text', 'abc', { rules: { pattern: 'b' } }).valid).toBe(false);
    expect(check('text', 'aaa', { rules: { pattern: '(a+)+' } }).valid).toBe(true);
    expect(check('text', 'a'.repeat(65536), { rules: { pattern: 'a+' } }).valid).toBe(true);
    expect(
      check('text', 'a'.repeat(65537), { rules: { pattern: 'a+' } }).errors.some(
        (error) => error.code === 'pattern_input_length'
      )
    ).toBe(true);
    expect(check('text', 'aaa', { rules: { minLength: 4 } }).valid).toBe(false);
    expect(check('markdown', 'aaa', { rules: { maxLength: 2 } }).valid).toBe(false);
  });
  it('validates numeric, date, timestamp, and exact currency bounds', () => {
    expect(check('integer', 0, { rules: { min: 0, max: 1 } }).valid).toBe(true);
    expect(check('float', 1.1, { rules: { max: 1 } }).valid).toBe(false);
    expect(check('date', '2024-01-01', { rules: { min: '2024-01-02' } }).valid).toBe(false);
    expect(
      check('timestamp', '2024-01-01T00:00:00Z', { rules: { max: '2023-12-31T23:59:59Z' } }).valid
    ).toBe(false);
    expect(
      check(
        'currency',
        { amount: '9007199254740993.02', currency: 'USD' },
        { rules: { max: '9007199254740993.01' } }
      ).valid
    ).toBe(false);
    expect(
      check('currency', { amount: '-0.02', currency: 'USD' }, { rules: { min: '-0.01' } }).valid
    ).toBe(false);
  });
  it('canonicalizes scalar uniqueness only without case folding', () => {
    expect(canonicalUniqueValue(field('integer'), -0)).toBe(
      canonicalUniqueValue(field('float'), 0)
    );
    expect(canonicalUniqueValue(field('text'), 'A')).not.toBe(
      canonicalUniqueValue(field('text'), 'a')
    );
    expect(canonicalUniqueValue(field('boolean'), false)).not.toBeNull();
    expect(canonicalUniqueValue(field('text'), '')).toBeNull();
    expect(canonicalUniqueValue(field('integer'), NaN)).toBeNull();
    expect(canonicalUniqueValue(field('geolocation'), { latitude: 0, longitude: 0 })).toBeNull();
    expect(canonicalUniqueValue(field('timestamp'), '2024-01-01T01:00:00+01:00')).toBe(
      canonicalUniqueValue(field('timestamp'), '2024-01-01T00:00:00Z')
    );
    const usd = canonicalUniqueValue(field('currency'), { amount: '01.0', currency: 'USD' });
    expect(usd).toBe(canonicalUniqueValue(field('currency'), { amount: '1.00', currency: 'USD' }));
    expect(usd).not.toBe(
      canonicalUniqueValue(field('currency'), { amount: '1.00', currency: 'EUR' })
    );
  });
});
