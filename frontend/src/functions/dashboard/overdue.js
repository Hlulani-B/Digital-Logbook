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
