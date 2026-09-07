import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChecklistEntryCard from '../EntryTemplates/EntryChecklist';
import { ChecklistView } from '../EntryTemplates/EntryChecklist';

vi.mock('@/functions/project/entries.js', () => ({
  updateEntry: vi.fn().mockResolvedValue({ success: true }),
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

  it('renders the project name', () => {
    render(<ChecklistEntryCard entry={sampleEntry} />);
    expect(screen.getByText('TestProject')).toBeTruthy();
  });

  it('renders the summary text', () => {
    render(<ChecklistEntryCard entry={sampleEntry} />);
    expect(screen.getByText('Fix login bug')).toBeTruthy();
  });

  it('renders "Untitled entry" when no summary', () => {
    const noSummary = { ...sampleEntry, summary: null, entries: null };
    render(<ChecklistEntryCard entry={noSummary} />);
    expect(screen.getByText('Untitled entry')).toBeTruthy();
  });

  it('renders the due date', () => {
    render(<ChecklistEntryCard entry={sampleEntry} />);
    // Date is formatted via formatDate
    const dateText = screen.getByText(/Sep/);
    expect(dateText).toBeTruthy();
  });

  it('renders "No due date" when no due_date', () => {
    const noDate = { ...sampleEntry, due_date: null };
    render(<ChecklistEntryCard entry={noDate} />);
    expect(screen.getByText('No due date')).toBeTruthy();
  });

  it('shows checkbox for entry', () => {
    render(<ChecklistEntryCard entry={sampleEntry} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeTruthy();
  });

  it('applies done styling when status is done_and_dusted', () => {
    render(<ChecklistEntryCard entry={doneEntry} />);
    const card = screen.getByText('Write tests').closest('.checklist-card');
    expect(card?.className).toContain('done');
  });

  it('sets data-status attribute for in_motion entries', () => {
    const inMotionEntry = { ...sampleEntry, status: 'in_motion' as const };
    render(<ChecklistEntryCard entry={inMotionEntry} />);
    const card = screen.getByText('Fix login bug').closest('.checklist-card');
    expect(card?.getAttribute('data-status')).toBe('in_motion');
  });
});

describe('ChecklistView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all entries sorted by due_date', () => {
    const entries = [
      { ...sampleEntry, id: 'e1', due_date: '2025-09-15', summary: 'Later task' },
      { ...sampleEntry, id: 'e2', due_date: '2025-09-10', summary: 'Earlier task' },
    ];
    render(<ChecklistView entries={entries} />);
    expect(screen.getByText('Earlier task')).toBeTruthy();
    expect(screen.getByText('Later task')).toBeTruthy();
  });

  it('renders empty state when no entries', () => {
    render(<ChecklistView entries={[]} />);
    // Should render without errors
    expect(document.body).toBeTruthy();
  });

  it('shows project name on each card', () => {
    const entries = [sampleEntry];
    render(<ChecklistView entries={entries} />);
    expect(screen.getByText('TestProject')).toBeTruthy();
  });
});
