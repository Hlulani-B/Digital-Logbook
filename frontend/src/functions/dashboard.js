import { getUnarchived } from "./project/archives.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Returns entry rows whose due_date falls within the next 3 days
 * (inclusive of today, exclusive of anything past 3 days out).
 * Entries with no due_date are excluded.
 */
export async function dueSoon(user_email, project_name) {
  const result = await getUnarchived(user_email, project_name);

  if (!result?.success) {
    return { success: false, message: result?.message || "Failed to fetch entries", data: [] };
  }

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * MS_PER_DAY);

  const filtered = (result.data || []).filter((entry) => {
    if (!entry.due_date) return false;
    const due = new Date(entry.due_date);
    if (isNaN(due.getTime())) return false;
    return due >= now && due <= threeDaysFromNow;
  });

  return { success: true, data: filtered };
}
