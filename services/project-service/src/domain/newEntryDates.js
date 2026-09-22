import { validDate, validTimestamp, isRecord } from './fieldSchema.js';

// US54: keep this contract in sync with frontend/src/lib/newEntryDates.ts.
// Both implementations are exercised by test-fixtures/us54-entry-dates.json.
export const ENTRY_DATE_COLUMNS = ['due_date', 'started_at', 'ended_at', 'paused_at'];
const labels = {
  due_date: 'Due Date',
  started_at: 'Started At',
  ended_at: 'Ended At',
  paused_at: 'Paused At',
};

function timestamp(value, dueDate = false) {
  if (dueDate && validDate(value)) return `${value}T23:59:59.999Z`;
  if (!validTimestamp(value)) return null;
  const iso = new Date(value).toISOString();
  return iso.length === 24 && +iso.slice(0, 4) > 0 ? iso : null;
}

export function sameEntryDate(value, previous, type = 'timestamp', dueDate = false) {
  if (value === previous) return true;
  if (type === 'date' || value == null || previous == null) return false;
  const before =
    previous instanceof Date
      ? Number.isFinite(previous.getTime())
        ? previous.toISOString()
        : null
      : timestamp(previous, dueDate);
  const after = timestamp(value, dueDate);
  return after !== null && before !== null && after === before;
}

export function validateEntryDates({
  dates = {},
  values,
  fields = [],
  previous,
  now = new Date(),
} = {}) {
  const normalizedDates = {};
  const normalizedValues = isRecord(values)
    ? { ...values }
    : previous && values === previous.entries
      ? undefined
      : values;
  const errors = [];
  const today = now.toISOString().slice(0, 10);
  const fail = (path, label, reason) => {
    errors.push({
      path,
      reason,
      message:
        reason === 'past'
          ? `${label} cannot be in the past.`
          : `${label}: enter a valid date${path === 'due_date' ? ' or timezone-qualified timestamp' : ''}.`,
    });
  };
  const check = (value, path, label, type, dueDate = false) => {
    if (value === null || value === '') return value;
    const normalized =
      type === 'date' ? (validDate(value) ? value : null) : timestamp(value, dueDate);
    if (normalized === null) {
      fail(path, label, 'invalid');
      return value;
    }
    if (type === 'date' ? normalized < today : Date.parse(normalized) < now.getTime())
      fail(path, label, 'past');
    return normalized;
  };

  for (const key of ENTRY_DATE_COLUMNS) {
    if (dates[key] === undefined) continue;
    if (
      previous &&
      Object.hasOwn(previous, key) &&
      sameEntryDate(dates[key], previous[key], 'timestamp', key === 'due_date')
    )
      continue;
    normalizedDates[key] = check(
      dates[key] === '' ? null : dates[key],
      key,
      labels[key],
      'timestamp',
      key === 'due_date'
    );
  }

  const dateFields = fields.filter(
    (field) => !field.deleted && (field.data_type === 'date' || field.data_type === 'timestamp')
  );
  if (normalizedValues != null && !isRecord(values) && dateFields.length > 0) {
    fail('entries', 'Date fields require a structured entry', 'invalid');
  } else if (isRecord(values)) {
    for (const field of dateFields) {
      const key = field.field_name;
      if (!Object.hasOwn(values, key) || values[key] === undefined) continue;
      const oldValues = previous?.entries;
      if (
        isRecord(oldValues) &&
        Object.hasOwn(oldValues, key) &&
        sameEntryDate(values[key], oldValues[key], field.data_type)
      ) {
        delete normalizedValues[key];
        continue;
      }
      normalizedValues[key] = check(values[key], `entries.${key}`, key, field.data_type);
    }
  }

  return {
    success: errors.length === 0,
    dates: normalizedDates,
    values: normalizedValues,
    errors,
    ...(errors.length > 0
      ? {
          code: 'ENTRY_DATE_VALIDATION',
          message: errors.map((error) => error.message).join(' '),
          retryable: false,
        }
      : {}),
  };
}
