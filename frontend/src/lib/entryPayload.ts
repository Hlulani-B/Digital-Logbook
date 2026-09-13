export type EntryPayload = Record<string, unknown> | string | number | boolean | unknown[] | null;

export type EntryPayloadState =
  | { kind: 'object'; value: Record<string, unknown> }
  | { kind: 'empty'; value: null }
  | { kind: 'opaque'; value: unknown };

export type EntryPayloadField = {
  name: string;
  value: string;
};

const PREFERRED_TITLE_KEYS = [
  'task',
  'description',
  'activity',
  'note',
  'goal',
  'title',
  'subject',
];

export function classifyEntryPayload(value: unknown): EntryPayloadState {
  if (value == null) return { kind: 'empty', value: null };
  if (typeof value === 'object' && !Array.isArray(value)) {
    return { kind: 'object', value: value as Record<string, unknown> };
  }
  return { kind: 'opaque', value };
}

export function formatEntryValue(value: unknown): string {
  if (value == null) return 'Not recorded';
  if (typeof value === 'string') return value.trim() || 'Not recorded';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value) || 'Not recorded';
  } catch {
    return 'Not recorded';
  }
}

export function getEntryPayloadFields(value: unknown): EntryPayloadField[] {
  const payload = classifyEntryPayload(value);
  if (payload.kind === 'object') {
    return Object.entries(payload.value).map(([name, fieldValue]) => ({
      name,
      value: formatEntryValue(fieldValue),
    }));
  }

  return [{ name: 'Legacy content', value: formatEntryValue(payload.value) }];
}

export function getEntryPayloadTitle(value: unknown): string {
  const payload = classifyEntryPayload(value);
  if (payload.kind !== 'object') return formatEntryValue(payload.value);

  for (const key of PREFERRED_TITLE_KEYS) {
    if (key in payload.value) {
      const title = formatEntryValue(payload.value[key]);
      if (title !== 'Not recorded') return title;
    }
  }

  for (const fieldValue of Object.values(payload.value)) {
    const title = formatEntryValue(fieldValue);
    if (title !== 'Not recorded') return title;
  }

  return 'Not recorded';
}
