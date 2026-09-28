import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesPage } from '../NotesPage';

const mocks = vi.hoisted(() => ({
  getNotes: vi.fn(),
  addNote: vi.fn(),
  viewNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  getAllEntries: vi.fn(),
  getProjectsByEmail: vi.fn(),
  trackViewedEntry: vi.fn(),
  cacheSubscribe: vi.fn(),
}));

vi.mock('@/functions/project/notes.js', () => ({
  getNotes: mocks.getNotes,
  addNote: mocks.addNote,
  viewNote: mocks.viewNote,
  updateNote: mocks.updateNote,
  deleteNote: mocks.deleteNote,
}));
vi.mock('@/functions/project/entries.js', () => ({ getAllEntries: mocks.getAllEntries }));
vi.mock('@/functions/project/project.js', () => ({
  getProjectsByEmail: mocks.getProjectsByEmail,
}));
vi.mock('@/lib/recentlyViewed', () => ({ trackViewedEntry: mocks.trackViewedEntry }));
vi.mock('@/lib/cache', () => ({
  cacheSubscribe: mocks.cacheSubscribe,
  CACHE_STORES: { NOTES: 'notes' },
}));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => true }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'walejiz@example.com' } }),
}));

const entryData = {
  id: 'entry-1',
  summary: 'Current entry',
  project_name: 'Alpha',
  entries: { task: 'work' },
  status: 'up_next',
  priority: null,
  due_date: null,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <NotesPage entryData={entryData} onClose={vi.fn()} />
    </MemoryRouter>
  );
}

function openReferenceChooser() {
  fireEvent.click(screen.getByRole('button', { name: '+ Add Note' }));
  fireEvent.click(screen.getByRole('button', { name: /Reference/ }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getNotes.mockResolvedValue({ success: true, data: [] });
  mocks.addNote.mockResolvedValue({ success: true });
  mocks.cacheSubscribe.mockReturnValue(() => {});
});

afterEach(cleanup);

describe('NotesPage reference flow', () => {
  it('asks for project vs entry before listing anything', async () => {
    renderPage();
    openReferenceChooser();
    expect(await screen.findByText('Add a Reference')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Project reference/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entry reference/ })).toBeInTheDocument();
    expect(mocks.getAllEntries).not.toHaveBeenCalled();
    expect(mocks.getProjectsByEmail).not.toHaveBeenCalled();
  });

  it('lists entries excluding the current one and saves a link note with the entry JSON', async () => {
    mocks.getAllEntries.mockResolvedValue({
      success: true,
      data: [
        { id: 'entry-1', project_name: 'Alpha', summary: 'Current entry' },
        { id: 'entry-2', project_name: 'Beta', summary: 'Second entry' },
      ],
    });
    renderPage();
    openReferenceChooser();
    fireEvent.click(await screen.findByRole('button', { name: /Entry reference/ }));
    expect(await screen.findByRole('button', { name: /Second entry/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Current entry/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Second entry/ }));
    await waitFor(() => expect(mocks.addNote).toHaveBeenCalledTimes(1));
    const [email, entryId, type, value] = mocks.addNote.mock.calls[0];
    expect(email).toBe('walejiz@example.com');
    expect(entryId).toBe('entry-1');
    expect(type).toBe('link');
    expect(JSON.parse(value)).toEqual({
      id: 'entry-2',
      project_name: 'Beta',
      display: 'Second entry',
    });
  });

  it('lists projects and saves a project-kind reference', async () => {
    mocks.getProjectsByEmail.mockResolvedValue({
      success: true,
      projects: [{ project_name: 'Alpha' }, { project_name: 'Beta' }],
    });
    renderPage();
    openReferenceChooser();
    fireEvent.click(await screen.findByRole('button', { name: /Project reference/ }));
    expect(await screen.findByRole('button', { name: 'Beta' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    await waitFor(() => expect(mocks.addNote).toHaveBeenCalledTimes(1));
    const [email, entryId, type, value] = mocks.addNote.mock.calls[0];
    expect(email).toBe('walejiz@example.com');
    expect(entryId).toBe('entry-1');
    expect(type).toBe('link');
    expect(JSON.parse(value)).toEqual({
      project_name: 'Beta',
      display: 'Beta',
      kind: 'project',
    });
  });

  it('renders saved references with a folder icon for projects and a link icon for entries', async () => {
    mocks.getNotes.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'note-1',
          email: 'walejiz@example.com',
          entry_id: 'entry-1',
          entry_type: 'link',
          value: JSON.stringify({ project_name: 'Beta', display: 'Beta', kind: 'project' }),
          created_at: '2026-09-20T10:00:00.000Z',
        },
        {
          id: 'note-2',
          email: 'walejiz@example.com',
          entry_id: 'entry-1',
          entry_type: 'link',
          value: JSON.stringify({ id: 'entry-2', project_name: 'Beta', display: 'Second entry' }),
          created_at: '2026-09-21T10:00:00.000Z',
        },
      ],
    });
    renderPage();
    const folderIcon = String.fromCodePoint(0x1f4c1);
    const linkIcon = String.fromCodePoint(0x1f517);
    expect(await screen.findByText(new RegExp(`${folderIcon} Beta`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${linkIcon} Second entry`))).toBeInTheDocument();
  });
});
