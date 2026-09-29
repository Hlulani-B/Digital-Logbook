import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Stats } from '../Stats';

// Mock hooks and dependencies
vi.mock('@/hooks/useNow', () => ({
  useNow: vi.fn().mockReturnValue(new Date('2025-01-01T12:00:00Z')),
}));

vi.mock('@/functions/ai.js', () => ({
  askAI: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('@/functions/tone', () => ({
  getToneInstruction: vi.fn().mockReturnValue(''),
}));

vi.mock('@/functions/aiMessages', () => ({
  getAiMessagesEnabled: vi.fn().mockReturnValue(false),
  useAiMessagesEnabled: vi.fn().mockReturnValue(false),
}));

/** Exposes the current location so navigation can be asserted. */
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

interface StatsTestProps {
  entries?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
  dueSoonCount?: number;
  activeProject?: string;
}

function renderStats({
  entries = [],
  projects = [],
  dueSoonCount = 0,
  activeProject,
}: StatsTestProps = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Stats
        entries={entries}
        projects={projects}
        dueSoonCount={dueSoonCount}
        activeProject={activeProject}
      />
      <LocationDisplay />
    </MemoryRouter>
  );
}

/** Opens the "Stats" dropdown menu. */
function openStatsMenu() {
  fireEvent.click(screen.getByLabelText('Stats options'));
}

/** Opens the dropdown and clicks the "Quick Stats" menu item. */
function openQuickStats() {
  openStatsMenu();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Quick Stats' }));
}

describe('Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Stats" dropdown trigger when panel is closed', () => {
    renderStats();
    expect(screen.getByLabelText('Stats options')).toBeTruthy();
    expect(screen.getByText('Stats')).toBeTruthy();
  });

  it('lists Quick Stats and Global Stats options in the menu', () => {
    renderStats();
    openStatsMenu();
    expect(screen.getByRole('menuitem', { name: 'Quick Stats' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Global Stats' })).toBeTruthy();
    // Only the two global options without an active project
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('shows the project option only when activeProject is set', () => {
    renderStats({ activeProject: 'MyProject' });
    openStatsMenu();
    expect(screen.getByRole('menuitem', { name: 'MyProject Stats' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('opens the quick stats panel from the menu', () => {
    renderStats();
    openQuickStats();
    expect(screen.getByText('Quick Stats')).toBeTruthy();
    expect(screen.getByLabelText('Close stats')).toBeTruthy();
  });

  it('displays total entries count', () => {
    renderStats({ entries: [{ id: '1' }, { id: '2' }, { id: '3' }] });
    openQuickStats();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Total Entries')).toBeTruthy();
  });

  it('displays projects count', () => {
    renderStats({ projects: [{ project_name: 'A' }, { project_name: 'B' }] });
    openQuickStats();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Projects')).toBeTruthy();
  });

  it('displays due soon count', () => {
    renderStats({ dueSoonCount: 5 });
    openQuickStats();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Due Soon')).toBeTruthy();
  });

  it('closes panel when close button is clicked', () => {
    renderStats();
    openQuickStats();
    expect(screen.getByText('Quick Stats')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Close stats'));
    expect(screen.queryByText('Quick Stats')).toBeNull();
    expect(screen.getByLabelText('Stats options')).toBeTruthy();
  });

  it('navigates to the global stats page from the menu', () => {
    renderStats();
    openStatsMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Global Stats' }));
    expect(screen.getByTestId('location').textContent).toBe('/stats');
  });

  it('navigates to the project stats page from the menu', () => {
    renderStats({ activeProject: 'MyProject' });
    openStatsMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'MyProject Stats' }));
    expect(screen.getByTestId('location').textContent).toBe('/stats?project=MyProject');
  });

  it('shows scoped stats for activeProject', () => {
    const entries = [
      {
        id: '1',
        project_name: 'MyProject',
        started_at: '2025-01-01T10:00:00Z',
        ended_at: '2025-01-01T11:00:00Z',
      },
      { id: '2', project_name: 'OtherProject' },
    ];
    renderStats({ entries, activeProject: 'MyProject' });
    openQuickStats();

    expect(screen.getByText('MyProject — Stats')).toBeTruthy();
    expect(screen.getByText('Entries')).toBeTruthy();
    expect(screen.getByText('Total Time')).toBeTruthy();
  });

  it('handles empty entries and projects gracefully', () => {
    renderStats({ entries: null as any, projects: null as any });
    openQuickStats();
    // Multiple "0" values are shown (entries, projects, due soon)
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it('displays Time Tracked label', () => {
    renderStats();
    openQuickStats();
    expect(screen.getByText('Time Tracked')).toBeTruthy();
  });
});
