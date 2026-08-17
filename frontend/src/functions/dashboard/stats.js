/**
 * Calculate total time tracked from entries
 * - Completed entries (has ended_at): uses stored duration directly
 * - In-progress entries (no ended_at): calculates live started_at → now
 * - Returns total time and count of in-progress tasks
 */
export function calculateTotalTimeTracked(entries) {
  const now = Date.now();
  let totalMs = 0;
  let inProgressCount = 0;

  entries.forEach((entry) => {
    // For completed tasks: use stored duration directly
    if (entry.duration && entry.ended_at) {
      // Parse duration string (format: "HH:MM:SS" or similar)
      const durationStr = String(entry.duration);
      const parts = durationStr.split(':').map(Number);
      
      if (parts.length === 3 && parts.every(p => !isNaN(p))) {
        // Format: HH:MM:SS
        const [hours, minutes, seconds] = parts;
        totalMs += (hours * 3600000) + (minutes * 60000) + (seconds * 1000);
      } else if (parts.length === 2 && parts.every(p => !isNaN(p))) {
        // Format: MM:SS
        const [minutes, seconds] = parts;
        totalMs += (minutes * 60000) + (seconds * 1000);
      }
    }
    // For in-progress tasks: calculate live duration
    else if (entry.started_at && !entry.ended_at) {
      const start = new Date(entry.started_at).getTime();
      if (!isNaN(start)) {
        totalMs += (now - start);
        inProgressCount++;
      }
    }
  });

  // Convert to hours and minutes
  const totalMinutes = Math.floor(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    display: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    inProgressCount,
  };
}
