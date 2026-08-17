import { supabase } from "@/lib/supabase";

/**
 * Fetch per-project statistics for the signed-in user from the
 * `get_project_stats` Supabase RPC (sums the `duration` interval column).
 * Returns: { data: [{ project_name, archived, entry_count, total_seconds, last_activity }] }
 * or { error } if the RPC is missing / fails.
 */
export async function getProjectStats() {
  const { data, error } = await supabase.rpc("get_project_stats");
  if (error) return { error: error.message };
  return { data: data || [] };
}

/**
 * Format a number of seconds as a compact human duration, e.g. 5400 -> "1h 30m".
 */
export function formatDuration(totalSeconds) {
  const s = Math.round(Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
  return "0m";
}
