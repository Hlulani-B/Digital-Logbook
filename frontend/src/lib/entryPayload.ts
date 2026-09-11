export type EntryPayload = Record<string, unknown> | string | number | boolean | unknown[] | null;

export type EntryPayloadState =
  | { kind: 'object'; value: Record<string, unknown> }
  | { kind: 'empty'; value: null }
  | { kind: 'opaque'; value: unknown };

export function classifyEntryPayload(value: unknown): EntryPayloadState {
  if (value == null) return { kind: 'empty', value: null };
  if (typeof value === 'object' && !Array.isArray(value)) {
    return { kind: 'object', value: value as Record<string, unknown> };
  }
  return { kind: 'opaque', value };
}

/**
 * A notes payload is the wire shape used to attach text/link/image notes to
 * an entry: an array of `{ entry_type, value }` objects. Historically a
 * caller bug passed this array into the `summary` slot of `addEntry()`, which
 * stored the JSON string of the notes as the entry summary. Both the write
 * layer and the display layer use this helper to detect and reject that
 * shape so the raw JSON can never leak to the UI.
 */
export function isNotesPayload(value: unknown): boolean {
  if (Array.isArray(value)) {
    return (
      value.length > 0 &&
      value.every(
        (n) =>
          n &&
          typeof n === 'object' &&
          !Array.isArray(n) &&
          typeof (n as Record<string, unknown>).entry_type === 'string' &&
          'value' in (n as Record<string, unknown>)
      )
    );
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.startsWith('[')) return false;
    try {
      return isNotesPayload(JSON.parse(trimmed));
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Returns the summary only when it is safe to display. A notes-shaped value
 * (either a real array or a JSON-stringified array of `{entry_type,value}`)
 * is treated as no summary at all so the caller falls through to whatever
 * secondary text (project name, first field, etc.) it would have used.
 */
export function cleanSummaryText(value: unknown): string | null {
  if (value == null) return null;
  if (isNotesPayload(value)) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

