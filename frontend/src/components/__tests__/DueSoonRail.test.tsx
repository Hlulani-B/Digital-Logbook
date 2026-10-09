import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DueSoonRail } from '../DueSoonRail';

const NOW = new Date('2026-03-15T10:00:00Z');
const inWindow = new Date(NOW.getTime() + 24 * 3600000).toISOString();

const row = (over: Record<string, unknown>) => ({
  id: 'x',
  summary: 'Task',
  project_name: 'Alpha',
  due_date: inWindow,
  status: 'up_next',
  archived: false,
  ...over,
});

describe('DueSoonRail — render-boundary eligibility guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an eligible active entry with its due-soon count', () => {
    const { container } = render(
      <MemoryRouter>
        <DueSoonRail entries={[row({ summary: 'Write report' })]} />
      </MemoryRouter>
    );
    expect(screen.getByText('Write report')).toBeTruthy();
    expect(container.querySelector('.dash-rail__count')?.textContent).toBe('1');
  });

  it('never renders a completed, archived or overdue entry, and the count matches', () => {
    const { container } = render(
      <MemoryRouter>
        <DueSoonRail
          entries={[
            row({ id: '1', summary: 'Still active' }),
            row({ id: '2', summary: 'Completed task', status: 'done_and_dusted' }),
            row({ id: '3', summary: 'Archived task', archived: true }),
            row({
              id: '4',
              summary: 'Overdue task',
              due_date: new Date(NOW.getTime() - 3600000).toISOString(),
            }),
            row({ id: '5', summary: 'No deadline task', due_date: null }),
          ]}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Still active')).toBeTruthy();
    expect(screen.queryByText('Completed task')).toBeNull();
    expect(screen.queryByText('Archived task')).toBeNull();
    expect(screen.queryByText('Overdue task')).toBeNull();
    expect(screen.queryByText('No deadline task')).toBeNull();
    expect(container.querySelector('.dash-rail__count')?.textContent).toBe('1');
  });

  it('shows the empty state when nothing is eligible', () => {
    render(
      <MemoryRouter>
        <DueSoonRail entries={[row({ summary: 'Completed task', status: 'done_and_dusted' })]} />
      </MemoryRouter>
    );
    expect(screen.getByText('Nothing due soon.')).toBeTruthy();
  });
});
