import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectTaskTable from '../ProjectTemplates/ProjectTable';

const mockOnUpdate = vi.fn();

const sampleRows = [
  {
    id: 'e1',
    project_name: 'Alpha',
    summary: 'Build feature X',
    status: 'in_motion',
    priority: '1',
    due_date: '2025-09-10',
    entries: { task: 'Build feature X', notes: 'Almost done' },
    deleted: false,
  },
  {
    id: 'e2',
    project_name: 'Alpha',
    summary: 'Fix bug Y',
    status: 'up_next',
    priority: '0',
    due_date: '2025-09-12',
    entries: { task: 'Fix bug Y' },
    deleted: false,
  },
  {
    id: 'e3',
    project_name: 'Beta',
    summary: 'Write docs',
    status: 'done_and_dusted',
    priority: '3',
    due_date: '2025-09-08',
    entries: { task: 'Write docs' },
    deleted: false,
  },
];

describe('ProjectTaskTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing with empty rows', () => {
    render(<ProjectTaskTable rows={[]} onUpdate={mockOnUpdate} />);
    expect(document.body).toBeTruthy();
  });

  it('renders all entry summaries', () => {
    render(<ProjectTaskTable rows={sampleRows} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Build feature X')).toBeTruthy();
    expect(screen.getByText('Fix bug Y')).toBeTruthy();
    expect(screen.getByText('Write docs')).toBeTruthy();
  });

  it('renders project names', () => {
    render(<ProjectTaskTable rows={sampleRows} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('renders status labels as select options', () => {
    render(<ProjectTaskTable rows={sampleRows} onUpdate={mockOnUpdate} />);
    // Statuses are rendered as <select> options
    const statusSelects = document.querySelectorAll('.ptt-select-status');
    expect(statusSelects.length).toBeGreaterThanOrEqual(1);
    // Check that option text includes the status labels
    const allOptions = Array.from(document.querySelectorAll('.ptt-select-status option'));
    const optionTexts = allOptions.map((o) => o.textContent);
    expect(optionTexts).toContain('In Motion');
    expect(optionTexts).toContain('Done & Dusted');
  });

  it('renders priority labels as select options', () => {
    render(<ProjectTaskTable rows={sampleRows} onUpdate={mockOnUpdate} />);
    // Priorities are rendered as <select> options
    const prioritySelects = document.querySelectorAll('.ptt-select-priority');
    expect(prioritySelects.length).toBeGreaterThanOrEqual(1);
    const allOptions = Array.from(document.querySelectorAll('.ptt-select-priority option'));
    const optionTexts = allOptions.map((o) => o.textContent);
    expect(optionTexts).toContain('Urgent and important');
    expect(optionTexts).toContain('Urgent but not important');
    expect(optionTexts).toContain('No priority');
  });

  it('skips soft-deleted rows', () => {
    const withDeleted = [
      ...sampleRows,
      { ...sampleRows[0], id: 'deleted-1', summary: 'Deleted task', deleted: true },
    ];
    render(<ProjectTaskTable rows={withDeleted} onUpdate={mockOnUpdate} />);
    expect(screen.queryByText('Deleted task')).toBeNull();
  });

  it('renders due dates formatted', () => {
    render(<ProjectTaskTable rows={sampleRows} onUpdate={mockOnUpdate} />);
    const dateElements = screen.getAllByText(/Sep/);
    expect(dateElements.length).toBe(3);
    // All three entries should have date cells
    const dateCells = document.querySelectorAll('.ptt-editable-date');
    expect(dateCells.length).toBe(3);
  });

  it('groups entries by project', () => {
    render(<ProjectTaskTable rows={sampleRows} onUpdate={mockOnUpdate} />);
    const alphaLabels = screen.getAllByText('Alpha');
    expect(alphaLabels.length).toBeGreaterThanOrEqual(1);
  });
});
