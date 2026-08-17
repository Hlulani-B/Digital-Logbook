import { getUnarchived } from "./project/archives.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Returns entry rows whose due_date falls within the next 3 days
 * (inclusive of today, exclusive of anything past 3 days out).
 * Entries with no due_date are excluded.
 */
export async function dueSoon(user_email, project_name) {
  let result;
  try {
    result = await getUnarchived(user_email, project_name);
  } catch (err) {
    console.error("[dueSoon] Failed to fetch entries:", err);
    return { success: false, message: err.message || "Failed to fetch entries", data: [] };
  }

  const data = result?.data || [];

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * MS_PER_DAY);

  const filtered = data.filter((entry) => {
    if (!entry.due_date) return false;
    const due = new Date(entry.due_date);
    if (isNaN(due.getTime())) return false;
    return due >= now && due <= threeDaysFromNow;
  });

  return { success: true, data: filtered };
}
