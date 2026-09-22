/**
 * Field Versioning System
 *
 * Preserves raw old values when field types change, so earlier
 * entry versions stay readable rather than breaking.
 *
 * History is stored in a `_field_history` JSONB column on each entry:
 * {
 *   "field_name@type": [
 *     { "value": <raw_value>, "migrated_at": "<ISO timestamp>", "reason": "retype" }
 *   ],
 *   "field_name": [
 *     { "value": <raw_value>, "migrated_at": "<ISO timestamp>", "reason": "rename" }
 *   ]
 * }
 *
 * This allows:
 * - Viewing what a field's value was before a type change
 * - Rolling back a migration if needed
 * - Audit trail of all schema changes affecting an entry
 */

export interface FieldHistoryEntry {
  value: unknown;
  migrated_at: string;
  reason: 'retype' | 'rename' | 'drop' | 'manual';
  from_type?: string;
  to_type?: string;
  from_name?: string;
  to_name?: string;
}

export type FieldHistory = Record<string, FieldHistoryEntry[]>;

/**
 * Record a field value change in the history.
 * Returns the updated history object.
 */
export function recordFieldChange(
  history: FieldHistory | null | undefined,
  fieldName: string,
  entry: FieldHistoryEntry
): FieldHistory {
  const h = history ? { ...history } : {};
  const key = entry.from_type ? `${fieldName}@${entry.from_type}` : fieldName;
  if (!h[key]) h[key] = [];
  h[key].push(entry);
  return h;
}

/**
 * Get the history for a specific field.
 * Returns all historical values for that field.
 */
export function getFieldHistory(
  history: FieldHistory | null | undefined,
  fieldName: string,
  type?: string
): FieldHistoryEntry[] {
  if (!history) return [];
  const key = type ? `${fieldName}@${type}` : fieldName;
  return history[key] || [];
}

/**
 * Get the most recent historical value for a field before a given date.
 * Useful for "what did this entry look like at time X?" queries.
 */
export function getFieldValueAtTime(
  history: FieldHistory | null | undefined,
  fieldName: string,
  beforeDate: string,
  type?: string
): unknown | undefined {
  const entries = getFieldHistory(history, fieldName, type);
  const relevant = entries.filter((e) => e.migrated_at <= beforeDate);
  if (relevant.length === 0) return undefined;
  return relevant[relevant.length - 1].value;
}

/**
 * Format a field history entry for display.
 */
export function formatHistoryEntry(entry: FieldHistoryEntry): string {
  const date = new Date(entry.migrated_at).toLocaleString();
  const valueStr =
    entry.value === null || entry.value === undefined
      ? 'null'
      : typeof entry.value === 'object'
        ? JSON.stringify(entry.value)
        : String(entry.value);

  switch (entry.reason) {
    case 'retype':
      return `[${date}] Retyped from ${entry.from_type} to ${entry.to_type}: ${valueStr}`;
    case 'rename':
      return `[${date}] Renamed from "${entry.from_name}" to "${entry.to_name}": ${valueStr}`;
    case 'drop':
      return `[${date}] Dropped: ${valueStr}`;
    case 'manual':
      return `[${date}] Manual edit: ${valueStr}`;
    default:
      return `[${date}] ${valueStr}`;
  }
}

/**
 * Merge two history objects (e.g., after offline sync).
 * Deduplicates by migrated_at timestamp.
 */
export function mergeHistories(
  a: FieldHistory | null | undefined,
  b: FieldHistory | null | undefined
): FieldHistory {
  const merged: FieldHistory = {};
  const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);

  for (const key of allKeys) {
    const entriesA = a?.[key] || [];
    const entriesB = b?.[key] || [];
    const combined = [...entriesA, ...entriesB];

    // Deduplicate by migrated_at
    const seen = new Set<string>();
    merged[key] = combined.filter((e) => {
      const ts = e.migrated_at;
      if (seen.has(ts)) return false;
      seen.add(ts);
      return true;
    });

    // Sort by timestamp
    merged[key].sort((a, b) => a.migrated_at.localeCompare(b.migrated_at));
  }

  return merged;
}
