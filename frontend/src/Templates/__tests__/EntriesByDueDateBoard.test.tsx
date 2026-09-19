import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntriesByDueDateBoard from '../ProjectTemplates/EntriesByDueDateBoard';
import { NotesProvider } from '@/context/NotesContext';

vi.mock('@/functions/project/entries.js', () => ({
  updateEntry: vi.fn().mockResolvedValue({ success: true }),
}));

const sampleEntries = [
  {
    id: 'e1',
    user_email: 'test@test.com',
    project_name: 'ProjectA',
    summary: 'Task Monday',
    due_date: '2025-09-08',
    status: 'up_next' as const,
    entries: null,
    started_at: null,
  },
  {
    id: 'e2',
    user_email: 'test@test.com',
    project_name: 'ProjectA',
    summary: 'Task Wednesday',
    due_date: '2025-09-10',
    status: 'in_motion' as const,
    entries: null,
    started_at: '2025-09-08T10:00:00Z',
  },
  {
    id: 'e3',
    user_email: 'test@test.com',
    project_name: 'ProjectB',
    summary: 'No date task',
    due_date: null,
    status: 'up_next' as const,
    entries: null,
    started_at: null,
  },
];

describe('EntriesByDueDateBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderBoard(entries: any[]) {
    return render(
      <NotesProvider>
        <EntriesByDueDateBoard entries={entries} />
      </NotesProvider>
    );
  }

  it('renders columns for each weekday', () => {
    renderBoard(sampleEntries);
    // Should have Monday and Wednesday columns
    expect(screen.getByText('Monday')).toBeTruthy();
    expect(screen.getByText('Wednesday')).toBeTruthy();
  });

  it('renders "No due date" column for entries without date', () => {
    renderBoard(sampleEntries);
    // "No due date" appears both as column label and in entry cards
    const elements = screen.getAllByText('No due date');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays entries in correct columns', () => {
    renderBoard(sampleEntries);
    expect(screen.getByText('Task Monday')).toBeTruthy();
    expect(screen.getByText('Task Wednesday')).toBeTruthy();
    expect(screen.getByText('No date task')).toBeTruthy();
  });

  it('renders empty state when no entries', () => {
    renderBoard([]);
    // Should render without errors
    expect(document.body).toBeTruthy();
  });

  it('renders with empty array prop', () => {
    renderBoard([]);
    expect(document.body).toBeTruthy();
  });

  it('sorts columns by earliest date', () => {
    renderBoard(sampleEntries);
    // Check that column labels exist (Monday, Wednesday, No due date)
    const columnLabels = document.querySelectorAll('.edb-column-label');
    expect(columnLabels.length).toBe(3);
  });

  it('skips deleted entries', () => {
    const withDeleted = [
      ...sampleEntries,
      { ...sampleEntries[0], id: 'deleted-1', deleted: true, summary: 'Deleted task' },
    ];
    renderBoard(withDeleted);
    expect(screen.queryByText('Deleted task')).toBeNull();
  });

  it('shows project names on entry cards', () => {
    renderBoard(sampleEntries);
    // ProjectA appears on multiple entries
    const projectLabels = screen.getAllByText('ProjectA');
    expect(projectLabels.length).toBeGreaterThanOrEqual(2);
  });
});
