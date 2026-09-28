import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarDayModal } from '../CalendarDayModal';
import type { CalendarEntry } from '@/lib/calendar';

const modalStyles = readFileSync(resolve(__dirname, '../CalendarDayModal.css'), 'utf8');

const { addEntry, getFields } = vi.hoisted(() => ({
  addEntry: vi.fn(),
  getFields: vi.fn(),
}));

vi.mock('@/functions/project/entries.js', () => ({ addEntry }));
vi.mock('@/functions/project/fields.js', () => ({ getFields }));

const fields = [
  { field_name: 'item_title', data_type: 'text', is_required: true },
  { field_name: 'amount', data_type: 'number', is_required: false },
  { field_name: 'quantity', data_type: 'integer', is_required: false },
  { field_name: 'score', data_type: 'float', is_required: false },
  { field_name: 'start_date', data_type: 'date', is_required: false },
  { field_name: 'confirmed', data_type: 'boolean', is_required: true },
  { field_name: 'optional_flag', data_type: 'boolean', is_required: false },
  ...Array.from({ length: 30 }, (_, index) => ({
    field_name: `detail_${index + 1}`,
    data_type: 'text',
    is_required: false,
  })),
];

const existingEntry: CalendarEntry = {
  id: 'existing-1',
  user_email: 'test@example.com',
  project_name: 'Project Alpha',
  entries: { title: 'Existing item' },
  summary: 'Existing item',
  due_date: null,
  priority: null,
  status: 'up_next',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderModal(entries: CalendarEntry[] = []) {
  const callbacks = {
    onClose: vi.fn(),
    onEntryAdded: vi.fn(),
    onEntryClick: vi.fn(),
  };
  const view = render(
    <>
      <style>{modalStyles}</style>
      <CalendarDayModal
        date={new Date(2030, 8, 22)}
        entries={entries}
        projects={[{ project_name: 'Project Alpha' }]}
        userEmail="test@example.com"
        {...callbacks}
      />
    </>
  );
  return { ...view, ...callbacks };
}

function openForm() {
  fireEvent.click(screen.getByRole('button', { name: '+ Add Task' }));
  return screen.getByRole('form', { name: 'New Item' });
}

async function loadProject() {
  fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'Project Alpha' } });
  await screen.findByLabelText('detail 30');
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/item title/), { target: { value: 'New task' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /confirmed/ }));
}

describe('CalendarDayModal adding layout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getFields.mockResolvedValue({ success: true, data: fields });
    addEntry.mockResolvedValue({ success: true });
  });

  it('keeps the footer outside the scrolling body at the initial top with many fields and entries', async () => {
    renderModal(Array.from({ length: 20 }, (_, index) => ({ ...existingEntry, id: index })));
    const form = openForm();
    await loadProject();

    const body = form.querySelector('.cdm-body') as HTMLElement;
    const footer = form.querySelector('.cdm-form-actions') as HTMLElement;
    const addButton = screen.getByRole('button', { name: 'Add Item' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });

    expect(body.scrollTop).toBe(0);
    expect(body.parentElement).toBe(form);
    expect(footer.parentElement).toBe(form);
    expect(body.nextElementSibling).toBe(footer);
    expect(body).not.toContainElement(footer);
    expect(footer).toContainElement(addButton);
    expect(footer).toContainElement(cancelButton);
    expect((addButton as HTMLButtonElement).form).toBe(form);
    expect((cancelButton as HTMLButtonElement).form).toBe(form);
    expect(addButton).toHaveAttribute('type', 'submit');
    expect(cancelButton).toHaveAttribute('type', 'button');
    expect(within(body).getAllByRole('button', { name: /Existing item/ })).toHaveLength(20);
    expect(Array.from(body.querySelectorAll('input, select'), (control) => control.id)).toEqual([
      'cdm-project',
      ...fields.map((field) => `cdm-field-${field.field_name}`),
      'cdm-due-date',
      'cdm-priority',
      'cdm-status',
    ]);

    // jsdom cannot measure viewport geometry; verify the flex/overflow contract instead.
    expect(form).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0%',
      minHeight: '0',
    });
    expect(body).toHaveStyle({ overflowY: 'auto', minHeight: '0' });
    expect(footer).toHaveStyle({ position: 'sticky', bottom: '0', flexShrink: '0' });
    expect(form.closest('.cdm-modal')).toHaveClass('cdm-modal--adding');
    expect(form.closest('.cdm-modal')).toHaveStyle({ minHeight: '0' });
    // jsdom does not resolve custom properties or safe-area environment values.
    const footerRule = Array.from(document.styleSheets[0].cssRules).find(
      (rule) => (rule as CSSStyleRule).selectorText === '.cdm-form-actions'
    ) as CSSStyleRule;
    expect(footerRule.style.getPropertyValue('background')).toBe('var(--surface-solid, #141414)');
    expect(footerRule.style.getPropertyValue('padding-bottom')).toContain(
      'env(safe-area-inset-bottom, 0px)'
    );

    fireEvent.change(screen.getByLabelText('detail 30'), { target: { value: 'Last field value' } });
    fireEvent.scroll(body, { target: { scrollTop: 1000 } });
    fireEvent.scroll(body, { target: { scrollTop: 0 } });
    expect(screen.getByLabelText('detail 30')).toHaveValue('Last field value');
    expect(body.nextElementSibling).toBe(footer);
  });

  it('preserves input types and provides large controls without enlarging the checkbox', async () => {
    const user = userEvent.setup();
    renderModal();
    openForm();
    await loadProject();

    for (const field of fields) {
      const input = document.getElementById(`cdm-field-${field.field_name}`)!;
      const expectedType = ['number', 'integer', 'float'].includes(field.data_type)
        ? 'number'
        : field.data_type === 'boolean'
          ? 'checkbox'
          : field.data_type === 'date'
            ? 'date'
            : 'text';
      expect(input).toHaveAttribute('type', expectedType);
      if (expectedType !== 'checkbox') {
        expect(input).toHaveStyle({ minHeight: '44px', fontSize: '1rem', flexShrink: '0' });
      }
    }
    expect(screen.getByLabelText('Due Date')).toHaveAttribute('type', 'datetime-local');
    expect(screen.getByLabelText('Due Date')).toHaveValue('2030-09-22T09:00');
    for (const control of [
      ...screen.getAllByRole('combobox'),
      screen.getByRole('button', { name: 'Add Item' }),
      screen.getByRole('button', { name: 'Cancel' }),
    ]) {
      expect(control).toHaveStyle({ minHeight: '44px', fontSize: '1rem', flexShrink: '0' });
    }
    const checkbox = screen.getByRole('checkbox', { name: 'optional flag' }) as HTMLInputElement;
    const label = checkbox.labels![0];
    expect(checkbox).toHaveStyle({ width: '1.15rem', height: '1.15rem', flexShrink: '0' });
    expect(label).toHaveStyle({ minHeight: '44px' });
    await user.click(label);
    expect(checkbox).toBeChecked();
  });

  it('keeps the footer available before project selection and while fields load', async () => {
    const pending = deferred<{ success: boolean; data: typeof fields }>();
    getFields.mockReturnValueOnce(pending.promise);
    renderModal();
    const form = openForm();
    const footer = form.querySelector('.cdm-form-actions');
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'Project Alpha' } });
    const loading = screen.getByText('Loading fields...');
    expect(form.querySelector('.cdm-body')).toContainElement(loading);
    expect(footer).not.toContainElement(loading);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(getFields).toHaveBeenCalledWith('test@example.com', 'Project Alpha');

    await act(async () => pending.resolve({ success: true, data: fields }));
    expect(screen.queryByText('Loading fields...')).not.toBeInTheDocument();
    expect(form.querySelector('.cdm-form-actions')).toBe(footer);
    expect(screen.getByLabelText('detail 30')).toBeInTheDocument();
  });

  it('submits typed values once, disables controls while saving, and returns to the list', async () => {
    const pending = deferred<{ success: boolean }>();
    addEntry.mockReturnValueOnce(pending.promise);
    const { onEntryAdded, onClose } = renderModal();
    const form = openForm();
    await loadProject();
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('amount'), { target: { value: '42' } });
    fireEvent.change(screen.getByLabelText('quantity'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('score'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('start date (UTC date)'), {
      target: { value: '2030-09-23' },
    });
    fireEvent.change(screen.getByLabelText('detail 30'), { target: { value: 'Final value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));

    expect(addEntry).toHaveBeenCalledExactlyOnceWith(
      'test@example.com',
      'Project Alpha',
      {
        item_title: 'New task',
        amount: 42,
        quantity: 3,
        score: 7,
        start_date: '2030-09-23',
        confirmed: true,
        detail_30: 'Final value',
      },
      new Date(2030, 8, 22, 9).toISOString(),
      null,
      'up_next',
      null,
      null,
      null
    );
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    form.querySelectorAll('input, select').forEach((control) => expect(control).toBeDisabled());
    fireEvent.submit(form);
    expect(addEntry).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ success: true }));
    expect(screen.getByText('Entry added!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add Task' })).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(onEntryAdded).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('preserves required text and Boolean validation', async () => {
    renderModal();
    openForm();
    await loadProject();
    const title = screen.getByLabelText(/item title/);
    expect(title).toBeRequired();
    expect(title).toBeInvalid();
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(addEntry).not.toHaveBeenCalled();

    fireEvent.change(title, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(screen.getByText('"item_title" is required')).toBeInTheDocument();
    fireEvent.change(title, { target: { value: 'Valid title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(screen.getByText('"confirmed" is required')).toBeInTheDocument();
    expect(addEntry).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('retains values on save failure and cancels without closing the day or submitting again', async () => {
    addEntry.mockRejectedValueOnce(new Error('Unable to save this item'));
    const { onClose, onEntryAdded, container } = renderModal([existingEntry]);
    const form = openForm();
    await loadProject();
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));

    expect(await screen.findByText('Unable to save this item')).toBeInTheDocument();
    expect(container.querySelector('.cdm-error')).toHaveStyle({
      flexShrink: '0',
      maxHeight: '20%',
      overflowY: 'auto',
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Item' })).toBeEnabled());
    expect(screen.getByLabelText(/item title/)).toHaveValue('New task');
    expect(form.querySelector('.cdm-body')).not.toContainElement(
      screen.getByRole('button', { name: 'Cancel' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByText('Unable to save this item')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Existing item/ })).toBeInTheDocument();
    expect(container.querySelector('.cdm-modal')).not.toHaveClass('cdm-modal--adding');
    expect(onClose).not.toHaveBeenCalled();
    expect(onEntryAdded).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledOnce();

    openForm();
    expect(screen.getByLabelText(/item title/)).toHaveValue('New task');
    expect(screen.getByLabelText('Project')).toHaveValue('Project Alpha');
  });

  it('allows canceling a field-loading error', async () => {
    getFields.mockRejectedValueOnce(new Error('Unavailable'));
    const { onClose, onEntryAdded } = renderModal();
    openForm();
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'Project Alpha' } });
    expect(await screen.findByText('Failed to load project fields')).toBeInTheDocument();
    expect(screen.queryByText('Loading fields...')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Failed to load project fields')).not.toBeInTheDocument();
    expect(screen.getByText('No items for this day.')).toBeInTheDocument();
    expect(addEntry).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onEntryAdded).not.toHaveBeenCalled();
  });

  it('keeps existing entry click, keyboard, and drag interactions in list and adding states', () => {
    const { onEntryClick } = renderModal([existingEntry]);
    for (const adding of [false, true]) {
      if (adding) openForm();
      const entry = screen.getByRole('button', { name: /Existing item/ });
      fireEvent.click(entry);
      fireEvent.keyDown(entry, { key: 'Enter' });
      const dataTransfer = { effectAllowed: '', setData: vi.fn() };
      fireEvent.dragStart(entry, { dataTransfer });
      expect(dataTransfer.effectAllowed).toBe('move');
      expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'existing-1');
      expect(entry).toHaveClass('cdm-entry--dragging');
      fireEvent.dragEnd(entry);
      expect(entry).not.toHaveClass('cdm-entry--dragging');
    }
    expect(onEntryClick).toHaveBeenCalledTimes(4);
    expect(onEntryClick).toHaveBeenLastCalledWith(existingEntry);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
