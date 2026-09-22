import { describe, it, expect } from 'vitest';
import {
  recordFieldChange,
  getFieldHistory,
  getFieldValueAtTime,
  formatHistoryEntry,
  mergeHistories,
} from '../fieldVersioning';

describe('recordFieldChange', () => {
  it('creates new history from null', () => {
    const result = recordFieldChange(null, 'status', {
      value: 'active',
      migrated_at: '2026-09-21T00:00:00Z',
      reason: 'retype',
      from_type: 'text',
      to_type: 'tags',
    });
    expect(result['status@text']).toHaveLength(1);
    expect(result['status@text'][0].value).toBe('active');
  });

  it('appends to existing history', () => {
    const existing = {
      'status@text': [
        {
          value: 'old',
          migrated_at: '2026-01-01T00:00:00Z',
          reason: 'retype' as const,
          from_type: 'text',
          to_type: 'tags',
        },
      ],
    };
    const result = recordFieldChange(existing, 'status', {
      value: 'new',
      migrated_at: '2026-09-21T00:00:00Z',
      reason: 'retype',
      from_type: 'text',
      to_type: 'tags',
    });
    expect(result['status@text']).toHaveLength(2);
  });
});

describe('getFieldHistory', () => {
  it('returns empty array for missing field', () => {
    expect(getFieldHistory(null, 'status')).toEqual([]);
    expect(getFieldHistory({}, 'status')).toEqual([]);
  });

  it('returns history for field with type', () => {
    const history = {
      'status@text': [
        { value: 'old', migrated_at: '2026-01-01T00:00:00Z', reason: 'retype' as const },
      ],
    };
    expect(getFieldHistory(history, 'status', 'text')).toHaveLength(1);
  });

  it('returns history for field without type', () => {
    const history = {
      status: [{ value: 'old', migrated_at: '2026-01-01T00:00:00Z', reason: 'rename' as const }],
    };
    expect(getFieldHistory(history, 'status')).toHaveLength(1);
  });
});

describe('getFieldValueAtTime', () => {
  it('returns undefined if no history before date', () => {
    const history = {
      status: [{ value: 'active', migrated_at: '2026-09-21T00:00:00Z', reason: 'retype' as const }],
    };
    expect(getFieldValueAtTime(history, 'status', '2026-01-01T00:00:00Z')).toBeUndefined();
  });

  it('returns most recent value before date', () => {
    const history = {
      status: [
        { value: 'old', migrated_at: '2026-01-01T00:00:00Z', reason: 'retype' as const },
        { value: 'new', migrated_at: '2026-06-01T00:00:00Z', reason: 'retype' as const },
        { value: 'latest', migrated_at: '2026-09-21T00:00:00Z', reason: 'retype' as const },
      ],
    };
    expect(getFieldValueAtTime(history, 'status', '2026-07-01T00:00:00Z')).toBe('new');
  });
});

describe('formatHistoryEntry', () => {
  it('formats retype entry', () => {
    const entry = {
      value: 'active',
      migrated_at: '2026-09-21T10:30:00Z',
      reason: 'retype' as const,
      from_type: 'text',
      to_type: 'tags',
    };
    const formatted = formatHistoryEntry(entry);
    expect(formatted).toContain('Retyped from text to tags');
    expect(formatted).toContain('active');
  });

  it('formats rename entry', () => {
    const entry = {
      value: 'data',
      migrated_at: '2026-09-21T10:30:00Z',
      reason: 'rename' as const,
      from_name: 'old_name',
      to_name: 'new_name',
    };
    const formatted = formatHistoryEntry(entry);
    expect(formatted).toContain('Renamed from "old_name" to "new_name"');
  });

  it('formats drop entry', () => {
    const entry = {
      value: 42,
      migrated_at: '2026-09-21T10:30:00Z',
      reason: 'drop' as const,
    };
    const formatted = formatHistoryEntry(entry);
    expect(formatted).toContain('Dropped');
    expect(formatted).toContain('42');
  });
});

describe('mergeHistories', () => {
  it('merges two histories', () => {
    const a = {
      status: [{ value: 'old', migrated_at: '2026-01-01T00:00:00Z', reason: 'retype' as const }],
    };
    const b = {
      status: [{ value: 'new', migrated_at: '2026-09-21T00:00:00Z', reason: 'retype' as const }],
    };
    const merged = mergeHistories(a, b);
    expect(merged.status).toHaveLength(2);
    expect(merged.status[0].value).toBe('old');
    expect(merged.status[1].value).toBe('new');
  });

  it('deduplicates by timestamp', () => {
    const a = {
      status: [{ value: 'same', migrated_at: '2026-01-01T00:00:00Z', reason: 'retype' as const }],
    };
    const b = {
      status: [{ value: 'same', migrated_at: '2026-01-01T00:00:00Z', reason: 'retype' as const }],
    };
    const merged = mergeHistories(a, b);
    expect(merged.status).toHaveLength(1);
  });

  it('handles null inputs', () => {
    expect(mergeHistories(null, null)).toEqual({});
    const history = {
      status: [{ value: 'x', migrated_at: '2026-01-01T00:00:00Z', reason: 'retype' as const }],
    };
    expect(mergeHistories(history, null)).toEqual(history);
  });
});
