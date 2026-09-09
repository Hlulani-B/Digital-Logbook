import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  calculateTotalTimeTracked,
  calculateProjectStats,
  computeFieldStats,
  formatDuration,
} from '@/functions/dashboard/stats.js';
import { getFields } from '@/functions/project/fields.js';
import { useNow } from '@/hooks/useNow';
import { NavBar } from '@/components/NavBar';
import { Header } from '@/components/Header';
import { cacheGet, CACHE_STORES } from '@/lib/cache';
import { syncAllData, computeDueSoon } from '@/CacheFunctions';

type Entry = Record<string, unknown>;
type Project = Record<string, unknown>;
type FieldDef = { field_name: string; data_type: string };

/* Opacity levels for monochrome chart segments — uses var(--text) so it adapts to theme */
const CHART_OPACITIES = [1, 0.7, 0.5, 0.35, 0.85, 0.6, 0.4, 0.25, 0.75, 0.55, 0.45, 0.3];

function colorForIndex(i: number) {
  const opacity = CHART_OPACITIES[i % CHART_OPACITIES.length];
  return `color-mix(in srgb, var(--text) ${Math.round(opacity * 100)}%, transparent)`;
}

/* ---------- Donut Chart ---------- */
interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function DonutChart({
  segments,
  totalDisplay,
}: {
  segments: DonutSegment[];
  totalDisplay: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrapper">
      <svg viewBox="0 0 160 160" className="donut-svg">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border)" strokeWidth="14" />
        {total > 0 &&
          segments.map((seg, i) => {
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
                background: d.color,
                opacity: 0.85,
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
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <div className="stat-card glass">
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
        {sub && <span className="stat-card-sub">{sub}</span>}
      </div>
    </div>
  );
}

/* ---------- Sparkline (daily series) ---------- */
function Sparkline({ series }: { series: { bucket: string; value: number }[] }) {
  if (series.length === 0) return null;
  const max = Math.max(...series.map((s) => s.value), 1);
  const shown = series.slice(-30);
  return (
    <div
      className="field-sparkline"
      title={`${shown[0].bucket} → ${shown[shown.length - 1].bucket}`}
    >
      {shown.map((s) => (
        <span
          key={s.bucket}
          className="field-spark-bar"
          style={{ height: `${Math.max((s.value / max) * 100, 8)}%` }}
        />
      ))}
    </div>
  );
}

/* ---------- Field Stat Panel (generic) ----------
 * Renders the standard FieldStat format: headline totals, a group-by
 * breakdown, a per-project compare, and a daily sparkline. The panel
 * knows nothing about any specific field — it renders whatever the
 * engine computed from the owner's field definitions. */
interface FieldStat {
  field: string;
  data_type: string;
  capabilities: { total: boolean; group: boolean; compare: boolean; plot: boolean };
  entryCount: number;
  count: number;
  displayTotal: string | null;
  displayAvg: string | null;
  groups: { value: string; count: number }[];
  series: { bucket: string; value: number }[];
  byProject: { key: string; count: number; total: number; display: string }[];
}

function FieldStatPanel({ stat, showCompare }: { stat: FieldStat; showCompare: boolean }) {
  const groupData = stat.groups.slice(0, 6).map((g, i) => ({
    label: g.value,
    value: g.count,
    display: String(g.count),
    color: colorForIndex(i),
  }));
  const compareData = stat.byProject.map((p, i) => ({
    label: p.key,
    value: stat.capabilities.total ? p.total : p.count,
    display: p.display,
    color: colorForIndex(i),
  }));

  return (
    <div className="stats-panel glass">
      <div className="field-stat-header">
        <h3 className="stats-panel-title">{stat.field}</h3>
        <span className="field-type-chip">{stat.data_type}</span>
      </div>
      <div className="field-stat-headline">
        {stat.capabilities.total && stat.displayTotal && (
          <>
            <div className="field-stat-main">
              <span className="field-stat-value">{stat.displayTotal}</span>
              <span className="field-stat-label">Total</span>
            </div>
            {stat.displayAvg && (
              <div className="field-stat-main">
                <span className="field-stat-value">{stat.displayAvg}</span>
                <span className="field-stat-label">Avg</span>
              </div>
            )}
          </>
        )}
        <div className="field-stat-main">
          <span className="field-stat-value">{stat.count}</span>
          <span className="field-stat-label">Filled</span>
        </div>
      </div>
      {stat.series.length > 1 && <Sparkline series={stat.series} />}
      {groupData.length > 0 && (
        <div className="field-stat-groups">
          <span className="field-stat-subtitle">By value</span>
          <BarChart data={groupData} />
        </div>
      )}
      {showCompare && stat.byProject.length > 1 && compareData.length > 0 && (
        <div className="field-stat-groups">
          <span className="field-stat-subtitle">By project</span>
          <BarChart data={compareData} />
        </div>
      )}
    </div>
  );
}

/* ---------- Main Component ---------- */
export function StatsView() {
  const { user } = useAuth();
  const email = user?.email || '';

  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dueSoonCount, setDueSoonCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    (async () => {
      // Read ONLY from IndexedDB. Mutations update it directly.
      try {
        const [cachedEntries, cachedProjects] = await Promise.all([
          cacheGet(CACHE_STORES.ALL_ENTRIES, email),
          cacheGet(CACHE_STORES.PROJECTS, email),
        ]);
        if (cancelled) return;
        if (cachedEntries?.data)
          setEntries(Array.isArray(cachedEntries.data) ? cachedEntries.data : []);
        if (cachedProjects?.data)
          setProjects(Array.isArray(cachedProjects.data) ? cachedProjects.data : []);
        if (cachedEntries?.data) {
          setDueSoonCount(computeDueSoon(cachedEntries.data).length);
        }
        if (!cachedEntries?.data && !cachedProjects?.data) {
          // First visit ever — trigger initial sync
          await syncAllData(email);
          if (cancelled) return;
          const [freshEntries, freshProjects] = await Promise.all([
            cacheGet(CACHE_STORES.ALL_ENTRIES, email),
            cacheGet(CACHE_STORES.PROJECTS, email),
          ]);
          if (freshEntries?.data)
            setEntries(Array.isArray(freshEntries.data) ? freshEntries.data : []);
          if (freshProjects?.data)
            setProjects(Array.isArray(freshProjects.data) ? freshProjects.data : []);
          if (freshEntries?.data) setDueSoonCount(computeDueSoon(freshEntries.data).length);
        }
      } catch (err) {
        console.error('[StatsView] Failed to load stats data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email]);

  // Tick every second only while a task is running so in-progress totals stay live.
  const hasInProgress = entries.some((e) => e.started_at && !e.ended_at);
  const now = useNow(1000, hasInProgress);

  // Collect the owner's field definitions for every project so the stats
  // engine knows each field's declared data type. Definitions are read from
  // the cache; anything missing is fetched (which also warms the cache).
  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    (async () => {
      const declared: FieldDef[] = [];
      await Promise.all(
        (Array.isArray(projects) ? projects : []).map(async (p) => {
          const name = (p as { project_name?: string })?.project_name;
          if (!name) return;
          let result = await cacheGet(CACHE_STORES.FIELDS, `${email}:${name}`);
          if (!result?.data) {
            result = await getFields(email, name);
          }
          const rows = (result?.data || []) as Array<Record<string, unknown>>;
          rows.forEach((r) => {
            if (r?.field_name) {
              declared.push({
                field_name: String(r.field_name),
                data_type: r.data_type ? String(r.data_type) : 'text',
              });
            }
          });
        })
      );
      if (!cancelled) setFieldDefs(declared);
    })();

    return () => {
      cancelled = true;
    };
  }, [email, projects]);

  // Generic field statistics — one standard format per field: total,
  // group-by, per-project compare, and a daily series. Definitions the
  // owner declared come from the fields table; anything present in the
  // data but never declared is derived, so no field is missed.
  const fieldStats = useMemo<FieldStat[]>(
    () => computeFieldStats(entries, fieldDefs, { now, maxGroups: 6 }),
    [entries, fieldDefs, now]
  );
  const hasMultipleProjects = useMemo(
    () => new Set(entries.map((e) => e.project_name || 'Unknown')).size > 1,
    [entries]
  );

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
        extra: `${ps.entryCount} ${ps.entryCount === 1 ? 'entry' : 'entries'}`,
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
      <div className="dash-layout">
        <div className="bg-mesh" />
        <NavBar projects={projects} entries={entries} activeView="all" />
        <main className="dash-main">
          <Header
            title="My Stats"
            entries={entries}
            projects={projects}
            dueSoonCount={dueSoonCount}
          />
          <div className="stats-page">
            <div className="feed-loading">
              <div
                className="animate-spin spinner-circle"
                style={{
                  width: 32,
                  height: 32,
                }}
              />
              <p>Loading stats...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />
      <NavBar projects={projects} entries={entries} activeView="all" />
      <main className="dash-main">
        <Header
          title="My Stats"
          entries={entries}
          projects={projects}
          dueSoonCount={dueSoonCount}
        />
        <div className="stats-page">
          {projectStats.length === 0 && fieldStats.length === 0 ? (
            <div className="stats-empty glass">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.4 }}
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <h2>No stats yet</h2>
              <p>Log entries — with custom fields or a running timer — to see stats here.</p>
            </div>
          ) : (
            <div className="stats-content">
              {/* Overview Cards */}
              <div className="stats-cards-grid">
                <StatCard
                  icon={
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  }
                  value={entries.length}
                  label="Total Entries"
                />
                <StatCard
                  icon={
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  }
                  value={projects.filter((p) => !p.archived).length}
                  label="Active Projects"
                />
                <StatCard
                  icon={
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  }
                  value={dueSoonCount}
                  label="Due Soon"
                />
                <StatCard
                  icon={
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  }
                  value={formatDuration(totalMs)}
                  label="Time Tracked"
                  sub={inProgressCount > 0 ? `${inProgressCount} in progress` : undefined}
                />
              </div>

              {/* Donut + Legend */}
              <div className="stats-chart-row">
                <div className="stats-panel glass">
                  <h3 className="stats-panel-title">Time Distribution</h3>
                  <DonutChart segments={donutSegments} totalDisplay={formatDuration(totalMs)} />
                  <div className="donut-legend">
                    {projectStats.map((ps, i) => {
                      const pct = totalMs > 0 ? ((ps.totalMs / totalMs) * 100).toFixed(1) : '0';
                      return (
                        <div key={ps.project_name} className="donut-legend-item">
                          <span
                            className="donut-legend-dot"
                            style={{ background: colorForIndex(i) }}
                          />
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
                      <div
                        className="status-ring"
                        style={
                          {
                            '--pct': `${entries.length ? (completedCount / entries.length) * 100 : 0}%`,
                          } as React.CSSProperties
                        }
                      >
                        <span className="status-count">{completedCount}</span>
                      </div>
                      <span className="status-label">Completed</span>
                    </div>
                    <div className="status-item">
                      <div
                        className="status-ring status-ring-active"
                        style={
                          {
                            '--pct': `${entries.length ? (inProgressCount / entries.length) * 100 : 0}%`,
                          } as React.CSSProperties
                        }
                      >
                        <span className="status-count">{inProgressCount}</span>
                      </div>
                      <span className="status-label">In Progress</span>
                    </div>
                    <div className="status-item">
                      <div
                        className="status-ring status-ring-idle"
                        style={
                          {
                            '--pct': `${entries.length ? (noTimerCount / entries.length) * 100 : 0}%`,
                          } as React.CSSProperties
                        }
                      >
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

              {/* Field Insights — generic stats for every owner-defined field,
              rendered from the same standard format as the panels above */}
              {fieldStats.length > 0 && (
                <>
                  <div className="stats-view-section-title" style={{ marginTop: '0.5rem' }}>
                    Field Insights
                  </div>
                  <div className="field-insights-grid">
                    {fieldStats.map((fs) => (
                      <FieldStatPanel key={fs.field} stat={fs} showCompare={hasMultipleProjects} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default StatsView;
