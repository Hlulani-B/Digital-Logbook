import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AllEntriesPage } from '../AllEntries';
import { initPreferences } from '@/functions/preferences';
import { cacheGet } from '@/lib/cache';
import { EntryBox } from '@/pages/NewEntry';
import { ChecklistView } from '@/Templates/EntryTemplates/EntryChecklist';
import EntriesByDueDateBoard from '@/Templates/ProjectTemplates/EntriesByDueDateBoard';
import ProjectTaskTable from '@/Templates/ProjectTemplates/ProjectTable';

// In-memory stand-in for the per-user preferences table (SQLite via cache).
const prefRows: Record<string, string> = {};

// Mock all dependencies
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'test@test.com' },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue({ data: [] }),
  cacheSubscribe: vi.fn(() => () => {}),
  CACHE_STORES: {
    ALL_ENTRIES: 'all_entries',
    PROJECTS: 'projects',
    PROFILE: 'profile',
    USER_PREFERENCES: 'user_preferences',
  },
  // preferences.js resolves to this same module id, so it needs the raw-DB API.
  getSharedDB: async () => ({
    exec: (sql: string, params?: unknown[]) => {
      const data = prefRows[params![0] as string];
      return data ? [{ values: [[data]] }] : [];
    },
    run: (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO user_preferences')) {
        prefRows[params![0] as string] = params![1] as string;
      }
    },
  }),
  persistDB: () => {},
}));

vi.mock('@/CacheFunctions', () => ({
  syncAllData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/functions/project/priority.js', () => ({
  setPriority: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/functions/profile/login.js', () => ({
  checkUser: vi.fn().mockResolvedValue({ exists: true, deleted: false }),
}));

vi.mock('@/components/NavBar', () => ({
  NavBar: vi.fn(() => <div data-testid="navbar">NavBar</div>),
}));

vi.mock('@/components/Header', () => ({
  Header: vi.fn(({ title }: any) => <div data-testid="header">{title}</div>),
}));

vi.mock('@/components/QuickEntryBar', () => ({
  QuickEntryBar: vi.fn(() => <div data-testid="quick-entry-bar">QuickEntryBar</div>),
}));

vi.mock('@/pages/NewEntry', () => ({
  EntryBox: vi.fn(() => <div data-testid="entry-box">EntryBox</div>),
}));

vi.mock('@/Templates/EntryTemplates/EntryChecklist', () => ({
  ChecklistView: vi.fn(() => <div data-testid="checklist-view">ChecklistView</div>),
}));

vi.mock('@/Templates/ProjectTemplates/EntriesByDueDateBoard', () => ({
  default: vi.fn(() => <div data-testid="board-view">BoardView</div>),
}));

vi.mock('@/Templates/ProjectTemplates/ProjectTable', () => ({
  default: vi.fn(() => <div data-testid="table-view">TableView</div>),
}));

vi.mock('@/pages/VoiceFeature', () => ({
  default: vi.fn(() => <div data-testid="voice-feature">VoiceFeature</div>),
}));

describe('AllEntriesPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Isolate the shared snapshot: each test starts from an empty store.
    for (const key of Object.keys(prefRows)) delete prefRows[key];
    await initPreferences('test@test.com');
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/entries']}>
        <AllEntriesPage />
      </MemoryRouter>
    );
  }

  it('renders the NavBar component', () => {
    renderPage();
    expect(screen.getByTestId('navbar')).toBeTruthy();
  });

  it('renders the Header with "My Entries" title', () => {
    renderPage();
    expect(screen.getByTestId('header')).toBeTruthy();
    expect(screen.getByText('My Items')).toBeTruthy();
  });

  it('renders the QuickEntryBar', () => {
    renderPage();
    expect(screen.getByTestId('quick-entry-bar')).toBeTruthy();
  });

  it('renders the search input', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Filter entries...')).toBeTruthy();
  });

  it('renders display mode toggle buttons', () => {
    renderPage();
    expect(screen.getByText('Cards')).toBeTruthy();
    expect(screen.getByText('Checklist')).toBeTruthy();
    expect(screen.getByText('Board')).toBeTruthy();
    expect(screen.getByText('Table')).toBeTruthy();
  });

  it('renders sort buttons for Date and Priority', () => {
    renderPage();
    expect(screen.getByText('Date')).toBeTruthy();
    expect(screen.getByText('Priority')).toBeTruthy();
  });

  it('defaults to cards display mode', () => {
    renderPage();
    // Cards button should be active by default
    const cardsBtn = screen.getByText('Cards');
    expect(cardsBtn.className).toContain('active');
  });

  it('defaults to date sorting', () => {
    renderPage();
    const dateBtn = screen.getByText('Date');
    expect(dateBtn.className).toContain('active');
  });

  it('shows empty state when no entries', async () => {
    renderPage();
    await waitFor(() => {
      // Should show "No entries yet" or loading state
      const main = document.querySelector('.dash-main');
      expect(main).toBeTruthy();
    });
  });

  it('persists display mode to the per-user preferences store', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Board'));
    await waitFor(() => {
      expect(JSON.parse(prefRows['test@test.com']).allentries_display_mode).toBe('board');
    });
  });

  it('persists sort preference to the per-user preferences store', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Priority'));
    await waitFor(() => {
      expect(JSON.parse(prefRows['test@test.com']).allentries_sort_by).toBe('priority');
    });
  });

  it('reads display mode from the preferences store on mount', async () => {
    prefRows['test@test.com'] = JSON.stringify({ allentries_display_mode: 'board' });
    await initPreferences('test@test.com');
    renderPage();
    const boardBtn = screen.getByText('Board');
    expect(boardBtn.className).toContain('active');
  });

  it('reads sort preference from the preferences store on mount', async () => {
    prefRows['test@test.com'] = JSON.stringify({ allentries_sort_by: 'priority' });
    await initPreferences('test@test.com');
    renderPage();
    const priorityBtn = screen.getByText('Priority');
    expect(priorityBtn.className).toContain('active');
  });
});

describe('AllEntriesPage archive filtering (Batch 3A — active-view consistency)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(prefRows)) delete prefRows[key];
    localStorage.clear();
    await initPreferences('test@test.com');
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/entries']}>
        <AllEntriesPage />
      </MemoryRouter>
    );
  }

  function seedCache(
    entryRows: Array<Record<string, unknown>>,
    projectRows: Array<Record<string, unknown>>
  ) {
    vi.mocked(cacheGet).mockImplementation(async (store: unknown) =>
      store === 'projects' ? { data: projectRows } : { data: entryRows }
    );
  }

  const activeProject = { project_name: 'Alpha', archived: false };
  const archivedProject = { project_name: 'OldProject', archived: true };

  function row(overrides: Record<string, unknown>) {
    return {
      project_name: 'Alpha',
      due_date: '2030-01-01T10:00:00Z',
      status: 'up_next',
      archived: false,
      deleted: false,
      ...overrides,
    };
  }

  /** Ids of every entry handed to a rendered stub. */
  function renderedEntryIds(): Array<string | undefined> {
    return (EntryBox as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (call) => (call[0] as { entry: { id?: string } }).entry?.id
    );
  }

  /** Ids passed to a stub on its most recent call. */
  function lastCalledIds(component: unknown, prop: string): Array<string | undefined> {
    const calls = (component as { mock: { calls: unknown[][] } }).mock.calls;
    if (calls.length === 0) return [];
    const props = calls[calls.length - 1][0] as Record<string, unknown>;
    return (props[prop] as Array<{ id?: string }>).map((r) => r.id);
  }

  it('excludes archived, deleted, and archived-project entries from the cards view', async () => {
    seedCache(
      [
        row({ id: '1', summary: 'Active entry' }),
        row({ id: '2', summary: 'Archived entry', archived: true }),
        row({ id: '3', summary: 'Entry of archived project', project_name: 'OldProject' }),
        row({ id: '4', summary: 'Deleted entry', deleted: true }),
      ],
      [activeProject, archivedProject]
    );
    renderPage();
    await waitFor(() => expect(vi.mocked(EntryBox).mock.calls.length).toBeGreaterThan(0));
    const renderedIds = renderedEntryIds();
    expect(renderedIds).toContain('1');
    expect(renderedIds).not.toContain('2');
    expect(renderedIds).not.toContain('3');
    expect(renderedIds).not.toContain('4');
  });

  it('keeps the same eligibility when switching through every view mode', async () => {
    seedCache(
      [
        row({ id: '1', summary: 'Active entry' }),
        row({ id: '2', summary: 'Archived entry', archived: true }),
        row({ id: '3', summary: 'Entry of archived project', project_name: 'OldProject' }),
        row({ id: '4', summary: 'Deleted entry', deleted: true }),
      ],
      [activeProject, archivedProject]
    );
    renderPage();

    fireEvent.click(screen.getByText('Table'));
    await waitFor(() => expect(vi.mocked(ProjectTaskTable).mock.calls.length).toBeGreaterThan(0));
    let ids = lastCalledIds(ProjectTaskTable, 'rows');
    expect(ids).toContain('1');
    expect(ids).not.toContain('2');
    expect(ids).not.toContain('3');
    expect(ids).not.toContain('4');

    fireEvent.click(screen.getByText('Checklist'));
    await waitFor(() => expect(vi.mocked(ChecklistView).mock.calls.length).toBeGreaterThan(0));
    ids = lastCalledIds(ChecklistView, 'entries');
    expect(ids).toContain('1');
    expect(ids).not.toContain('2');
    expect(ids).not.toContain('3');
    expect(ids).not.toContain('4');

    fireEvent.click(screen.getByText('Board'));
    await waitFor(() =>
      expect(vi.mocked(EntriesByDueDateBoard).mock.calls.length).toBeGreaterThan(0)
    );
    ids = lastCalledIds(EntriesByDueDateBoard, 'entries');
    expect(ids).toContain('1');
    expect(ids).not.toContain('2');
    expect(ids).not.toContain('3');
    expect(ids).not.toContain('4');
  });

  it('excludes entries of a project archived through the local fallback', async () => {
    // Legacy fallback written when the server archive update is blocked — the
    // effective archive state (shared with Dashboard) must cover it too.
    localStorage.setItem('dl_archived_test@test.com', JSON.stringify(['LocalOld']));
    seedCache(
      [
        row({ id: '1', summary: 'Active entry' }),
        row({ id: '2', summary: 'Locally archived entry', project_name: 'LocalOld' }),
      ],
      [activeProject, { project_name: 'LocalOld', archived: false }]
    );
    renderPage();
    await waitFor(() => expect(vi.mocked(EntryBox).mock.calls.length).toBeGreaterThan(0));
    const renderedIds = renderedEntryIds();
    expect(renderedIds).toContain('1');
    expect(renderedIds).not.toContain('2');
  });

  it('does not let search resurrect archived or deleted entries', async () => {
    seedCache(
      [
        row({ id: '1', summary: 'Kickoff recap' }),
        row({ id: '2', summary: 'Kickoff archived draft', archived: true }),
        row({ id: '4', summary: 'Kickoff deleted draft', deleted: true }),
      ],
      [activeProject]
    );
    renderPage();
    await waitFor(() => expect(vi.mocked(EntryBox).mock.calls.length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText('Filter entries...'), {
      target: { value: 'kickoff' },
    });
    await waitFor(() => expect(renderedEntryIds()).toContain('1'));
    const renderedIds = renderedEntryIds();
    expect(renderedIds).not.toContain('2');
    expect(renderedIds).not.toContain('4');
  });

  it('shows the empty search state when only archived entries match', async () => {
    seedCache(
      [
        row({ id: '1', summary: 'Active entry' }),
        row({ id: '2', summary: 'Zebra archived', archived: true }),
      ],
      [activeProject]
    );
    renderPage();
    await waitFor(() => expect(vi.mocked(EntryBox).mock.calls.length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText('Filter entries...'), {
      target: { value: 'zebra' },
    });
    await waitFor(() => expect(screen.getByText('No results found')).toBeTruthy());
  });

  it('shows the empty state when no active entries exist', async () => {
    seedCache(
      [
        row({ id: '2', summary: 'Archived', archived: true }),
        row({ id: '4', summary: 'Deleted', deleted: true }),
      ],
      [activeProject]
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('No entries yet')).toBeTruthy());
  });

  it('returns a restored entry to active views once its archive flag clears', async () => {
    seedCache([row({ id: '2', summary: 'Restored entry', archived: false })], [activeProject]);
    renderPage();
    await waitFor(() => expect(vi.mocked(EntryBox).mock.calls.length).toBeGreaterThan(0));
    expect(renderedEntryIds()).toContain('2');
  });

  it('re-includes a project\u2019s entries after the project is restored', async () => {
    // While the project is effectively archived its entries stay out…
    seedCache(
      [row({ id: '5', summary: 'Project entry', project_name: 'OldProject' })],
      [archivedProject]
    );
    const first = renderPage();
    await waitFor(() => expect(screen.getByText('No entries yet')).toBeTruthy());
    first.unmount();

    // …and the same entry becomes visible again once the project is active.
    seedCache(
      [row({ id: '5', summary: 'Project entry', project_name: 'OldProject' })],
      [{ project_name: 'OldProject', archived: false }]
    );
    renderPage();
    await waitFor(() => expect(renderedEntryIds()).toContain('5'));
  });
});
