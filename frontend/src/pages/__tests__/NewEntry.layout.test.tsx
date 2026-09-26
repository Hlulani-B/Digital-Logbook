import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryBox } from '../NewEntry';

const mocks = vi.hoisted(() => ({
  updateEntry: vi.fn(),
  deleteEntryById: vi.fn(),
  getFields: vi.fn(),
  archiveEntry: vi.fn(),
  unarchiveEntry: vi.fn(),
  openNotes: vi.fn(),
}));

vi.mock('@/functions/project/entries.js', () => ({
  updateEntry: mocks.updateEntry,
  deleteEntryById: mocks.deleteEntryById,
  getEntries: vi.fn(),
  getAllEntries: vi.fn(),
}));
vi.mock('@/functions/project/fields.js', () => ({ getFields: mocks.getFields }));
vi.mock('@/functions/project/archives.js', () => ({
  archiveEntry: mocks.archiveEntry,
  unarchiveEntry: mocks.unarchiveEntry,
}));
vi.mock('@/functions/project/project.js', () => ({ getProjectsByEmail: vi.fn() }));
vi.mock('@/context/NotesContext', () => ({ useNotes: () => ({ openNotes: mocks.openNotes }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/attachmentApi', () => ({ uploadAndFinalize: vi.fn() }));

const sampleEntry: ComponentProps<typeof EntryBox>['entry'] = {
  id: 'entry-layout-1',
  user_email: 'layout@example.com',
  project_name: 'Layout project',
  project_id: 42,
  entries: { Title: 'Original title', Notes: 'Original notes', Locked: 'Read only' },
  created_at: '2026-09-01T12:00:00.000Z',
  due_date: null,
  started_at: null,
  ended_at: null,
  priority: null,
  status: 'up_next',
  summary: 'Original summary',
};

function element<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  expect(found).not.toBeNull();
  return found!;
}

function renderBox(entry = sampleEntry) {
  const onUpdated = vi.fn();
  const onDelete = vi.fn();
  const onPriorityChanged = vi.fn();
  const onArchiveToggled = vi.fn();
  const result = render(
    <MemoryRouter>
      <EntryBox
        entry={entry}
        onUpdated={onUpdated}
        onDelete={onDelete}
        onPriorityChanged={onPriorityChanged}
        onArchiveToggled={onArchiveToggled}
        projectColor="#123456"
      />
    </MemoryRouter>
  );
  return { ...result, onUpdated, onDelete, onPriorityChanged, onArchiveToggled };
}

function openEdit() {
  fireEvent.click(screen.getByRole('button', { name: 'Entry options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updateEntry.mockResolvedValue({ success: true });
  mocks.deleteEntryById.mockResolvedValue({ success: true });
  mocks.archiveEntry.mockResolvedValue({ success: true });
  mocks.getFields.mockResolvedValue({
    success: true,
    data: [
      { field_name: 'Title', data_type: 'text' },
      { field_name: 'Notes', data_type: 'markdown' },
      { field_name: 'Locked', data_type: 'text', field_permissions: { owner: 'view' } },
      {
        field_name: 'Conditional',
        data_type: 'text',
        visibility: { rules: [{ field: 'Title', operator: 'eq', value: 'Show details' }] },
      },
      { field_name: 'Hidden', data_type: 'text', field_permissions: { owner: 'hidden' } },
    ],
  });
});

afterEach(cleanup);

describe('EntryBox inline edit layout', () => {
  it('keeps the entire editor inline with controls in order inside the body and actions outside', async () => {
    const { container } = renderBox();
    openEdit();
    const title = await screen.findByDisplayValue('Original title');
    const shell = element(container, '.entry-box--editing');
    const body = element(shell, '.entry-form__body');
    const footer = element(shell, '.entry-form__footer');
    const selects = within(body).getAllByRole('combobox');
    const dates = body.querySelectorAll('input[type="datetime-local"]');

    expect(shell).toHaveClass('entry-box', 'entry-form');
    expect(shell.parentElement).toBe(container);
    expect(container.querySelector('.modal-overlay, [role="dialog"]')).toBeNull();
    expect(Array.from(shell.children)).toEqual([body, footer]);
    expect(footer).toHaveClass('entry-box__edit-actions');
    expect(body.firstElementChild).toHaveClass('entry-box__header');
    expect(
      within(body).getByRole('button', { name: sampleEntry.project_name })
    ).toBeInTheDocument();
    expect(selects[0]).toHaveClass('entry-box__priority-select');
    expect(selects[1]).toHaveClass('entry-box__status-select');
    expect(Array.from(body.querySelectorAll('select, input, textarea'))).toEqual([
      ...selects,
      title,
      screen.getByDisplayValue('Original notes'),
      screen.getByDisplayValue('Read only'),
      ...dates,
    ]);
    expect(dates).toHaveLength(2);
    expect(dates[0].previousElementSibling).toHaveTextContent('Due Date');
    expect(dates[1].previousElementSibling).toHaveTextContent('Started At');
    expect(screen.getByDisplayValue('Read only')).toBeDisabled();
    expect(within(body).queryByText('Conditional')).not.toBeInTheDocument();
    expect(within(body).queryByText('Hidden')).not.toBeInTheDocument();
    expect(
      within(body).queryByRole('button', { name: /Cancel|Save Changes/ })
    ).not.toBeInTheDocument();
    expect(
      within(footer)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Cancel', 'Save Changes']);

    fireEvent.change(title, { target: { value: 'Show details' } });
    expect(within(body).getByText('Conditional')).toBeInTheDocument();
    expect(within(body).queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('saves all draft values and preserves the pending state and update callback', async () => {
    let finishSave!: (value: { success: boolean }) => void;
    mocks.updateEntry.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      })
    );
    const { container, onUpdated } = renderBox();
    openEdit();
    fireEvent.change(await screen.findByDisplayValue('Original title'), {
      target: { value: 'Edited title' },
    });
    fireEvent.change(screen.getByDisplayValue('Original notes'), {
      target: { value: 'Edited notes' },
    });
    const body = element(container, '.entry-form__body');
    const [priority, status] = within(body).getAllByRole('combobox');
    const [due, started] = body.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(priority, { target: { value: '0' } });
    fireEvent.change(status, { target: { value: 'in_motion' } });
    fireEvent.change(due, { target: { value: '2026-09-25T15:30' } });
    fireEvent.change(started, { target: { value: '2026-09-24T09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    for (const control of body.querySelectorAll('select, input, textarea')) {
      expect(control).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onUpdated).not.toHaveBeenCalled();
    const updatedFields = { Title: 'Edited title', Notes: 'Edited notes', Locked: 'Read only' };
    const dueISO = new Date('2026-09-25T15:30').toISOString();
    const startedISO = new Date('2026-09-24T09:00').toISOString();
    expect(mocks.updateEntry).toHaveBeenCalledExactlyOnceWith(
      sampleEntry.user_email,
      sampleEntry.project_name,
      sampleEntry.id,
      updatedFields,
      dueISO,
      'Urgent and important',
      'in_motion',
      startedISO,
      null
    );
    await act(async () => finishSave({ success: true }));
    expect(onUpdated).toHaveBeenCalledExactlyOnceWith({
      ...sampleEntry,
      entries: updatedFields,
      due_date: dueISO,
      started_at: startedISO,
      priority: 'Urgent and important',
      status: 'in_motion',
    });
    expect(container.querySelector('.entry-form')).toBeNull();
    expect(screen.getByRole('button', { name: 'Entry options' })).toBeInTheDocument();
  });

  it('cancels without saving and resets drafts when editing again', async () => {
    const { container, onUpdated } = renderBox();
    openEdit();
    fireEvent.change(await screen.findByDisplayValue('Original title'), {
      target: { value: 'Discard title' },
    });
    fireEvent.change(screen.getByDisplayValue('Original notes'), {
      target: { value: 'Discard notes' },
    });
    const body = element(container, '.entry-form__body');
    const [priority, status] = within(body).getAllByRole('combobox');
    fireEvent.change(priority, { target: { value: '1' } });
    fireEvent.change(status, { target: { value: 'done_and_dusted' } });
    for (const date of body.querySelectorAll('input[type="datetime-local"]')) {
      fireEvent.change(date, { target: { value: '2026-09-25T12:00' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(container.querySelector('.entry-form')).toBeNull();
    expect(screen.getByText('Original summary')).toBeInTheDocument();
    expect(mocks.updateEntry).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
    openEdit();
    expect(await screen.findByDisplayValue('Original title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original notes')).toBeInTheDocument();
    const [resetPriority, resetStatus] = screen.getAllByRole('combobox');
    expect(resetPriority).toHaveValue('3');
    expect(resetStatus).toHaveValue('up_next');
    for (const date of container.querySelectorAll('input[type="datetime-local"]')) {
      expect(date).toHaveValue('');
    }
  });

  it.each(['failure', 'error', 'rejection'])(
    'keeps %s feedback in the body without moving actions or closing the editor',
    async (kind) => {
      if (kind === 'rejection') mocks.updateEntry.mockRejectedValueOnce(new Error('Save rejected'));
      else
        mocks.updateEntry.mockResolvedValueOnce(
          kind === 'failure'
            ? { success: false, message: 'Save rejected' }
            : { error: 'Save rejected' }
        );
      const { container, onUpdated } = renderBox();
      openEdit();
      await screen.findByDisplayValue('Original title');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      const error = await screen.findByText('Save rejected');
      const body = element(container, '.entry-form__body');
      const footer = element(container, '.entry-form__footer');
      expect(error.parentElement).toBe(body);
      expect(error.previousElementSibling).toHaveClass('entry-box__header');
      expect(error.nextElementSibling).toHaveClass('entry-box__fields--editing');
      expect(body.nextElementSibling).toBe(footer);
      expect(within(footer).getByRole('button', { name: 'Save Changes' })).toBeEnabled();
      expect(onUpdated).not.toHaveBeenCalled();
      fireEvent.click(within(footer).getByRole('button', { name: 'Cancel' }));
      openEdit();
      expect(screen.queryByText('Save rejected')).not.toBeInTheDocument();
    }
  );

  it('keeps historical opaque content in the body without rewriting it on save', async () => {
    const entry = { ...sampleEntry, entries: ['Historical task'] };
    const { container, onUpdated } = renderBox(entry);
    openEdit();
    const body = element(container, '.entry-form__body');
    expect(within(body).getByText('["Historical task"]')).toBeInTheDocument();
    expect(within(body).queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledExactlyOnceWith(entry));
    expect(mocks.updateEntry).toHaveBeenCalledExactlyOnceWith(
      entry.user_email,
      entry.project_name,
      entry.id,
      undefined,
      null,
      null,
      'up_next',
      null,
      null
    );
  });

  it('leaves ordinary card styling, notes, priority, and archive callbacks unchanged', async () => {
    const { container, onPriorityChanged, onArchiveToggled } = renderBox();
    await waitFor(() => expect(container.querySelector('.field-display')).not.toBeNull());
    const card = element(container, '.entry-box');
    expect(
      container.querySelector('.entry-form, .entry-form__body, .entry-form__footer')
    ).toBeNull();
    expect(card.style.getPropertyValue('--tint')).toBe('#12345618');
    expect(within(card).getByRole('table')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Notes' }));
    expect(mocks.openNotes).toHaveBeenCalledExactlyOnceWith(sampleEntry);
    fireEvent.change(element(card, '.entry-box__priority-select'), { target: { value: '2' } });
    expect(onPriorityChanged).toHaveBeenCalledExactlyOnceWith(
      sampleEntry.id,
      sampleEntry.project_name,
      '2'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Entry options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive', exact: true }));
    await waitFor(() =>
      expect(onArchiveToggled).toHaveBeenCalledExactlyOnceWith(sampleEntry.id, true)
    );
    expect(mocks.archiveEntry).toHaveBeenCalledExactlyOnceWith(
      sampleEntry.user_email,
      sampleEntry.project_name,
      sampleEntry.id
    );
  });

  it('keeps delete confirmation inline in the ordinary menu with cancel and delete callbacks', async () => {
    const { container, onDelete } = renderBox();
    await waitFor(() => expect(container.querySelector('.field-display')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Entry options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    const menu = element(container, '.entry-box__menu');
    expect(within(menu).getByText('Delete this entry?')).toBeInTheDocument();
    expect(
      container.querySelector('.entry-form, .entry-form__body, .entry-form__footer')
    ).toBeNull();
    fireEvent.click(within(menu).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete this entry?')).not.toBeInTheDocument();
    expect(mocks.deleteEntryById).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(within(menu).getByRole('button', { name: 'Delete', exact: true }));
    fireEvent.click(within(menu).getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledExactlyOnceWith(sampleEntry.id));
    expect(mocks.deleteEntryById).toHaveBeenCalledExactlyOnceWith(
      sampleEntry.user_email,
      sampleEntry.id
    );
    expect(screen.queryByText('Delete this entry?')).not.toBeInTheDocument();
  });
});
