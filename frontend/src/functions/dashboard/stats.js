/**
 * Format milliseconds into a human-readable string like "2h 30m" or "45m".
 */
export function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Calculate the elapsed time in ms for a single entry.
 * Completed entries: ended_at − created_at.
 * In-progress entries (no ended_at): now − created_at.
 * Returns 0 if created_at is missing or invalid.
 */
function entryDurationMs(entry, now) {
  const createdAt = new Date(entry.created_at).getTime();
  if (isNaN(createdAt)) return 0;

  if (entry.ended_at) {
    const endedAt = new Date(entry.ended_at).getTime();
    return isNaN(endedAt) ? 0 : endedAt - createdAt;
  }
  // In-progress: no ended_at yet
  return now - createdAt;
}

/**
 * Calculate total time tracked from entries
 * - Completed entries (has ended_at): ended_at − created_at
 * - In-progress entries (no ended_at): now − created_at
 * - Returns total time and count of in-progress tasks
 */
export function calculateTotalTimeTracked(entries) {
  const now = Date.now();
  let totalMs = 0;
  let inProgressCount = 0;

  entries.forEach((entry) => {
    if (!entry.ended_at && entry.created_at) {
      totalMs += entryDurationMs(entry, now);
      inProgressCount++;
    } else if (entry.ended_at) {
      totalMs += entryDurationMs(entry, now);
    }
  });

  return {
    display: formatDuration(totalMs),
    inProgressCount,
  };
}

/**
 * Calculate per-project statistics from entries.
 * Returns an array of { project_name, entryCount, totalMs, display, inProgressCount }
 * sorted by total time descending.
 */
export function calculateProjectStats(entries) {
  const now = Date.now();
  const map = new Map();

  entries.forEach((entry) => {
    const name = entry.project_name || 'Unknown';
    if (!map.has(name)) {
      map.set(name, { project_name: name, entryCount: 0, totalMs: 0, inProgressCount: 0 });
    }
    const stat = map.get(name);
    stat.entryCount++;

    if (!entry.ended_at && entry.created_at) {
      stat.totalMs += entryDurationMs(entry, now);
      stat.inProgressCount++;
    } else if (entry.ended_at) {
      stat.totalMs += entryDurationMs(entry, now);
    }
  });

  return Array.from(map.values())
    .map((s) => ({ ...s, display: formatDuration(s.totalMs) }))
    .sort((a, b) => b.totalMs - a.totalMs);
}
