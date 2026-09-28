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

  it('falls back to a meaningful object value with field name', () => {
    expect(getEntryPayloadTitle({ count: 0, enabled: false })).toBe('count: 0');
  });

  it('exposes object values as fields and opaque values as legacy content', () => {
    expect(getEntryPayloadFields({ removed_field: 'Still readable' })).toEqual([
      { name: 'removed_field', value: 'Still readable' },
    ]);
    expect(getEntryPayloadFields(['old', 'payload'])).toEqual([
      { name: 'Legacy content', value: '["old","payload"]' },
    ]);
  });

  it('skips underscore-prefixed internal fields', () => {
    expect(
      getEntryPayloadFields({ task: 'Buy milk', _project_ref: { project_name: 'Shopping' } })
    ).toEqual([{ name: 'task', value: 'Buy milk' }]);
  });

  it('shows [Image] for base64 image data', () => {
    expect(formatEntryValue('data:image/png;base64,iVBORw0KGgo=')).toBe('[Image]');
    expect(formatEntryValue('/9j/4AAQSkZJRgABAQAAAQABAAD/')).toBe('[Image]');
    expect(formatEntryValue('iVBORw0KGgoAAAANSUhEUg==')).toBe('[Image]');
    expect(formatEntryValue('Just a normal text')).toBe('Just a normal text');
  });
});
