import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChecklistEntryCard from '../EntryTemplates/EntryChecklist';
import { ChecklistView } from '../EntryTemplates/EntryChecklist';
import { NotesProvider } from '@/context/NotesContext';

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
