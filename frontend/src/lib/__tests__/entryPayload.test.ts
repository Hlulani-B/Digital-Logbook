import { describe, expect, it } from 'vitest';
import { formatEntryValue, getEntryPayloadFields, getEntryPayloadTitle } from '@/lib/entryPayload';

describe('entry payload presentation', () => {
  it('formats every supported opaque payload without losing meaningful values', () => {
    expect(formatEntryValue('Legacy note')).toBe('Legacy note');
    expect(formatEntryValue(0)).toBe('0');
    expect(formatEntryValue(false)).toBe('false');
    expect(formatEntryValue(['one', { two: 2 }])).toBe('["one",{"two":2}]');
    expect(formatEntryValue(null)).toBe('Not recorded');
  });

  it('uses preferred object fields for titles', () => {
    expect(getEntryPayloadTitle({ custom: 'Other', task: 'Finish report' })).toBe('Finish report');
  });

  it('falls back to a meaningful object value', () => {
    expect(getEntryPayloadTitle({ count: 0, enabled: false })).toBe('0');
  });

  it('exposes object values as fields and opaque values as legacy content', () => {
    expect(getEntryPayloadFields({ removed_field: 'Still readable' })).toEqual([
      { name: 'removed_field', value: 'Still readable' },
    ]);
    expect(getEntryPayloadFields(['old', 'payload'])).toEqual([
      { name: 'Legacy content', value: '["old","payload"]' },
    ]);
  });
});
