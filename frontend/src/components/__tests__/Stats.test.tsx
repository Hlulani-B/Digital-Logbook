import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
}));

describe('Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "View Stats" button when panel is closed', () => {
    render(<Stats entries={[]} projects={[]} dueSoonCount={0} />);
    expect(screen.getByText('View Stats')).toBeTruthy();
  });

  it('opens stats panel on button click', () => {
    render(<Stats entries={[]} projects={[]} dueSoonCount={0} />);
    fireEvent.click(screen.getByText('View Stats'));
    expect(screen.getByText('Quick Stats')).toBeTruthy();
  });

  it('displays total entries count', () => {
    const entries = [{ id: '1' }, { id: '2' }, { id: '3' }];
    render(<Stats entries={entries} projects={[]} dueSoonCount={0} />);
    fireEvent.click(screen.getByText('View Stats'));
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Total Entries')).toBeTruthy();
  });

  it('displays projects count', () => {
    const projects = [{ project_name: 'A' }, { project_name: 'B' }];
    render(<Stats entries={[]} projects={projects} dueSoonCount={0} />);
    fireEvent.click(screen.getByText('View Stats'));
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Projects')).toBeTruthy();
  });

  it('displays due soon count', () => {
    render(<Stats entries={[]} projects={[]} dueSoonCount={5} />);
    fireEvent.click(screen.getByText('View Stats'));
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Due Soon')).toBeTruthy();
  });

  it('closes panel when close button is clicked', () => {
    render(<Stats entries={[]} projects={[]} dueSoonCount={0} />);
    fireEvent.click(screen.getByText('View Stats'));
    expect(screen.getByText('Quick Stats')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Close stats'));
    expect(screen.queryByText('Quick Stats')).toBeNull();
    expect(screen.getByText('View Stats')).toBeTruthy();
  });

  it('shows "Project Stats" when activeProject is set', () => {
    render(<Stats entries={[]} projects={[]} dueSoonCount={0} activeProject="MyProject" />);
    expect(screen.getByText('Project Stats')).toBeTruthy();
  });

  it('shows scoped stats for activeProject', () => {
    const entries = [
      { id: '1', project_name: 'MyProject', started_at: '2025-01-01T10:00:00Z', ended_at: '2025-01-01T11:00:00Z' },
      { id: '2', project_name: 'OtherProject' },
    ];
    render(<Stats entries={entries} projects={[]} dueSoonCount={0} activeProject="MyProject" />);
    fireEvent.click(screen.getByText('Project Stats'));

    expect(screen.getByText('MyProject — Stats')).toBeTruthy();
    expect(screen.getByText('Entries')).toBeTruthy();
    expect(screen.getByText('Total Time')).toBeTruthy();
  });

  it('handles empty entries and projects gracefully', () => {
    render(<Stats entries={null as any} projects={null as any} dueSoonCount={0} />);
    fireEvent.click(screen.getByText('View Stats'));
    // Multiple "0" values are shown (entries, projects, due soon)
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it('displays Time Tracked label', () => {
    render(<Stats entries={[]} projects={[]} dueSoonCount={0} />);
    fireEvent.click(screen.getByText('View Stats'));
    expect(screen.getByText('Time Tracked')).toBeTruthy();
  });
});
