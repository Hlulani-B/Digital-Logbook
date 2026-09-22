import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  calculateTotalTimeTracked,
  calculateProjectStats,
  analysisFieldDefs,
  computeFieldAnalysis,
  fieldAnalysisPolicy,
  dailyWindow,
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
type FieldDef = { field_name: string; data_type: string; [key: string]: unknown };
type FieldAnalysis = ReturnType<typeof computeFieldAnalysis>;
type DailyPoint = { bucket: string; value: number | null };
type Matrix = {
  rows: { key: string; label: string }[];
  columns: { key: string; label: string }[];
  values: (number | null)[][];
};

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
  label = 'Total Tracked',
}: {
  segments: DonutSegment[];
  totalDisplay: string;
  label?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrapper">
      <svg viewBox="0 0 160 160" className="donut-svg" role="img" aria-label={label}>
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
        <span className="donut-center-label">{label}</span>
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
  const min = Math.min(0, ...data.map((d) => d.value));
  const max = Math.max(0, ...data.map((d) => d.value));
  const span = max - min || 1;
  const zero = (-min / span) * 100;

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
            <span className="bar-chart-zero" style={{ left: `${zero}%` }} />
            <div
              className="bar-chart-fill"
              style={{
                left: `${((Math.min(0, d.value) - min) / span) * 100}%`,
                width: `${(Math.abs(d.value) / span) * 100}%`,
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
  label = 'Daily activity trend',
}: {
  series: DailyPoint[];
  formatValue: (v: number) => string;
  label?: string;
}) {
  if (series.length === 0) return <p>No dated values to plot.</p>;
  const shown = series;
  const values = shown.flatMap((s) => (s.value === null ? [] : [s.value]));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const W = 640;
  const H = 190;
  const padL = 64;
  const padR = 18;
  const padT = 14;
  const padB = 28;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const start = Date.parse(shown[0].bucket);
  const elapsed = Date.parse(shown[shown.length - 1].bucket) - start;
  const x = (i: number) =>
    padL + (elapsed ? ((Date.parse(shown[i].bucket) - start) / elapsed) * iw : iw / 2);
  const y = (v: number) => padT + ih - ((v - min) / span) * ih;

  const points = shown.map((s, i) => ({
    ...s,
    cx: x(i),
    cy: s.value === null ? null : y(s.value),
  }));
  const linePath = points
    .map((p, i) =>
      p.cy === null
        ? ''
        : `${i === 0 || points[i - 1].cy === null ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`
    )
    .join(' ');
  const tickIdx = [
    0,
    Math.floor((shown.length - 1) / 3),
    Math.floor((2 * (shown.length - 1)) / 3),
    shown.length - 1,
  ].filter((v, i, a) => v >= 0 && a.indexOf(v) === i);

  return (
    <div className="trend-chart-wrapper">
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-chart-svg" role="img" aria-label={label}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(min + span * f)}
              y2={y(min + span * f)}
              className="trend-grid"
            />
            <text
              x={padL - 8}
              y={y(min + span * f) + 4}
              textAnchor="end"
              className="trend-axis-text"
            >
              {formatValue(min + span * f)}
            </text>
          </g>
        ))}
        {tickIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="trend-axis-text">
            {formatTrendBucket(shown[i].bucket)}
          </text>
        ))}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="analysis-zero" />
        <path d={linePath} className="trend-line" />
        {points.map((p) =>
          p.cy === null || p.value === null ? null : (
            <circle
              key={p.bucket}
              cx={p.cx}
              cy={p.cy}
              r={shown.length > 30 ? 2.5 : 3.5}
              className="trend-dot"
            >
              <title>{`${p.bucket}: ${formatValue(p.value)}`}</title>
            </circle>
          )
        )}
      </svg>
    </div>
  );
}

/* One selectable series in the "Plot over time" panel. */
interface PlotOption {
  key: string;
  label: string;
  series: DailyPoint[];
  formatValue: (v: number) => string;
}

/* ---------- Type-aware field analysis ---------- */
function Coverage({ stat }: { stat: FieldAnalysis }) {
  return (
    <p className="analysis-note">
      Full project: {stat.coverage.filled} filled of {stat.coverage.total} entries
      {' · '}
      {stat.coverage.missing} missing · {stat.coverage.invalid} invalid (excluded)
    </p>
  );
}

function FieldStatPanel({ stat }: { stat: FieldAnalysis }) {
  return (
    <div className="stats-panel glass">
      <div className="field-stat-header">
        <h3 className="stats-panel-title">{stat.field}</h3>
        <span className="field-type-chip">{stat.data_type}</span>
      </div>
      {stat.numeric && (
        <div className="field-stat-headline">
          {Object.entries(stat.numeric).map(([key, value]) => (
            <div className="field-stat-main" key={key}>
              <span className="field-stat-value">{formatStatValue(value, stat.data_type)}</span>
              <span className="field-stat-label">{key}</span>
            </div>
          ))}
        </div>
      )}
      <Coverage stat={stat} />
    </div>
  );
}

function DataTable({
  matrix,
  caption,
  formatValue,
  rowHeading = 'Value',
}: {
  matrix: Matrix;
  caption: string;
  formatValue: (value: number) => string;
  rowHeading?: string;
}) {
  return (
    <details className="analysis-data">
      <summary>View complete data</summary>
      <div className="analysis-scroll" role="region" aria-label={`${caption} data`} tabIndex={0}>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{rowHeading}</th>
              {matrix.columns.map((column) => (
                <th scope="col" key={column.key}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, i) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {matrix.columns.map((column, j) => (
                  <td key={column.key}>
                    {matrix.values[i][j] === null
                      ? 'No observations'
                      : formatValue(matrix.values[i][j] as number)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function seriesMatrix(series: DailyPoint[], label: string): Matrix {
  return {
    rows: series.map(({ bucket }) => ({ key: bucket, label: bucket })),
    columns: [{ key: 'value', label }],
    values: series.map(({ value }) => [value]),
  };
}

function MatrixChart({
  matrix,
  formatValue,
  label,
  daily = false,
}: {
  matrix: Matrix;
  formatValue: (value: number) => string;
  label: string;
  daily?: boolean;
}) {
  if (!matrix.rows.length || !matrix.columns.length) return <p>No comparable values to plot.</p>;
  const values = matrix.values.flat().filter((v): v is number => v !== null);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const width = Math.max(640, matrix.rows.length * (matrix.columns.length * 12 + 16));
  const height = 240;
  const left = 72;
  const bottom = 195;
  const y = (v: number) => bottom - ((v - min) / span) * 175;
  const step = (width - left - 16) / matrix.rows.length;
  const barWidth = (step * 0.8) / matrix.columns.length;
  return (
    <>
      <div className="analysis-scroll" role="region" aria-label={`${label} chart`} tabIndex={0}>
        <svg width={width} height={height} role="img" aria-label={label} className="analysis-bars">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={left}
                x2={width - 16}
                y1={y(min + span * f)}
                y2={y(min + span * f)}
                className="trend-grid"
              />
              <text
                x={left - 8}
                y={y(min + span * f) + 4}
                textAnchor="end"
                className="trend-axis-text"
              >
                {formatValue(min + span * f)}
              </text>
            </g>
          ))}
          <line x1={left} x2={width - 16} y1={y(0)} y2={y(0)} className="analysis-zero" />
          {matrix.rows.map((row, i) => (
            <g key={row.key}>
              {matrix.columns.map((column, j) => {
                const value = matrix.values[i][j];
                if (value === null) return null;
                return (
                  <rect
                    key={column.key}
                    x={left + i * step + step * 0.1 + j * barWidth}
                    y={Math.min(y(0), y(value))}
                    width={Math.max(0, barWidth - 1)}
                    height={Math.abs(y(value) - y(0))}
                    fill={colorForIndex(j)}
                  >
                    <title>
                      {row.label} · {column.label}: {formatValue(value)}
                    </title>
                  </rect>
                );
              })}
              {(!daily ||
                i % Math.ceil(matrix.rows.length / 8) === 0 ||
                i === matrix.rows.length - 1) && (
                <text
                  x={left + (i + 0.5) * step}
                  y={bottom + 22}
                  textAnchor="middle"
                  className="trend-axis-text"
                >
                  <title>{row.label}</title>
                  {daily
                    ? formatTrendBucket(row.label)
                    : row.label.length > 14
                      ? `${row.label.slice(0, 12)}…`
                      : row.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <ul className="analysis-legend" aria-label="Chart legend">
        {matrix.columns.map((column, j) => (
          <li key={column.key}>
            <span className="donut-legend-dot" style={{ background: colorForIndex(j) }} />
            {column.label}
          </li>
        ))}
      </ul>
    </>
  );
}

const VIEW_LABELS: Record<string, string> = {
  bars: 'Bar chart',
  donut: 'Composition donut',
  trend: 'Trend',
  grouped: 'Grouped comparison',
  search: 'Search values',
  summary: 'Coverage summary',
};

function FieldAnalysisDetail({
  entries,
  defs,
  def,
  now,
}: {
  entries: Entry[];
  defs: FieldDef[];
  def: FieldDef;
  now: number;
}) {
  const policy = fieldAnalysisPolicy(def.data_type);
  const [chosenView, setView] = useState(policy.defaultView);
  const [aggregation, setAggregation] = useState('sum');
  const [compareKey, setCompareKey] = useState('');
  const [search, setSearch] = useState('');
  const partners = defs.filter(
    (d) =>
      d.field_name !== def.field_name &&
      ['category', 'boolean'].includes(fieldAnalysisPolicy(d.data_type).kind)
  );
  const eligibleViews = policy.views.filter((v) => v !== 'grouped' || partners.length > 0);
  const view = eligibleViews.includes(chosenView) ? chosenView : policy.defaultView;
  const compareDef = partners.find((d) => d.field_name === compareKey);
  useEffect(() => {
    if (!compareDef) {
      setCompareKey('');
      if (chosenView === 'grouped') setView(policy.defaultView);
    }
  }, [compareDef, chosenView, policy.defaultView]);
  const stat = useMemo(
    () =>
      computeFieldAnalysis(entries, def, {
        now,
        aggregation,
        compareDef: view === 'grouped' ? compareDef : null,
      }),
    [entries, def, now, aggregation, view, compareDef]
  );
  const numeric = policy.kind === 'numeric';
  const dated = numeric || policy.kind === 'date';
  const formatValue = (value: number) => formatStatValue(value, numeric ? def.data_type : 'number');
  const metricLabel = numeric
    ? `${aggregation === 'sum' ? 'Total' : 'Average'} ${def.field_name}${def.data_type === 'duration' ? ' (duration)' : ''}`
    : 'Entry count';
  const dailyMatrix = seriesMatrix(stat.series, metricLabel);
  const categoryMatrix: Matrix = {
    rows: stat.frequencies.map((f) => ({ key: f.key, label: f.label })),
    columns: [{ key: 'count', label: 'Entry count' }],
    values: stat.frequencies.map((f) => [f.count]),
  };
  const validCount = stat.coverage.filled - stat.coverage.invalid;
  const searchRows = stat.frequencies.filter((f) =>
    f.label.toLocaleLowerCase('en-US').includes(search.toLocaleLowerCase('en-US'))
  );
  const chartLabel = `${def.field_name} — ${VIEW_LABELS[view]}`;

  return (
    <div className="analysis-detail">
      <div className="analysis-controls">
        <label>
          View
          <select
            className="field-plot-select"
            value={view}
            onChange={(e) => {
              setView(e.target.value);
              if (e.target.value === 'grouped')
                setCompareKey(compareDef?.field_name || partners[0].field_name);
            }}
          >
            {eligibleViews.map((v) => (
              <option value={v} key={v}>
                {VIEW_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
        {numeric && (
          <label>
            Aggregation
            <select
              className="field-plot-select"
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value)}
            >
              <option value="sum">Sum</option>
              <option value="average">Average</option>
            </select>
          </label>
        )}
        {view === 'grouped' && (
          <label>
            Compare by
            <select
              className="field-plot-select"
              value={compareKey}
              onChange={(e) => setCompareKey(e.target.value)}
            >
              {partners.map((d) => (
                <option key={d.field_name} value={d.field_name}>
                  {d.field_name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <Coverage stat={stat} />
      <p className="analysis-note">
        {numeric
          ? `${metricLabel} by entry creation day (UTC).`
          : policy.kind === 'date'
            ? `Entry counts by ${def.field_name} value (UTC), not entry creation date.`
            : policy.kind === 'multi'
              ? 'Entries selecting each option; selections overlap, so counts are not composition percentages.'
              : policy.kind === 'text'
                ? 'Plain-text values across the full project. Search matches literal text.'
                : policy.kind === 'summary'
                  ? 'Coverage only: this field type does not have a meaningful numeric or category chart.'
                  : `${validCount} valid entries across the full project; missing and invalid values are excluded from percentages.`}
      </p>
      {stat.range && (
        <p className="analysis-note">
          60-day window: {stat.range.start} – {stat.range.end} (UTC).
          {aggregation === 'average' && numeric
            ? ' Gaps mean no observations, not zero.'
            : ' Days without observations are zero.'}
        </p>
      )}
      {stat.undatedCount > 0 && (
        <p className="analysis-note">
          {stat.undatedCount} valid values excluded from daily charts: no valid entry creation date.
        </p>
      )}
      {view === 'grouped' && stat.comparison ? (
        <>
          <p className="analysis-note">
            {stat.comparison.excluded} entries excluded for missing or invalid comparison values or
            dates. Each legend item is a {compareDef?.field_name} category.
          </p>
          <MatrixChart
            matrix={stat.comparison.display}
            formatValue={formatValue}
            label={chartLabel}
            daily={numeric}
          />
          <DataTable
            matrix={stat.comparison.full}
            caption={`${def.field_name} by ${compareDef?.field_name}`}
            formatValue={formatValue}
            rowHeading={numeric ? 'Creation day (UTC)' : def.field_name}
          />
        </>
      ) : view === 'trend' ? (
        <>
          <TrendChart series={stat.series} formatValue={formatValue} label={chartLabel} />
          <DataTable
            matrix={dailyMatrix}
            caption={`${def.field_name} daily values`}
            formatValue={formatValue}
            rowHeading={numeric ? 'Creation day (UTC)' : 'Field date (UTC)'}
          />
        </>
      ) : view === 'bars' && dated ? (
        <>
          <MatrixChart matrix={dailyMatrix} formatValue={formatValue} label={chartLabel} daily />
          <DataTable
            matrix={dailyMatrix}
            caption={`${def.field_name} daily values`}
            formatValue={formatValue}
            rowHeading="Creation day (UTC)"
          />
        </>
      ) : view === 'bars' || view === 'donut' ? (
        <>
          {validCount === 0 ? (
            <p>No valid values to plot.</p>
          ) : view === 'donut' ? (
            <>
              <DonutChart
                segments={stat.displayFrequencies.map((f, i) => ({
                  label: f.label,
                  value: f.count,
                  color: colorForIndex(i),
                }))}
                totalDisplay={String(validCount)}
                label={`${def.field_name} composition`}
              />
              <ul className="analysis-legend" aria-label="Chart legend">
                {stat.displayFrequencies.map((f, i) => (
                  <li key={f.key}>
                    <span className="donut-legend-dot" style={{ background: colorForIndex(i) }} />
                    {f.label}: {f.count} ({((f.count / validCount) * 100).toFixed(1)}%)
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div role="group" aria-label={chartLabel}>
              <BarChart
                data={stat.displayFrequencies.map((f, i) => ({
                  label: f.label,
                  value: f.count,
                  display: String(f.count),
                  color: colorForIndex(i),
                }))}
              />
            </div>
          )}
          <DataTable
            matrix={categoryMatrix}
            caption={`${def.field_name} frequencies`}
            formatValue={String}
          />
        </>
      ) : view === 'search' ? (
        <>
          <label className="analysis-search">
            Search values
            <input
              className="field-plot-select"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <p className="analysis-note" role="status">
            {searchRows.length} matching values
          </p>
          <div
            className="analysis-scroll analysis-text-results"
            tabIndex={0}
            role="region"
            aria-label={`${def.field_name} search results`}
          >
            <table>
              <caption>{def.field_name} values</caption>
              <thead>
                <tr>
                  <th scope="col">Value</th>
                  <th scope="col">Entries</th>
                </tr>
              </thead>
              <tbody>
                {searchRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {searchRows.length === 0 && <p>No matching values.</p>}
          </div>
        </>
      ) : null}
      {stat.frequencies.length > 6 && view !== 'search' && (
        <p className="analysis-note">
          Category charts show the top five plus Other; the complete data table retains every
          category.
        </p>
      )}
    </div>
  );
}

function FieldExplorer({
  entries,
  defs,
  now,
}: {
  entries: Entry[];
  defs: FieldDef[];
  now: number;
}) {
  const [field, setField] = useState(defs[0]?.field_name || '');
  const selected = defs.find((d) => d.field_name === field) || defs[0];
  useEffect(() => {
    if (selected && selected.field_name !== field) setField(selected.field_name);
  }, [selected, field]);
  if (!selected) return null;
  return (
    <section className="stats-panel glass" aria-labelledby="field-analysis-title">
      <h3 className="stats-panel-title" id="field-analysis-title">
        Field analysis
      </h3>
      <label className="analysis-field-label">
        Field
        <select
          className="field-plot-select"
          value={selected.field_name}
          onChange={(e) => setField(e.target.value)}
        >
          {defs.map((d) => (
            <option key={d.field_name} value={d.field_name}>
              {d.field_name} ({d.data_type})
            </option>
          ))}
        </select>
      </label>
      <FieldAnalysisDetail
        key={`${selected.field_name}:${selected.data_type}`}
        entries={entries}
        defs={defs}
        def={selected}
        now={now}
      />
    </section>
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
  const fieldsKey = `${email}:${scopeProject}`;
  const [fieldState, setFieldState] = useState<{
    key: string;
    defs: FieldDef[];
    ready: boolean;
    error?: boolean;
  }>({ key: '', defs: [], ready: false });
  const fieldDefs = fieldState.key === fieldsKey ? fieldState.defs : [];
  const fieldsReady = fieldState.key === fieldsKey && fieldState.ready;
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
    setEntries([]);
    setProjects([]);
    setLoading(!!email);
    loadData();
    return () => {
      loadSeq.current++;
    };
  }, [email, loadData]);

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
    setFieldState({ key: fieldsKey, defs: [], ready: false });
    if (!email || !scopeProject) return;
    let cancelled = false;
    let sequence = 0;
    const loadFields = async () => {
      const seq = ++sequence;
      try {
        let result = await cacheGet(CACHE_STORES.FIELDS, fieldsKey);
        if (!result?.data) result = await getFields(email, scopeProject);
        if (cancelled || seq !== sequence) return;
        const rows = Array.isArray(result?.data) ? result.data : [];
        setFieldState({
          key: fieldsKey,
          ready: true,
          defs: rows.filter((r: FieldDef) => r?.field_name),
        });
      } catch (err) {
        if (cancelled || seq !== sequence) return;
        console.error('[StatsView] Failed to load field definitions:', err);
        setFieldState({ key: fieldsKey, defs: [], ready: true, error: true });
      }
    };
    const unsubscribe = cacheSubscribe(CACHE_STORES.FIELDS, fieldsKey, loadFields);
    loadFields();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [email, scopeProject, fieldsKey]);

  // Generic field statistics — one standard format per field: total,
  // group-by, and a daily series. Shown only on the project stats
  // dashboard (the ?project= view); the global "My Stats" page shows no
  // field insights. Definitions the owner declared come from the fields
  // table; anything present in the data but never declared is derived, so
  // no field is missed.
  const analysisDefs = useMemo(
    () => (scopeProject && fieldsReady ? analysisFieldDefs(scopedEntries, fieldDefs) : []),
    [scopeProject, fieldsReady, scopedEntries, fieldDefs]
  );
  const fieldStats = useMemo(
    () => analysisDefs.map((def) => computeFieldAnalysis(scopedEntries, def, { now })),
    [analysisDefs, scopedEntries, now]
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
    return { entries: dailyWindow(toSeries(counts)), time: dailyWindow(toSeries(ms)) };
  }, [scopedEntries, now]);

  // Activity stays separate from the type-aware custom-field explorer.
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
    return options;
  }, [activitySeries]);
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
          {scopeProject && !fieldsReady ? (
            <p role="status">Loading field definitions...</p>
          ) : projectStats.length === 0 && fieldStats.length === 0 ? (
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

              {/* Built-in activity uses entry creation dates, independently of field analysis. */}
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
                  <p className="analysis-note">
                    {selectedPlot.label} by entry creation day (UTC). 60-day window:{' '}
                    {selectedPlot.series[0].bucket} –{' '}
                    {selectedPlot.series[selectedPlot.series.length - 1].bucket}. Days without
                    observations are zero.
                  </p>
                  <TrendChart series={selectedPlot.series} formatValue={selectedPlot.formatValue} />
                  <DataTable
                    matrix={seriesMatrix(selectedPlot.series, selectedPlot.label)}
                    caption={selectedPlot.label}
                    formatValue={selectedPlot.formatValue}
                    rowHeading="Creation day (UTC)"
                  />
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
                  {fieldState.error && (
                    <p className="analysis-note">
                      Field definitions are unavailable; showing inferred field types.
                    </p>
                  )}
                  <FieldExplorer
                    key={fieldsKey}
                    entries={scopedEntries}
                    defs={analysisDefs}
                    now={now}
                  />
                  <div className="field-insights-grid">
                    {fieldStats.map((fs) => (
                      <FieldStatPanel key={fs.field} stat={fs} />
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
