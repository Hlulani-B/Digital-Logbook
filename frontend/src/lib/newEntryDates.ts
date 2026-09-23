import { isCalendarDate, normalizeTimestamp } from './fieldValidation';
import { isRecord } from './fieldSchema';

// US54: keep the policy in sync with project-service/src/domain/newEntryDates.js.
// Only user-controlled date columns are validated here. System-generated timer
// timestamps (started_at, ended_at, paused_at) are excluded — they are produced
// by timerPatch on the server or computed client-side for timer actions, and
// must not be subject to the no-past-date restriction.
export const ENTRY_DATE_COLUMNS = ['due_date'] as const;
const labels: Record<string, string> = {
  due_date: 'Due Date',
};
export interface EntryDateField {
  field_name: string;
  data_type: string;
  deleted?: boolean;
}
export interface EntryDateError {
  path: string;
  reason: 'past' | 'invalid';
  message: string;
}
interface DateValidationInput {
  dates?: Record<string, unknown>;
  values?: unknown;
  fields?: EntryDateField[];
  previous?: Record<string, unknown>;
  now?: Date;
}

function timestamp(value: unknown, dueDate = false): string | null {
  if (dueDate && isCalendarDate(value)) return `${value}T23:59:59.999Z`;
  if (typeof value !== 'string' || value.length > 35) return null;
  const offset = value.endsWith('Z') ? null : value.slice(-6);
  if (
    offset &&
    (+offset.slice(1, 3) > 14 || (+offset.slice(1, 3) === 14 && +offset.slice(4) !== 0))
  )
    return null;
  return normalizeTimestamp(value);
}

export function sameEntryDate(
  value: unknown,
  previous: unknown,
  type = 'timestamp',
  dueDate = false
): boolean {
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
}: DateValidationInput = {}) {
  const normalizedDates: Record<string, unknown> = {};
  const normalizedValues = isRecord(values)
    ? { ...values }
    : previous && values === previous.entries
      ? undefined
      : values;
  const errors: EntryDateError[] = [];
  const today = earliestEntryDate(now);
  const fail = (path: string, label: string, reason: EntryDateError['reason']) => {
    errors.push({
      path,
      reason,
      message:
        reason === 'past'
          ? `${label} cannot be in the past.`
          : `${label}: enter a valid date${path === 'due_date' ? ' or timezone-qualified timestamp' : ''}.`,
    });
  };
  const check = (value: unknown, path: string, label: string, type: string, dueDate = false) => {
    if (value === null || value === '') return value;
    const normalized =
      type === 'date' ? (isCalendarDate(value) ? value : null) : timestamp(value, dueDate);
    if (normalized === null) {
      fail(path, label, 'invalid');
      return value;
    }
    // Allow a small tolerance window for clock skew / network latency.
    // A strictly zero-tolerance comparison (value < now) rejects timestamps
    // that are valid but arrive a few hundred ms late over the network.
    const pastThreshold = now.getTime() - 5000;
    if (type === 'date' ? normalized < today : Date.parse(normalized) < pastThreshold)
      fail(path, label, 'past');
    return normalized;
  };

  for (const key of ENTRY_DATE_COLUMNS) {
    if (dates[key] === undefined) continue;
    if (
      previous &&
      Object.prototype.hasOwnProperty.call(previous, key) &&
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
  } else if (isRecord(values) && isRecord(normalizedValues)) {
    for (const field of dateFields) {
      const key = field.field_name;
      if (!Object.prototype.hasOwnProperty.call(values, key) || values[key] === undefined) continue;
      const oldValues = previous?.entries;
      if (
        isRecord(oldValues) &&
        Object.prototype.hasOwnProperty.call(oldValues, key) &&
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

export function earliestEntryDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function toLocalDateTime(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function earliestEntryDateTime(now = new Date()): string {
  return toLocalDateTime(new Date(Math.ceil(now.getTime() / 60000) * 60000));
}

// Retain invalid input so the shared validator can report it instead of silently
// accepting Date's calendar/DST rollover. Native inputs are only an aid.
export function localDateTimeToISO(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !isCalendarDate(value.slice(0, 10)))
    return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && toLocalDateTime(date) === value
    ? date.toISOString()
    : value;
}

export function dateOnlyDueToISO(value: string): string | null {
  if (!value) return null;
  if (!isCalendarDate(value)) return value;
  const date = new Date(`${value}T23:59:59.999`);
  if (!Number.isFinite(date.getTime()) || toLocalDateTime(date).slice(0, 10) !== value)
    return value;
  return date.toISOString();
}

// An untouched minute-precision editor must not truncate the stored timestamp.
export function editedDateTime(value: string, original: unknown): string | null | undefined {
  return value === toLocalDateTime(original) ? undefined : localDateTimeToISO(value);
}
