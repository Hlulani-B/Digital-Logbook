import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSettingsPanel } from '../ProjectSettingsPanel';

// Mock the API functions
vi.mock('@/functions/project/project.js', () => ({
  editProjectName: vi.fn().mockResolvedValue({ success: true }),
  deleteProject: vi.fn().mockResolvedValue({ success: true }),
  setProjectColor: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/functions/project/fields.js', () => ({
  getFields: vi.fn().mockResolvedValue({ success: true, data: [] }),
  addField: vi.fn().mockResolvedValue({ success: true }),
  editField: vi.fn().mockResolvedValue({ success: true }),
  deleteField: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/functions/project/archives.js', () => ({
  archiveProject: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/functions/project/entries.js', () => ({
  getEntries: vi.fn().mockResolvedValue({
    success: true,
    data: [
      { id: '1', summary: 'Entry 1', due_date: '2026-10-01' },
      { id: '2', summary: 'Entry 2', due_date: '2026-10-02' },
      { id: '3', summary: 'Entry 3', due_date: '2026-10-03' },
    ],
  }),
  deleteEntryById: vi.fn().mockResolvedValue({ success: true }),
}));

const defaultProps = {
  open: true,
  projectName: 'Test Project',
  userEmail: 'test@example.com',
  currentColor: null,
  onClose: vi.fn(),
  onProjectUpdated: vi.fn(),
  onProjectDeleted: vi.fn(),
  onProjectArchived: vi.fn(),
};

describe('ProjectSettingsPanel - Entries Bulk Select', () => {
  it('renders entries section with count', async () => {
    render(<ProjectSettingsPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Entries \(3\)/)).toBeInTheDocument();
    });
  });

  it('shows "No entries" message when entries array is empty', async () => {
    const { getEntries } = await import('@/functions/project/entries.js');
    (getEntries as any).mockResolvedValueOnce({ success: true, data: [] });
    render(<ProjectSettingsPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No entries in this project.')).toBeInTheDocument();
    });
  });

  it('renders checkboxes for each entry', async () => {
    render(<ProjectSettingsPanel {...defaultProps} />);
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      // Should have select all + 3 entry checkboxes
      expect(checkboxes.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('shows "Select all" checkbox', async () => {
    render(<ProjectSettingsPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Select all')).toBeInTheDocument();
    });
  });

  it('selects all entries when "Select all" is clicked', async () => {
    render(<ProjectSettingsPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Entries \(3\)/)).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByLabelText(/Select all/i);
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText('3 selected')).toBeInTheDocument();
    });
  });

  it('shows bulk delete button when entries are selected', async () => {
    render(<ProjectSettingsPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Entries \(3\)/)).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByLabelText(/Select all/i);
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText(/Delete selected/)).toBeInTheDocument();
    });
  });

  it('clears selection when "Clear" button is clicked', async () => {
    render(<ProjectSettingsPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Entries \(3\)/)).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByLabelText(/Select all/i);
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText('3 selected')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText('3 selected')).not.toBeInTheDocument();
    });
  });

  it('calls deleteEntryById for each selected entry when bulk delete is clicked', async () => {
    const { deleteEntryById } = await import('@/functions/project/entries.js');

    render(<ProjectSettingsPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Entries \(3\)/)).toBeInTheDocument();
    });

    // Select all entries
    const selectAllCheckbox = screen.getByLabelText(/Select all/i);
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText('3 selected')).toBeInTheDocument();
    });

    // Click delete
    const deleteButton = screen.getByText(/Delete selected/);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(deleteEntryById).toHaveBeenCalledWith('test@example.com', '1');
      expect(deleteEntryById).toHaveBeenCalledWith('test@example.com', '2');
      expect(deleteEntryById).toHaveBeenCalledWith('test@example.com', '3');
    });
  });

  it('toggles individual entry selection', async () => {
    render(<ProjectSettingsPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Entries \(3\)/)).toBeInTheDocument();
    });

    // Get all entry checkboxes (exclude the select all checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    const entryCheckboxes = checkboxes.filter((cb) =>
      cb.getAttribute('aria-label')?.includes('Select entry')
    );

    // Click first entry checkbox
    fireEvent.click(entryCheckboxes[0]);

    await waitFor(() => {
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
  });
});
