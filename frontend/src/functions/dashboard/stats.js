/**
 * Parse a duration/interval string into milliseconds.
 * Handles Postgres intervals like "2 days 06:27:39.557", "1 day 02:00:00",
 * plain time like "HH:MM:SS", "MM:SS", or returns 0 for unparseable values.
 */
function durationToMs(duration) {
  if (!duration) return 0;
  let str = String(duration).trim();
  let days = 0;

  // Extract leading days: "2 days ..." or "1 day ..."
  const dayMatch = str.match(/^(\d+)\s+days?\s*/);
  if (dayMatch) {
    days = parseInt(dayMatch[1], 10);
    str = str.slice(dayMatch[0].length);
  }

  const parts = str.split(':').map(Number);
  let ms = 0;
  if (parts.length === 3 && parts.every(p => !isNaN(p))) {
    ms = (parts[0] * 3600000) + (parts[1] * 60000) + (parts[2] * 1000);
  } else if (parts.length === 2 && parts.every(p => !isNaN(p))) {
    ms = (parts[0] * 60000) + (parts[1] * 1000);
  }

  return ms + (days * 86400000);
}

/**
 * Format milliseconds into a human-readable string like "2d 3h 27m" or "2h 30m" or "45m".
 */
export function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format a Postgres interval string (e.g. "2 days 06:27:39.557") into a clean display string.
 */
export function formatInterval(interval) {
  return formatDuration(durationToMs(interval));
}

/**
 * Format milliseconds into a live timer string "HH:MM:SS" (always 2-digit padded).
 * Used by ticking UIs that show a running in-progress timer.
 */
export function formatTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Calculate the elapsed time in ms for a single entry.
 * Computes purely from timestamps — does NOT rely on the (dropped) `duration` column.
 * - Completed entries (ended_at + started_at): ended_at − started_at.
 * - In-progress entries (started_at set, no ended_at): live started_at → now.
 * - Fallback (ended_at + created_at, no started_at): ended_at − created_at.
 * - Returns 0 if none of the above.
 *
 * `now` is accepted as a parameter so callers can pass a single shared timestamp
 * (e.g. a ticking value) for consistent, live-updating in-progress durations.
 */
export function entryDurationMs(entry, now = Date.now()) {
  // Completed: ended_at − started_at (the actual work time)
  if (entry.ended_at && entry.started_at) {
    const end = new Date(entry.ended_at).getTime();
    const start = new Date(entry.started_at).getTime();
    if (!isNaN(end) && !isNaN(start)) {
      return end - start;
    }
  }
  // In-progress: live started_at → now
  if (entry.started_at && !entry.ended_at) {
    const start = new Date(entry.started_at).getTime();
    if (!isNaN(start)) {
      return now - start;
    }
  }
  // Fallback: legacy entries that have ended_at but no started_at
  if (entry.ended_at && entry.created_at) {
    const end = new Date(entry.ended_at).getTime();
    const start = new Date(entry.created_at).getTime();
    if (!isNaN(end) && !isNaN(start)) {
      return end - start;
    }
  }
  return 0;
}

/**
 * Calculate total time tracked from entries.
 * - Completed entries (has ended_at): computes ended_at − started_at.
 * - In-progress entries (no ended_at): calculates live started_at → now.
 * - Returns total time and count of in-progress tasks.
 */
export function calculateTotalTimeTracked(entries, now = Date.now()) {
  let totalMs = 0;
  let inProgressCount = 0;

  entries.forEach((entry) => {
    if (entry.started_at && !entry.ended_at) {
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
export function calculateProjectStats(entries, now = Date.now()) {
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
    } else if (entry.ended_at) {
      stat.totalMs += entryDurationMs(entry, now);
    }
  });

  return Array.from(map.values())
    .map((s) => ({ ...s, display: formatDuration(s.totalMs) }))
    .sort((a, b) => b.totalMs - a.totalMs);
}
