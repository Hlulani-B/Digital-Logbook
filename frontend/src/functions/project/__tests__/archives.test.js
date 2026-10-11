/**
 * Archive lifecycle regression tests — Issue 1.
 *
 * Contract: an entry's individual archive state is independent of its parent
 * project's archive state.
 *
 *   - Individually archiving an entry persists in ALL_ENTRIES + ENTRIES.
 *   - Archiving a project flips ONLY the project flag. Entry rows keep their
 *     own `archived` values — the old cascade rewrote them all to true.
 *   - Restoring a project must never rewrite individual entry flags, so an
 *     individually archived entry stays archived while its active siblings
 *     reappear in active views (the old cascade resurrected archived entries).
 *   - Refresh round-trips keep the server's per-entry truth.
 *   - Offline optimistic paths follow the same rules (Batch 1/2 behaviour).
 *
 * These run against the real archive handlers and the real cache layer
 * (sql.js is swapped for its asm build so the cache can run under Node).
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sql.js', async () => {
  const mod = await import('sql.js/dist/sql-asm.js');
  return { default: mod.default ?? mod };
});

const mockRequest = vi.fn();
vi.mock('@/lib/api', () => ({
  request: (...args) => mockRequest(...args),
  PROJECT_URL: 'http://localhost:5003',
}));

const EMAIL = 'lifecycle@test.com';
const PROJECT = 'Lifecycle';
const ENTRIES_KEY = `${EMAIL}:${PROJECT}`;
const ARCHIVES_ALL_KEY = `${EMAIL}:all`;

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

const makeEntry = (id, archived = false) => ({
  id,
  project_name: PROJECT,
  summary: `${id} summary`,
  status: 'up_next',
  archived,
  deleted: false,
  entries: { task: id },
});

// Mocked server state. Entries keep their own archive flag server-side; the
// project flag is tracked separately (as the fixed backend does).
let serverEntries;
let serverProjectArchived;

function routeRequest(_url, options) {
  const { function: fn, values } = JSON.parse(options.body);
  switch (fn) {
    case 'archive_project':
      serverProjectArchived = true;
      return { success: true, message: 'Project archived successfully' };
    case 'unarchive_project':
      serverProjectArchived = false;
      return { success: true, message: 'Project unarchived successfully' };
    case 'archive_entry':
      serverEntries = serverEntries.map((e) =>
        String(e.id) === String(values.entry_id) ? { ...e, archived: true } : e
      );
      return { success: true, message: 'Entry archived successfully' };
    case 'unarchive_entry':
      serverEntries = serverEntries.map((e) =>
        String(e.id) === String(values.entry_id) ? { ...e, archived: false } : e
      );
      return { success: true, message: 'Entry unarchived successfully' };
    case 'getProjects':
      return {
        success: true,
        projects: [{ project_name: PROJECT, archived: serverProjectArchived }],
      };
    case 'getArchivedProjects':
      return {
        success: true,
        data: serverProjectArchived ? [{ project_name: PROJECT, archived: true }] : [],
      };
    case 'getUnarchivedProjects':
      return {
        success: true,
        data: serverProjectArchived ? [] : [{ project_name: PROJECT, archived: false }],
      };
    case 'get':
      // getEntries — the authoritative rows, individual flags intact.
      return { success: true, data: serverEntries.map((e) => ({ ...e })) };
    case 'getArchives':
      return {
        success: true,
        data: serverEntries.filter((e) => e.archived).map((e) => ({ ...e })),
      };
    case 'getUnarchived':
      return {
        success: true,
        data: serverEntries.filter((e) => !e.archived).map((e) => ({ ...e })),
      };
    default:
      throw new Error(`Unexpected mocked server function: ${fn}`);
  }
}

async function seedCache() {
  const { cacheSet, CACHE_STORES } = await import('@/lib/cache');
  await cacheSet(CACHE_STORES.ALL_ENTRIES, EMAIL, {
    success: true,
    data: serverEntries.map((e) => ({ ...e })),
  });
  await cacheSet(CACHE_STORES.ENTRIES, ENTRIES_KEY, {
    success: true,
    data: serverEntries.map((e) => ({ ...e })),
  });
  await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
    success: true,
    projects: [{ project_name: PROJECT, archived: serverProjectArchived }],
  });
}

async function readAllEntries() {
  const { cacheGet, CACHE_STORES } = await import('@/lib/cache');
  const cached = await cacheGet(CACHE_STORES.ALL_ENTRIES, EMAIL);
  return cached?.data || [];
}

async function readProjectEntries() {
  const { cacheGet, CACHE_STORES } = await import('@/lib/cache');
  const cached = await cacheGet(CACHE_STORES.ENTRIES, ENTRIES_KEY);
  return cached?.data || [];
}

async function readProjects() {
  const { cacheGet, CACHE_STORES } = await import('@/lib/cache');
  const cached = await cacheGet(CACHE_STORES.PROJECTS, EMAIL);
  // setProjectArchivedFlag writes the flipped rows under `data` while
  // getProjectsByEmail keeps the server payload under `projects`; the helper
  // reads `data` first exactly like the production helper does.
  return cached?.data || cached?.projects || [];
}

const archivedFlag = (rows, id) => rows.find((e) => String(e.id) === String(id))?.archived;

describe('archive lifecycle — individual entry state survives project archive/restore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    serverEntries = [makeEntry('A'), makeEntry('B')];
    serverProjectArchived = false;
    setOnline(true);
    mockRequest.mockImplementation(routeRequest);
    // Tests share one IndexedDB, and the queue/cache are module singletons —
    // start each one clean so an earlier case can't leak rows into a later one.
    const { clearQueue } = await import('@/CacheFunctions/offlineQueue.js');
    const { clearUserCache } = await import('@/lib/cache');
    await clearQueue();
    await clearUserCache(EMAIL);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps Entry A archived and shows Entry B again after a project archive → restore cycle', async () => {
    const { archiveEntry, archiveProject, unarchiveProject } =
      await import('@/functions/project/archives.js');
    await seedCache();

    // 1. Individually archive Entry A.
    await archiveEntry(EMAIL, PROJECT, 'A');
    expect(archivedFlag(await readAllEntries(), 'A')).toBe(true);
    expect(archivedFlag(await readAllEntries(), 'B')).toBe(false);

    // 2. Archive the whole project: only the project's own flag flips.
    await archiveProject(EMAIL, PROJECT);
    expect(archivedFlag(await readAllEntries(), 'A')).toBe(true);
    expect(archivedFlag(await readAllEntries(), 'B')).toBe(false);

    // 3. Restore the project: A must stay archived, B becomes active again.
    await unarchiveProject(EMAIL, PROJECT);
    const all = await readAllEntries();
    expect(archivedFlag(all, 'A')).toBe(true); // ← the regression: used to flip to false
    expect(archivedFlag(all, 'B')).toBe(false);

    const perProject = await readProjectEntries();
    expect(archivedFlag(perProject, 'A')).toBe(true);
    expect(archivedFlag(perProject, 'B')).toBe(false);
  });

  it('keeps two individually archived entries archived after project restoration', async () => {
    serverEntries = [makeEntry('A'), makeEntry('B'), makeEntry('C')];
    const { archiveEntry, archiveProject, unarchiveProject } =
      await import('@/functions/project/archives.js');
    await seedCache();

    await archiveEntry(EMAIL, PROJECT, 'A');
    await archiveEntry(EMAIL, PROJECT, 'C');
    await archiveProject(EMAIL, PROJECT);
    await unarchiveProject(EMAIL, PROJECT);

    const all = await readAllEntries();
    expect(archivedFlag(all, 'A')).toBe(true);
    expect(archivedFlag(all, 'C')).toBe(true);
    expect(archivedFlag(all, 'B')).toBe(false);
  });

  it('individually restoring Entry A after a project restore cycle works normally', async () => {
    const { archiveEntry, archiveProject, unarchiveProject, unarchiveEntry } =
      await import('@/functions/project/archives.js');
    const { cacheGet, CACHE_STORES } = await import('@/lib/cache');
    await seedCache();

    await archiveEntry(EMAIL, PROJECT, 'A');
    await archiveProject(EMAIL, PROJECT);
    await unarchiveProject(EMAIL, PROJECT);
    expect(archivedFlag(await readAllEntries(), 'A')).toBe(true);

    await unarchiveEntry(EMAIL, PROJECT, 'A');
    expect(archivedFlag(await readAllEntries(), 'A')).toBe(false);
    expect(archivedFlag(await readProjectEntries(), 'A')).toBe(false);

    const archivesList = await cacheGet(CACHE_STORES.ARCHIVES, ARCHIVES_ALL_KEY);
    expect((archivesList?.data || []).some((e) => String(e.id) === 'A')).toBe(false);
  });

  it('re-derives active-view eligibility from effective project state without rewriting flags', async () => {
    const { archiveEntry, archiveProject, unarchiveProject } =
      await import('@/functions/project/archives.js');
    const { getEffectiveArchivedProjectNames } =
      await import('@/functions/project/archiveState.js');
    const { isActiveEntry } = await import('@/functions/dashboard/overdue.js');
    await seedCache();

    await archiveEntry(EMAIL, PROJECT, 'A');

    await archiveProject(EMAIL, PROJECT);
    expect(getEffectiveArchivedProjectNames(EMAIL, await readProjects()).has(PROJECT)).toBe(true);
    // While the project is archived, both rows are hidden from active views…
    let all = await readAllEntries();
    expect(
      isActiveEntry(
        all.find((e) => e.id === 'A'),
        true
      )
    ).toBe(false);
    expect(
      isActiveEntry(
        all.find((e) => e.id === 'B'),
        true
      )
    ).toBe(false);

    await unarchiveProject(EMAIL, PROJECT);
    expect(getEffectiveArchivedProjectNames(EMAIL, await readProjects()).has(PROJECT)).toBe(false);
    // …and after restoration eligibility follows each entry's own flag.
    all = await readAllEntries();
    expect(
      isActiveEntry(
        all.find((e) => e.id === 'A'),
        false
      )
    ).toBe(false);
    expect(
      isActiveEntry(
        all.find((e) => e.id === 'B'),
        false
      )
    ).toBe(true);
  });

  it('keeps server truth across a refresh round-trip after restoration', async () => {
    const { archiveEntry, archiveProject, unarchiveProject } =
      await import('@/functions/project/archives.js');
    const { getEntries } = await import('@/functions/project/entries.js');
    const { cacheGet, CACHE_STORES } = await import('@/lib/cache');
    await seedCache();

    await archiveEntry(EMAIL, PROJECT, 'A');
    await archiveProject(EMAIL, PROJECT);
    await unarchiveProject(EMAIL, PROJECT);

    // Simulate a later refresh/sync round-trip: server rows still carry the
    // individual flags, so nothing resurrects A.
    await getEntries(EMAIL, PROJECT);
    const perProject = await readProjectEntries();
    expect(archivedFlag(perProject, 'A')).toBe(true);
    expect(archivedFlag(perProject, 'B')).toBe(false);
    expect(archivedFlag(await readAllEntries(), 'A')).toBe(true);

    // The Archives list must keep showing A under archived entries and B
    // under active entries — restore views stay correct.
    const archivesList = await cacheGet(CACHE_STORES.ARCHIVES, ARCHIVES_ALL_KEY);
    const ids = (archivesList?.data || []).map((e) => String(e.id));
    expect(ids).toContain('A');
    expect(ids).not.toContain('B');
  });

  it('offline project archive/restore keeps entry flags and queues both actions', async () => {
    const { archiveEntry, archiveProject, unarchiveProject } =
      await import('@/functions/project/archives.js');
    const { getQueue } = await import('@/CacheFunctions/offlineQueue.js');
    await seedCache();

    setOnline(false);
    mockRequest.mockReset(); // offline must never hit the network

    await archiveEntry(EMAIL, PROJECT, 'A');
    await archiveProject(EMAIL, PROJECT);

    // The project row shows archived; the entry rows keep their own flags.
    let projectRows = await readProjects();
    expect(projectRows.find((p) => p.project_name === PROJECT)?.archived).toBe(true);
    expect(archivedFlag(await readAllEntries(), 'A')).toBe(true);
    expect(archivedFlag(await readAllEntries(), 'B')).toBe(false);

    await unarchiveProject(EMAIL, PROJECT);
    projectRows = await readProjects();
    expect(projectRows.find((p) => p.project_name === PROJECT)?.archived).toBe(false);
    expect(archivedFlag(await readAllEntries(), 'A')).toBe(true); // still archived
    expect(archivedFlag(await readAllEntries(), 'B')).toBe(false);

    const queue = await getQueue();
    expect(queue.map((q) => q.action)).toEqual([
      'archiveEntry',
      'archiveProject',
      'unarchiveProject',
    ]);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
