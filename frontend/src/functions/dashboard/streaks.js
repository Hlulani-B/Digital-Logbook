/**
 * Streak tracking — calculates consecutive-day logging streaks from entries.
 *
 * A "streak day" is any calendar day on which at least one entry was created.
 * The current streak counts consecutive days backwards from today (or yesterday).
 */

/**
 * Extract a sorted array of unique date strings (YYYY-MM-DD) from entries.
 * Uses `created_at` (ISO timestamp) on each entry.
 *
 * @param {Array<{ created_at?: string }>} entries
 * @returns {string[]} e.g. ["2026-08-18", "2026-08-19", "2026-08-20"]
 */
function uniqueDays(entries) {
  const set = new Set();
  for (const e of entries) {
    if (!e.created_at) continue;
    const d = new Date(e.created_at);
    if (isNaN(d.getTime())) continue;
    // Normalise to YYYY-MM-DD in local time
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    set.add(key);
  }
  return Array.from(set).sort();
}

/**
 * Convert a YYYY-MM-DD string to a Date at midnight local time.
 */
function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a Date as YYYY-MM-DD in local time.
 */
function formatDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Calculate streak statistics from a list of entries.
 *
 * @param {Array<{ created_at?: string }>} entries
 * @returns {{ currentStreak: number, longestStreak: number, totalDays: number, lastActiveDay: string|null }}
 *
 * - `currentStreak`  — consecutive days up to today (or yesterday if nothing logged today yet).
 * - `longestStreak`  — the longest consecutive-day run in the entire history.
 * - `totalDays`      — total unique days with at least one entry.
 * - `lastActiveDay`  — YYYY-MM-DD of the most recent active day, or null.
 */
export function calculateStreaks(entries) {
  const days = uniqueDays(entries);
  const totalDays = days.length;

  if (totalDays === 0) {
    return { currentStreak: 0, longestStreak: 0, totalDays: 0, lastActiveDay: null };
  }

  const lastActiveDay = days[days.length - 1];

  // --- Current streak ---
  // Walk backwards from today (or yesterday) and count consecutive days present in the set.
  const daySet = new Set(days);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cursor = new Date(today);
  // If today isn't an active day, start from yesterday
  if (!daySet.has(formatDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let currentStreak = 0;
  while (daySet.has(formatDay(cursor))) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // --- Longest streak ---
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = parseDay(days[i - 1]);
    const curr = parseDay(days[i]);
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 1;
    }
  }

  return { currentStreak, longestStreak, totalDays, lastActiveDay };
}

/**
 * Human-readable label for the current streak.
 * @param {number} streak
 * @returns {string}
 */
export function streakLabel(streak) {
  if (streak === 0) return 'No active streak';
  if (streak === 1) return '1 day streak';
  return `${streak} day streak`;
}
