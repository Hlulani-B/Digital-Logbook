import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEffectiveArchivedProjectNames, getLocallyArchivedProjectNames } from '../archiveState';

const EMAIL = 'archive@example.test';
const key = `dl_archived_${EMAIL}`;

const project = (name, archived = false) => ({ project_name: name, archived });

describe('getLocallyArchivedProjectNames — Dashboard localStorage fallback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns an empty set when nothing is stored', () => {
    expect(getLocallyArchivedProjectNames(EMAIL).size).toBe(0);
    expect(getLocallyArchivedProjectNames('').size).toBe(0);
    expect(getLocallyArchivedProjectNames(undefined).size).toBe(0);
  });

  it('reads the names the Dashboard archived locally', () => {
    localStorage.setItem(key, JSON.stringify(['Local only', 'Also local']));
    const names = getLocallyArchivedProjectNames(EMAIL);
    expect([...names]).toEqual(['Local only', 'Also local']);
  });

  it('is scoped per user email', () => {
    localStorage.setItem(key, JSON.stringify(['Mine']));
    localStorage.setItem('dl_archived_other@example.test', JSON.stringify(['Theirs']));
    expect([...getLocallyArchivedProjectNames(EMAIL)]).toEqual(['Mine']);
    expect([...getLocallyArchivedProjectNames('other@example.test')]).toEqual(['Theirs']);
  });

  it('treats malformed stored data as no local archives', () => {
    localStorage.setItem(key, 'not-json');
    expect(getLocallyArchivedProjectNames(EMAIL).size).toBe(0);
    localStorage.setItem(key, JSON.stringify({ nested: true }));
    expect(getLocallyArchivedProjectNames(EMAIL).size).toBe(0);
  });
});

describe('getEffectiveArchivedProjectNames — shared archive eligibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('marks server-archived projects as archived', () => {
    const names = getEffectiveArchivedProjectNames(EMAIL, [
      project('Server archived', true),
      project('Active', false),
    ]);
    expect(names.has('Server archived')).toBe(true);
    expect(names.has('Active')).toBe(false);
  });

  it('marks locally archived projects as archived through the fallback', () => {
    localStorage.setItem(key, JSON.stringify(['Locally archived']));
    const names = getEffectiveArchivedProjectNames(EMAIL, [
      project('Locally archived', false),
      project('Active', false),
    ]);
    expect(names.has('Locally archived')).toBe(true);
    expect(names.has('Active')).toBe(false);
  });

  it('keeps a project archived when both signals agree', () => {
    localStorage.setItem(key, JSON.stringify(['Both']));
    expect(getEffectiveArchivedProjectNames(EMAIL, [project('Both', true)]).has('Both')).toBe(true);
  });

  it('a restored project becomes active again once every signal is cleared', () => {
    localStorage.setItem(key, JSON.stringify(['Restored']));
    // While locally archived it counts as archived even with a false flag…
    expect(
      getEffectiveArchivedProjectNames(EMAIL, [project('Restored', false)]).has('Restored')
    ).toBe(true);
    // …and after the Dashboard's unarchive action removes the fallback entry.
    localStorage.setItem(key, JSON.stringify([]));
    expect(
      getEffectiveArchivedProjectNames(EMAIL, [project('Restored', false)]).has('Restored')
    ).toBe(false);
  });

  it('tolerates missing project rows and nameless rows', () => {
    localStorage.setItem(key, JSON.stringify(['Local']));
    const names = getEffectiveArchivedProjectNames(EMAIL, [
      null,
      {},
      project('Local', false),
      { archived: true },
    ]);
    expect([...names]).toEqual(['Local']);
  });

  it('treats a non-array project list as no archives', () => {
    expect(getEffectiveArchivedProjectNames(EMAIL, null).size).toBe(0);
    expect(getEffectiveArchivedProjectNames(EMAIL, 'projects').size).toBe(0);
  });
});
