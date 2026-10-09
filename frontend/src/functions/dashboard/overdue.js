/** Shared lifecycle states used to determine current overdue eligibility. */
export const ENTRY_ACTIVE_STATUSES = ['up_next', 'in_motion'];
export const ENTRY_DONE_STATUS = 'done_and_dusted';

/**
 * Check whether an entry is currently overdue. This is a warning state only;
 * active overdue entries remain editable and completable.
 */
export function isOverdue(dueDate, status, archived = false) {
  if (archived === true || !dueDate || status === ENTRY_DONE_STATUS) return false;
  if (status != null && !ENTRY_ACTIVE_STATUSES.includes(status)) return false;

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;
  return due < new Date();
}

/**
 * Get formatted overdue text
 * @param {string|null} dueDate - The due date string
 * @param {string|null} status - The entry status
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
