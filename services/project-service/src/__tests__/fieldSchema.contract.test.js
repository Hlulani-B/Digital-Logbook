import {
  normalizeField,
  normalizeFields,
  validateFieldDefinitions,
  validateEntryValues,
  canonicalUniqueValue,
} from '../domain/fieldSchema.js';

const field = (data_type, extra = {}) => ({ field_name: 'value', data_type, ...extra });
const validate = (type, value, extra = {}) => validateEntryValues([field(type, extra)], { value });

describe('shared field contract', () => {
  test.each([
    ['text', 'hello'],
    ['markdown', '**hello**'],
    ['integer', 0],
    ['float', -1.25],
    ['number', 2.5],
    ['boolean', false],
    ['date', '2024-02-29'],
    ['timestamp', '2024-03-01T00:30:00+01:00'],
    ['geolocation', { latitude: -90, longitude: 180 }],
    ['currency', { amount: '12345678901234567890.01', currency: 'USD' }],
    ['file', { attachmentId: '00000000-0000-4000-8000-000000000001' }],
    ['image', { attachmentId: '00000000-0000-4000-8000-000000000002' }],
  ])('%s accepts its typed value and required false/zero', (type, value) =>
    expect(validate(type, value, { is_required: true }).valid).toBe(true)
  );

  test.each([
    ['text', 1],
    ['markdown', {}],
    ['integer', 1.2],
    ['integer', Number.MAX_SAFE_INTEGER + 1],
    ['float', Infinity],
    ['number', '2'],
    ['boolean', 'false'],
    ['date', '2023-02-29'],
    ['date', '2024-04-31'],
    ['date', '0000-01-01'],
    ['timestamp', '2024-02-30T00:00:00Z'],
    ['timestamp', '2024-01-01T24:00:00Z'],
    ['timestamp', '2024-01-01T00:00:00'],
    ['timestamp', '2024-01-01T00:00:00+14:30'],
    ['geolocation', { latitude: 91, longitude: 0 }],
    ['currency', { amount: 1.2, currency: 'USD' }],
    ['currency', { amount: '1.001', currency: 'USD' }],
    ['currency', { amount: '1', currency: 'ZZZ' }],
    ['file', { attachmentId: 'bad' }],
    ['image', { attachmentId: 'bad', url: 'public' }],
  ])('%s rejects an invalid value', (type, value) =>
    expect(validate(type, value).valid).toBe(false)
  );

  test.each([null, '', '  ', []])('required rejects empty %j', (value) =>
    expect(validate('text', value, { is_required: true }).errors[0].code).toBe('required')
  );

  test('defaults apply only on absent create keys, unknown keys survive', () => {
    const fields = [field('boolean', { has_default: true, default_value: true })];
    expect(validateEntryValues(fields, { old: 42 }, { applyDefaults: true }).values).toEqual({
      old: 42,
      value: true,
    });
    expect(
      validateEntryValues(fields, { value: false }, { applyDefaults: true }).values.value
    ).toBe(false);
    expect(validateEntryValues(fields, { value: null }, { applyDefaults: true }).values.value).toBe(
      null
    );
    expect(validateEntryValues(fields, {}).values).toEqual({});
    expect(
      normalizeField(field('text', { has_default: false, default_value: null }))
    ).not.toHaveProperty('default_value');
    expect(
      normalizeField(field('text', { has_default: true, default_value: null })).default_value
    ).toBe(null);
  });

  test('legacy options adapt without rewriting stored strings', () => {
    const f = normalizeField(field('custom:Red, Blue,Red'));
    expect(f.data_type).toBe('select');
    expect(f.options.map((o) => o.label)).toEqual(['Red', 'Blue']);
    expect(validateEntryValues([f], { value: 'Blue' }).valid).toBe(true);
    expect(normalizeField(field('custom')).data_type).toBe('select');
    expect(normalizeFields([field('text'), field('number')]).map((f) => f.display_order)).toEqual([
      0, 1,
    ]);
  });

  test('single selection uses values, tags use deduplicated IDs', () => {
    const options = [{ id: 'a', label: 'Alpha', value: 'old-alpha' }];
    expect(validate('select', 'old-alpha', { options }).valid).toBe(true);
    expect(validate('select', 'a', { options }).valid).toBe(false);
    expect(validate('multiselect', ['a', 'a'], { options }).values.value).toEqual(['a']);
    expect(validate('multiselect', ['old-alpha'], { options }).valid).toBe(false);
  });

  test('RE2 full-string matching, unsupported features, and limits', () => {
    expect(validate('text', 'abc', { rules: { pattern: 'b' } }).valid).toBe(false);
    expect(validate('text', 'bbb', { rules: { pattern: 'b+' } }).valid).toBe(true);
    expect(validateFieldDefinitions([field('text', { rules: { pattern: '(?=a)a' } })]).valid).toBe(
      false
    );
    expect(
      validateFieldDefinitions([field('text', { rules: { pattern: 'a'.repeat(513) } })]).valid
    ).toBe(false);
    expect(validate('text', 'a'.repeat(65537), { rules: { pattern: 'a+' } }).errors[0].code).toBe(
      'pattern_length'
    );
    expect(validate('text', 'a'.repeat(65536), { rules: { pattern: '(a+)+' } }).valid).toBe(true);
  });

  test('exact currency canonicalization follows currency fraction digits', () => {
    expect(validate('currency', { amount: '-000.0000', currency: 'usd' }).values.value).toEqual({
      amount: '0.00',
      currency: 'USD',
    });
    expect(validate('currency', { amount: '00012', currency: 'JPY' }).values.value.amount).toBe(
      '12'
    );
    expect(validate('currency', { amount: '1.234', currency: 'KWD' }).valid).toBe(true);
    expect(validate('currency', { amount: '1.1', currency: 'JPY' }).valid).toBe(false);
    const f = field('currency');
    expect(canonicalUniqueValue(f, { amount: '1', currency: 'USD' })).toBe(
      canonicalUniqueValue(f, { amount: '01.00', currency: 'usd' })
    );
    expect(canonicalUniqueValue(f, { amount: '1', currency: 'EUR' })).not.toBe(
      canonicalUniqueValue(f, { amount: '1', currency: 'USD' })
    );
    expect(
      validate(
        'currency',
        { amount: '99999999999999999999.99', currency: 'USD' },
        { rules: { max: '99999999999999999999.98' } }
      ).valid
    ).toBe(false);
  });

  test('scalar uniqueness canonicalizes timestamp and numeric values', () => {
    expect(canonicalUniqueValue(field('timestamp'), '2024-03-01T00:30:00+01:00')).toBe(
      '2024-02-29T23:30:00.000Z'
    );
    expect(canonicalUniqueValue(field('number'), -0)).toBe('0');
    expect(canonicalUniqueValue(field('boolean'), false)).toBe('false');
    expect(canonicalUniqueValue(field('text'), 'A')).not.toBe(
      canonicalUniqueValue(field('text'), 'a')
    );
    expect(canonicalUniqueValue(field('text'), '')).toBeNull();
  });

  test.each([
    field('text', { rules: { min: 1 } }),
    field('number', { rules: { pattern: 'x' } }),
    field('integer', { rules: { min: 0.1 } }),
    field('date', { rules: { min: 'invalid' } }),
    field('text', { rules: { minLength: 2, maxLength: 1 } }),
    field('currency', { rules: { min: '10', max: '2' } }),
    field('file', { has_default: true, default_value: null }),
    field('multiselect', { is_unique: true }),
    field('geolocation', { is_unique: true }),
    field('boolean', { is_required: 'false' }),
    field('text', { has_default: true }),
    field('text', { options: [{}] }),
    field('unsupported'),
  ])('rejects incompatible definition %j', (f) =>
    expect(validateFieldDefinitions([f]).valid).toBe(false)
  );

  test('duplicate names/IDs, unsafe JSON, opaque payloads rejected by structured validator', () => {
    expect(validateFieldDefinitions([field('text'), field('text')]).valid).toBe(false);
    expect(validateEntryValues([], { unknown: NaN }).valid).toBe(false);
    expect(validateEntryValues([], 'legacy').errors[0].code).toBe('payload');
    expect(validateFieldDefinitions([field('text', { field_name: '__proto__' })]).valid).toBe(
      false
    );
  });
});
