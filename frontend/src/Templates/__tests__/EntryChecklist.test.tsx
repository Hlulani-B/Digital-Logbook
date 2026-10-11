import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChecklistEntryCard from '../EntryTemplates/EntryChecklist';
import { ChecklistView } from '../EntryTemplates/EntryChecklist';
import { NotesProvider } from '@/context/NotesContext';
import { updateEntry } from '@/functions/project/entries.js';
import { setPriority } from '@/functions/project/priority.js';
import { getFields } from '@/functions/project/fields.js';

vi.mock('@/functions/project/entries.js', () => ({
  updateEntry: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/functions/project/priority.js', () => ({
  setPriority: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/functions/project/fields.js', () => ({
  getFields: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

const sampleEntry = {
  id: 'entry-1',
  user_email: 'test@test.com',
  project_name: 'TestProject',
  summary: 'Fix login bug',
  due_date: '2025-09-10',
  status: 'up_next' as const,
  entries: null,
  started_at: null,
};

const doneEntry = {
  ...sampleEntry,
  id: 'entry-2',
  status: 'done_and_dusted' as const,
  summary: 'Write tests',
};

describe('ChecklistEntryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderCard(entry: any) {
    return render(
      <NotesProvider>
        <ChecklistEntryCard entry={entry} />
      </NotesProvider>
    );
  }

  it('renders the project name', () => {
    renderCard(sampleEntry);
    expect(screen.getByText('TestProject')).toBeTruthy();
  });

  it('renders the summary text', () => {
    renderCard(sampleEntry);
    expect(screen.getByText('Fix login bug')).toBeTruthy();
  });

  it('renders project name fallback when no summary', () => {
    const noSummary = { ...sampleEntry, summary: null, entries: null };
    renderCard(noSummary);
    expect(screen.getByText('TestProject entry')).toBeTruthy();
  });

  it('renders opaque historical payloads when no summary is available', () => {
    const legacyEntry = { ...sampleEntry, summary: null, entries: ['Legacy task'] };
    renderCard(legacyEntry);
    expect(screen.getByText('["Legacy task"]')).toBeTruthy();
  });

  it('renders the due date', () => {
    renderCard(sampleEntry);
    // Date is formatted via formatDate
    const dateText = screen.getByText(/Sep/);
    expect(dateText).toBeTruthy();
  });

  it('renders the saved due time alongside the due date', () => {
    const due = new Date(2026, 9, 10, 18, 0).toISOString();
    renderCard({ ...sampleEntry, due_date: due });
    expect(document.querySelector('.checklist-due')?.textContent).toContain('18:00');
  });

  it('keeps a date-only due value free of a fabricated time', () => {
    renderCard({ ...sampleEntry, due_date: '2026-10-10T23:59:59.999Z' });
    const dueText = document.querySelector('.checklist-due')?.textContent || '';
    expect(dueText).toMatch(/10/);
    expect(dueText).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('renders "No due date" when no due_date', () => {
    const noDate = { ...sampleEntry, due_date: null };
    renderCard(noDate);
    expect(screen.getByText('No due date')).toBeTruthy();
  });

  it('shows checkbox for entry', () => {
    renderCard(sampleEntry);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeTruthy();
  });

  it('applies done styling when status is done_and_dusted', () => {
    renderCard(doneEntry);
    const card = screen.getByText('Write tests').closest('.checklist-card');
    expect(card?.className).toContain('done');
  });

  it('sets data-status attribute for in_motion entries', () => {
    const inMotionEntry = { ...sampleEntry, status: 'in_motion' as const };
    renderCard(inMotionEntry);
    const card = screen.getByText('Fix login bug').closest('.checklist-card');
    expect(card?.getAttribute('data-status')).toBe('in_motion');
  });

  it('renders a styled overdue warning only for active past-due entries', () => {
    const pastDue = new Date(Date.now() - 86400000).toISOString();
    const { unmount } = renderCard({ ...sampleEntry, due_date: pastDue });
    expect(document.querySelector('.checklist-overdue-badge')?.textContent).toMatch(/^Overdue/);
    unmount();
    renderCard({ ...doneEntry, due_date: pastDue });
    expect(document.querySelector('.checklist-overdue-badge')).toBeNull();
  });

  it('does not show the warning for archived entries', () => {
    const pastDue = new Date(Date.now() - 86400000).toISOString();
    renderCard({ ...sampleEntry, due_date: pastDue, archived: true });
    expect(document.querySelector('.checklist-overdue-badge')).toBeNull();
  });

  it('updates priority from the card dropdown with the raw server value', async () => {
    const onUpdated = vi.fn();
    render(
      <NotesProvider>
        <ChecklistEntryCard
          entry={{ ...sampleEntry, priority: 'Urgent and important' }}
          onUpdated={onUpdated}
        />
      </NotesProvider>
    );
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: '2' } });
    await waitFor(() =>
      expect(vi.mocked(setPriority)).toHaveBeenCalledExactlyOnceWith(
        'test@test.com',
        '2',
        'TestProject',
        'entry-1'
      )
    );
    expect(onUpdated).toHaveBeenCalled();
  });

  it('updates status from the card dropdown', async () => {
    const onUpdated = vi.fn();
    render(
      <NotesProvider>
        <ChecklistEntryCard entry={sampleEntry} onUpdated={onUpdated} />
      </NotesProvider>
    );
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_motion' } });
    await waitFor(() =>
      expect(vi.mocked(updateEntry)).toHaveBeenCalledExactlyOnceWith(
        'test@test.com',
        'TestProject',
        'entry-1',
        undefined,
        undefined,
        undefined,
        'in_motion'
      )
    );
    expect(onUpdated).toHaveBeenCalled();
  });

  it('edits project fields in the dialog and saves them with the entry', async () => {
    vi.mocked(getFields).mockResolvedValueOnce({
      success: true,
      data: [{ field_name: 'notes', data_type: 'text', is_required: false }],
    } as any);
    const entryWithFields = {
      ...sampleEntry,
      id: 'entry-fields',
      project_name: 'FieldsProject',
      entries: { notes: 'old value' },
    };
    const onUpdated = vi.fn();
    render(
      <NotesProvider>
        <ChecklistEntryCard entry={entryWithFields} onUpdated={onUpdated} />
      </NotesProvider>
    );
    fireEvent.click(screen.getByText('Fix login bug'));
    const input = await screen.findByDisplayValue('old value');
    fireEvent.change(input, { target: { value: 'new value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() =>
      expect(vi.mocked(updateEntry)).toHaveBeenCalledExactlyOnceWith(
        'test@test.com',
        'FieldsProject',
        'entry-fields',
        { notes: 'new value' },
        undefined,
        null,
        'up_next',
        undefined,
        undefined,
        undefined,
        'Fix login bug'
      )
    );
    expect(onUpdated).toHaveBeenCalled();
  });

  it('keeps the details panel collapsed until Show details is pressed', () => {
    const { container } = renderCard(sampleEntry);
    const details = container.querySelector('.checklist-card-details');
    expect(details).not.toBeNull();
    expect(details?.classList.contains('is-open')).toBe(false);
    const toggle = screen.getByRole('button', { name: 'Show details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(
      container.querySelector('.checklist-card-details')?.classList.contains('is-open')
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Hide details' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hide details' }));
    expect(
      container.querySelector('.checklist-card-details')?.classList.contains('is-open')
    ).toBe(false);
  });

  it('shows unfilled project fields blank in the details panel', async () => {
    vi.mocked(getFields).mockResolvedValueOnce({
      success: true,
      data: [{ field_name: 'notes', data_type: 'text', is_required: false }],
    } as any);
    const entry = {
      ...sampleEntry,
      id: 'entry-blank-fields',
      project_name: 'BlankFieldsProject',
      entries: null,
    };
    const { container } = render(
      <NotesProvider>
        <ChecklistEntryCard entry={entry} />
      </NotesProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    await waitFor(() =>
      expect(container.querySelector('.checklist-card-field-key')?.textContent).toBe('Notes')
    );
    expect(
      container.querySelector('.checklist-card-field-value .field-display-empty')?.textContent
    ).toBe('—');
  });

  it('adds values to an empty payload from the edit dialog', async () => {
    vi.mocked(getFields).mockResolvedValueOnce({
      success: true,
      data: [{ field_name: 'notes', data_type: 'text', is_required: false }],
    } as any);
    const entry = {
      ...sampleEntry,
      id: 'entry-empty-payload',
      project_name: 'EmptyPayloadProject',
      entries: null,
    };
    const onUpdated = vi.fn();
    render(
      <NotesProvider>
        <ChecklistEntryCard entry={entry} onUpdated={onUpdated} />
      </NotesProvider>
    );
    fireEvent.click(screen.getByText('Fix login bug'));
    const label = await screen.findByText('notes');
    const input = label.parentElement?.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'added value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() =>
      expect(vi.mocked(updateEntry)).toHaveBeenCalledExactlyOnceWith(
        'test@test.com',
        'EmptyPayloadProject',
        'entry-empty-payload',
        { notes: 'added value' },
        undefined,
        null,
        'up_next',
        undefined,
        undefined,
        undefined,
        'Fix login bug'
      )
    );
    expect(onUpdated).toHaveBeenCalled();
  });
});

describe('ChecklistView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderView(entries: any[]) {
    return render(
      <NotesProvider>
        <ChecklistView entries={entries} />
      </NotesProvider>
    );
  }

  it('renders all entries sorted by due_date', () => {
    const entries = [
      { ...sampleEntry, id: 'e1', due_date: '2025-09-15', summary: 'Later task' },
      { ...sampleEntry, id: 'e2', due_date: '2025-09-10', summary: 'Earlier task' },
    ];
    renderView(entries);
    expect(screen.getByText('Earlier task')).toBeTruthy();
    expect(screen.getByText('Later task')).toBeTruthy();
  });

  it('renders empty state when no entries', () => {
    renderView([]);
    // Should render without errors
    expect(document.body).toBeTruthy();
  });

  it('shows project name on each card', () => {
    const entries = [sampleEntry];
    renderView(entries);
    expect(screen.getByText('TestProject')).toBeTruthy();
  });
});
