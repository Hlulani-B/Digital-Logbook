import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickEntryBar } from '../QuickEntryBar';

vi.mock('../../functions/project/natural_language.js', () => ({
  addNaturalLanguageEntry: vi.fn(),
}));

import { addNaturalLanguageEntry } from '../../functions/project/natural_language.js';

describe('QuickEntryBar', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the input with default placeholder', () => {
    render(<QuickEntryBar />);
    expect(screen.getByPlaceholderText(/Quick add/i)).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    render(<QuickEntryBar placeholder="Type here..." />);
    expect(screen.getByPlaceholderText('Type here...')).toBeTruthy();
  });

  it('does not submit empty text', async () => {
    const user = userEvent.setup();
    render(<QuickEntryBar />);

    await user.click(screen.getByRole('button', { name: '' }));
    expect(addNaturalLanguageEntry).not.toHaveBeenCalled();
  });

  it('calls addNaturalLanguageEntry on submit', async () => {
    const user = userEvent.setup();
    (addNaturalLanguageEntry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      data: {},
    });

    render(<QuickEntryBar />);

    const input = screen.getByPlaceholderText(/Quick add/i);
    await user.type(input, 'Fixed login bug');
    await user.click(screen.getByRole('button', { name: '' }));

    expect(addNaturalLanguageEntry).toHaveBeenCalledWith('Fixed login bug');
  });

  it('shows success message after entry created', async () => {
    const user = userEvent.setup();
    (addNaturalLanguageEntry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      data: {},
    });

    render(<QuickEntryBar />);

    const input = screen.getByPlaceholderText(/Quick add/i);
    await user.type(input, 'Test entry');
    await user.click(screen.getByRole('button', { name: '' }));

    await waitFor(() => {
      expect(screen.getByText('Entry created!')).toBeTruthy();
    });
  });

  it('shows error message on failure', async () => {
    const user = userEvent.setup();
    (addNaturalLanguageEntry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      message: 'Something went wrong',
    });

    render(<QuickEntryBar />);

    const input = screen.getByPlaceholderText(/Quick add/i);
    await user.type(input, 'Test entry');
    await user.click(screen.getByRole('button', { name: '' }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });
  });

  it('calls onEntryCreated callback on success', async () => {
    const user = userEvent.setup();
    const onEntryCreated = vi.fn();
    (addNaturalLanguageEntry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      data: {},
    });

    render(<QuickEntryBar onEntryCreated={onEntryCreated} />);

    const input = screen.getByPlaceholderText(/Quick add/i);
    await user.type(input, 'Test entry');
    await user.click(screen.getByRole('button', { name: '' }));

    await waitFor(() => {
      expect(onEntryCreated).toHaveBeenCalled();
    });
  });

  it('shows voice button when onVoiceOpen is provided', () => {
    const onVoiceOpen = vi.fn();
    render(<QuickEntryBar onVoiceOpen={onVoiceOpen} />);
    expect(screen.getByLabelText('Voice entry')).toBeTruthy();
  });

  it('does not show voice button when onVoiceOpen is not provided', () => {
    render(<QuickEntryBar />);
    expect(screen.queryByLabelText('Voice entry')).toBeNull();
  });

  it('submits on Enter key', async () => {
    const user = userEvent.setup();
    (addNaturalLanguageEntry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      data: {},
    });

    render(<QuickEntryBar />);

    const input = screen.getByPlaceholderText(/Quick add/i);
    await user.type(input, 'Quick entry{enter}');

    expect(addNaturalLanguageEntry).toHaveBeenCalledWith('Quick entry');
  });

  it('shows project creation message when project_only', async () => {
    const user = userEvent.setup();
    (addNaturalLanguageEntry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      data: { project_only: true, project: 'NewProject' },
    });

    render(<QuickEntryBar />);

    const input = screen.getByPlaceholderText(/Quick add/i);
    await user.type(input, 'new project stuff');
    await user.click(screen.getByRole('button', { name: '' }));

    await waitFor(() => {
      expect(screen.getByText('Project "NewProject" created!')).toBeTruthy();
    });
  });

  it('disables input while loading', async () => {
    const user = userEvent.setup();
    // Don't resolve immediately — keep it pending
    let resolvePromise: (v: any) => void;
    (addNaturalLanguageEntry as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((resolve) => { resolvePromise = resolve; })
    );

    render(<QuickEntryBar />);

    const input = screen.getByPlaceholderText(/Quick add/i) as HTMLInputElement;
    await user.type(input, 'Loading test');
    await user.click(screen.getByRole('button', { name: '' }));

    await waitFor(() => {
      expect(input.disabled).toBe(true);
    });

    // Resolve to clean up
    resolvePromise!({ success: true, data: {} });
  });
});
