import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChecklistEntryCard from '../EntryTemplates/EntryChecklist';

const mocks = vi.hoisted(() => ({
  updateEntry: vi.fn(),
  deleteEntryById: vi.fn(),
  openNotes: vi.fn(),
}));

vi.mock('@/functions/project/entries.js', () => ({
  updateEntry: mocks.updateEntry,
  deleteEntryById: mocks.deleteEntryById,
}));
vi.mock('@/context/NotesContext', () => ({ useNotes: () => ({ openNotes: mocks.openNotes }) }));

const sampleEntry = {
  id: 'checklist-layout-1',
  user_email: 'layout@example.com',
  project_name: 'Layout project',
  summary: 'Original summary',
  due_date: '2026-09-25',
  status: 'up_next' as const,
  started_at: null,
  entries: null,
};

function element<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  expect(found).not.toBeNull();
  return found!;
}

function renderCard(status: 'up_next' | 'done_and_dusted' = 'up_next') {
  const entry = { ...sampleEntry, status };
  const onUpdated = vi.fn();
  const onDelete = vi.fn();
  const result = render(
    <ChecklistEntryCard
      entry={entry}
      onUpdated={onUpdated}
      onDelete={onDelete}
      projectColor="#123456"
    />
  );
  return { ...result, entry, onUpdated, onDelete };
}

function openEdit() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updateEntry.mockResolvedValue({ success: true });
  mocks.deleteEntryById.mockResolvedValue({ success: true });
});

afterEach(cleanup);

describe('Checklist edit dialog layout', () => {
  it('wraps the title and ordered controls in the body with sibling actions, not the ordinary card', () => {
    const { container } = renderCard();
    const card = element(container, '.checklist-card');
    openEdit();
    const dialog = element(container, '.checklist-dialog--editing');
    const body = element(dialog, '.entry-form__body');
    const footer = element(dialog, '.entry-form__footer');
    const summary = screen.getByRole('textbox');
    const due = element(body, 'input[type="date"]');

    expect(dialog).toHaveClass('checklist-dialog', 'entry-form');
    expect(dialog.parentElement).toHaveClass('checklist-dialog-overlay');
    expect(Array.from(dialog.children)).toEqual([body, footer]);
    expect(body.firstElementChild).toBe(screen.getByRole('heading', { name: 'Edit Entry' }));
    expect(Array.from(body.querySelectorAll('textarea, input'))).toEqual([summary, due]);
    expect(Array.from(body.querySelectorAll('label')).map((label) => label.textContent)).toEqual([
      'Summary',
      'Due Date',
    ]);
    expect(summary).toHaveValue(sampleEntry.summary);
    expect(due).toHaveValue(sampleEntry.due_date);
    expect(footer).toHaveClass('checklist-dialog-actions');
    expect(
      within(footer)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Cancel', 'Save']);
    expect(within(body).queryByRole('button')).not.toBeInTheDocument();
    expect(card).not.toHaveClass('entry-form', 'checklist-dialog--editing');
    expect(card.querySelector('.entry-form__body, .entry-form__footer')).toBeNull();
    fireEvent.mouseDown(summary);
    fireEvent.click(summary);
    expect(dialog).toBeInTheDocument();
  });

  it('saves summary and date with the existing callback and pending-save behavior', async () => {
    let finishSave!: (value: { success: boolean }) => void;
    mocks.updateEntry.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      })
    );
    const { container, onUpdated } = renderCard();
    openEdit();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Edited summary' } });
    fireEvent.change(element(container, 'input[type="date"]'), { target: { value: '2026-09-27' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));

    const footer = element(container, '.entry-form__footer');
    expect(within(footer).getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(within(footer).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(mocks.updateEntry).toHaveBeenCalledExactlyOnceWith(
      sampleEntry.user_email,
      sampleEntry.project_name,
      sampleEntry.id,
      undefined,
      '2026-09-27T21:59:59.999Z',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'Edited summary'
    );
    await act(async () => finishSave({ success: true }));
    expect(onUpdated).toHaveBeenCalledExactlyOnceWith();
    expect(container.querySelector('.checklist-dialog-overlay')).toBeNull();
    expect(screen.getByText(sampleEntry.summary)).toBeInTheDocument();
  });

  it('cancels without saving and resets the form on reopening', () => {
    const { container, onUpdated } = renderCard();
    openEdit();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved draft' } });
    fireEvent.change(element(container, 'input[type="date"]'), { target: { value: '2026-09-28' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(container.querySelector('.checklist-dialog-overlay')).toBeNull();
    expect(screen.getByText(sampleEntry.summary)).toBeInTheDocument();
    expect(mocks.updateEntry).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(sampleEntry.summary));
    // Draft is not retained - form resets to original values
    expect(screen.getByRole('textbox')).toHaveValue(sampleEntry.summary);
    expect(element(container, 'input[type="date"]')).toHaveValue(
      sampleEntry.due_date ? sampleEntry.due_date.slice(0, 10) : ''
    );
  });

  it('keeps save errors in the body before the fields and allows retry with a cleared due date', async () => {
    mocks.updateEntry.mockRejectedValueOnce(new Error('Save rejected'));
    const { container, onUpdated } = renderCard();
    openEdit();
    fireEvent.change(element(container, 'input[type="date"]'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    const error = await screen.findByText('Save rejected');
    const body = element(container, '.entry-form__body');
    const footer = element(container, '.entry-form__footer');
    expect(error.parentElement).toBe(body);
    expect(error.previousElementSibling).toHaveTextContent('Edit Entry');
    expect(error.nextElementSibling).toHaveClass('checklist-dialog-field');
    expect(body.nextElementSibling).toBe(footer);
    expect(onUpdated).not.toHaveBeenCalled();
    expect(within(footer).getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    fireEvent.click(within(footer).getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledExactlyOnceWith());
    expect(mocks.updateEntry).toHaveBeenLastCalledWith(
      sampleEntry.user_email,
      sampleEntry.project_name,
      sampleEntry.id,
      undefined,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      sampleEntry.summary
    );
    expect(container.querySelector('.entry-form')).toBeNull();
  });

  it.each(['overlay', 'outside'])('preserves %s dismissal without saving', (target) => {
    const { container, onUpdated } = renderCard();
    openEdit();
    if (target === 'overlay') fireEvent.click(element(container, '.checklist-dialog-overlay'));
    else fireEvent.mouseDown(document.body);
    expect(container.querySelector('.checklist-dialog-overlay')).toBeNull();
    expect(mocks.updateEntry).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it.each(['up_next', 'done_and_dusted'] as const)(
    'keeps ordinary %s card styling, notes, and checkbox behavior',
    async (status) => {
      const { container, entry, onUpdated } = renderCard(status);
      const card = element(container, '.checklist-card');
      expect(
        container.querySelector('.entry-form, .entry-form__body, .entry-form__footer')
      ).toBeNull();
      expect(card).toHaveAttribute('data-status', status);
      expect(card.classList.contains('checklist-card--done')).toBe(status === 'done_and_dusted');
      expect(card.style.getPropertyValue('--tint')).toBe('#12345618');
      fireEvent.click(screen.getAllByRole('button', { name: 'View Notes' })[0]);
      expect(mocks.openNotes).toHaveBeenCalledExactlyOnceWith(entry);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', String(status === 'done_and_dusted'));
      fireEvent.click(checkbox);
      await waitFor(() => expect(onUpdated).toHaveBeenCalledExactlyOnceWith());
      expect(mocks.updateEntry).toHaveBeenCalledExactlyOnceWith(
        entry.user_email,
        entry.project_name,
        entry.id,
        undefined,
        undefined,
        undefined,
        status === 'done_and_dusted' ? 'up_next' : 'done_and_dusted'
      );
      expect(container.querySelector('.checklist-dialog-overlay')).toBeNull();
    }
  );

  it('leaves the delete dialog structure, cancel, and confirmation callback unchanged', async () => {
    const { container, onDelete, onUpdated } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    const dialog = element(container, '.checklist-dialog');
    expect(dialog.className).toBe('checklist-dialog');
    expect(Array.from(dialog.children).map((child) => child.className)).toEqual([
      'checklist-dialog-title',
      'checklist-dialog-message',
      'checklist-dialog-actions',
    ]);
    expect(
      container.querySelector(
        '.entry-form, .entry-form__body, .entry-form__footer, .checklist-dialog--editing'
      )
    ).toBeNull();
    expect(
      within(dialog).getByText('Are you sure you want to delete this entry? This cannot be undone.')
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(container.querySelector('.checklist-dialog-overlay')).toBeNull();
    expect(mocks.deleteEntryById).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    fireEvent.click(
      within(element(container, '.checklist-dialog')).getByRole('button', {
        name: 'Delete',
        exact: true,
      })
    );
    await waitFor(() => expect(onDelete).toHaveBeenCalledExactlyOnceWith(sampleEntry.id));
    expect(mocks.deleteEntryById).toHaveBeenCalledExactlyOnceWith(
      sampleEntry.user_email,
      sampleEntry.id
    );
    expect(container.querySelector('.checklist-dialog-overlay')).toBeNull();
    expect(mocks.updateEntry).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
