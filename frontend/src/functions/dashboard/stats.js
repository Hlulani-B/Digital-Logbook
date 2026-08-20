/**
 * Parse a duration/interval string into milliseconds.
 * Handles "HH:MM:SS", "MM:SS" formats, or returns 0 for unparseable values.
 */
function durationToMs(duration) {
  if (!duration) return 0;
  const parts = String(duration).split(':').map(Number);
  if (parts.length === 3 && parts.every(p => !isNaN(p))) {
    return (parts[0] * 3600000) + (parts[1] * 60000) + (parts[2] * 1000);
  }
  if (parts.length === 2 && parts.every(p => !isNaN(p))) {
    return (parts[0] * 60000) + (parts[1] * 1000);
  }
  return 0;
}

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
 * - Completed entries (has ended_at): uses the stored `duration` column (ended_at − started_at).
 * - In-progress entries (started_at set, no ended_at): calculates live started_at → now.
 * - Returns 0 if neither is available.
 */
function entryDurationMs(entry, now) {
  // Completed: use stored duration column directly
  if (entry.duration && entry.ended_at) {
    return durationToMs(entry.duration);
  }
  // In-progress: calculate live duration from started_at
  if (entry.started_at && !entry.ended_at) {
    const start = new Date(entry.started_at).getTime();
    if (!isNaN(start)) {
      return now - start;
    }
  }
  return 0;
}

/**
 * Calculate total time tracked from entries
 * - Completed entries (has ended_at): uses stored duration column
 * - In-progress entries (no ended_at): calculates live started_at → now
 * - Returns total time and count of in-progress tasks
 */
export function calculateTotalTimeTracked(entries) {
  const now = Date.now();
  let totalMs = 0;
  let inProgressCount = 0;

  entries.forEach((entry) => {
    if (entry.started_at && !entry.ended_at) {
      totalMs += entryDurationMs(entry, now);
      inProgressCount++;
    } else if (entry.duration && entry.ended_at) {
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

    if (entry.started_at && !entry.ended_at) {
      stat.totalMs += entryDurationMs(entry, now);
      stat.inProgressCount++;
    } else if (entry.duration && entry.ended_at) {
      stat.totalMs += entryDurationMs(entry, now);
    }
  });

  return Array.from(map.values())
    .map((s) => ({ ...s, display: formatDuration(s.totalMs) }))
    .sort((a, b) => b.totalMs - a.totalMs);
}
