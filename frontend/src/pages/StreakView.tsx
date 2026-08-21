import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { sortUnarchivedEntries } from "@/functions/project/entries.js";
import { calculateStreaks, streakLabel } from "@/functions/dashboard/streaks.js";

type Entry = Record<string, unknown>;

/**
 * Standalone Streak Tracking page.
 * Shows current streak, longest streak, and a calendar heatmap of activity.
 */
export function StreakView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const email = user?.email || "";

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await sortUnarchivedEntries(email, null, 0);
        if (!cancelled) setEntries(res?.data || []);
      } catch (err) {
        console.error("[StreakView] Failed to load entries:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [email]);

  const streaks = useMemo(() => calculateStreaks(entries), [entries]);

  if (loading) {
    return (
      <div className="stats-page">
        <div className="feed-loading">
          <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
          <p>Loading streaks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-page">
      {/* Header */}
      <div className="stats-page-header">
        <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Dashboard
        </button>
        <h1 className="stats-page-title">My Streaks</h1>
      </div>

      {entries.length === 0 ? (
        <div className="stats-empty glass">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
            <path d="M12 2c1 3-2 5-2 8a4 4 0 0 0 8 0c0-3-2-5-2-8"/>
            <path d="M8 14c-1.5 1-3 3-3 5a5 5 0 0 0 10 0c0-2-1.5-4-3-5"/>
          </svg>
          <h2>No entries yet</h2>
          <p>Start logging entries to build your streak!</p>
        </div>
      ) : (
        <div className="stats-content">
          {/* Streak Cards */}
          <div className="stats-cards-grid">
            <div className="stat-card glass">
              <div className="stat-card-icon" style={{ background: "linear-gradient(135deg, #f97316, #fb923c)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2c1 3-2 5-2 8a4 4 0 0 0 8 0c0-3-2-5-2-8"/><path d="M8 14c-1.5 1-3 3-3 5a5 5 0 0 0 10 0c0-2-1.5-4-3-5"/></svg>
              </div>
              <div className="stat-card-body">
                <span className="stat-card-value">{streaks.currentStreak}</span>
                <span className="stat-card-label">Current Streak</span>
                <span className="stat-card-sub">{streakLabel(streaks.currentStreak)}</span>
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-card-icon" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2c1 3-2 5-2 8a4 4 0 0 0 8 0c0-3-2-5-2-8"/><path d="M8 14c-1.5 1-3 3-3 5a5 5 0 0 0 10 0c0-2-1.5-4-3-5"/></svg>
              </div>
              <div className="stat-card-body">
                <span className="stat-card-value">{streaks.longestStreak}</span>
                <span className="stat-card-label">Longest Streak</span>
                <span className="stat-card-sub">Best run ever</span>
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-card-icon" style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div className="stat-card-body">
                <span className="stat-card-value">{streaks.totalDays}</span>
                <span className="stat-card-label">Active Days</span>
                <span className="stat-card-sub">Total days logged</span>
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-card-icon" style={{ background: "linear-gradient(135deg, #3b82f6, #60a5fa)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div className="stat-card-body">
                <span className="stat-card-value">{entries.length}</span>
                <span className="stat-card-label">Total Entries</span>
                <span className="stat-card-sub">All time</span>
              </div>
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="stats-panel glass">
            <h3 className="stats-panel-title">Activity (Last 90 Days)</h3>
            <StreakHeatmap entries={entries} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple 90-day heatmap showing daily entry counts as coloured cells.
 */
function StreakHeatmap({ entries }: { entries: Entry[] }) {
  const dayMap = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    // Initialise last 90 days with 0
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      map.set(key, 0);
    }
    // Count entries per day
    for (const e of entries) {
      if (!e.created_at) continue;
      const d = new Date(e.created_at as string);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (map.has(key)) {
        map.set(key, map.get(key)! + 1);
      }
    }
    return map;
  }, [entries]);

  const days = Array.from(dayMap.entries());
  const maxCount = Math.max(...days.map(([, c]) => c), 1);

  function cellColor(count: number) {
    if (count === 0) return "var(--bg-secondary, #f1f5f9)";
    const intensity = Math.min(count / maxCount, 1);
    // Orange gradient: light → dark
    const r = Math.round(249 - intensity * 40);
    const g = Math.round(115 + intensity * 30);
    const b = Math.round(22 + intensity * 10);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Group into weeks (columns of 7)
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="streak-heatmap">
      <div className="streak-heatmap-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="streak-heatmap-week">
            {week.map(([day, count]) => (
              <div
                key={day}
                className="streak-heatmap-cell"
                style={{ background: cellColor(count) }}
                title={`${day}: ${count} ${count === 1 ? "entry" : "entries"}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="streak-heatmap-legend">
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
          <div
            key={i}
            className="streak-heatmap-cell"
            style={{ background: cellColor(intensity * maxCount) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export default StreakView;
