import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildProjectColorMap,
  colorForName,
  resolveProjectColor,
} from '../projectColorMap';

describe('buildProjectColorMap', () => {
  it('returns empty map for empty array', () => {
    expect(buildProjectColorMap([])).toEqual({});
  });

  it('maps project names to their colours', () => {
    const projects = [
      { project_name: 'Alpha', project_color: '#ff0000' },
      { project_name: 'Beta', project_color: '#00ff00' },
    ];
    expect(buildProjectColorMap(projects)).toEqual({
      Alpha: '#ff0000',
      Beta: '#00ff00',
    });
  });

  it('sets null for projects without a colour', () => {
    const projects = [{ project_name: 'NoColor' }];
    expect(buildProjectColorMap(projects)).toEqual({ NoColor: null });
  });

  it('maps null for projects without a colour', () => {
    const projects = [{ project_name: 'NoColor' }, { project_name: 'Valid' }];
    const result = buildProjectColorMap(projects);
    expect(result.NoColor).toBeNull();
    expect(result.Valid).toBeNull();
  });

  it('later entries overwrite earlier ones with same name', () => {
    const projects = [
      { project_name: 'Dup', project_color: '#aaa' },
      { project_name: 'Dup', project_color: '#bbb' },
    ];
    expect(buildProjectColorMap(projects).Dup).toBe('#bbb');
  });
});

describe('colorForName', () => {
  it('returns a hex colour string', () => {
    const color = colorForName('TestProject');
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('returns the same colour for the same name', () => {
    expect(colorForName('Alpha')).toBe(colorForName('Alpha'));
  });

  it('returns different colours for different names (usually)', () => {
    // Hash collisions are possible but unlikely for short distinct names
    const colors = new Set(['A', 'B', 'C', 'D', 'E'].map(colorForName));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('resolveProjectColor', () => {
  it('returns custom colour when present in map', () => {
    const map = { Alpha: '#ff0000' };
    expect(resolveProjectColor('Alpha', map)).toBe('#ff0000');
  });

  it('returns hash-based colour when project not in map', () => {
    const map = {};
    const result = resolveProjectColor('Unknown', map);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    expect(result).toBe(colorForName('Unknown'));
  });

  it('returns hash-based colour when custom colour is null', () => {
    const map = { Alpha: null };
    const result = resolveProjectColor('Alpha', map);
    expect(result).toBe(colorForName('Alpha'));
  });
});
