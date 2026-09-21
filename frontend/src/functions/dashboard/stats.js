import { normalizeField } from '../../lib/fieldSchema.ts';

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
  if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
    ms = parts[0] * 3600000 + parts[1] * 60000 + parts[2] * 1000;
  } else if (parts.length === 2 && parts.every((p) => !isNaN(p))) {
    ms = parts[0] * 60000 + parts[1] * 1000;
  }

  return ms + days * 86400000;
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
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Calculate the elapsed (net worked) time in ms for a single entry.
 * Computes purely from timestamps — does NOT rely on the (dropped) `duration` column.
 * - Completed entries (ended_at + started_at): ended_at − started_at − paused_ms.
 * - In-progress running (started_at set, no ended_at, no paused_at): now − started_at − paused_ms.
 * - In-progress paused (started_at set, no ended_at, paused_at set): frozen at
 *   paused_at − started_at − paused_ms (does not accrue while paused).
 * - Fallback (ended_at + created_at, no started_at): ended_at − created_at (legacy,
 *   no pause data exists for these rows).
 * - Returns 0 if none of the above.
 *
 * Pause fields are additive-optional: entries without them (all legacy rows and
 * the existing test fixtures) behave exactly as before because `(paused_ms || 0)`
 * is 0 and the paused_at branch never fires.
 *
 * `now` is accepted as a parameter so callers can pass a single shared timestamp
 * (e.g. a ticking value) for consistent, live-updating in-progress durations.
 */
export function entryDurationMs(entry, now = Date.now()) {
  // node-pg returns BIGINT as a string; coerce so arithmetic stays numeric.
  const pausedMs = Number(entry.paused_ms) || 0;
  // Completed: ended_at − started_at − paused (the actual work time)
  if (entry.ended_at && entry.started_at) {
    const end = new Date(entry.ended_at).getTime();
    const start = new Date(entry.started_at).getTime();
    if (!isNaN(end) && !isNaN(start)) {
      return Math.max(0, end - start - pausedMs);
    }
  }
  // In-progress: anchor at paused_at when paused (frozen), else live now
  if (entry.started_at && !entry.ended_at) {
    const start = new Date(entry.started_at).getTime();
    const anchor = entry.paused_at ? new Date(entry.paused_at).getTime() : now;
    if (!isNaN(start) && !isNaN(anchor)) {
      return Math.max(0, anchor - start - pausedMs);
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
 * Countdown support: remaining time until the entry's target duration is met.
 * Returns null for entries without a target (legacy count-up mode), otherwise
 * max(0, target_duration_ms − net elapsed). A paused entry keeps whatever
 * remaining time it had when paused (net elapsed is frozen while paused).
 */
export function entryRemainingMs(entry, now = Date.now()) {
  if (entry.target_duration_ms == null) return null;
  const remaining = Number(entry.target_duration_ms) - entryDurationMs(entry, now);
  return Math.max(0, remaining);
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

/* ============================================================
 * Generic field statistics
 *
 * Statistics follow one format wherever they go. Any field its
 * owner has defined can be totalled, grouped by, compared across
 * projects, and plotted over time — the logbook never hard-codes
 * knowledge of a particular field. Everything below is driven by
 * field definitions (name + data_type) and the entry data itself.
 * ============================================================ */

/**
 * What the logbook knows about data types — and nothing else.
 * Capabilities decide how a field may be aggregated, so a field
 * the logbook has never seen behaves exactly like a built-in one.
 */
export const FIELD_CAPABILITIES = {
  number: { total: true, group: true, compare: true, plot: true },
  integer: { total: true, group: true, compare: true, plot: true },
  float: { total: true, group: true, compare: true, plot: true },
  duration: { total: true, group: true, compare: true, plot: true },
  text: { total: false, group: true, compare: true, plot: true },
  boolean: { total: false, group: true, compare: true, plot: true },
  date: { total: false, group: true, compare: true, plot: true },
};

/**
 * Built-in columns expressed as field definitions, so they flow
 * through the exact same engine as owner-defined fields.
 * `duration` is virtual — computed from started_at/ended_at.
 */
export const BUILTIN_FIELD_DEFS = [
  { field_name: 'project_name', data_type: 'text' },
  { field_name: 'status', data_type: 'text' },
  { field_name: 'priority', data_type: 'text' },
  { field_name: 'due_date', data_type: 'date' },
  { field_name: 'created_at', data_type: 'date' },
  { field_name: 'duration', data_type: 'duration' },
];

/** Keys that appear inside the entries JSONB but are engine-internal
 * or rendered elsewhere — never treated as owner fields. */
const RESERVED_FIELD_KEYS = new Set(['started_at', 'description']);

/** Capabilities for a data type (unknown types behave like text). */
export function fieldCapabilities(data_type) {
  return FIELD_CAPABILITIES[data_type] || FIELD_CAPABILITIES.text;
}

function isMissing(value) {
  return (
    value == null ||
    (typeof value === 'string' && !value.trim()) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function numericValue(raw, type = 'number') {
  if (typeof raw !== 'number' && typeof raw !== 'string') return undefined;
  if (typeof raw === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && (type !== 'integer' || Number.isInteger(value))
    ? value
    : undefined;
}

function isNumericLike(v) {
  return numericValue(v) !== undefined;
}

function dateValue(raw) {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?)?$/
  );
  if (!match) return undefined;
  const [, y, m, d, h, minute, second, , zone] = match;
  const year = Number(y);
  const month = Number(m);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || Number(d) < 1 || Number(d) > days[month - 1]) return undefined;
  if (h !== undefined && (Number(h) > 23 || Number(minute) > 59 || Number(second || 0) > 59)) {
    return undefined;
  }
  if (zone && zone.toUpperCase() !== 'Z') {
    const offset = zone.slice(1).replace(':', '');
    if (Number(offset.slice(0, 2)) > 23 || Number(offset.slice(2)) > 59) return undefined;
  }
  const iso =
    h === undefined
      ? `${value}T00:00:00Z`
      : `${value.replace(/[t ]/, 'T').replace(/z$/, 'Z')}${zone ? '' : 'Z'}`;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return undefined;
  const result = new Date(time).toISOString();
  return /^\d{4}-/.test(result) ? result : undefined;
}

function isBooleanLike(v) {
  return typeof v === 'boolean' || v === 'true' || v === 'false';
}

function isDateLike(v) {
  return dateValue(v) !== undefined;
}

/**
 * Infer a field's data type purely from its values — used when no
 * definition exists, so statistics still work for fields the
 * logbook has never seen in advance.
 */
export function inferDataType(values) {
  const vals = (values || []).filter((v) => !isMissing(v));
  if (vals.length === 0) return 'text';
  if (vals.some((v) => !['string', 'number', 'boolean'].includes(typeof v))) return 'summary';
  if (vals.every(isNumericLike)) return 'number';
  if (vals.every(isBooleanLike)) return 'boolean';
  if (vals.every(isDateLike)) return 'date';
  return 'text';
}

/**
 * Derive field definitions from entry data alone (union of the
 * keys present in the entries JSONB, with inferred data types).
 */
export function deriveFieldDefs(entries) {
  const byField = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const obj = entry && entry.entries;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    Object.keys(obj).forEach((key) => {
      if (RESERVED_FIELD_KEYS.has(key)) return;
      if (!byField.has(key)) byField.set(key, []);
      byField.get(key).push(obj[key]);
    });
  });
  return Array.from(byField.entries()).map(([field_name, values]) => ({
    field_name,
    data_type: inferDataType(values),
  }));
}

/**
 * Merge declared definitions (fields table) with derived ones
 * (from the data itself). Declared types win; derived fields fill
 * the gaps so nothing present in the data is missed.
 */
export function mergeFieldDefs(declared, derived) {
  const merged = new Map();
  (declared || []).forEach((d) => {
    if (d && d.field_name) {
      merged.set(d.field_name, { ...d, data_type: d.data_type || 'text' });
    }
  });
  (derived || []).forEach((d) => {
    if (d && d.field_name && !merged.has(d.field_name)) merged.set(d.field_name, d);
  });
  return Array.from(merged.values());
}

/**
 * Read one field's raw value from an entry. Custom fields live in
 * the entries JSONB; built-in columns sit at the top level. The
 * virtual `duration` field is computed from timestamps.
 */
function rawFieldValue(entry, field, now) {
  if (!entry) return undefined;
  if (field === 'duration') {
    return entry.started_at || entry.ended_at ? entryDurationMs(entry, now) : undefined;
  }
  const obj = entry.entries;
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj[field] !== undefined) {
    return obj[field];
  }
  return entry[field];
}

/**
 * Coerce a raw value to the type declared for its field.
 * Returns undefined for missing or unusable values.
 */
function coerceValue(raw, data_type) {
  if (isMissing(raw)) return undefined;
  if (['number', 'integer', 'float', 'duration'].includes(data_type)) {
    return numericValue(raw, data_type);
  }
  if (data_type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw !== 'string') return undefined;
    const s = raw.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    return undefined;
  }
  if (data_type === 'date' || data_type === 'timestamp') return dateValue(raw);
  if (
    typeof raw === 'string' ||
    typeof raw === 'boolean' ||
    (typeof raw === 'number' && Number.isFinite(raw))
  )
    return String(raw);
  return undefined;
}

/** Normalise a coerced value into a display-safe group key. */
function groupKey(value, data_type) {
  if (['date', 'timestamp'].includes(data_type) && typeof value === 'string')
    return value.slice(0, 10);
  return String(value);
}

/** Day bucket (UTC YYYY-MM-DD) for plotting a field over time. */
export function dayBucket(entry) {
  return dateValue(entry?.created_at)?.slice(0, 10) || null;
}

/**
 * Format a stat value for display — durations use the shared
 * duration formatter, numbers get locale formatting.
 */
export function formatStatValue(value, data_type) {
  if (value === null || value === undefined) return '';
  if (data_type === 'duration') return formatDuration(value);
  if (data_type === 'number' || typeof value === 'number') {
    // Pinned locale so stats read the same wherever they are rendered.
    return Number(value.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return String(value);
}

/**
 * One-line summary of a field stat — shared by every UI surface
 * so a field reads the same wherever its statistics appear.
 */
export function fieldHeadline(stat) {
  if (!stat) return '';
  if (stat.capabilities.total && stat.displayTotal) {
    return `${stat.displayTotal} total · ${stat.count} filled`;
  }
  if (stat.groups && stat.groups.length > 0) {
    return `top: ${stat.groups[0].value} × ${stat.groups[0].count}`;
  }
  return `${stat.count} filled`;
}

/**
 * Group one field's metric by another field — the "compare" view.
 * For total-able fields the metric is the sum (e.g. total budget
 * per project); otherwise it is the entry count.
 * Returns [{ key, count, total, display }] sorted by metric desc.
 */
export function groupFieldBy(entries, field, by, { now = Date.now(), data_type } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  let type = data_type;
  if (!type) {
    const raws = list
      .map((e) => rawFieldValue(e, field, now))
      .filter((v) => v !== undefined && v !== null && v !== '');
    type = inferDataType(raws);
  }
  const capabilities = fieldCapabilities(type);
  const map = new Map();

  list.forEach((entry) => {
    const value = coerceValue(rawFieldValue(entry, field, now), type);
    if (value === undefined) return;

    const rawKey = by === 'project_name' ? entry.project_name : rawFieldValue(entry, by, now);
    const key =
      rawKey === undefined || rawKey === null || rawKey === ''
        ? by === 'project_name'
          ? 'Unknown'
          : null
        : String(rawKey);
    if (key === null) return;

    const g = map.get(key) || { key, count: 0, total: 0 };
    g.count++;
    if (capabilities.total && typeof value === 'number') g.total += value;
    map.set(key, g);
  });

  return Array.from(map.values())
    .map((g) => ({
      ...g,
      display: capabilities.total ? formatStatValue(g.total, type) : String(g.count),
    }))
    .sort((a, b) => b.total - a.total || b.count - a.count);
}

/**
 * Compute the standard FieldStat for every field in play.
 *
 * Statistics follow one format wherever they go:
 *   { field, data_type, capabilities: { total, group, compare, plot },
 *     entryCount, count, total, displayTotal, min, max, avg, displayAvg,
 *     groups: [{ value, count }],          // group by value
 *     series: [{ bucket, value }],         // plot over time (daily)
 *     byProject: [{ key, count, total, display }] }  // compare
 *
 * Field definitions come from the owner (fields table) when
 * passed; anything present in the data but never declared is
 * derived automatically, so the logbook needs no advance
 * knowledge of any field.
 */
export function computeFieldStats(
  entries,
  fieldDefs = [],
  { now = Date.now(), maxGroups = 8, includeBuiltins = false } = {}
) {
  const list = Array.isArray(entries) ? entries : [];
  const defs = mergeFieldDefs(fieldDefs, deriveFieldDefs(list));
  if (includeBuiltins) {
    BUILTIN_FIELD_DEFS.forEach((b) => {
      if (!defs.some((d) => d.field_name === b.field_name)) defs.push({ ...b });
    });
  }

  return defs
    .map((def) => {
      const capabilities = fieldCapabilities(def.data_type);
      const numericValues = [];
      const groupCounts = new Map();
      const seriesMap = new Map();
      let filled = 0;

      list.forEach((entry) => {
        const value = coerceValue(rawFieldValue(entry, def.field_name, now), def.data_type);
        if (value === undefined) return;
        filled++;

        // Group by value
        const gv = groupKey(value, def.data_type);
        groupCounts.set(gv, (groupCounts.get(gv) || 0) + 1);

        // Numeric accumulation (total / min / max / avg)
        if (capabilities.total && typeof value === 'number') numericValues.push(value);

        // Plot over time — daily buckets; sums for total-able
        // fields, counts otherwise.
        const bucket = dayBucket(entry);
        if (bucket) {
          const cur = seriesMap.get(bucket) || 0;
          seriesMap.set(
            bucket,
            cur + (capabilities.total && typeof value === 'number' ? value : 1)
          );
        }
      });

      const total = numericValues.length > 0 ? numericValues.reduce((sum, v) => sum + v, 0) : null;
      const min = numericValues.length > 0 ? numericValues.reduce((a, b) => Math.min(a, b)) : null;
      const max = numericValues.length > 0 ? numericValues.reduce((a, b) => Math.max(a, b)) : null;
      const avg = numericValues.length > 0 ? total / numericValues.length : null;

      const groups = Array.from(groupCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
        .slice(0, maxGroups);

      const series = Array.from(seriesMap.entries())
        .map(([bucket, value]) => ({ bucket, value }))
        .sort((a, b) => (a.bucket < b.bucket ? -1 : 1));

      return {
        field: def.field_name,
        data_type: def.data_type,
        capabilities,
        entryCount: list.length,
        count: filled,
        total,
        displayTotal: total === null ? null : formatStatValue(total, def.data_type),
        min,
        max,
        avg,
        displayAvg: avg === null ? null : formatStatValue(avg, def.data_type),
        groups,
        series,
        byProject: groupFieldBy(list, def.field_name, 'project_name', {
          now,
          data_type: def.data_type,
        }),
      };
    })
    .filter((stat) => stat.count > 0);
}

/** Analysis policies deliberately do not change the legacy capability contract. */
export function fieldAnalysisPolicy(data_type) {
  let kind = 'summary';
  let views = ['summary'];
  if (['number', 'integer', 'float', 'duration'].includes(data_type)) {
    kind = 'numeric';
    views = ['bars', 'trend', 'grouped'];
  } else if (
    data_type === 'select' ||
    data_type === 'custom' ||
    (typeof data_type === 'string' && data_type.startsWith('custom:'))
  ) {
    kind = 'category';
    views = ['bars', 'donut', 'grouped'];
  } else if (data_type === 'boolean') {
    kind = 'boolean';
    views = ['donut', 'bars', 'grouped'];
  } else if (data_type === 'multiselect' || data_type === 'multi') {
    kind = 'multi';
    views = ['bars'];
  } else if (data_type === 'date' || data_type === 'timestamp') {
    kind = 'date';
    views = ['trend'];
  } else if (data_type === 'text' || data_type === 'markdown') {
    kind = 'text';
    views = ['search'];
  }
  return { kind, views, defaultView: views[0] };
}

/** Keep declared, even entirely missing, fields and normalize option metadata. */
export function analysisFieldDefs(entries, declared = []) {
  const list = Array.isArray(entries) ? entries : [];
  const defs = mergeFieldDefs(declared, deriveFieldDefs(list));
  if (
    list.some((entry) => entry?.started_at || entry?.ended_at) &&
    !defs.some((def) => def.field_name === 'duration')
  ) {
    defs.push({ field_name: 'duration', data_type: 'duration' });
  }
  return defs.map((def, index) => normalizeField(def, index));
}

/** An observation, not today's clock, anchors this UTC calendar window. */
export function dailyWindow(points, fill = 0) {
  const byDay = new Map();
  for (const point of Array.isArray(points) ? points : []) {
    const bucket = dateValue(point?.bucket)?.slice(0, 10);
    if (!bucket || (point.value !== null && !Number.isFinite(point.value))) continue;
    byDay.set(bucket, point.value);
  }
  if (!byDay.size) return [];
  const end = [...byDay.keys()].sort().at(-1);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: 60 }, (_, index) => {
    const bucket = new Date(endTime - (59 - index) * 86400000).toISOString().slice(0, 10);
    return {
      bucket,
      value: byDay.has(bucket)
        ? byDay.get(bucket)
        : fill === null || Number.isFinite(fill)
          ? fill
          : 0,
    };
  });
}

function analysisRawValue(entry, def, now) {
  if (def.field_name !== 'duration' || def.data_type === 'duration') {
    return rawFieldValue(entry, def.field_name, now);
  }
  // A real, same-name field must not be replaced by the virtual timer.
  const fields = entry?.entries;
  return fields && !Array.isArray(fields) && fields.duration !== undefined
    ? fields.duration
    : entry?.duration;
}

function categoryValue(raw, def) {
  if (
    (typeof raw !== 'string' && typeof raw !== 'number') ||
    isMissing(raw) ||
    (typeof raw === 'number' && !Number.isFinite(raw))
  )
    return undefined;
  const text = String(raw);
  // Single-select persists value/label; multiselect persists IDs. Resolve
  // that canonical representation first when an alias overlaps another ID.
  const byId = def.options.find((item) => item.id === text);
  const byStoredValue = def.options.find((item) => (item.value ?? item.label) === text);
  const option =
    (def.data_type === 'multiselect' ? byId || byStoredValue : byStoredValue || byId) ||
    def.options.find((item) => item.label === text);
  return option
    ? { key: option.id, label: option.label || String(option.value ?? option.id) }
    : { key: text, label: text };
}

function analysisValue(raw, def, kind) {
  if (isMissing(raw)) return undefined;
  if (kind === 'numeric') return numericValue(raw, def.data_type);
  if (kind === 'date') return dateValue(raw)?.slice(0, 10);
  if (kind === 'category') return categoryValue(raw, def);
  if (kind === 'boolean') {
    const value = coerceValue(raw, 'boolean');
    return value === undefined ? undefined : { key: String(value), label: value ? 'Yes' : 'No' };
  }
  if (kind === 'multi') {
    if (!Array.isArray(raw)) return undefined;
    const values = new Map();
    for (const member of raw) {
      const value = categoryValue(member, def);
      if (value === undefined) return undefined;
      values.set(value.key, value);
    }
    return [...values.values()];
  }
  if (kind === 'text') return coerceValue(raw, 'text');
  return raw;
}

function frequencyMap(kind) {
  return new Map(
    kind === 'boolean'
      ? [
          ['true', { key: 'true', label: 'Yes', count: 0 }],
          ['false', { key: 'false', label: 'No', count: 0 }],
        ]
      : []
  );
}

function compareLabels(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function countFrequency(map, value) {
  const item = map.get(value.key) || { ...value, count: 0 };
  item.count++;
  map.set(value.key, item);
}

function sortedFrequencies(map) {
  return [...map.values()].sort(
    (a, b) => b.count - a.count || compareLabels(a.label, b.label) || compareLabels(a.key, b.key)
  );
}

/** @param {{key: string, label: string, count: number}[]} frequencies */
function cappedFrequencies(frequencies) {
  if (frequencies.length <= 6) return frequencies.map((item) => ({ ...item }));
  const occupied = new Set(frequencies.flatMap((item) => [item.key, item.label]));
  let key = '__other__';
  while (occupied.has(key)) key += '_';
  let label = 'Other (remaining)';
  let suffix = 2;
  while (occupied.has(label)) label = `Other (remaining ${suffix++})`;
  return [
    ...frequencies.slice(0, 5),
    {
      key,
      label,
      count: frequencies.slice(5).reduce((total, item) => total + item.count, 0),
    },
  ];
}

function averageAggregation(aggregation) {
  return aggregation === 'average' || aggregation === 'avg';
}

function aggregateValue(sum, count, aggregation) {
  if (averageAggregation(aggregation)) return count ? sum / count : null;
  return aggregation === 'count' ? count : sum;
}

function matrixAxis(frequencies, collapse) {
  const items = collapse ? cappedFrequencies(frequencies) : frequencies;
  const indices = new Map(items.map((item, index) => [item.key, index]));
  return {
    items: items.map(({ key, label }) => ({ key, label })),
    indexOf: (key) => indices.get(key) ?? items.length - 1,
  };
}

function analysisMatrix(rows, columns, pairs, aggregation) {
  const cells = rows.items.map(() => columns.items.map(() => ({ sum: 0, count: 0 })));
  for (const pair of pairs) {
    const cell = cells[rows.indexOf(pair.row)][columns.indexOf(pair.column)];
    cell.sum += pair.value;
    cell.count++;
  }
  return {
    rows: rows.items,
    columns: columns.items,
    values: cells.map((row) =>
      row.map((cell) => aggregateValue(cell.sum, cell.count, aggregation))
    ),
  };
}

function fieldComparison(records, total, def, compareDef, kind, series, now, aggregation) {
  if (!compareDef || !['numeric', 'category', 'boolean'].includes(kind)) return null;
  const partner = normalizeField(compareDef);
  const partnerKind = fieldAnalysisPolicy(partner.data_type).kind;
  if (
    !partner.field_name ||
    partner.field_name === def.field_name ||
    !['category', 'boolean'].includes(partnerKind)
  )
    return null;

  const numeric = kind === 'numeric';
  const rowCounts = frequencyMap(kind);
  const columnCounts = frequencyMap(partnerKind);
  const pairs = [];
  const start = series[0]?.bucket;
  const end = series.at(-1)?.bucket;
  let excluded = total - records.length;
  for (const record of records) {
    if (numeric) {
      if (!record.bucket) {
        excluded++;
        continue;
      }
      // Range exclusions are not incomplete pairs. The primary series anchors the window.
      if (!start || record.bucket < start || record.bucket > end) continue;
    }
    const other = analysisValue(analysisRawValue(record.entry, partner, now), partner, partnerKind);
    if (other === undefined) {
      excluded++;
      continue;
    }
    if (!numeric) countFrequency(rowCounts, record.value);
    countFrequency(columnCounts, other);
    pairs.push({
      row: numeric ? record.bucket : record.value.key,
      column: other.key,
      value: numeric ? record.value : 1,
    });
  }

  const rows = numeric
    ? series.map(({ bucket }) => ({ key: bucket, label: bucket, count: 0 }))
    : sortedFrequencies(rowCounts);
  const columns = sortedFrequencies(columnCounts);
  const metric = numeric ? aggregation : 'count';
  return {
    full: analysisMatrix(matrixAxis(rows, false), matrixAxis(columns, false), pairs, metric),
    display: analysisMatrix(matrixAxis(rows, !numeric), matrixAxis(columns, true), pairs, metric),
    excluded,
  };
}

/**
 * Type-aware analysis leaves computeFieldStats/groupFieldBy's result shapes intact.
 * @param {object[]} entries
 * @param {object} def
 * @param {{now?: number, aggregation?: string, compareDef?: object | null}} options
 */
export function computeFieldAnalysis(
  entries,
  def,
  { now = Date.now(), aggregation = 'sum', compareDef = null } = {}
) {
  const list = Array.isArray(entries) ? entries : [];
  const field = normalizeField(def);
  const { kind } = fieldAnalysisPolicy(field.data_type);
  const coverage = { total: list.length, filled: 0, missing: 0, invalid: 0 };
  const counts = frequencyMap(kind);
  const days = new Map();
  const records = [];
  let numeric = null;
  let numericCount = 0;
  let undatedCount = 0;

  for (const entry of list) {
    const raw = analysisRawValue(entry, field, now);
    if (isMissing(raw)) {
      coverage.missing++;
      continue;
    }
    coverage.filled++;
    const value = analysisValue(raw, field, kind);
    if (value === undefined) {
      coverage.invalid++;
      continue;
    }
    const bucket = kind === 'numeric' ? dayBucket(entry) : kind === 'date' ? value : null;
    records.push({ entry, value, bucket });
    if (kind === 'numeric') {
      if (!numeric) numeric = { total: 0, average: 0, min: value, max: value };
      numeric.total += value;
      numeric.min = Math.min(numeric.min, value);
      numeric.max = Math.max(numeric.max, value);
      numericCount++;
      if (!bucket) undatedCount++;
    }
    if (kind === 'numeric' || kind === 'date') {
      if (bucket) {
        const day = days.get(bucket) || { sum: 0, count: 0 };
        day.sum += kind === 'numeric' ? value : 1;
        day.count++;
        days.set(bucket, day);
      }
    } else if (kind === 'multi') {
      value.forEach((item) => countFrequency(counts, item));
    } else if (kind === 'category' || kind === 'boolean') {
      countFrequency(counts, value);
    } else if (kind === 'text') {
      countFrequency(counts, { key: value, label: value });
    }
  }

  if (numeric) numeric.average = numeric.total / numericCount;
  const metric = kind === 'date' ? 'count' : aggregation;
  const series = dailyWindow(
    [...days].map(([bucket, day]) => ({
      bucket,
      value: aggregateValue(day.sum, day.count, metric),
    })),
    averageAggregation(metric) ? null : 0
  );
  const frequencies = sortedFrequencies(counts);
  return {
    field: field.field_name,
    data_type: field.data_type,
    kind,
    coverage,
    numeric,
    frequencies,
    displayFrequencies: cappedFrequencies(frequencies),
    series,
    range: series.length ? { start: series[0].bucket, end: series.at(-1).bucket } : null,
    undatedCount,
    comparison: fieldComparison(
      records,
      list.length,
      field,
      compareDef,
      kind,
      series,
      now,
      aggregation
    ),
  };
}
