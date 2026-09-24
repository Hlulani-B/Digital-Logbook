import { RE2JS } from 're2js';
import {
  FIELD_TYPES,
  hasOwn,
  isRecord,
  isNumericField,
  isTextField,
  normalizeField,
  normalizeFields,
  supportsDefault,
  supportsUnique,
} from './fieldSchema';
import type { FieldDefinition, FieldError } from './fieldSchema';
import type { AlertLevel } from './fieldVisibility';
export type { FieldError } from './fieldSchema';
export type { AlertLevel } from './fieldVisibility';

export const MAX_PATTERN_LENGTH = 512;
export const MAX_PATTERN_INPUT_LENGTH = 65_536;
const currencyIntl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
export const CURRENCY_CODES: readonly string[] =
  currencyIntl.supportedValuesOf?.('currency') ??
  'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW'.split(
    ' '
  );
const currencySet = new Set(CURRENCY_CODES);

export function currencyFractionDigits(code: string): number | null {
  if (!currencySet.has(code)) return null;
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

// These fixed lexical expressions never contain user-supplied patterns.
export function normalizeDecimal(amount: unknown, digits?: number): string | null {
  if (typeof amount !== 'string' || amount.length > 1024 || !/^-?\d+(?:\.\d+)?$/.test(amount))
    return null;
  const negative = amount.startsWith('-');
  const [whole, fraction = ''] = (negative ? amount.slice(1) : amount).split('.');
  if (digits !== undefined && fraction.length > digits) return null;
  const integer = whole.replace(/^0+(?=\d)/, '');
  const decimals =
    digits === undefined ? fraction.replace(/0+$/, '') : fraction.padEnd(digits, '0');
  const zero = integer === '0' && !/[1-9]/.test(decimals);
  return `${negative && !zero ? '-' : ''}${integer}${decimals ? `.${decimals}` : ''}`;
}

function compareDecimals(left: string, right: string): number {
  const scale = Math.max(left.split('.')[1]?.length ?? 0, right.split('.')[1]?.length ?? 0);
  const scaled = (value: string) => {
    const [integer, fraction = ''] = value.split('.');
    return BigInt(`${integer}${fraction.padEnd(scale, '0')}`);
  };
  const a = scaled(left),
    b = scaled(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export function normalizeTimestamp(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return null;
  if (!isCalendarDate(value.slice(0, 10))) return null;
  if (+value.slice(11, 13) > 23 || +value.slice(14, 16) > 59 || +value.slice(17, 19) > 59)
    return null;
  const offset = value.endsWith('Z') ? null : value.slice(-6);
  if (offset && (+offset.slice(1, 3) > 23 || +offset.slice(4) > 59)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const result = new Date(time).toISOString();
  return result.length === 24 && +result.slice(0, 4) > 0 ? result : null;
}

export const isEmptyFieldValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);
const safeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;

function patternError(pattern: unknown): string | null {
  if (typeof pattern !== 'string') return 'Pattern must be a string.';
  if (pattern.length > MAX_PATTERN_LENGTH)
    return `Pattern must be at most ${MAX_PATTERN_LENGTH} characters.`;
  try {
    RE2JS.compile(pattern);
    return null;
  } catch {
    return 'Pattern is invalid or uses an expression unsupported by RE2.';
  }
}

function validateValue(
  field: FieldDefinition,
  value: unknown
): { value: unknown; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const fail = (code: string, message: string) =>
    errors.push({ field: field.field_name, code, message });
  if (isEmptyFieldValue(value)) {
    if (field.is_required) fail('required', `${field.field_name} is required.`);
    return { value, errors };
  }
  let result = value;
  switch (field.data_type) {
    case 'text':
    case 'markdown':
      if (typeof value !== 'string') fail('type', 'Enter text.');
      break;
    case 'integer':
      if (!safeNumber(value) || !Number.isSafeInteger(value))
        fail('type', 'Enter a safe whole number.');
      break;
    case 'float':
    case 'number':
      if (!safeNumber(value)) fail('type', 'Enter a finite number within the safe numeric range.');
      break;
    case 'boolean':
      if (typeof value !== 'boolean') fail('type', 'Choose true or false.');
      break;
    case 'date':
      if (!isCalendarDate(value)) fail('type', 'Enter a valid date in YYYY-MM-DD format.');
      break;
    case 'timestamp': {
      const timestamp = normalizeTimestamp(value);
      if (timestamp === null) fail('type', 'Enter a valid timestamp with a time zone.');
      else result = timestamp;
      break;
    }
    case 'geolocation':
      if (
        !isRecord(value) ||
        !safeNumber(value.latitude) ||
        !safeNumber(value.longitude) ||
        Math.abs(value.latitude) > 90 ||
        Math.abs(value.longitude) > 180
      )
        fail('type', 'Enter latitude from -90 to 90 and longitude from -180 to 180.');
      break;
    case 'currency': {
      const digits =
        isRecord(value) && typeof value.currency === 'string'
          ? currencyFractionDigits(value.currency)
          : null;
      const amount =
        isRecord(value) && digits !== null ? normalizeDecimal(value.amount, digits) : null;
      if (amount === null || !isRecord(value))
        fail('type', 'Enter an exact decimal amount with a valid currency and fraction digits.');
      else result = { ...value, amount };
      break;
    }
    case 'file':
    case 'image':
      if (
        !isRecord(value) ||
        typeof value.attachmentId !== 'string' ||
        !value.attachmentId.trim() ||
        Object.keys(value).some((key) => key !== 'attachmentId')
      )
        fail('type', 'Choose a private attachment; only its attachment ID may be stored.');
      break;
    case 'entity_link':
      if (
        !Array.isArray(value) ||
        !value.every(
          (id) =>
            typeof id === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        )
      )
        fail('type', 'Entity links must be an array of valid entry IDs.');
      else result = [...new Set(value)];
      break;
    case 'tags':
      if (!Array.isArray(value) || !value.every((t) => typeof t === 'string' && t.trim()))
        fail('type', 'Tags must be an array of non-empty strings.');
      else result = [...new Set(value.map((t: string) => t.trim()))];
      break;
    case 'custom':
    case 'select': // Legacy alias
      if (
        typeof value !== 'string' ||
        !field.options.some((option) => (option.value ?? option.label) === value)
      )
        fail('option', 'Choose an available option.');
      break;
    case 'checklist': {
      if (!Array.isArray(value)) {
        fail('type', 'Checklist must be an array of items.');
      } else {
        const valid = value.every(
          (item) =>
            isRecord(item) &&
            typeof item.text === 'string' &&
            item.text.trim() &&
            typeof item.done === 'boolean'
        );
        if (!valid) fail('type', 'Each checklist item must have text (string) and done (boolean).');
        else
          result = value.map((item) => ({
            text: item.text.trim(),
            done: item.done,
            id: item.id || crypto.randomUUID(),
          }));
      }
      break;
    }
    case 'computed':
      // Computed fields are read-only; value is set by the computation engine
      break;
    default:
      fail('type', 'Unsupported field type.');
  }
  if (errors.length) return { value, errors };
  const rules = field.rules;
  if (typeof result === 'string' && isTextField(field.data_type)) {
    if (rules.minLength !== undefined && result.length < rules.minLength)
      fail('minLength', `Use at least ${rules.minLength} characters.`);
    if (rules.maxLength !== undefined && result.length > rules.maxLength)
      fail('maxLength', `Use at most ${rules.maxLength} characters.`);
    if (rules.pattern !== undefined) {
      const invalidPattern = patternError(rules.pattern);
      if (invalidPattern) fail('pattern', invalidPattern);
      else if (result.length > MAX_PATTERN_INPUT_LENGTH)
        fail(
          'pattern_input_length',
          `Pattern-validated text must be at most ${MAX_PATTERN_INPUT_LENGTH} characters.`
        );
      else if (!RE2JS.compile(rules.pattern).matches(result))
        fail('pattern', 'Value must match the entire pattern.');
    }
  }
  for (const bound of ['min', 'max'] as const) {
    if (rules[bound] === undefined) continue;
    let comparison: number | undefined;
    if (safeNumber(result) && isNumericField(field.data_type) && safeNumber(rules[bound]))
      comparison = result - Number(rules[bound]);
    else if (field.data_type === 'currency' && isRecord(result)) {
      const limit = normalizeDecimal(rules[bound]);
      if (limit !== null) comparison = compareDecimals(result.amount as string, limit);
    } else if (
      field.data_type === 'date' &&
      typeof result === 'string' &&
      isCalendarDate(rules[bound])
    ) {
      comparison = result.localeCompare(String(rules[bound]));
    } else if (field.data_type === 'timestamp' && typeof result === 'string') {
      const limit = normalizeTimestamp(rules[bound]);
      if (limit !== null) comparison = Date.parse(result) - Date.parse(limit);
    }
    if (comparison !== undefined && (bound === 'min' ? comparison < 0 : comparison > 0))
      fail(bound, `Value must be ${bound === 'min' ? 'at least' : 'at most'} ${rules[bound]}.`);
  }
  return { value: result, errors };
}

export function validateFieldDefinitions(input: unknown): {
  valid: boolean;
  fields: FieldDefinition[];
  errors: FieldError[];
} {
  const fields = normalizeFields(input);
  const errors: FieldError[] = [];
  if (!Array.isArray(input))
    errors.push({ field: '', code: 'schema', message: 'Fields must be an array.' });
  const names = new Set<string>(),
    ids = new Set<string>();
  fields.forEach((field, index) => {
    const fail = (code: string, message: string) =>
      errors.push({ field: field.field_name || String(index), code, message });
    const raw = Array.isArray(input) ? input[index] : undefined;
    if (!isRecord(raw)) fail('schema', 'Field must be an object.');
    if (!field.field_name.trim()) fail('field_name', 'Field name is required.');
    if (names.has(field.field_name)) fail('duplicate_name', 'Field names must be unique.');
    names.add(field.field_name);
    if (field.id !== undefined && (typeof field.id !== 'string' || !field.id || ids.has(field.id)))
      fail('duplicate_id', 'Field IDs must be nonempty and unique.');
    if (field.id) ids.add(field.id);
    if (!FIELD_TYPES.includes(field.data_type)) fail('data_type', 'Unsupported field type.');
    if (!Number.isSafeInteger(field.display_order) || field.display_order < 0)
      fail('display_order', 'Order must be a nonnegative integer.');
    if (isRecord(raw)) {
      for (const key of ['is_required', 'is_unique', 'has_default'])
        if (hasOwn(raw, key) && typeof raw[key] !== 'boolean')
          fail('schema', `${key} must be a boolean.`);
      if (hasOwn(raw, 'rules') && !isRecord(raw.rules)) fail('rules', 'Rules must be an object.');
      if (hasOwn(raw, 'options') && !Array.isArray(raw.options))
        fail('options', 'Options must be an array.');
    }
    if (field.data_type === 'custom' || field.data_type === 'select') {
      const values = new Set<string>();
      for (const option of field.options) {
        const persisted = option.value ?? option.label;
        if (values.has(persisted)) fail('option', 'Option values must be unique.');
        values.add(persisted);
      }
    }
    if (field.is_unique && !supportsUnique(field.data_type))
      fail('unique', 'Uniqueness is only available for scalar fields.');
    const rules = field.rules;
    for (const key of ['minLength', 'maxLength'] as const) {
      if (rules[key] === undefined) continue;
      if (!isTextField(field.data_type) || !Number.isSafeInteger(rules[key]) || rules[key]! < 0)
        fail('rules', `${key} requires text and a nonnegative integer.`);
    }
    if (
      rules.minLength !== undefined &&
      rules.maxLength !== undefined &&
      rules.minLength > rules.maxLength
    )
      fail('rules', 'Minimum length cannot exceed maximum length.');
    if (rules.pattern !== undefined) {
      if (!isTextField(field.data_type))
        fail('rules', 'Patterns are only supported for text and Markdown.');
      const invalid = patternError(rules.pattern);
      if (invalid) fail('pattern', invalid);
    }
    let validBounds = true;
    for (const bound of ['min', 'max'] as const) {
      const value = rules[bound];
      if (value === undefined) continue;
      const valid = isNumericField(field.data_type)
        ? safeNumber(value) && (field.data_type !== 'integer' || Number.isSafeInteger(value))
        : field.data_type === 'currency'
          ? normalizeDecimal(value) !== null
          : field.data_type === 'date'
            ? isCalendarDate(value)
            : field.data_type === 'timestamp'
              ? normalizeTimestamp(value) !== null
              : false;
      if (!valid) {
        validBounds = false;
        fail('rules', `Invalid ${bound} for ${field.data_type}.`);
      }
    }
    if (validBounds && rules.min !== undefined && rules.max !== undefined) {
      const reversed =
        field.data_type === 'currency'
          ? compareDecimals(String(rules.min), String(rules.max)) > 0
          : field.data_type === 'timestamp'
            ? Date.parse(String(rules.min)) > Date.parse(String(rules.max))
            : rules.min > rules.max;
      if (reversed) fail('rules', 'Minimum cannot exceed maximum.');
    }
    if (field.has_default) {
      if (!supportsDefault(field.data_type))
        fail('default', 'Attachment defaults are not allowed.');
      else if (!hasOwn(field, 'default_value') || field.default_value === undefined)
        fail('default', 'Specify a default value or disable the default.');
      else {
        const checked = validateValue(field, field.default_value);
        errors.push(
          ...checked.errors.map((error) => ({ ...error, code: `default_${error.code}` }))
        );
        if (!checked.errors.length) field.default_value = checked.value;
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
              // exists/not_exists don't require a value
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
  });
  return { valid: errors.length === 0, fields, errors };
}

export function validateEntryValues(
  fields: unknown,
  payload: unknown,
  { applyDefaults = false }: { applyDefaults?: boolean } = {}
): { valid: boolean; values: unknown; errors: FieldError[] } {
  const schema = validateFieldDefinitions(fields);
  const errors = [...schema.errors];
  if (!isRecord(payload)) {
    errors.push({
      field: '',
      code: 'payload',
      message:
        'Structured values must be an object. Opaque historical content requires explicit conversion.',
    });
    return { valid: false, values: payload, errors };
  }
  const values: Record<string, unknown> = { ...payload };
  for (const field of schema.fields) {
    const present = hasOwn(payload, field.field_name);
    const shouldDefault =
      !present && applyDefaults && field.has_default && supportsDefault(field.data_type);
    const value = present
      ? payload[field.field_name]
      : shouldDefault
        ? structuredClone(field.default_value)
        : undefined;
    const checked = validateValue(field, value);
    errors.push(...checked.errors);
    if (present || shouldDefault)
      Object.defineProperty(values, field.field_name, {
        value: checked.value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
  }
  return { valid: errors.length === 0, values, errors };
}

/** A stable scalar key; uniqueness itself must be checked by the server. */
export function canonicalUniqueValue(input: unknown, value: unknown): string | null {
  const field = normalizeField(input);
  if (!supportsUnique(field.data_type) || isEmptyFieldValue(value)) return null;
  const checked = validateValue({ ...field, rules: {}, is_required: false }, value);
  if (checked.errors.length) return null;
  if (field.data_type === 'currency' && isRecord(checked.value))
    return JSON.stringify([checked.value.currency, normalizeDecimal(checked.value.amount)]);
  return JSON.stringify(checked.value);
}

/**
 * Check if a value breaches warning or alert thresholds.
 * Returns the alert level and an optional message.
 */
export function checkThresholds(
  field: FieldDefinition,
  value: unknown
): { level: AlertLevel; message?: string } {
  const rules = field.rules;
  if (!rules) return { level: 'ok' };

  // Only apply to numeric, currency, date, and timestamp fields
  const isThresholdType =
    isNumericField(field.data_type) ||
    field.data_type === 'currency' ||
    field.data_type === 'date' ||
    field.data_type === 'timestamp';

  if (!isThresholdType || isEmptyFieldValue(value)) {
    return { level: 'ok' };
  }

  let numericValue: number | null = null;

  if (isNumericField(field.data_type) && typeof value === 'number') {
    numericValue = value;
  } else if (
    field.data_type === 'currency' &&
    isRecord(value) &&
    typeof value.amount === 'string'
  ) {
    const normalized = normalizeDecimal(value.amount);
    if (normalized !== null) {
      numericValue = parseFloat(normalized);
    }
  } else if (field.data_type === 'date' && typeof value === 'string') {
    numericValue = Date.parse(value);
  } else if (field.data_type === 'timestamp' && typeof value === 'string') {
    numericValue = Date.parse(value);
  }

  if (numericValue === null || !Number.isFinite(numericValue)) {
    return { level: 'ok' };
  }

  // Check alert thresholds first (more severe)
  if (rules.alert_min !== undefined) {
    const alertMin =
      field.data_type === 'currency' && typeof rules.alert_min === 'string'
        ? parseFloat(normalizeDecimal(rules.alert_min) ?? '0')
        : field.data_type === 'date' || field.data_type === 'timestamp'
          ? Date.parse(String(rules.alert_min))
          : Number(rules.alert_min);
    if (Number.isFinite(alertMin) && numericValue < alertMin) {
      return { level: 'alert', message: `Value is below alert minimum (${rules.alert_min})` };
    }
  }

  if (rules.alert_max !== undefined) {
    const alertMax =
      field.data_type === 'currency' && typeof rules.alert_max === 'string'
        ? parseFloat(normalizeDecimal(rules.alert_max) ?? '0')
        : field.data_type === 'date' || field.data_type === 'timestamp'
          ? Date.parse(String(rules.alert_max))
          : Number(rules.alert_max);
    if (Number.isFinite(alertMax) && numericValue > alertMax) {
      return { level: 'alert', message: `Value exceeds alert maximum (${rules.alert_max})` };
    }
  }

  // Check warning thresholds
  if (rules.warn_min !== undefined) {
    const warnMin =
      field.data_type === 'currency' && typeof rules.warn_min === 'string'
        ? parseFloat(normalizeDecimal(rules.warn_min) ?? '0')
        : field.data_type === 'date' || field.data_type === 'timestamp'
          ? Date.parse(String(rules.warn_min))
          : Number(rules.warn_min);
    if (Number.isFinite(warnMin) && numericValue < warnMin) {
      return { level: 'warning', message: `Value is below warning minimum (${rules.warn_min})` };
    }
  }

  if (rules.warn_max !== undefined) {
    const warnMax =
      field.data_type === 'currency' && typeof rules.warn_max === 'string'
        ? parseFloat(normalizeDecimal(rules.warn_max) ?? '0')
        : field.data_type === 'date' || field.data_type === 'timestamp'
          ? Date.parse(String(rules.warn_max))
          : Number(rules.warn_max);
    if (Number.isFinite(warnMax) && numericValue > warnMax) {
      return { level: 'warning', message: `Value exceeds warning maximum (${rules.warn_max})` };
    }
  }

  return { level: 'ok' };
}
