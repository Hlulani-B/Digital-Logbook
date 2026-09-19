import { RE2JS } from 're2js';

export const FIELD_TYPES = Object.freeze([
  'text',
  'markdown',
  'integer',
  'float',
  'number',
  'date',
  'timestamp',
  'boolean',
  'select',
  'multiselect',
  'geolocation',
  'currency',
  'file',
  'image',
  'entity_link',
]);
export const isRecord = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const isEmptyValue = (value) =>
  value == null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);
const own = (value, key) => Object.hasOwn(value, key);
const error = (field, code, message) => ({ field, code, message });
const numeric = ['integer', 'float', 'number'];
const compound = ['multiselect', 'geolocation', 'file', 'image'];
const currencyCodes = new Set([...Intl.supportedValuesOf('currency'), 'XXX', 'XTS']);

export function normalizeField(input = {}, index = 0) {
  const source = isRecord(input) ? input : {};
  const legacy = typeof source.data_type === 'string' && source.data_type.startsWith('custom:');
  const data_type =
    legacy || source.data_type === 'custom' ? 'select' : (source.data_type ?? 'text');
  let options = source.options ?? [];
  if (legacy && (!Array.isArray(options) || options.length === 0)) {
    options = [
      ...new Set(
        source.data_type
          .slice(7)
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      ),
    ].map((label, i) => ({ id: `legacy-${i}`, label, value: label }));
  }
  const field = {
    ...(source.id !== undefined ? { id: source.id } : {}),
    field_name: source.field_name ?? '',
    data_type,
    is_required: source.is_required ?? false,
    is_unique: source.is_unique ?? false,
    rules: source.rules ?? {},
    has_default: source.has_default ?? false,
    options: Array.isArray(options)
      ? options.map((option) =>
          isRecord(option)
            ? {
                id: option.id,
                label: option.label,
                ...(option.value !== undefined ? { value: option.value } : {}),
                ...(option.parent_id !== undefined ? { parent_id: option.parent_id } : {}),
              }
            : option
        )
      : options,
    display_order: source.display_order ?? index,
    // Visibility Triggers
    ...(isRecord(source.visibility)
      ? {
          visibility: {
            rules: Array.isArray(source.visibility.rules) ? source.visibility.rules : [],
            ...(typeof source.visibility.logic === 'string'
              ? { logic: source.visibility.logic }
              : {}),
          },
        }
      : {}),
  };
  if (field.has_default) field.default_value = source.default_value;
  return field;
}

export function normalizeFields(fields) {
  return Array.isArray(fields) ? fields.map(normalizeField) : [];
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  );
}

export function validTimestamp(value) {
  if (typeof value !== 'string' || value.length > 35) return false;
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
  );
  if (!match || !validDate(match[1]) || +match[2] > 23 || +match[3] > 59 || +match[4] > 59)
    return false;
  if (match[5] !== 'Z') {
    const [hours, minutes] = match[5].slice(1).split(':').map(Number);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

const decimal = (value) =>
  typeof value === 'string' && value.length <= 256 && /^-?\d+(?:\.\d+)?$/.test(value);
export function compareDecimals(left, right) {
  const scale = Math.max((left.split('.')[1] || '').length, (right.split('.')[1] || '').length);
  const integer = (value) => {
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
    return BigInt(`${negative ? '-' : ''}${whole}${fraction.padEnd(scale, '0')}`);
  };
  const a = integer(left),
    b = integer(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonicalCurrency(value) {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !['amount', 'currency'].includes(key)) ||
    !decimal(value.amount) ||
    typeof value.currency !== 'string'
  )
    return null;
  const currency = value.currency.toUpperCase();
  if (!currencyCodes.has(currency)) return null;
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
  const negative = value.amount.startsWith('-');
  let [whole, fraction = ''] = (negative ? value.amount.slice(1) : value.amount).split('.');
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) return null;
  whole = whole.replace(/^0+(?=\d)/, '');
  fraction = fraction.slice(0, digits).padEnd(digits, '0');
  const sign = negative && /[1-9]/.test(whole + fraction) ? '-' : '';
  return { amount: `${sign}${whole}${digits ? '.' + fraction : ''}`, currency };
}

function jsonSafe(value, depth = 0) {
  if (depth > 64) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((v) => jsonSafe(v, depth + 1));
  return isRecord(value) && Object.values(value).every((v) => jsonSafe(v, depth + 1));
}

function validateValue(field, value) {
  const type = field.data_type,
    rules = field.rules || {};
  const errors = [];
  const fail = (code, message) => errors.push(error(field.field_name, code, message));
  if (isEmptyValue(value)) {
    if (field.is_required) fail('required', 'A value is required.');
    return { value, errors };
  }
  let valid = true;
  switch (type) {
    case 'text':
    case 'markdown':
      valid = typeof value === 'string';
      break;
    case 'integer':
      valid = Number.isSafeInteger(value);
      break;
    case 'float':
    case 'number':
      valid = typeof value === 'number' && Number.isFinite(value);
      break;
    case 'boolean':
      valid = typeof value === 'boolean';
      break;
    case 'date':
      valid = validDate(value);
      break;
    case 'timestamp':
      valid = validTimestamp(value);
      if (valid) value = new Date(value).toISOString();
      break;
    case 'select':
      valid =
        typeof value === 'string' && field.options.some((o) => (o.value ?? o.label) === value);
      break;
    case 'multiselect':
      valid =
        Array.isArray(value) &&
        value.every((id) => typeof id === 'string' && field.options.some((o) => o.id === id));
      if (valid) value = [...new Set(value)];
      break;
    case 'geolocation':
      valid =
        isRecord(value) &&
        Object.keys(value).length === 2 &&
        typeof value.latitude === 'number' &&
        typeof value.longitude === 'number' &&
        Number.isFinite(value.latitude) &&
        Number.isFinite(value.longitude) &&
        Math.abs(value.latitude) <= 90 &&
        Math.abs(value.longitude) <= 180;
      break;
    case 'currency': {
      const result = canonicalCurrency(value);
      valid = !!result;
      if (valid) value = result;
      break;
    }
    case 'file':
    case 'image':
      valid =
        isRecord(value) &&
        Object.keys(value).length === 1 &&
        typeof value.attachmentId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.attachmentId);
      break;
    case 'entity_link':
      valid =
        Array.isArray(value) &&
        value.every(
          (id) =>
            typeof id === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        );
      if (valid) value = [...new Set(value)];
      break;
    default:
      valid = false;
  }
  if (!valid) {
    fail('type', `Invalid ${type} value.`);
    return { value, errors };
  }
  if (own(rules, 'minLength') && value.length < rules.minLength)
    fail('minLength', `Minimum length is ${rules.minLength}.`);
  if (own(rules, 'maxLength') && value.length > rules.maxLength)
    fail('maxLength', `Maximum length is ${rules.maxLength}.`);
  for (const bound of ['min', 'max']) {
    if (!own(rules, bound)) continue;
    const compared =
      type === 'currency'
        ? compareDecimals(value.amount, rules[bound])
        : type === 'timestamp'
          ? Math.sign(Date.parse(value) - Date.parse(rules[bound]))
          : value < rules[bound]
            ? -1
            : value > rules[bound]
              ? 1
              : 0;
    if ((bound === 'min' && compared < 0) || (bound === 'max' && compared > 0))
      fail(bound, `Value violates ${bound} ${rules[bound]}.`);
  }
  if (own(rules, 'pattern')) {
    if (value.length > 65536)
      fail('pattern_length', 'Regex-validated values are limited to 65,536 characters.');
    else {
      try {
        if (!RE2JS.compile(rules.pattern).matcher(value).matches())
          fail('pattern', 'Value does not match the required pattern.');
      } catch {
        fail('pattern', 'Unsupported regular expression.');
      }
    }
  }
  return { value, errors };
}

export function validateFieldDefinitions(input) {
  const errors = [];
  if (!Array.isArray(input) || input.length > 200)
    return {
      valid: false,
      fields: [],
      errors: [error('', 'fields', 'Provide an array of at most 200 fields.')],
    };
  const fields = normalizeFields(input),
    names = new Set(),
    ids = new Set();
  fields.forEach((field, index) => {
    const name = typeof field.field_name === 'string' ? field.field_name : '';
    const fail = (code, message) => errors.push(error(name, code, message));
    const start = errors.length;
    if (!isRecord(input[index])) fail('field', 'Field must be an object.');
    if (
      !name.trim() ||
      name.length > 100 ||
      ['__proto__', 'prototype', 'constructor'].includes(name)
    )
      fail('field_name', 'Field names must contain 1–100 characters and not be reserved.');
    if (names.has(name)) fail('duplicate_name', 'Field names must be unique.');
    names.add(name);
    if (field.id !== undefined) {
      if (typeof field.id !== 'string' || !field.id || ids.has(field.id))
        fail('id', 'Field IDs must be nonempty unique strings.');
      ids.add(field.id);
    }
    if (!FIELD_TYPES.includes(field.data_type)) fail('data_type', 'Unsupported field type.');
    for (const key of ['is_required', 'is_unique', 'has_default'])
      if (typeof field[key] !== 'boolean') fail(key, `${key} must be a boolean.`);
    if (!Number.isSafeInteger(field.display_order) || field.display_order < 0)
      fail('display_order', 'Display order must be a nonnegative integer.');
    if (field.is_unique && compound.includes(field.data_type))
      fail('is_unique', 'Uniqueness is supported only for scalar fields and currency.');
    if (!Array.isArray(field.options) || field.options.length > 500)
      fail('options', 'Provide at most 500 options.');
    else {
      if (!['select', 'multiselect'].includes(field.data_type) && field.options.length)
        fail('options', 'Options require a selection field.');
      const optionIds = new Set(),
        values = new Set();
      for (const option of field.options) {
        if (
          !isRecord(option) ||
          typeof option.id !== 'string' ||
          !option.id ||
          option.id.length > 100 ||
          typeof option.label !== 'string' ||
          !option.label.trim() ||
          option.label.length > 500 ||
          (option.value !== undefined &&
            (typeof option.value !== 'string' || !option.value.trim() || option.value.length > 500))
        ) {
          fail('options', 'Each option requires an ID, label, and optional string value.');
          continue;
        }
        if (optionIds.has(option.id) || values.has(option.value ?? option.label))
          fail('options', 'Option IDs and stored values must be unique.');
        optionIds.add(option.id);
        values.add(option.value ?? option.label);
      }
      // Dynamic Taxonomy: Validate parent_id references
      for (const option of field.options) {
        if (option.parent_id !== undefined) {
          if (typeof option.parent_id !== 'string' || !option.parent_id.trim()) {
            fail('options', 'parent_id must be a nonempty string.');
          } else if (!optionIds.has(option.parent_id)) {
            fail('options', `parent_id "${option.parent_id}" does not reference a valid option.`);
          } else if (option.parent_id === option.id) {
            fail('options', 'Option cannot be its own parent.');
          }
        }
      }
      // Check for circular parent references
      const optionMap = new Map(field.options.map((o) => [o.id, o]));
      for (const option of field.options) {
        const visited = new Set();
        let current = option.parent_id;
        while (current) {
          if (visited.has(current)) {
            fail('options', `Circular parent reference detected involving "${current}".`);
            break;
          }
          visited.add(current);
          current = optionMap.get(current)?.parent_id;
        }
      }
    }
    if (!isRecord(field.rules)) fail('rules', 'Rules must be an object.');
    else {
      const type = field.data_type;
      for (const [key, value] of Object.entries(field.rules)) {
        if (['minLength', 'maxLength'].includes(key)) {
          if (
            !['text', 'markdown', 'multiselect'].includes(type) ||
            !Number.isSafeInteger(value) ||
            value < 0
          )
            fail(key, 'Length bounds require text or tags and nonnegative integers.');
        } else if (['min', 'max'].includes(key)) {
          const ok = numeric.includes(type)
            ? typeof value === 'number' &&
              Number.isFinite(value) &&
              (type !== 'integer' || Number.isSafeInteger(value))
            : type === 'date'
              ? validDate(value)
              : type === 'timestamp'
                ? validTimestamp(value)
                : type === 'currency'
                  ? decimal(value)
                  : false;
          if (!ok) fail(key, `Invalid bound for ${type}.`);
        } else if (key === 'pattern') {
          if (
            !['text', 'markdown'].includes(type) ||
            typeof value !== 'string' ||
            value.length > 512
          )
            fail('pattern', 'Text patterns are limited to 512 characters.');
          else {
            try {
              RE2JS.compile(value);
            } catch {
              fail('pattern', 'Unsupported regular expression.');
            }
          }
        } else if (['warn_min', 'warn_max', 'alert_min', 'alert_max'].includes(key)) {
          const ok = numeric.includes(type)
            ? typeof value === 'number' &&
              Number.isFinite(value) &&
              (type !== 'integer' || Number.isSafeInteger(value))
            : type === 'date'
              ? validDate(value)
              : type === 'timestamp'
                ? validTimestamp(value)
                : type === 'currency'
                  ? decimal(value)
                  : false;
          if (!ok) fail(key, `Invalid ${key} threshold for ${type}.`);
        } else fail('rules', `Unknown rule: ${key}.`);
      }
      if (errors.length === start) {
        for (const [min, max] of [
          ['min', 'max'],
          ['minLength', 'maxLength'],
        ]) {
          if (own(field.rules, min) && own(field.rules, max)) {
            const a = field.rules[min],
              b = field.rules[max];
            const reversed =
              type === 'currency' && min === 'min'
                ? compareDecimals(a, b) > 0
                : type === 'timestamp' && min === 'min'
                  ? Date.parse(a) > Date.parse(b)
                  : a > b;
            if (reversed) fail('bounds', 'Minimum cannot exceed maximum.');
          }
        }
      }
    }
    // Visibility Triggers: Validate visibility rules
    if (field.visibility) {
      if (!isRecord(field.visibility)) {
        fail('visibility', 'Visibility must be an object.');
      } else {
        if (!Array.isArray(field.visibility.rules)) {
          fail('visibility', 'Visibility rules must be an array.');
        } else {
          const validOperators = [
            'eq',
            'neq',
            'in',
            'not_in',
            'exists',
            'not_exists',
            'gt',
            'lt',
            'gte',
            'lte',
          ];
          for (const rule of field.visibility.rules) {
            if (!isRecord(rule)) {
              fail('visibility', 'Each visibility rule must be an object.');
            } else {
              if (typeof rule.field !== 'string' || !rule.field.trim()) {
                fail('visibility', 'Visibility rule must specify a field name.');
              }
              if (typeof rule.operator !== 'string' || !validOperators.includes(rule.operator)) {
                fail('visibility', `Invalid visibility operator: ${rule.operator}`);
              }
              if (
                rule.operator !== 'exists' &&
                rule.operator !== 'not_exists' &&
                rule.value === undefined
              ) {
                fail(
                  'visibility',
                  `Visibility rule with operator "${rule.operator}" requires a value.`
                );
              }
            }
          }
        }
        if (
          field.visibility.logic !== undefined &&
          field.visibility.logic !== 'and' &&
          field.visibility.logic !== 'or'
        ) {
          fail('visibility', 'Visibility logic must be "and" or "or".');
        }
      }
    }
    if (field.has_default) {
      if (['file', 'image'].includes(field.data_type))
        fail('default', 'Attachment defaults are not permitted.');
      else if (!own(input[index], 'default_value') || !jsonSafe(field.default_value))
        fail('default', 'A JSON default value is required.');
      else if (errors.length === start) {
        const checked = validateValue(field, field.default_value);
        errors.push(...checked.errors);
        field.default_value = checked.value;
      }
    }
  });
  return { valid: errors.length === 0, fields, errors };
}

export function validateEntryValues(fields, payload, { applyDefaults = false } = {}) {
  const schema = validateFieldDefinitions(fields);
  if (!schema.valid) return { valid: false, values: payload, errors: schema.errors };
  if (!isRecord(payload) || !jsonSafe(payload))
    return {
      valid: false,
      values: payload,
      errors: [
        error('', 'payload', 'Structured entries must be JSON objects containing finite values.'),
      ],
    };
  const values = { ...payload },
    errors = [];
  for (const field of schema.fields) {
    const name = field.field_name;
    if (!own(values, name) && applyDefaults && field.has_default)
      values[name] = structuredClone(field.default_value);
    const checked = validateValue(field, values[name]);
    errors.push(...checked.errors);
    if (own(values, name)) values[name] = checked.value;
  }
  return { valid: errors.length === 0, values, errors };
}

export function canonicalUniqueValue(input, value) {
  const field = normalizeField(input);
  if (isEmptyValue(value) || compound.includes(field.data_type)) return null;
  if (field.data_type === 'currency') {
    const result = canonicalCurrency(value);
    return result ? JSON.stringify([result.currency, result.amount]) : null;
  }
  if (field.data_type === 'timestamp')
    return validTimestamp(value) ? new Date(value).toISOString() : null;
  if (numeric.includes(field.data_type))
    return typeof value === 'number' && Number.isFinite(value)
      ? String(Object.is(value, -0) ? 0 : value)
      : null;
  return ['string', 'boolean'].includes(typeof value) ? JSON.stringify(value) : null;
}
