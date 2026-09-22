import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AddEntry } from '../AddEntry';
import { addEntry } from '../../functions/project/entries.js';
import { getFields } from '../../functions/project/fields.js';

vi.mock('../../functions/project/entries.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../functions/project/fields.js', () => ({
  getFields: vi.fn(),
}));

const globalStyles = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');
const fieldStyles = readFileSync(resolve(__dirname, '../../components/fields/fields.css'), 'utf8');

const optionalBooleanField = {
  field_name: 'optional_flag',
  data_type: 'boolean',
  is_required: false,
};

describe('AddEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFields).mockResolvedValue({ data: [optionalBooleanField] });
    vi.mocked(addEntry).mockResolvedValue({ success: true });
  });

  function renderForm(props: Partial<ComponentProps<typeof AddEntry>> = {}) {
    return render(
      <AddEntry user_email="test@example.com" project_name="Project Alpha" {...props} />
    );
  }

  it('defaults an untouched optional Boolean field to false', async () => {
    renderForm();

    expect(await screen.findByRole('checkbox', { name: 'False' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(vi.mocked(addEntry).mock.calls[0][2]).toEqual({ optional_flag: false });
  });

  it('persists false after an optional Boolean field is changed', async () => {
    renderForm();

    const checkbox = await screen.findByRole('checkbox', { name: 'True' });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('checkbox', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(vi.mocked(addEntry).mock.calls[0][2]).toEqual({ optional_flag: false });
  });

  it('keeps many fields and notes in the scroll body with sibling submit/cancel actions', async () => {
    const fields = Array.from({ length: 30 }, (_, i) => ({
      field_name: `detail_${i + 1}`,
      data_type: 'text',
    }));
    vi.mocked(getFields).mockResolvedValueOnce({ data: fields });
    renderForm({ onCancel: vi.fn() });
    const inputs = await screen.findAllByRole('textbox');
    expect(inputs).toHaveLength(30);
    const form = screen.getByRole('form', { name: 'New Item' });
    const body = form.querySelector('.entry-form__body') as HTMLElement;
    const footer = form.querySelector('.entry-form__footer') as HTMLElement;
    expect(Array.from(form.children)).toEqual([body, footer]);
    expect(body.scrollTop).toBe(0);
    expect(body).toContainElement(inputs[29]);
    expect(body).toContainElement(screen.getByLabelText('Due Date'));
    expect(body).toContainElement(screen.getByLabelText('Priority'));
    expect(body).toContainElement(screen.getByLabelText('Status'));
    expect(Array.from(body.querySelectorAll('.field-label'), (el) => el.textContent)).toEqual(
      fields.map((field) => field.field_name)
    );
    const submit = within(footer).getByRole('button', { name: 'Add Item' }) as HTMLButtonElement;
    expect(submit.form).toBe(form);
    expect(submit).toHaveAttribute('type', 'submit');
    expect(within(footer).getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'type',
      'button'
    );
    expect(body).not.toContainElement(footer);

    fireEvent.change(inputs[29], { target: { value: 'Final detail' } });
    fireEvent.click(screen.getByRole('button', { name: /Notes/ }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add Note' }));
    const note = screen.getByPlaceholderText('Type a note...');
    fireEvent.change(note, { target: { value: 'A note' } });
    expect(body).toContainElement(note);
    fireEvent.scroll(body, { target: { scrollTop: 1000 } });
    fireEvent.scroll(body, { target: { scrollTop: 0 } });
    expect(inputs[29]).toHaveValue('Final detail');
    fireEvent.submit(form);
    await waitFor(() => expect(addEntry).toHaveBeenCalledOnce());
    expect(vi.mocked(addEntry).mock.calls[0][2]).toEqual({ detail_30: 'Final detail' });
    expect(vi.mocked(addEntry).mock.calls[0][10]).toEqual([
      { entry_type: 'text', value: 'A note' },
    ]);
  });

  it('keeps Cancel available and prevents submission while loading fields', async () => {
    let resolveFields!: (value: { data: (typeof optionalBooleanField)[] }) => void;
    vi.mocked(getFields).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFields = resolve;
      })
    );
    const onCancel = vi.fn();
    renderForm({ onCancel });
    const form = screen.getByRole('form', { name: 'New Item' });
    const footer = form.querySelector('.entry-form__footer');
    expect(form.querySelector('.entry-form__body')).toContainElement(
      screen.getByText('Loading columns...')
    );
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeDisabled();
    fireEvent.submit(form);
    expect(addEntry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    await act(async () => resolveFields({ data: [optionalBooleanField] }));
    expect(form.querySelector('.entry-form__footer')).toBe(footer);
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeEnabled();
  });

  it('cancels a populated form without saving', async () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'True' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('preserves disabled saving controls and the success callback', async () => {
    let resolveSave!: (value: { success: boolean }) => void;
    vi.mocked(addEntry).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
    const onAdded = vi.fn();
    renderForm({ onAdded, onCancel: vi.fn() });
    await screen.findByRole('checkbox', { name: 'False' });
    const form = screen.getByRole('form', { name: 'New Item' });
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    form.querySelectorAll('input, select').forEach((input) => expect(input).toBeDisabled());
    fireEvent.submit(form);
    expect(addEntry).toHaveBeenCalledOnce();
    await act(async () => resolveSave({ success: true }));
    expect(onAdded).toHaveBeenCalledExactlyOnceWith({ success: true });
  });

  it('preserves required-field validation and entered values after a save failure', async () => {
    vi.mocked(getFields).mockResolvedValueOnce({
      data: [{ field_name: 'Title', data_type: 'text', is_required: true }],
    });
    vi.mocked(addEntry).mockRejectedValueOnce(new Error('Save unavailable'));
    renderForm({ onCancel: vi.fn() });
    const title = await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(screen.getByText('"Title" is required')).toBeInTheDocument();
    expect(addEntry).not.toHaveBeenCalled();
    fireEvent.change(title, { target: { value: 'Draft title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    const error = await screen.findByText('Save unavailable');
    expect(error.closest('.entry-form__body')).not.toBeNull();
    expect(title).toHaveValue('Draft title');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeEnabled();
  });

  it('applies the shared scroll/footer and comfortable-control CSS contract', async () => {
    // jsdom verifies declarations, not actual viewport geometry or sticky positioning.
    render(<style>{fieldStyles + globalStyles}</style>);
    vi.mocked(getFields).mockResolvedValueOnce({
      data: [
        optionalBooleanField,
        { field_name: 'Title', data_type: 'text' },
        { field_name: 'Description', data_type: 'markdown' },
        { field_name: 'Amount', data_type: 'currency' },
        { field_name: 'Position', data_type: 'geolocation' },
      ],
    });
    renderForm({ onCancel: vi.fn() });
    await screen.findByRole('checkbox', { name: 'False' });
    const form = screen.getByRole('form', { name: 'New Item' });
    const body = form.querySelector('.entry-form__body')!;
    const footer = form.querySelector('.entry-form__footer')!;
    expect(form).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      minHeight: '0',
      overflow: 'hidden',
    });
    expect(body).toHaveStyle({ overflowY: 'auto', minHeight: '0', flex: '1 1 auto' });
    expect(footer).toHaveStyle({ position: 'sticky', bottom: '0', flexShrink: '0' });
    for (const control of form.querySelectorAll('input:not([type="checkbox"]), select')) {
      expect(control).toHaveStyle({ minHeight: '44px', fontSize: '1rem', minWidth: '0' });
    }
    expect(screen.getByPlaceholderText('Supports Markdown formatting...')).toHaveStyle({
      minHeight: '100px',
      resize: 'vertical',
      fontSize: '1rem',
    });
    for (const button of within(footer as HTMLElement).getAllByRole('button')) {
      expect(button).toHaveStyle({ minHeight: '44px', fontSize: '1rem' });
    }
    expect(screen.getByRole('checkbox', { name: 'True' }).closest('label')).toHaveStyle({
      minHeight: '44px',
    });
  });
});
