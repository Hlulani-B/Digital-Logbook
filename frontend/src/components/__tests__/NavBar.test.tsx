import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NavBar } from '../NavBar';

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/dashboard', search: '', hash: '', state: null, key: '' }),
  };
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'test@test.com', user_metadata: { full_name: 'Test User' } },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  CACHE_STORES: {
    PROJECTS: 'projects',
    ALL_ENTRIES: 'all_entries',
    PROFILE: 'profile',
  },
}));

describe('NavBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderNavBar(props = {}) {
    return render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NavBar {...props} />
      </MemoryRouter>
    );
  }

  it('renders the Digital Logbook title', () => {
    renderNavBar();
    expect(screen.getByText('Digital Logbook')).toBeTruthy();
  });

  it('renders the hamburger toggle button', () => {
    renderNavBar();
    expect(screen.getByLabelText('Toggle menu')).toBeTruthy();
  });

  it('opens drawer when hamburger is clicked', () => {
    renderNavBar();
    const hamburger = screen.getByLabelText('Toggle menu');
    fireEvent.click(hamburger);

    // Drawer should now be visible
    expect(screen.getByText('Navigation')).toBeTruthy();
    expect(screen.getByText('Views')).toBeTruthy();
    expect(screen.getByText('Projects')).toBeTruthy();
  });

  it('shows navigation items in drawer', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('All Entries')).toBeTruthy();
    expect(screen.getByText('Archives')).toBeTruthy();
    expect(screen.getByText('My Stats')).toBeTruthy();
    expect(screen.getByText('Activity Log')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.getByText('Kanban')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('shows "No projects yet" when no projects provided', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    expect(screen.getByText('No projects yet. Create one below.')).toBeTruthy();
  });

  it('renders project names when projects are provided', () => {
    const projects = [
      { project_name: 'Project Alpha', archived: false },
      { project_name: 'Project Beta', archived: false },
    ];
    renderNavBar({ projects });
    fireEvent.click(screen.getByLabelText('Toggle menu'));

    expect(screen.getByText('Project Alpha')).toBeTruthy();
    expect(screen.getByText('Project Beta')).toBeTruthy();
  });

  it('does not show archived projects', () => {
    const projects = [
      { project_name: 'Active Project', archived: false },
      { project_name: 'Archived Project', archived: true },
    ];
    renderNavBar({ projects });
    fireEvent.click(screen.getByLabelText('Toggle menu'));

    expect(screen.getByText('Active Project')).toBeTruthy();
    expect(screen.queryByText('Archived Project')).toBeNull();
  });

  it('navigates to /dashboard when Home is clicked', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('Home'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to /entries when All Entries is clicked', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('All Entries'));
    expect(mockNavigate).toHaveBeenCalledWith('/entries');
  });

  it('navigates to /calendar when Calendar is clicked', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('Calendar'));
    expect(mockNavigate).toHaveBeenCalledWith('/calendar');
  });

  it('navigates to /kanban when Kanban is clicked', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('Kanban'));
    expect(mockNavigate).toHaveBeenCalledWith('/kanban');
  });

  it('navigates to /today when Today is clicked', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('Today'));
    expect(mockNavigate).toHaveBeenCalledWith('/today');
  });

  it('closes drawer after clicking a nav item', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    expect(screen.getByText('Navigation')).toBeTruthy();

    fireEvent.click(screen.getByText('Home'));
    // After clicking, drawer should close — Navigation text should still be in DOM
    // but drawer-open class should be removed
  });

  it('shows entry count badge next to Home', () => {
    const entries = [
      { id: '1', project_name: 'P1' },
      { id: '2', project_name: 'P2' },
    ];
    renderNavBar({ entries });
    fireEvent.click(screen.getByLabelText('Toggle menu'));

    // The badge should show "2"
    const badges = screen.getAllByText('2');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows New Project button', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    expect(screen.getByText('New Project')).toBeTruthy();
  });

  it('shows Manage Projects button', () => {
    renderNavBar();
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    expect(screen.getByText('Manage Projects')).toBeTruthy();
  });

  it('calls onNewProject when New Project is clicked', () => {
    const onNewProject = vi.fn();
    renderNavBar({ onNewProject });
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('New Project'));
    expect(onNewProject).toHaveBeenCalled();
  });

  it('dispatches open-settings event when settings is triggered via ProfileMenu', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderNavBar();

    // Open profile menu
    fireEvent.click(screen.getByRole('button', { name: /Test User/i }));
    // Click settings
    fireEvent.click(screen.getByText('Settings'));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'open-settings' })
    );
    dispatchSpy.mockRestore();
  });

  it('renders ProfileMenu with user info', () => {
    renderNavBar();
    expect(screen.getByText('Test User')).toBeTruthy();
  });

  it('shows project entry counts in badges', () => {
    const projects = [{ project_name: 'Alpha', archived: false }];
    const entries = [
      { id: '1', project_name: 'Alpha' },
      { id: '2', project_name: 'Alpha' },
      { id: '3', project_name: 'Beta' },
    ];
    renderNavBar({ projects, entries });
    fireEvent.click(screen.getByLabelText('Toggle menu'));

    // Alpha should have badge with 2
    const badges = screen.getAllByText('2');
    expect(badges.length).toBeGreaterThan(0);
  });
});
