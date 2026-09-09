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
