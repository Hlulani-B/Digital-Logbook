import { type CalendarEntry, getEntryTitle } from './calendar';

export type EntryStatus = 'up_next' | 'in_motion' | 'done_and_dusted';

export const STATUS_LABELS: Record<EntryStatus, string> = {
  up_next: 'Up Next',
  in_motion: 'In Motion',
  done_and_dusted: 'Done & Dusted',
};

export const STATUS_ORDER: EntryStatus[] = ['up_next', 'in_motion', 'done_and_dusted'];

export interface GroupedEntries {
  up_next: CalendarEntry[];
  in_motion: CalendarEntry[];
  done_and_dusted: CalendarEntry[];
}

/**
 * Returns a normalized status for an entry, defaulting to 'up_next'.
 */
export function getEntryStatus(entry: CalendarEntry): EntryStatus {
  const status = (entry.status as EntryStatus) ?? 'up_next';
  if (STATUS_ORDER.includes(status)) return status;
  return 'up_next';
}

/**
 * Filters entries by optional project name and/or a free-text search query.
 */
export function filterEntries(
  entries: CalendarEntry[],
  projectFilter: string,
  searchQuery: string
): CalendarEntry[] {
  let filtered = entries;

  if (projectFilter) {
    filtered = filtered.filter((e) => e.project_name === projectFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((e) => {
      const title = getEntryTitle(e).toLowerCase();
      const project = (e.project_name || '').toLowerCase();
      return title.includes(q) || project.includes(q);
    });
  }

  return filtered;
}

/**
 * Groups entries by their status into the three Kanban columns.
 */
export function groupEntriesByStatus(entries: CalendarEntry[]): GroupedEntries {
  const groups: GroupedEntries = {
    up_next: [],
    in_motion: [],
    done_and_dusted: [],
  };
  for (const entry of entries) {
    const status = getEntryStatus(entry);
    groups[status].push(entry);
  }
  return groups;
}

export interface StatusUpdateTimestamps {
  started_at: string | null;
  ended_at: string | null;
}

/**
 * Computes the timestamps that should accompany a status change.
 * - Moving to 'in_motion' sets started_at if it is not already set.
 * - Moving to 'done_and_dusted' sets ended_at if it is not already set.
 */
export function getStatusUpdateTimestamps(
  entry: CalendarEntry,
  newStatus: EntryStatus,
  now: string
): StatusUpdateTimestamps {
  return {
    started_at: newStatus === 'in_motion' && !entry.started_at ? now : (entry.started_at ?? null),
    ended_at: newStatus === 'done_and_dusted' && !entry.ended_at ? now : (entry.ended_at ?? null),
  };
}

/**
 * Returns an updated entry after a status change, including auto-set timestamps.
 */
export function buildUpdatedEntry(
  entry: CalendarEntry,
  newStatus: EntryStatus,
  now: string
): CalendarEntry {
  const { started_at, ended_at } = getStatusUpdateTimestamps(entry, newStatus, now);
  return {
    ...entry,
    status: newStatus,
    started_at,
    ended_at,
  };
}

/**
 * Compares two ISO date strings or null values.
 * Earlier dates sort first.
 */
export function compareDueDates(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const dateA = new Date(a).getTime();
  const dateB = new Date(b).getTime();
  if (Number.isNaN(dateA) && Number.isNaN(dateB)) return 0;
  if (Number.isNaN(dateA)) return 1;
  if (Number.isNaN(dateB)) return -1;
  return dateA - dateB;
}

/**
 * Sorts entries by due date (ascending). Entries without a due date go last.
 */
export function sortEntriesByDueDate(entries: CalendarEntry[]): CalendarEntry[] {
  return [...entries].sort((a, b) => compareDueDates(a.due_date ?? null, b.due_date ?? null));
}
