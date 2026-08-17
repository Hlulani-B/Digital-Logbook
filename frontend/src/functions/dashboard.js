import { getUnarchived } from "./project/archives.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Returns entry rows whose due_date falls within the next 7 days
 * (inclusive of today, exclusive of anything past 7 days out).
 * Entries with no due_date are excluded.
 */
export async function dueSoon(user_email, project_name) {
  const result = await getUnarchived(user_email, project_name);

  if (!result?.success) {
    return { success: false, message: result?.message || "Failed to fetch entries", data: [] };
  }

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * MS_PER_DAY);

  const filtered = (result.data || []).filter((entry) => {
    if (!entry.due_date) return false;
    const due = new Date(entry.due_date);
    if (isNaN(due.getTime())) return false;
    return due >= now && due <= sevenDaysFromNow;
  });

  return { success: true, data: filtered };
}

/**
 * Returns entry rows whose started_at (or due_date, if started_at
 * isn't set yet) falls within the next 7 days — i.e. things
 * "up next" to start soon.
 */
export async function upNext(user_email, project_name) {
  const result = await getUnarchived(user_email, project_name);

  if (!result?.success) {
    return { success: false, message: result?.message || "Failed to fetch entries", data: [] };
  }

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * MS_PER_DAY);

  const filtered = (result.data || []).filter((entry) => {
    const referenceDateRaw = entry.started_at || entry.due_date;
    if (!referenceDateRaw) return false;
    const referenceDate = new Date(referenceDateRaw);
    if (isNaN(referenceDate.getTime())) return false;
    return referenceDate >= now && referenceDate <= sevenDaysFromNow;
  });

  return { success: true, data: filtered };
}