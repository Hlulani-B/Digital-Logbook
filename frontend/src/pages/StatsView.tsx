import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getProjectsByEmail } from "@/functions/project/project.js";
import { sortUnarchivedEntries } from "@/functions/project/entries.js";
import { dueSoon } from "@/functions/dashboard.js";
import {
  calculateTotalTimeTracked,
  calculateProjectStats,
  formatDuration,
} from "@/functions/dashboard/stats.js";
import { useNow } from "@/hooks/useNow";

type Entry = Record<string, unknown>;
type Project = Record<string, unknown>;

const CHART_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
  "#f97316", "#06b6d4", "#84cc16", "#a855f7",
];

function colorForIndex(i: number) {
  return CHART_COLORS[i % CHART_COLORS.length];
}

/* ---------- Donut Chart ---------- */
interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function DonutChart({ segments, totalDisplay }: { segments: DonutSegment[]; totalDisplay: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrapper">
      <svg viewBox="0 0 160 160" className="donut-svg">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border)" strokeWidth="14" />
        {total > 0 && segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference;
          const gap = circumference - dash;
          const rotation = (offset / total) * 360 - 90;
          offset += seg.value;
          return (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(${rotation} 80 80)`}
              className="donut-segment"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="donut-center">
        <span className="donut-center-value">{totalDisplay}</span>
        <span className="donut-center-label">Total Tracked</span>
      </div>
    </div>
  );
}

/* ---------- Bar Chart ---------- */
interface BarDatum {
  label: string;
  value: number;
  display: string;
  color: string;
  extra?: string;
}

function BarChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-chart-row">
          <div className="bar-chart-label">
            <span className="bar-chart-dot" style={{ background: d.color }} />
            <span className="bar-chart-name">{d.label}</span>
            {d.extra && <span className="bar-chart-extra">{d.extra}</span>}
          </div>
          <div className="bar-chart-track">
            <div
              className="bar-chart-fill"
              style={{
                width: `${Math.max((d.value / max) * 100, 3)}%`,
                background: `linear-gradient(90deg, ${d.color}, ${d.color}cc)`,
              }}
            />
          </div>
          <span className="bar-chart-value">{d.display}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Stat Card ---------- */
function StatCard({
  icon,
  value,
  label,
  sub,
  gradient,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
  gradient: string;
}) {
  return (
    <div className="stat-card glass">
      <div className="stat-card-icon" style={{ background: gradient }}>
        {icon}
      </div>
      <div className="stat-card-body">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
        {sub && <span className="stat-card-sub">{sub}</span>}
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */
export function StatsView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const email = user?.email || "";

  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dueSoonCount, setDueSoonCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [projectsRes, entriesRes, dueSoonRes] = await Promise.allSettled([
          getProjectsByEmail(email),
          sortUnarchivedEntries(email, null, 0),
          dueSoon(email, null),
        ]);

        if (cancelled) return;

        if (projectsRes.status === "fulfilled") setProjects(projectsRes.value?.projects || []);
        if (entriesRes.status === "fulfilled") setEntries(entriesRes.value?.data || []);
        if (dueSoonRes.status === "fulfilled") setDueSoonCount(dueSoonRes.value?.data?.length || 0);
      } catch (err) {
        console.error("[StatsView] Failed to load stats data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [email]);

  // Tick every second only while a task is running so in-progress totals stay live.
  const hasInProgress = entries.some((e) => e.started_at && !e.ended_at);
  const now = useNow(1000, hasInProgress);

  const totalTimeTracked = useMemo(() => calculateTotalTimeTracked(entries, now), [entries, now]);
  const projectStats = useMemo(() => calculateProjectStats(entries, now), [entries, now]);
  const totalMs = useMemo(
    () => projectStats.reduce((sum, ps) => sum + ps.totalMs, 0),
    [projectStats]
  );

  const donutSegments = useMemo(
    () =>
      projectStats.map((ps, i) => ({
        label: ps.project_name,
        value: ps.totalMs,
        color: colorForIndex(i),
      })),
    [projectStats]
  );

  const timeBarData = useMemo(
    () =>
      projectStats.map((ps, i) => ({
        label: ps.project_name,
        value: ps.totalMs,
        display: ps.display,
        color: colorForIndex(i),
        extra: `${ps.entryCount} ${ps.entryCount === 1 ? "entry" : "entries"}`,
      })),
    [projectStats]
  );

  const entryBarData = useMemo(
    () =>
      projectStats.map((ps, i) => ({
        label: ps.project_name,
        value: ps.entryCount,
        display: String(ps.entryCount),
        color: colorForIndex(i),
        extra: ps.display,
      })),
    [projectStats]
  );

  const completedCount = entries.filter((e) => e.ended_at).length;
  const inProgressCount = totalTimeTracked.inProgressCount;
  const noTimerCount = entries.length - completedCount - inProgressCount;

  if (loading) {
    return (
      <div className="stats-page">
        <div className="feed-loading">
          <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
          <p>Loading stats...</p>
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
        <h1 className="stats-page-title">My Stats</h1>
      </div>

      {projectStats.length === 0 ? (
        <div className="stats-empty glass">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <h2>No time-tracked entries yet</h2>
          <p>Start a timer on an entry to see beautiful stats here.</p>
        </div>
      ) : (
        <div className="stats-content">
          {/* Overview Cards */}
          <div className="stats-cards-grid">
            <StatCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
              value={entries.length}
              label="Total Entries"
              gradient="linear-gradient(135deg, #6366f1, #818cf8)"
            />
            <StatCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>}
              value={projects.filter((p) => !p.archived).length}
              label="Active Projects"
              gradient="linear-gradient(135deg, #10b981, #34d399)"
            />
            <StatCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              value={dueSoonCount}
              label="Due Soon"
              gradient="linear-gradient(135deg, #f59e0b, #fbbf24)"
            />
            <StatCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
              value={formatDuration(totalMs)}
              label="Time Tracked"
              sub={inProgressCount > 0 ? `${inProgressCount} in progress` : undefined}
              gradient="linear-gradient(135deg, #ec4899, #f472b6)"
            />
          </div>

          {/* Donut + Legend */}
          <div className="stats-chart-row">
            <div className="stats-panel glass">
              <h3 className="stats-panel-title">Time Distribution</h3>
              <DonutChart segments={donutSegments} totalDisplay={formatDuration(totalMs)} />
              <div className="donut-legend">
                {projectStats.map((ps, i) => {
                  const pct = totalMs > 0 ? ((ps.totalMs / totalMs) * 100).toFixed(1) : "0";
                  return (
                    <div key={ps.project_name} className="donut-legend-item">
                      <span className="donut-legend-dot" style={{ background: colorForIndex(i) }} />
                      <span className="donut-legend-name">{ps.project_name}</span>
                      <span className="donut-legend-pct">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="stats-panel glass">
              <h3 className="stats-panel-title">Entry Status</h3>
              <div className="status-breakdown">
                <div className="status-item">
                  <div className="status-ring" style={{ "--pct": `${entries.length ? (completedCount / entries.length) * 100 : 0}%` } as React.CSSProperties}>
                    <span className="status-count">{completedCount}</span>
                  </div>
                  <span className="status-label">Completed</span>
                </div>
                <div className="status-item">
                  <div className="status-ring status-ring-active" style={{ "--pct": `${entries.length ? (inProgressCount / entries.length) * 100 : 0}%` } as React.CSSProperties}>
                    <span className="status-count">{inProgressCount}</span>
                  </div>
                  <span className="status-label">In Progress</span>
                </div>
                <div className="status-item">
                  <div className="status-ring status-ring-idle" style={{ "--pct": `${entries.length ? (noTimerCount / entries.length) * 100 : 0}%` } as React.CSSProperties}>
                    <span className="status-count">{noTimerCount}</span>
                  </div>
                  <span className="status-label">No Timer</span>
                </div>
              </div>
            </div>
          </div>

          {/* Time per Project Bar Chart */}
          <div className="stats-panel glass">
            <h3 className="stats-panel-title">Time per Project</h3>
            <BarChart data={timeBarData} />
          </div>

          {/* Entries per Project Bar Chart */}
          <div className="stats-panel glass">
            <h3 className="stats-panel-title">Entries per Project</h3>
            <BarChart data={entryBarData} />
          </div>
        </div>
      )}
    </div>
  );
}

export default StatsView;
