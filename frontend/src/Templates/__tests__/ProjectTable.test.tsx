import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectTaskTable from '../ProjectTemplates/ProjectTable';
import { NotesProvider } from '@/context/NotesContext';

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

  function renderTable(rows: any[]) {
    return render(
      <NotesProvider>
        <ProjectTaskTable rows={rows} onUpdate={mockOnUpdate} />
      </NotesProvider>
    );
  }

  it('renders without crashing with empty rows', () => {
    renderTable([]);
    expect(document.body).toBeTruthy();
  });

  it('renders all entry summaries', () => {
    renderTable(sampleRows);
    expect(screen.getByText('Build feature X')).toBeTruthy();
    expect(screen.getByText('Fix bug Y')).toBeTruthy();
    expect(screen.getByText('Write docs')).toBeTruthy();
  });

  it('renders project names', () => {
    renderTable(sampleRows);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('renders status labels as select options', () => {
    renderTable(sampleRows);
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
    renderTable(sampleRows);
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
    renderTable(withDeleted);
    expect(screen.queryByText('Deleted task')).toBeNull();
  });

  it('renders due dates formatted', () => {
    renderTable(sampleRows);
    const dateElements = screen.getAllByText(/Sep/);
    expect(dateElements.length).toBe(3);
    // All three entries should have date cells
    const dateCells = document.querySelectorAll('.ptt-editable-date');
    expect(dateCells.length).toBe(3);
  });

  it('groups entries by project', () => {
    renderTable(sampleRows);
    const alphaLabels = screen.getAllByText('Alpha');
    expect(alphaLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps legacy payloads visible and object keys retained after field removal readable', () => {
    const historicalRows = [
      {
        ...sampleRows[0],
        id: 'legacy-string',
        summary: 'Legacy string entry',
        entries: 'Original plain-text entry',
      },
      {
        ...sampleRows[1],
        id: 'retained-key',
        summary: 'Retained field entry',
        entries: { retired_field: 'Historical value' },
      },
    ];

    renderTable(historicalRows);

    expect(screen.getByText('Legacy content')).toBeTruthy();
    const legacyValue = screen.getByText('Original plain-text entry');
    expect(legacyValue.closest('.ptt-editable')).toBeNull();
    expect(screen.getByText('retired_field')).toBeTruthy();
    expect(screen.getByText('Historical value')).toBeTruthy();

    fireEvent.click(legacyValue);
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
});
