import { type CalendarEntry, parseDueDate } from './calendar';

export interface TodaySections {
  /** Entries whose due date has already passed. Highest urgency. */
  overdue: CalendarEntry[];
  /** Entries due sometime today. */
  dueToday: CalendarEntry[];
  /** Entries that have been started but not yet completed. */
  inProgress: CalendarEntry[];
}

/**
 * Returns the start and end of "today" in the user's local timezone.
 * Used so that a due date of midnight UTC does not shift categories
 * unexpectedly for users in other timezones.
 */
export function getTodayBounds(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { start, end };
}

/**
 * Checks whether an entry is due today.
 * Completed entries are excluded because they no longer need attention.
 */
export function isDueToday(entry: CalendarEntry, now: Date = new Date()): boolean {
  if (entry.status === 'done_and_dusted') return false;
  const due = parseDueDate(entry.due_date);
  if (!due) return false;
  const { start, end } = getTodayBounds(now);
  return due.getTime() >= start.getTime() && due.getTime() <= end.getTime();
}

/**
 * Checks whether an entry is overdue.
 * Mirrors the dashboard overdue helper but accepts a whole entry.
 */
export function isEntryOverdue(entry: CalendarEntry, now: Date = new Date()): boolean {
  if (entry.status === 'done_and_dusted') return false;
  const due = parseDueDate(entry.due_date);
  if (!due) return false;
  return due.getTime() < getTodayBounds(now).start.getTime();
}

/**
 * Checks whether an entry is currently in progress.
 * Uses the explicit status first, then falls back to started/ended timestamps.
 */
export function isInProgress(entry: CalendarEntry): boolean {
  if (entry.status === 'done_and_dusted') return false;
  if (entry.status === 'in_motion') return true;
  if (entry.started_at && !entry.ended_at) return true;
  return false;
}

/**
 * Partitions entries into the three Today-view sections.
 *
 * Ordering rationale:
 * 1. Overdue — missed deadlines are the most urgent thing to address.
 * 2. Due today — today's commitments come next so they are not missed.
 * 3. In progress — work already started should be visible to continue,
 *    but it ranks below explicit deadlines.
 */
export function getTodaySections(entries: CalendarEntry[], now: Date = new Date()): TodaySections {
  const sections: TodaySections = {
    overdue: [],
    dueToday: [],
    inProgress: [],
  };

  for (const entry of entries) {
    if (entry.archived || entry.status === 'done_and_dusted') continue;

    if (isEntryOverdue(entry, now)) {
      sections.overdue.push(entry);
    } else if (isDueToday(entry, now)) {
      sections.dueToday.push(entry);
    } else if (isInProgress(entry)) {
      sections.inProgress.push(entry);
    }
  }

  return sections;
}

/**
 * Returns true only when every Today section is empty.
 */
export function hasNothingToDo(sections: TodaySections): boolean {
  return (
    sections.overdue.length === 0 &&
    sections.dueToday.length === 0 &&
    sections.inProgress.length === 0
  );
}
