// ── Shared due date + time display ─────────────────────────────
// Entry due dates are stored in two shapes:
//   • date-only — the date-only editors persist a local end-of-day
//     (23:59:59.999) marker, and the backend normalizer persists the literal
//     `${date}T23:59:59.999Z` marker;
//   • real timestamps — minute-precision values picked in the datetime-local
//     editors (a genuine due time).
// Display must show the saved calendar date without a timezone shift, and a
// time only when one was actually saved — never a fabricated 00:00/23:59.
// Every due-date surface formats through this module so the marker rules and
// the date style stay consistent.

const CALENDAR_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_END_OF_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T23:59:59\.999Z$/;

/** Default date style: `10 Oct 2026`. */
export const DUE_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

/** Local Date for the given calendar date, or null for impossible dates. */
function localCalendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export interface ParsedDueDate {
  /** Local Date carrying the saved calendar date; its time is meaningful only when hasTime. */
  date: Date;
  /** True when a real due time was persisted with the date. */
  hasTime: boolean;
}

export function parseDueDateForDisplay(value: unknown): ParsedDueDate | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Literal `${date}T23:59:59.999Z` — the backend's date-only marker. Use
    // the calendar date verbatim: converting that instant to local time would
    // shift it to the next day east of UTC.
    const utcEndOfDay = UTC_END_OF_DAY_PATTERN.exec(trimmed);
    if (utcEndOfDay) {
      const date = localCalendarDate(
        Number(utcEndOfDay[1]),
        Number(utcEndOfDay[2]),
        Number(utcEndOfDay[3])
      );
      return date ? { date, hasTime: false } : null;
    }

    // Bare calendar date — already date-only.
    const bare = CALENDAR_PATTERN.exec(trimmed);
    if (bare) {
      const date = localCalendarDate(Number(bare[1]), Number(bare[2]), Number(bare[3]));
      return date ? { date, hasTime: false } : null;
    }
  }

  const instant = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(instant.getTime())) return null;

  // The date-only editors persist local end-of-day; that marker carries no
  // time of its own. Real picks (datetime-local, minute precision) never
  // carry 59.999 seconds, so they are unaffected.
  if (
    instant.getHours() === 23 &&
    instant.getMinutes() === 59 &&
    instant.getSeconds() === 59 &&
    instant.getMilliseconds() === 999
  ) {
    return {
      date: new Date(instant.getFullYear(), instant.getMonth(), instant.getDate()),
      hasTime: false,
    };
  }

  return { date: instant, hasTime: true };
}

/** `HH:mm` in the given (or runtime default) locale — 24-hour clock. */
export function formatDueTime(date: Date, locale?: string): string {
  return date.toLocaleTimeString(locale, TIME_OPTIONS);
}

export interface DueDateDisplayOptions {
  /** BCP-47 locale; falls back to the runtime default. */
  locale?: string;
  /** Date style for the surface; defaults to `10 Oct 2026`. */
  dateOptions?: Intl.DateTimeFormatOptions;
}

export interface DueDateDisplay {
  /** Formatted calendar date. */
  date: string;
  /** Formatted `HH:mm`, or null when the entry has no saved time. */
  time: string | null;
  /** `date` or `date · time` — the ready-to-render label. */
  text: string;
  /** True when a real due time is displayed. */
  hasTime: boolean;
}

export function formatDueDateParts(
  value: unknown,
  options: DueDateDisplayOptions = {}
): DueDateDisplay | null {
  const parsed = parseDueDateForDisplay(value);
  if (!parsed) return null;
  const date = parsed.date.toLocaleDateString(
    options.locale,
    options.dateOptions ?? DUE_DATE_OPTIONS
  );
  const time = parsed.hasTime ? formatDueTime(parsed.date, options.locale) : null;
  return { date, time, hasTime: parsed.hasTime, text: time ? `${date} \u00b7 ${time}` : date };
}

/** `date` or `date · time`, or null when there is no valid due date. */
export function formatDueDateTime(
  value: unknown,
  options: DueDateDisplayOptions = {}
): string | null {
  return formatDueDateParts(value, options)?.text ?? null;
}
