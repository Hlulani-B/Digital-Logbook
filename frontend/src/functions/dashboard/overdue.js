/**
 * Shared entry lifecycle rules (single source of truth for every view).
 *
 * Status vocabulary: 'up_next' | 'in_motion' | 'done_and_dusted'.
 * Overdue is a DERIVED warning state, never a permission gate: an entry
 * that is currently overdue remains fully editable and completable.
 */

/** Statuses that represent unfinished, active work. */
export const ENTRY_ACTIVE_STATUSES = ['up_next', 'in_motion'];

/** Completed status — a completed entry is never currently overdue. */
export const ENTRY_DONE_STATUS = 'done_and_dusted';

/**
 * Check if an entry is currently overdue.
 * - Entry is overdue if due_date has passed
 *   AND status is an active status (up_next / in_motion; null defaults to up_next)
 *   AND the entry is not archived
 * @param {string|null} dueDate - The due date string (ISO format)
 * @param {string|null|undefined} status - The entry status
 * @param {boolean} [archived] - Whether the entry is archived
 * @returns {boolean} - True if currently overdue
 */
export function isOverdue(dueDate, status, archived = false) {
  if (archived === true) return false;
  if (!dueDate) return false;
  if (status === ENTRY_DONE_STATUS) return false;
  // A missing status behaves like the app-wide default ('up_next').
  if (status != null && !ENTRY_ACTIVE_STATUSES.includes(status)) return false;

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;

  const now = new Date();
  return due < now;
}

/**
 * Get formatted overdue text
 * @param {string|null} dueDate - The due date string
 * @param {string|null|undefined} status - The entry status
 * @param {boolean} [archived] - Whether the entry is archived
 * @returns {string|null} - Formatted overdue text or null
 */
export function getOverdueText(dueDate, status, archived = false) {
  if (!isOverdue(dueDate, status, archived)) return null;

  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = now - due;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Overdue today';
  if (diffDays === 1) return 'Overdue by 1 day';
  return `Overdue by ${diffDays} days`;
}

/** How far ahead an upcoming deadline still counts as "due soon". */
export const DUE_SOON_WINDOW_DAYS = 3;

/**
 * Check if an entry is currently due soon.
 * - It has a valid deadline inside the due-soon window (now → +3 days)
 * - AND its status represents unfinished work (up_next / in_motion;
 *   null defaults to up_next)
 * - AND neither the entry nor its parent project is archived
 * - A completed entry is never due soon
 * - An already overdue entry (due date in the past) is never due soon —
 *   that is overdue territory, handled by isOverdue above
 *
 * The window is anchored at `now`, not the start of today, so a deadline
 * whose time has already passed today falls out of due soon (it is now
 * overdue) instead of lingering until midnight.
 *
 * @param {string|null} dueDate - The due date string (ISO format)
 * @param {string|null|undefined} status - The entry status
 * @param {boolean} [archived] - Whether the entry is individually archived
 * @param {boolean} [projectArchived] - Whether the parent project is archived
 * @returns {boolean} - True if currently due soon
 */
export function isDueSoon(dueDate, status, archived = false, projectArchived = false) {
  if (archived === true || projectArchived === true) return false;
  if (!dueDate) return false;
  if (status === ENTRY_DONE_STATUS) return false;
  // A missing status behaves like the app-wide default ('up_next').
  if (status != null && !ENTRY_ACTIVE_STATUSES.includes(status)) return false;

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return due >= now && due <= windowEnd;
}

/**
 * Whether an entry belongs in active (non-archive) views at all.
 * - Deleted entries never appear
 * - Individually archived entries only appear where archived content is
 *   explicitly requested (the Archives views handle that themselves)
 * - Entries of an archived project are excluded from ordinary active views
 *   because their parent project is archived — while keeping the entry's own
 *   independent archive flag untouched
 *
 * This mirrors the exclusion semantics of isOverdue/isDueSoon above and is
 * the single rule every active surface (feeds, table, checklist, board,
 * cards) should select rows with.
 *
 * @param {object|null} entry - The entry row
 * @param {boolean} [projectArchived] - Whether the parent project is archived
 * @returns {boolean} - True if the entry should appear in active views
 */
export function isActiveEntry(entry, projectArchived = false) {
  if (!entry || entry.deleted === true) return false;
  if (entry.archived === true || projectArchived === true) return false;
  return true;
}
