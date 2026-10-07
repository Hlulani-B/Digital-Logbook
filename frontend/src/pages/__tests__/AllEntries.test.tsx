import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AllEntriesPage } from '../AllEntries';
import { initPreferences } from '@/functions/preferences';

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
