import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddEntry } from '../AddEntry';
import { addEntry } from '../../functions/project/entries.js';
import { getFields } from '../../functions/project/fields.js';

vi.mock('../../functions/project/entries.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../functions/project/fields.js', () => ({
  getFields: vi.fn(),
}));

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

  function renderForm() {
    return render(<AddEntry user_email="test@example.com" project_name="Project Alpha" />);
  }

  it('omits an untouched optional Boolean field', async () => {
    renderForm();

    await screen.findByRole('checkbox', { name: 'optional flag' });
    fireEvent.click(screen.getByRole('button', { name: 'Add Entry' }));

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(vi.mocked(addEntry).mock.calls[0][2]).toEqual({});
  });

  it('persists false after an optional Boolean field is changed', async () => {
    renderForm();

    const checkbox = await screen.findByRole('checkbox', { name: 'optional flag' });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Add Entry' }));

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(vi.mocked(addEntry).mock.calls[0][2]).toEqual({ optional_flag: false });
  });
});
