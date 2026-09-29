import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AllEntriesPage } from '../AllEntries';
import { cacheGet } from '@/lib/cache';

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
    FIELDS: 'fields',
  },
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

vi.mock('@/pages/AddEntry', () => ({
  AddEntry: vi.fn(() => <div data-testid="add-entry">AddEntry</div>),
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

vi.mock('@/pages/Kanban', () => ({
  KanbanBoardView: vi.fn(() => <div data-testid="kanban-view">KanbanBoardView</div>),
}));

vi.mock('@/pages/Timeline', () => ({
  TimelineView: vi.fn(() => <div data-testid="timeline-view">TimelineView</div>),
}));

describe('AllEntriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByText('My Entries')).toBeTruthy();
  });

  it('renders the QuickEntryBar', () => {
    renderPage();
    expect(screen.getByTestId('quick-entry-bar')).toBeTruthy();
  });

  it('renders the search input', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Search entries...')).toBeTruthy();
  });

  it('shows the View dropdown with every display option', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    expect(screen.getByRole('option', { name: 'Cards' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Checklist' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Board' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Table' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Kanban' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Timeline' })).toBeTruthy();
  });

  it('shows the sort dropdown with Date and Priority options', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    expect(screen.getByRole('option', { name: 'Date' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Priority' })).toBeTruthy();
  });

  it('defaults to cards display mode', () => {
    renderPage();
    // The View dropdown trigger shows the active display mode
    expect(screen.getByRole('button', { name: 'Cards' })).toBeTruthy();
  });

  it('defaults to date sorting', () => {
    renderPage();
    // The Sort dropdown trigger shows the active sort option
    expect(screen.getByRole('button', { name: 'Date' })).toBeTruthy();
  });

  it('changes display mode from the View dropdown', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    fireEvent.click(screen.getByRole('option', { name: 'Checklist' }));
    expect(screen.getByRole('button', { name: 'Checklist' })).toBeTruthy();
    expect(setItemSpy).toHaveBeenCalledWith('allentries-display-mode', 'checklist');
    setItemSpy.mockRestore();
    localStorage.clear();
  });

  it('changes the sort preference from the sort dropdown', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    fireEvent.click(screen.getByRole('option', { name: 'Priority' }));
    expect(screen.getByRole('button', { name: 'Priority' })).toBeTruthy();
    expect(setItemSpy).toHaveBeenCalledWith('allentries-sort-by', 'priority');
    setItemSpy.mockRestore();
    localStorage.clear();
  });

  it('hides the sort control only in kanban and timeline views', () => {
    renderPage();
    // Visible in the default (cards) view
    expect(screen.getByRole('button', { name: 'Date' })).toBeTruthy();

    // Hidden in the kanban view
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    fireEvent.click(screen.getByRole('option', { name: 'Kanban' }));
    expect(screen.queryByRole('button', { name: 'Date' })).toBeNull();

    // Hidden in the timeline view
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }));
    fireEvent.click(screen.getByRole('option', { name: 'Timeline' }));
    expect(screen.queryByRole('button', { name: 'Date' })).toBeNull();

    // Reappears in the other views
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    fireEvent.click(screen.getByRole('option', { name: 'Cards' }));
    expect(screen.getByRole('button', { name: 'Date' })).toBeTruthy();
    localStorage.clear();
  });

  it('shows the new-entry card in the feed', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /New Entry/ })).toBeTruthy();
  });

  it('opens the new-entry project picker from the new-entry card', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /New Entry/ }));
    expect(screen.getByRole('heading', { name: 'New Entry' })).toBeTruthy();
    expect(screen.getByText('No projects yet. Create one first.')).toBeTruthy();
  });

  it('opens the entry form after picking a project in the new-entry modal', async () => {
    vi.mocked(cacheGet)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ project_name: 'Alpha' }] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /New Entry/ }));
    const projectButton = await screen.findByRole('button', { name: 'Alpha' });
    fireEvent.click(projectButton);
    expect(screen.getByTestId('add-entry')).toBeTruthy();
  });

  it('shows empty state when no entries', async () => {
    renderPage();
    await waitFor(() => {
      // Should show "No entries yet" or loading state
      const main = document.querySelector('.dash-main');
      expect(main).toBeTruthy();
    });
  });

  it('persists display mode to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    renderPage();
    // On mount, it should save the default display mode
    expect(setItemSpy).toHaveBeenCalledWith('allentries-display-mode', 'cards');
    setItemSpy.mockRestore();
  });

  it('persists sort preference to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    renderPage();
    expect(setItemSpy).toHaveBeenCalledWith('allentries-sort-by', 'date');
    setItemSpy.mockRestore();
  });

  it('reads display mode from localStorage on mount', () => {
    localStorage.setItem('allentries-display-mode', 'board');
    renderPage();
    expect(screen.getByRole('button', { name: 'Board' })).toBeTruthy();
    localStorage.clear();
  });

  it('reads sort preference from localStorage on mount', () => {
    localStorage.setItem('allentries-sort-by', 'priority');
    renderPage();
    // The Sort dropdown trigger reflects the saved preference
    expect(screen.getByRole('button', { name: 'Priority' })).toBeTruthy();
    localStorage.clear();
  });

  /** Route each cache store this page reads to the data under test. */
  function mockFeed({
    entries,
    projects,
    fields = {},
  }: {
    entries: Array<Record<string, unknown>>;
    projects: Array<Record<string, unknown>>;
    fields?: Record<string, Array<Record<string, unknown>>>;
  }) {
    vi.mocked(cacheGet).mockImplementation(async (store: string, key: string) => {
      if (store === 'all_entries') return { data: entries };
      if (store === 'projects') return { data: projects };
      if (store === 'fields') return { data: fields[key.split(':')[1]] ?? [] };
      return { data: [] };
    });
  }

  const feedEntries = [
    { id: 'a1', project_name: 'Alpha' },
    { id: 'a2', project_name: 'Alpha' },
    { id: 'a3', project_name: 'Alpha' },
    { id: 'b1', project_name: 'Beta' },
  ];
  const feedProjects = [{ project_name: 'Alpha' }, { project_name: 'Beta' }];

  it('shows the filter icon at the end of the search bar', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
  });

  it('opens the entries filter panel with project, entry count and field count', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByText('Filter entries')).toBeTruthy();
    expect(screen.getByLabelText('Project name filter')).toBeTruthy();
    expect(screen.getByLabelText('Entry count filter type')).toBeTruthy();
    expect(screen.getByLabelText('Field count filter type')).toBeTruthy();
  });

  it('filters the feed by project name', async () => {
    mockFeed({ entries: feedEntries, projects: feedProjects });
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(4));

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Project name filter'), { target: { value: 'Alpha' } });

    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Filters (1 active)' })).toBeTruthy();
  });

  it("filters the feed by the entry's project entry count", async () => {
    mockFeed({ entries: feedEntries, projects: feedProjects });
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(4));

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Entry count value'), { target: { value: '2' } });

    // Alpha has 3 entries, Beta only 1 — Above 2 keeps Alpha's rows
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(3));
  });

  it("filters the feed by the entry's project field count", async () => {
    mockFeed({
      entries: feedEntries,
      projects: feedProjects,
      fields: { Alpha: [{ field_name: 'Calories' }, { field_name: 'Food Name' }] },
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(4));

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Field count value'), { target: { value: '1' } });

    // Only Alpha defines fields at all — Beta's 0 field count is filtered out
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(3));
  });

  it("filters the feed by the entry's project field type", async () => {
    mockFeed({
      entries: feedEntries,
      projects: feedProjects,
      fields: {
        Alpha: [
          { field_name: 'Calories', data_type: 'integer' },
          { field_name: 'Food Name', data_type: 'text' },
        ],
        Beta: [{ field_name: 'Steps', data_type: 'integer' }],
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(4));

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await waitFor(() => expect(screen.getByLabelText('Field type filter')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Field type filter'), { target: { value: 'text' } });

    // Only Alpha defines a text field — Beta's rows are filtered out
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Filters (1 active)' })).toBeTruthy();
  });

  it('searches entries by field name as well as by value', async () => {
    mockFeed({
      entries: [
        { id: 'a1', project_name: 'Alpha', entries: { Calories: 200 } },
        { id: 'a2', project_name: 'Alpha', entries: { Steps: 5000 } },
      ],
      projects: [{ project_name: 'Alpha' }],
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(2));

    fireEvent.change(screen.getByPlaceholderText('Search entries...'), {
      target: { value: 'calories' },
    });

    // "Calories" is the only entry with a matching field name or value
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(1));
  });

  it('clears every active filter', async () => {
    mockFeed({ entries: feedEntries, projects: feedProjects });
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(4));

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Project name filter'), { target: { value: 'Beta' } });
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(1));

    fireEvent.click(screen.getByText('Clear all'));
    await waitFor(() => expect(screen.getAllByTestId('entry-box')).toHaveLength(4));
    expect(screen.getByLabelText('Project name filter')).toHaveProperty('value', '');
  });
});
