/**
 * Check if an entry is overdue
 * - Entry is overdue if due_date has passed AND status is not "done_and_dusted"
 * @param {string|null} dueDate - The due date string (ISO format)
 * @param {string|null} status - The entry status
 * @returns {boolean} - True if overdue
 */
export function isOverdue(dueDate, status) {
  if (!dueDate) return false;
  if (status === 'done_and_dusted') return false;

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;

  const now = new Date();
  return due < now;
}

/**
 * Get formatted overdue text
 * @param {string|null} dueDate - The due date string
 * @param {string|null} status - The entry status
 * @returns {string|null} - Formatted overdue text or null
 */
export function getOverdueText(dueDate, status) {
  if (!isOverdue(dueDate, status)) return null;

  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = now - due;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Overdue today';
  if (diffDays === 1) return 'Overdue by 1 day';
  return `Overdue by ${diffDays} days`;
}
