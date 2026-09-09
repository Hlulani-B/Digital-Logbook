import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DataPortability from '../DataPortability';
import { addEntry, getAllEntries } from '@/functions/project/entries';
import { addProject, getProjectsByEmail } from '@/functions/project/project';
import {
  archiveEntry,
  archiveProject,
  getArchivedProjects,
  getArchives,
} from '@/functions/project/archives';
import { addField, getFields } from '@/functions/project/fields';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' }, loading: false }),
}));

vi.mock('@/functions/project/entries', () => ({
  addEntry: vi.fn(),
  getAllEntries: vi.fn(),
}));

vi.mock('@/functions/project/project', () => ({
  addProject: vi.fn(),
  getProjectsByEmail: vi.fn(),
}));

vi.mock('@/functions/project/archives', () => ({
  archiveEntry: vi.fn(),
  archiveProject: vi.fn(),
  getArchives: vi.fn(),
  getArchivedProjects: vi.fn(),
}));

vi.mock('@/functions/project/fields', () => ({
  addField: vi.fn(),
  getFields: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue({ data: [] }),
  CACHE_STORES: { ALL_ENTRIES: 'all-entries', PROJECTS: 'projects' },
}));

vi.mock('@/components/NavBar', () => ({
  NavBar: () => <div />,
}));

vi.mock('@/components/Header', () => ({
  Header: () => <div />,
}));

const backup = {
  version: 2,
  projects: [
    { project_name: 'Archived project', description: 'Saved description', archived: true },
  ],
  fields: [
    { table_name: 'Archived project', field_name: 'risk', data_type: 'text', is_required: true },
  ],
  entries: [
    {
      project_name: 'Archived project',
      entries: 'opaque legacy payload',
      due_date: null,
      priority: null,
      status: 'up_next',
      started_at: null,
      ended_at: null,
      duration: '01:00:00',
      summary: 'Saved summary',
      archived: true,
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DataPortability />
    </MemoryRouter>
  );
}

async function uploadBackup(user: ReturnType<typeof userEvent.setup>, content = backup) {
  const file = new File([JSON.stringify(content)], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(JSON.stringify(content)) });
  await user.upload(screen.getByLabelText(/choose a file/i), file);
}

describe('DataPortability import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProjectsByEmail).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getAllEntries).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getArchivedProjects).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getArchives).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getFields).mockResolvedValue({ success: true, data: [] });
    vi.mocked(addProject).mockResolvedValue({ success: true });
    vi.mocked(addField).mockResolvedValue({ success: true });
    vi.mocked(addEntry).mockResolvedValue({ success: true, data: { id: 'created-entry-id' } });
    vi.mocked(archiveEntry).mockResolvedValue({ success: true });
    vi.mocked(archiveProject).mockResolvedValue({ success: true });
  });

  it('restores dependencies in order and archives the created entry ID', async () => {
    const user = userEvent.setup();
    renderPage();

    await uploadBackup(user);

    await waitFor(() => expect(screen.getByText('Import complete')).toBeInTheDocument());

    expect(addProject).toHaveBeenCalledWith(
      'test@example.com',
      'Archived project',
      'Saved description'
    );
    expect(addField).toHaveBeenCalledWith(
      'test@example.com',
      'Archived project',
      'risk',
      'text',
      true
    );
    expect(addEntry).toHaveBeenCalledWith(
      'test@example.com',
      'Archived project',
      'opaque legacy payload',
      null,
      null,
      'up_next',
      null,
      null,
      undefined,
      'Saved summary'
    );
    expect(archiveEntry).toHaveBeenCalledWith(
      'test@example.com',
      'Archived project',
      'created-entry-id'
    );
    expect(archiveProject).toHaveBeenCalledWith('test@example.com', 'Archived project');
    expect(addProject.mock.invocationCallOrder[0]).toBeLessThan(
      addField.mock.invocationCallOrder[0]
    );
    expect(addField.mock.invocationCallOrder[0]).toBeLessThan(addEntry.mock.invocationCallOrder[0]);
    expect(addEntry.mock.invocationCallOrder[0]).toBeLessThan(
      archiveEntry.mock.invocationCallOrder[0]
    );
    expect(archiveEntry.mock.invocationCallOrder[0]).toBeLessThan(
      archiveProject.mock.invocationCallOrder[0]
    );
    expect(getProjectsByEmail).toHaveBeenCalledWith('test@example.com');
    expect(getAllEntries).toHaveBeenCalledWith('test@example.com');
    expect(screen.getByText(/1 projects/)).toBeInTheDocument();
    expect(screen.getByText(/1 fields/)).toBeInTheDocument();
    expect(screen.getByText(/1 entries/)).toBeInTheDocument();
  });

  it('skips dependent records and reports failed project creation', async () => {
    vi.mocked(addProject).mockResolvedValue({ success: false, message: 'duplicate project' });
    const user = userEvent.setup();
    renderPage();

    await uploadBackup(user);

    await waitFor(() => expect(screen.getByText('Restore failures')).toBeInTheDocument());

    expect(addField).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(archiveEntry).not.toHaveBeenCalled();
    expect(archiveProject).not.toHaveBeenCalled();
    expect(screen.getByText(/3 failed/)).toBeInTheDocument();
  });
});
