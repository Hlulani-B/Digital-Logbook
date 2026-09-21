import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  calculateTotalTimeTracked,
  calculateProjectStats,
  computeFieldStats,
  entryDurationMs,
  dayBucket,
  formatDuration,
  formatStatValue,
} from '@/functions/dashboard/stats.js';
import { getFields } from '@/functions/project/fields.js';
import { useNow } from '@/hooks/useNow';
import { NavBar } from '@/components/NavBar';
import { Header } from '@/components/Header';
import { cacheGet, cacheSubscribe, CACHE_STORES } from '@/lib/cache';
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

/* ---------- Trend Chart (plot over time) ----------
 * Full daily-series chart with date and value axes — the visible
 * "plot over time" capability for any series the stats engine computes,
 * whether a built-in activity metric or an owner-defined field. */
const TREND_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatTrendBucket(bucket: string) {
  const [, m, d] = bucket.split('-').map(Number);
  return m >= 1 && m <= 12 ? `${TREND_MONTHS[m - 1]} ${d}` : bucket;
}

function TrendChart({
  series,
  formatValue,
}: {
  series: { bucket: string; value: number }[];
  formatValue: (v: number) => string;
}) {
  if (series.length === 0) return null;
  // Cap the window so long histories stay readable.
  const shown = series.slice(-60);
  const max = Math.max(...shown.map((s) => s.value), 1);
  const W = 640;
  const H = 190;
  const padL = 64;
  const padR = 18;
  const padT = 14;
  const padB = 28;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const x = (i: number) => padL + (shown.length === 1 ? iw / 2 : (i / (shown.length - 1)) * iw);
  const y = (v: number) => padT + ih - (v / max) * ih;

  const points = shown.map((s, i) => ({ ...s, cx: x(i), cy: y(s.value) }));
  const baseline = padT + ih;
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`)
    .join(' ');
  const areaPath = [
    linePath,
    `L${points[points.length - 1].cx.toFixed(1)},${baseline}`,
    `L${points[0].cx.toFixed(1)},${baseline}`,
    'Z',
  ].join(' ');
  const tickIdx = [
    0,
    Math.floor((shown.length - 1) / 3),
    Math.floor((2 * (shown.length - 1)) / 3),
    shown.length - 1,
  ].filter((v, i, a) => v >= 0 && a.indexOf(v) === i);

  return (
    <div className="trend-chart-wrapper">
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-chart-svg" role="img">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={y(max * f)} y2={y(max * f)} className="trend-grid" />
            <text x={padL - 8} y={y(max * f) + 4} textAnchor="end" className="trend-axis-text">
              {formatValue(Math.round(max * f * 100) / 100)}
            </text>
          </g>
        ))}
        {tickIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="trend-axis-text">
            {formatTrendBucket(shown[i].bucket)}
          </text>
        ))}
        <path d={areaPath} className="trend-area" />
        <path d={linePath} className="trend-line" />
        {points.map((p) => (
          <circle
            key={p.bucket}
            cx={p.cx}
            cy={p.cy}
            r={shown.length > 30 ? 2.5 : 3.5}
            className="trend-dot"
          >
            <title>{`${p.bucket}: ${formatValue(p.value)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/* One selectable series in the "Plot over time" panel. */
interface PlotOption {
  key: string;
  label: string;
  series: { bucket: string; value: number }[];
  formatValue: (v: number) => string;
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
  // Optional ?project= scope — set by the Stats button on a project
  // dashboard so every panel on this page follows one scope.
  const [searchParams, setSearchParams] = useSearchParams();
  const scopeProject = searchParams.get('project') || '';

  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dueSoonCount, setDueSoonCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  // Selected series in the "Plot over time" panel
  const [plotKey, setPlotKey] = useState('');

  // Guard against overlapping loadData calls (mount effect + two
  // cacheSubscribe listeners firing near-simultaneously during a sync).
  const loadSeq = useRef(0);

  const loadData = useCallback(async () => {
    if (!email) return;
    const seq = ++loadSeq.current;
    // Read ONLY from IndexedDB. Mutations update it directly.
    try {
      const [cachedEntries, cachedProjects] = await Promise.all([
        cacheGet(CACHE_STORES.ALL_ENTRIES, email),
        cacheGet(CACHE_STORES.PROJECTS, email),
      ]);
      if (seq !== loadSeq.current) return;
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
        const [freshEntries, freshProjects] = await Promise.all([
          cacheGet(CACHE_STORES.ALL_ENTRIES, email),
          cacheGet(CACHE_STORES.PROJECTS, email),
        ]);
        if (seq !== loadSeq.current) return;
        if (freshEntries?.data)
          setEntries(Array.isArray(freshEntries.data) ? freshEntries.data : []);
        if (freshProjects?.data)
          setProjects(Array.isArray(freshProjects.data) ? freshProjects.data : []);
        if (freshEntries?.data) setDueSoonCount(computeDueSoon(freshEntries.data).length);
      }
    } catch (err) {
      console.error('[StatsView] Failed to load stats data:', err);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to cache changes — re-render when syncAllData or a mutation writes new rows
  useEffect(() => {
    if (!email) return;
    const unsubs = [
      cacheSubscribe(CACHE_STORES.ALL_ENTRIES, email, () => loadData()),
      cacheSubscribe(CACHE_STORES.PROJECTS, email, () => loadData()),
    ];
    return () => unsubs.forEach((u) => u());
  }, [email, loadData]);

  // Entries scoped to ?project= — every stat below derives from these so
  // the whole dashboard follows a single scope.
  const scopedEntries = useMemo(
    () => (scopeProject ? entries.filter((e) => e.project_name === scopeProject) : entries),
    [entries, scopeProject]
  );

  // Tick every second only while a task is running so in-progress totals stay live.
  const hasInProgress = scopedEntries.some((e) => e.started_at && !e.ended_at);
  const now = useNow(1000, hasInProgress);

  // Collect the owner's field definitions for the scoped project so the
  // stats engine knows each field's declared data type. Field Insights are
  // a project-scoped feature — the global "My Stats" view doesn't show
  // them, so nothing is fetched when no project is selected. Definitions
  // are read from the cache; anything missing is fetched (which also warms
  // the cache).
  useEffect(() => {
    if (!email || !scopeProject) return;
    let cancelled = false;

    (async () => {
      let result = await cacheGet(CACHE_STORES.FIELDS, `${email}:${scopeProject}`);
      if (!result?.data) {
        result = await getFields(email, scopeProject);
      }
      const rows = (result?.data || []) as Array<Record<string, unknown>>;
      if (!cancelled) {
        setFieldDefs(
          rows
            .filter((r) => r?.field_name)
            .map((r) => ({
              field_name: String(r.field_name),
              data_type: r.data_type ? String(r.data_type) : 'text',
            }))
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, scopeProject]);

  // Generic field statistics — one standard format per field: total,
  // group-by, and a daily series. Shown only on the project stats
  // dashboard (the ?project= view); the global "My Stats" page shows no
  // field insights. Definitions the owner declared come from the fields
  // table; anything present in the data but never declared is derived, so
  // no field is missed.
  const fieldStats = useMemo<FieldStat[]>(
    () => (scopeProject ? computeFieldStats(scopedEntries, fieldDefs, { now, maxGroups: 6 }) : []),
    [scopeProject, scopedEntries, fieldDefs, now]
  );

  // Daily activity series — entries logged per day and time tracked per
  // day — bucketed the same way the engine buckets field plots so the
  // plot-over-time panel always has something to draw even without
  // custom fields.
  const activitySeries = useMemo(() => {
    const counts = new Map<string, number>();
    const ms = new Map<string, number>();
    scopedEntries.forEach((entry) => {
      const bucket = dayBucket(entry);
      if (!bucket) return;
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
      const duration = entryDurationMs(entry, now);
      if (duration > 0) ms.set(bucket, (ms.get(bucket) || 0) + duration);
    });
    const toSeries = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([bucket, value]) => ({ bucket, value }))
        .sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
    return { entries: toSeries(counts), time: toSeries(ms) };
  }, [scopedEntries, now]);

  // Plot-over-time options: the built-in daily activity metrics plus
  // every scoped custom field, all drawn by the same TrendChart.
  const plotOptions = useMemo<PlotOption[]>(() => {
    const options: PlotOption[] = [];
    if (activitySeries.entries.length > 0) {
      options.push({
        key: 'activity:entries',
        label: 'Entries per day',
        series: activitySeries.entries,
        formatValue: (v) => String(v),
      });
    }
    if (activitySeries.time.length > 0) {
      options.push({
        key: 'activity:time',
        label: 'Time tracked per day',
        series: activitySeries.time,
        formatValue: (v) => formatDuration(v),
      });
    }
    fieldStats.forEach((fs) => {
      if (fs.series.length === 0) return;
      options.push({
        key: `field:${fs.field}`,
        label: fs.field,
        series: fs.series,
        formatValue: (v) => (fs.capabilities.total ? formatStatValue(v, fs.data_type) : String(v)),
      });
    });
    return options;
  }, [activitySeries, fieldStats]);
  const selectedPlot = plotOptions.find((o) => o.key === plotKey) || plotOptions[0];

  const totalTimeTracked = useMemo(
    () => calculateTotalTimeTracked(scopedEntries, now),
    [scopedEntries, now]
  );
  const projectStats = useMemo(
    () => calculateProjectStats(scopedEntries, now),
    [scopedEntries, now]
  );
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

  const completedCount = scopedEntries.filter((e) => e.ended_at).length;
  const inProgressCount = totalTimeTracked.inProgressCount;
  const noTimerCount = scopedEntries.length - completedCount - inProgressCount;
  // Due-soon count and page title follow the active scope
  const scopedDueSoonCount = useMemo(() => computeDueSoon(scopedEntries).length, [scopedEntries]);
  const shownDueSoonCount = scopeProject ? scopedDueSoonCount : dueSoonCount;
  const statsTitle = scopeProject ? `${scopeProject} — Stats` : 'My Stats';

  if (loading) {
    return (
      <div className="dash-layout">
        <div className="bg-mesh" />
        <NavBar projects={projects} entries={entries} activeView="all" />
        <main className="dash-main">
          <Header
            title={statsTitle}
            entries={entries}
            projects={projects}
            dueSoonCount={shownDueSoonCount}
          />
          <div className="stats-page" data-tour="page-stats">
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
          title={statsTitle}
          entries={entries}
          projects={projects}
          dueSoonCount={shownDueSoonCount}
        />
        <div className="stats-page" data-tour="page-stats">
          {/* Scope chip — shown while stats are scoped to one project */}
          {scopeProject && (
            <div className="stats-scope-chip glass">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="stats-scope-chip-label">
                Project: <strong>{scopeProject}</strong>
              </span>
              <button
                type="button"
                className="stats-scope-chip-clear"
                onClick={() => setSearchParams({})}
              >
                All projects
              </button>
            </div>
          )}
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
              <p>
                {scopeProject
                  ? `Log entries in ${scopeProject} — with custom fields or a running timer — to see stats here.`
                  : 'Log entries — with custom fields or a running timer — to see stats here.'}
              </p>
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
                  value={scopedEntries.length}
                  label="Total Entries"
                />
                {scopeProject ? (
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
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    }
                    value={completedCount}
                    label="Completed"
                    sub={inProgressCount > 0 ? `${inProgressCount} in progress` : undefined}
                  />
                ) : (
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
                )}
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
                  value={shownDueSoonCount}
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

              {/* Donut + Legend — cross-project view, hidden when scoped */}
              <div className="stats-chart-row">
                {!scopeProject && (
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
                )}

                {/* Status Breakdown */}
                <div
                  className="stats-panel glass"
                  style={scopeProject ? { gridColumn: '1 / -1' } : undefined}
                >
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

              {/* Plot over time — daily series for the built-in activity
              metrics plus every scoped custom field, selectable from the
              dropdown: sums per day for total-able fields, counts
              otherwise. */}
              {plotOptions.length > 0 && selectedPlot && (
                <div className="stats-panel glass">
                  <div className="field-plot-header">
                    <h3 className="stats-panel-title">Plot over time</h3>
                    <select
                      className="field-plot-select"
                      aria-label="Series to plot over time"
                      value={selectedPlot.key}
                      onChange={(e) => setPlotKey(e.target.value)}
                    >
                      {plotOptions.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <TrendChart series={selectedPlot.series} formatValue={selectedPlot.formatValue} />
                </div>
              )}

              {/* Time per Project Bar Chart — cross-project view */}
              {!scopeProject && (
                <div className="stats-panel glass">
                  <h3 className="stats-panel-title">Time per Project</h3>
                  <BarChart data={timeBarData} />
                </div>
              )}

              {/* Entries per Project Bar Chart — cross-project view */}
              {!scopeProject && (
                <div className="stats-panel glass">
                  <h3 className="stats-panel-title">Entries per Project</h3>
                  <BarChart data={entryBarData} />
                </div>
              )}

              {/* Field Insights — generic stats for every owner-defined
              field of the scoped project, rendered from the same standard
              format as the panels above. Hidden on the global view. */}
              {fieldStats.length > 0 && (
                <>
                  <div className="stats-view-section-title" style={{ marginTop: '0.5rem' }}>
                    Field Insights
                  </div>
                  <div className="field-insights-grid">
                    {fieldStats.map((fs) => (
                      <FieldStatPanel key={fs.field} stat={fs} showCompare={false} />
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
