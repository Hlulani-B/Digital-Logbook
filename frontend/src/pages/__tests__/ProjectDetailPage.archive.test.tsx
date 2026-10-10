/**
 * Archive consistency — Batch 3 Part A (active-entry visibility).
 *
 * The project page's default (non-search) views must select entries through
 * the shared isActiveEntry rule: archived and deleted rows must not linger as
 * faded cards in Table, Checklist, Board or Cards — not on first load from the
 * cache, not after an optimistic archive write flips the flag while the page
 * is open, and not through in-project search or a restore round-trip. The page
 * renders against the real IndexedDB/sql.js cache stack; only network, auth
 * and the four view components (stubbed so their received rows can be
 * asserted) are mocked.
 *
 * Follow-up (final lifecycle fix): the feed is also gated by the effective
 * project archive state — while the parent project is archived, none of its
 * rows show, even though their own flags are preserved across the cycle.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The wasm build of sql.js cannot locate sql-wasm.wasm under Node.
vi.mock('sql.js', async () => {
  const mod = await import('sql.js/dist/sql-asm.js');
  return { default: mod.default ?? mod };
});

const mockRequest = vi.fn();
vi.mock('@/lib/api', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
  PROJECT_URL: 'http://localhost:5003',
}));

const EMAIL = 'archivetest@test.com';
const PROJECT = 'ArchiveProject';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { email: EMAIL }, signOut: vi.fn() }),
}));

vi.mock('@/components/NavBar', () => ({ NavBar: () => null }));
vi.mock('@/components/Header', () => ({ Header: () => null }));
vi.mock('@/components/ProjectSettingsPanel', () => ({ ProjectSettingsPanel: () => null }));
vi.mock('@/pages/VoiceFeature', () => ({ default: () => null }));
vi.mock('@/lib/recentlyViewed', () => ({ trackViewedProject: vi.fn() }));
vi.mock('@/lib/recentlyCreated', () => ({ trackCreatedEntry: vi.fn() }));
vi.mock('@/functions/project/priority.js', () => ({ setPriority: vi.fn() }));
vi.mock('@/functions/project/search.js', () => ({ searchEntriesInProject: vi.fn() }));
vi.mock('@/functions/project/natural_language.js', () => ({
  addNaturalLanguageEntry: vi.fn(),
}));
vi.mock('@/functions/ai.js', () => ({ askAI: vi.fn(), parseAIResponse: (s: string) => s }));
vi.mock('@/functions/tone', () => ({ getToneInstruction: () => '' }));
vi.mock('@/functions/aiMessages', () => ({
  getAiMessagesEnabled: () => false,
  useAiMessagesEnabled: () => false,
}));

// The four active view components are stubbed so each test can assert the
// exact rows the page hands them — an archived row in any call is a failure.
vi.mock('@/pages/NewEntry', () => ({
  EntryBox: vi.fn(() => <div data-testid="entry-box" />),
}));
vi.mock('@/Templates/EntryTemplates/EntryChecklist', () => ({
  ChecklistView: vi.fn(() => <div data-testid="checklist-view" />),
}));
vi.mock('@/Templates/ProjectTemplates/EntriesByDueDateBoard', () => ({
  default: vi.fn(() => <div data-testid="board-view" />),
}));
vi.mock('@/Templates/ProjectTemplates/ProjectTable', () => ({
  default: vi.fn(() => <div data-testid="table-view" />),
}));

// Imported lazily so the mocks above are registered first.
const { ProjectDetailPage } = await import('@/pages/ProjectDetailPage');
const { NotesProvider } = await import('@/context/NotesContext');
const { cacheSet, CACHE_STORES } = await import('@/lib/cache');
const { initPreferences, setPref } = await import('@/functions/preferences');
const { searchEntriesInProject } = await import('@/functions/project/search.js');
const { EntryBox } = await import('@/pages/NewEntry');
const { ChecklistView } = await import('@/Templates/EntryTemplates/EntryChecklist');
const EntriesByDueDateBoard = (await import('@/Templates/ProjectTemplates/EntriesByDueDateBoard'))
  .default;
const ProjectTaskTable = (await import('@/Templates/ProjectTemplates/ProjectTable')).default;

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

function entry(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_email: EMAIL,
    project_name: PROJECT,
    summary: `entry ${id}`,
    due_date: '2030-01-01T10:00:00Z',
    status: 'up_next',
    archived: false,
    deleted: false,
    ...overrides,
  };
}

async function seedEntries(rows: Array<Record<string, unknown>>) {
  await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
    success: true,
    data: [{ project_name: PROJECT }],
  });
  await cacheSet(CACHE_STORES.FIELDS, `${EMAIL}:${PROJECT}`, {
    success: true,
    data: [{ field_name: 'task', data_type: 'text', is_required: false }],
  });
  await cacheSet(CACHE_STORES.ENTRIES, `${EMAIL}:${PROJECT}`, { success: true, data: rows });
}

function renderPage() {
  return render(
    <NotesProvider>
      <MemoryRouter initialEntries={[`/project/${PROJECT}`]}>
        <Routes>
          <Route path="/project/:projectName" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </NotesProvider>
  );
}

type MockedComponent = { mock: { calls: unknown[][] } };

function lastCallIds(component: unknown, prop: string) {
  const calls = (component as MockedComponent).mock.calls;
  const props = calls[calls.length - 1][0] as Record<string, unknown>;
  return (props[prop] as Array<{ id: string }>).map((r) => r.id);
}

function entryBoxIds(): Array<string | undefined> {
  return (EntryBox as unknown as MockedComponent).mock.calls.map(
    (call) => (call[0] as { entry: { id?: string } }).entry?.id
  );
}

function entryBoxCallCount(): number {
  return (EntryBox as unknown as MockedComponent).mock.calls.length;
}

function entryBoxIdsSince(index: number): Array<string | undefined> {
  return (EntryBox as unknown as MockedComponent).mock.calls
    .slice(index)
    .map((call) => (call[0] as { entry: { id?: string } }).entry?.id);
}

describe('ProjectDetailPage archive consistency (Batch 3A)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setOnline(false);
    mockRequest.mockRejectedValue(new Error('Failed to fetch'));
    await initPreferences(EMAIL);
    // Deterministic starting view — the toggle persists through the shared
    // preferences row, so reset it here instead of depending on test order.
    await setPref('project_view_mode', 'table');
  });

  it('excludes archived and deleted entries from every active view', async () => {
    await seedEntries([entry('1'), entry('2', { archived: true }), entry('3', { deleted: true })]);
    renderPage();

    // jsdom defaults to the Table view (window width >= 600). Wait for the
    // loaded rows — an early render can pass rows=[] while the cache loads.
    await waitFor(
      () => {
        expect(lastCallIds(ProjectTaskTable, 'rows')).toContain('1');
      },
      { timeout: 10000 }
    );
    let ids = lastCallIds(ProjectTaskTable, 'rows');
    expect(ids).not.toContain('2');
    expect(ids).not.toContain('3');

    fireEvent.click(screen.getByText('Cards'));
    await waitFor(() => expect(entryBoxIds()).toContain('1'), { timeout: 10000 });
    ids = entryBoxIds();
    expect(ids).not.toContain('2');
    expect(ids).not.toContain('3');

    fireEvent.click(screen.getByText('Checklist'));
    await waitFor(() => expect(lastCallIds(ChecklistView, 'entries')).toContain('1'), {
      timeout: 10000,
    });
    ids = lastCallIds(ChecklistView, 'entries');
    expect(ids).not.toContain('2');
    expect(ids).not.toContain('3');

    fireEvent.click(screen.getByText('Board'));
    await waitFor(() => expect(lastCallIds(EntriesByDueDateBoard, 'entries')).toContain('1'), {
      timeout: 10000,
    });
    ids = lastCallIds(EntriesByDueDateBoard, 'entries');
    expect(ids).not.toContain('2');
    expect(ids).not.toContain('3');
  }, 120000);

  it('removes an entry from active views immediately after its archive flag flips', async () => {
    await seedEntries([entry('1'), entry('2')]);
    renderPage();

    fireEvent.click(screen.getByText('Cards'));
    await waitFor(() => expect(entryBoxIds()).toContain('2'), { timeout: 10000 });

    // Mirror what archiveEntry's optimistic write does: flip `archived` in the
    // same ENTRIES cache row the page reads, which fires its subscription.
    const callsBefore = entryBoxCallCount();
    await cacheSet(CACHE_STORES.ENTRIES, `${EMAIL}:${PROJECT}`, {
      success: true,
      data: [entry('1'), entry('2', { archived: true })],
    });

    // Only renders AFTER the optimistic write count: stale calls from before
    // it legitimately still contain the entry.
    await waitFor(
      () => {
        const recent = entryBoxIdsSince(callsBefore);
        expect(recent.length).toBeGreaterThan(0);
        expect(recent).not.toContain('2');
      },
      { timeout: 10000 }
    );
    expect(entryBoxIdsSince(callsBefore)).toContain('1');
  }, 120000);

  it('returns a restored entry to the active views', async () => {
    await seedEntries([entry('1'), entry('2', { archived: true })]);
    renderPage();

    await waitFor(
      () => {
        expect(lastCallIds(ProjectTaskTable, 'rows')).toContain('1');
      },
      { timeout: 10000 }
    );
    expect(lastCallIds(ProjectTaskTable, 'rows')).not.toContain('2');

    // Restore — same cache row, flag cleared (what the restore action writes).
    await cacheSet(CACHE_STORES.ENTRIES, `${EMAIL}:${PROJECT}`, {
      success: true,
      data: [entry('1'), entry('2')],
    });

    await waitFor(
      () => {
        expect(lastCallIds(ProjectTaskTable, 'rows')).toContain('2');
      },
      { timeout: 10000 }
    );
  }, 120000);

  it('search does not resurface an archived entry', async () => {
    await seedEntries([entry('1'), entry('2', { archived: true })]);
    // The backend search feed deliberately includes the archived row — the
    // page's filtered path must still drop it before any view sees it.
    vi.mocked(searchEntriesInProject).mockResolvedValue({
      data: [entry('1'), entry('2', { archived: true })],
    });

    renderPage();
    await waitFor(
      () => {
        expect(lastCallIds(ProjectTaskTable, 'rows')).toContain('1');
      },
      { timeout: 10000 }
    );

    const callsBefore = entryBoxCallCount();
    fireEvent.change(screen.getByPlaceholderText(`Search in ${PROJECT}...`), {
      target: { value: 'entry' },
    });

    await waitFor(() => expect(entryBoxIdsSince(callsBefore)).toContain('1'), {
      timeout: 10000,
    });
    // Archived rows never reach a view — neither the search feed nor the
    // default table (requirement: search must not bypass eligibility).
    expect(entryBoxIds()).not.toContain('2');
    expect(lastCallIds(ProjectTaskTable, 'rows')).not.toContain('2');
  }, 120000);

  it('shows the empty state when every entry is archived', async () => {
    await seedEntries([entry('2', { archived: true })]);
    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('No items yet')).toBeTruthy();
      },
      { timeout: 10000 }
    );
    expect(entryBoxIds()).not.toContain('2');
  }, 120000);

  it('shows the search empty state when every match is archived', async () => {
    await seedEntries([entry('1'), entry('2', { archived: true })]);
    vi.mocked(searchEntriesInProject).mockResolvedValue({
      data: [entry('2', { archived: true })],
    });

    renderPage();
    await waitFor(
      () => {
        expect(lastCallIds(ProjectTaskTable, 'rows')).toContain('1');
      },
      { timeout: 10000 }
    );

    fireEvent.change(screen.getByPlaceholderText(`Search in ${PROJECT}...`), {
      target: { value: 'entry' },
    });

    await waitFor(
      () => {
        expect(screen.getByText('No results found')).toBeTruthy();
      },
      { timeout: 10000 }
    );
    expect(entryBoxIds()).not.toContain('2');
  }, 120000);

  it('gates the whole feed on the effective project archive state', async () => {
    await seedEntries([entry('1'), entry('2')]);
    renderPage();

    await waitFor(() => expect(lastCallIds(ProjectTaskTable, 'rows')).toContain('2'), {
      timeout: 10000,
    });

    // Archive the PROJECT only: its rows keep their own active flags, so the
    // page must hide them through the effective archived-project state.
    const callsBefore = (ProjectTaskTable as unknown as MockedComponent).mock.calls.length;
    await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
      success: true,
      data: [{ project_name: PROJECT, archived: true }],
    });

    // The gated feed falls back to the empty state…
    await waitFor(() => expect(screen.getByText('No items yet')).toBeTruthy(), {
      timeout: 10000,
    });
    // …and no table render after the archive flip may still hold the rows.
    const callsAfter = (ProjectTaskTable as unknown as MockedComponent).mock.calls.slice(
      callsBefore
    );
    for (const call of callsAfter) {
      const ids = (call[0] as { rows: Array<{ id: string }> }).rows.map((r) => r.id);
      expect(ids).not.toContain('1');
      expect(ids).not.toContain('2');
    }

    // Restore the project flag — the active rows must come back.
    await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
      success: true,
      data: [{ project_name: PROJECT, archived: false }],
    });
    await waitFor(() => expect(lastCallIds(ProjectTaskTable, 'rows')).toContain('2'), {
      timeout: 10000,
    });
    expect(lastCallIds(ProjectTaskTable, 'rows')).toContain('1');
  }, 120000);
});
