import { describe, it, expect } from 'vitest';
import { ACTION_CONFIG, FALLBACK_CONFIG } from '../ActivityFeed';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

describe('ACTION_CONFIG color coding', () => {
  it('every action type has a valid hex color', () => {
    for (const [actionType, config] of Object.entries(ACTION_CONFIG)) {
      expect(config.color, `${actionType}.color`).toMatch(HEX_COLOR_RE);
    }
  });

  it('fallback config has a valid hex color', () => {
    expect(FALLBACK_CONFIG.color).toMatch(HEX_COLOR_RE);
  });

  it('uses green for creation events', () => {
    expect(ACTION_CONFIG.PROJECT_CREATED.color).toBe('#22c55e');
    expect(ACTION_CONFIG.ENTRY_ADDED.color).toBe('#22c55e');
  });

  it('uses red for deletion events', () => {
    expect(ACTION_CONFIG.PROJECT_DELETED.color).toBe('#ef4444');
    expect(ACTION_CONFIG.ENTRY_DELETED.color).toBe('#ef4444');
  });

  it('uses blue for edit/rename/update events', () => {
    expect(ACTION_CONFIG.PROJECT_RENAMED.color).toBe('#3b82f6');
    expect(ACTION_CONFIG.ENTRY_UPDATED.color).toBe('#3b82f6');
  });

  it('uses amber for archive/unarchive events', () => {
    expect(ACTION_CONFIG.PROJECT_ARCHIVED.color).toBe('#f59e0b');
    expect(ACTION_CONFIG.PROJECT_UNARCHIVED.color).toBe('#f59e0b');
    expect(ACTION_CONFIG.ENTRY_ARCHIVED.color).toBe('#f59e0b');
    expect(ACTION_CONFIG.ENTRY_UNARCHIVED.color).toBe('#f59e0b');
  });

  it('uses purple for field events', () => {
    expect(ACTION_CONFIG.FIELD_ADDED.color).toBe('#a855f7');
    expect(ACTION_CONFIG.FIELD_EDITED.color).toBe('#a855f7');
  });

  it('uses orange for priority events', () => {
    expect(ACTION_CONFIG.PRIORITY_SET.color).toBe('#f97316');
  });

  it('every config has all required fields', () => {
    for (const [actionType, config] of Object.entries(ACTION_CONFIG)) {
      expect(config).toHaveProperty('verb');
      expect(config).toHaveProperty('entityLabel');
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('color');
      expect(typeof config.verb).toBe('string');
      expect(typeof config.entityLabel).toBe('string');
    }
  });
});
