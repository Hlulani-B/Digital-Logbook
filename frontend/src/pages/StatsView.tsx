import { useState, useEffect, useCallback } from "react";
import { getProjectStats, formatDuration } from "@/functions/project/stats.js";

type ProjectStat = {
  project_name: string;
  archived: boolean;
  entry_count: number;
  total_seconds: number;
  last_activity: string | null;
};

const TAB_COLORS = ["#ec4899", "#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TAB_COLORS[Math.abs(hash) % TAB_COLORS.length];
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function StatsView() {
  const [stats, setStats] = useState<ProjectStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getProjectStats();
    if (result.error) {
      setError(result.error);
    } else {
      setStats(result.data as ProjectStat[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalEntries = stats.reduce((sum, s) => sum + (s.entry_count || 0), 0);
  const totalSeconds = stats.reduce((sum, s) => sum + (s.total_seconds || 0), 0);
  const lastActivity =
    stats
      .map((s) => s.last_activity)
      .filter((d): d is string => !!d)
      .sort()
      .pop() ?? null;
  const maxSeconds = Math.max(1, ...stats.map((s) => s.total_seconds || 0));

  // Non-archived first (by total time desc), archived last.
  const sorted = [...stats].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return (b.total_seconds || 0) - (a.total_seconds || 0);
  });

  if (loading) {
    return (
      <div className="stats-loading">
        <div
          className="animate-spin"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "3px solid var(--border)",
            borderTopColor: "var(--accent)",
          }}
        />
        <p>Crunching the numbers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-error glass">
        <div className="stats-error-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="stats-error-title">Couldn't load stats</h2>
        <p className="stats-error-desc">{error}</p>
        <p className="stats-error-hint">
          Make sure the <code>get_project_stats</code> function exists in your Supabase project
          (see <code>supabase/setup.sql</code>, section 3). Run it once in the Supabase SQL editor.
        </p>
        <button className="btn-primary" onClick={load}>Try again</button>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="stats-empty animate-in">
        <div className="stats-empty-icon">📊</div>
        <h2 className="stats-empty-title">No stats yet</h2>
        <p className="stats-empty-desc">
          Create a project and log entries with durations to see your statistics here.
        </p>
      </div>
    );
  }

  return (
    <div className="stats-view animate-in">
      <div className="stats-header">
        <div>
          <h1 className="stats-title">My Stats</h1>
          <p className="stats-subtitle">Total work recorded across your projects</p>
        </div>
        <button className="btn-secondary stats-refresh" onClick={load} title="Refresh stats">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card glass">
          <span className="stat-card-label">Total Projects</span>
          <span className="stat-card-value">{stats.length}</span>
        </div>
        <div className="stat-card glass">
          <span className="stat-card-label">Total Entries</span>
          <span className="stat-card-value">{totalEntries}</span>
        </div>
        <div className="stat-card glass">
          <span className="stat-card-label">Total Time</span>
          <span className="stat-card-value">{formatDuration(totalSeconds)}</span>
        </div>
        <div className="stat-card glass">
          <span className="stat-card-label">Last Activity</span>
          <span className="stat-card-value stat-card-value-sm">{formatDate(lastActivity)}</span>
        </div>
      </div>

      <div className="stats-breakdown">
        <h2 className="stats-section-title">Time per project</h2>
        <div className="stats-projects">
          {sorted.map((s) => {
            const color = colorForName(s.project_name);
            const pct = Math.round(((s.total_seconds || 0) / maxSeconds) * 100);
            return (
              <div
                key={s.project_name}
                className={`stats-project-row glass ${s.archived ? "is-archived" : ""}`}
              >
                <div className="stats-project-head">
                  <span className="stats-project-dot" style={{ background: color }} />
                  <span className="stats-project-name">{s.project_name}</span>
                  {s.archived && <span className="stats-project-tag">Archived</span>}
                  <span className="stats-project-count">
                    {s.entry_count} {s.entry_count === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <div className="stats-bar">
                  <div className="stats-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className="stats-project-foot">
                  <span className="stats-project-time">{formatDuration(s.total_seconds || 0)}</span>
                  <span className="stats-project-activity">Last: {formatDate(s.last_activity)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default StatsView;
