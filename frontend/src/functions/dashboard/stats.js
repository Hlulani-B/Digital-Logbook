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

function isNumericLike(v) {
  if (typeof v === 'number') return !isNaN(v);
  if (typeof v === 'string' && v.trim() !== '') return !isNaN(Number(v));
  return false;
}

function isBooleanLike(v) {
  return typeof v === 'boolean' || v === 'true' || v === 'false';
}

function isDateLike(v) {
  return (
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.trim()) && !isNaN(new Date(v).getTime())
  );
}

/**
 * Infer a field's data type purely from its values — used when no
 * definition exists, so statistics still work for fields the
 * logbook has never seen in advance.
 */
export function inferDataType(values) {
  const vals = (values || []).filter((v) => v !== null && v !== undefined && v !== '');
  if (vals.length === 0) return 'text';
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
      merged.set(d.field_name, { field_name: d.field_name, data_type: d.data_type || 'text' });
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
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (data_type === 'number') {
    if (typeof raw === 'number') return isNaN(raw) ? undefined : raw;
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    const n = Number(String(raw).trim());
    return isNaN(n) ? undefined : n;
  }
  if (data_type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    return undefined;
  }
  if (data_type === 'date') {
    const t = new Date(raw).getTime();
    return isNaN(t) ? undefined : new Date(raw).toISOString();
  }
  if (data_type === 'duration') {
    return typeof raw === 'number' && !isNaN(raw) ? raw : undefined;
  }
  return String(raw);
}

/** Normalise a coerced value into a display-safe group key. */
function groupKey(value, data_type) {
  if (data_type === 'date' && typeof value === 'string') return value.slice(0, 10);
  return String(value);
}

/** Day bucket (UTC YYYY-MM-DD) for plotting a field over time. */
function dayBucket(entry) {
  if (!entry || !entry.created_at) return null;
  const t = new Date(entry.created_at).getTime();
  return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
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
      const min = numericValues.length > 0 ? Math.min(...numericValues) : null;
      const max = numericValues.length > 0 ? Math.max(...numericValues) : null;
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
