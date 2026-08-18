/**
 * Check if an entry is overdue
 * An entry is overdue if:
 * - It has a due_date that has passed
 * - Its status is NOT "done_and_dusted"
 * 
 * @param {object} entry - The entry object
 * @returns {boolean} - True if overdue, false otherwise
 */
export function isOverdue(entry) {
  if (!entry || !entry.due_date) return false;
  
  // Check if status is completed
  const status = entry.status;
  if (status === "done_and_dusted") return false;
  
  // Check if due date has passed
  const dueDate = new Date(entry.due_date);
  const now = new Date();
  
  return dueDate < now;
}

/**
 * Get formatted overdue text
 * @param {object} entry - The entry object
 * @returns {string|null} - Formatted overdue text or null if not overdue
 */
export function getOverdueText(entry) {
  if (!isOverdue(entry)) return null;
  
  const dueDate = new Date(entry.due_date);
  const now = new Date();
  const diffMs = now - dueDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Overdue today";
  if (diffDays === 1) return "1 day overdue";
  return `${diffDays} days overdue`;
}
