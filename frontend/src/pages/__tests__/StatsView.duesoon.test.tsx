import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatsView } from '../StatsView';

// Real derivation under test: cache rows → effective archived-project set
// (server flag OR Dashboard localStorage fallback) → computeDueSoon → render.
// Only the boundaries (auth, cache stores, field fetching, navigation) are
// mocked; the Due Soon math and the stats UI stay real.

const { EMAIL, LOCAL_ARCHIVED, SERVER_ARCHIVED, mocks } = vi.hoisted(() => ({
  EMAIL: 'qa@example.test',
  LOCAL_ARCHIVED: 'Local Archived',
  SERVER_ARCHIVED: 'Server Archived',
  mocks: {
    cacheGet: vi.fn(),
    cacheSubscribe: vi.fn(() => () => {}),
    getFields: vi.fn(),
    syncAllData: vi.fn(),
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { email: EMAIL } }),
}));
vi.mock('@/components/NavBar', () => ({ NavBar: () => <nav aria-label="Main navigation" /> }));
vi.mock('@/hooks/useNow', () => ({ useNow: () => Date.now() }));
vi.mock('@/functions/project/fields.js', () => ({ getFields: mocks.getFields }));
vi.mock('@/CacheFunctions', async () => {
  // Real syncService — its computeDueSoon is the exact function the surfaces use.
  const syncService = await vi.importActual<typeof import('@/CacheFunctions/syncService')>(
    '@/CacheFunctions/syncService'
  );
  return { syncAllData: mocks.syncAllData, computeDueSoon: syncService.computeDueSoon };
});
vi.mock('@/lib/cache', () => ({
  cacheGet: mocks.cacheGet,
  cacheSubscribe: mocks.cacheSubscribe,
  CACHE_STORES: { ALL_ENTRIES: 'all_entries', PROJECTS: 'projects', FIELDS: 'fields' },
}));

const hourFromNow = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

function seedCache() {
  const projects = [
    { project_name: 'Active', archived: false },
    { project_name: SERVER_ARCHIVED, archived: true },
    { project_name: LOCAL_ARCHIVED, archived: false },
  ];
  const entries = [
    // Counted: active entry of an active project.
    { id: 'active-1', project_name: 'Active', due_date: hourFromNow(24), status: 'up_next' },
    // Excluded: completed.
    {
      id: 'done-1',
      project_name: 'Active',
      due_date: hourFromNow(24),
      status: 'done_and_dusted',
    },
    // Excluded: past due (overdue territory).
    { id: 'overdue-1', project_name: 'Active', due_date: hourFromNow(-24), status: 'up_next' },
    // Excluded: individually archived.
    {
      id: 'archived-1',
      project_name: 'Active',
      due_date: hourFromNow(24),
      status: 'up_next',
      archived: true,
    },
    // Excluded: parent project archived on the server.
    {
      id: 'server-arch-1',
      project_name: SERVER_ARCHIVED,
      due_date: hourFromNow(24),
      status: 'up_next',
    },
    // Excluded: parent project archived through the Dashboard's localStorage
    // fallback (its cached row still says archived: false).
    {
      id: 'local-arch-1',
      project_name: LOCAL_ARCHIVED,
      due_date: hourFromNow(24),
      status: 'up_next',
    },
  ];
  mocks.cacheGet.mockImplementation(async (_store: string, key: string) => {
    if (key === EMAIL) return { success: true, data: entries };
    if (key === 'projects') return { success: true, data: projects };
    return null;
  });
}

/** Reads the Due Soon value from the page's overview stat card (same shownDueSoonCount the Quick Stats panel shows). */
function dueSoonStatValue(): string | null {
  const card = screen.getByText('Due Soon', { exact: true }).closest('.stat-card');
  if (!card) throw new Error('Missing Due Soon stat card');
  return card.querySelector('.stat-card-value')?.textContent ?? null;
}

function renderStatsView() {
  return render(
    <MemoryRouter>
      <StatsView />
    </MemoryRouter>
  );
}

describe('StatsView — Due Soon count honours effective project archive state', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.cacheGet.mockReset();
    mocks.cacheSubscribe.mockClear();
    mocks.getFields.mockResolvedValue({ success: true, data: [] });
    mocks.syncAllData.mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected network request');
      })
    );
    seedCache();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('counts eligible entries of active projects and excludes archived ones consistently', async () => {
    localStorage.setItem(`dl_archived_${EMAIL}`, JSON.stringify([LOCAL_ARCHIVED]));
    renderStatsView();

    // Exactly one entry qualifies: the active project's upcoming entry. The
    // completed, past-due and individually archived entries are excluded by
    // the shared predicate; both archived projects are excluded by the
    // effective archive set (server flag AND localStorage fallback alike).
    await waitFor(() => expect(dueSoonStatValue()).toBe('1'));
  });

  it('a restored locally archived project contributes its entries again', async () => {
    localStorage.setItem(`dl_archived_${EMAIL}`, JSON.stringify([LOCAL_ARCHIVED]));
    const { unmount } = renderStatsView();
    await waitFor(() => expect(dueSoonStatValue()).toBe('1'));

    // Simulate the Dashboard's unarchive action clearing the fallback entry,
    // then revisit the page (fresh mount, like real navigation).
    unmount();
    cleanup();
    localStorage.setItem(`dl_archived_${EMAIL}`, JSON.stringify([]));
    renderStatsView();

    // The restored project's entry returns; the server-archived one stays out.
    await waitFor(() => expect(dueSoonStatValue()).toBe('2'));
  });
});
