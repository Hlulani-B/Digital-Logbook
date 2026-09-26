import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TemplatePicker } from '../fields/TemplatePicker';
import { listTemplates, type Template } from '@/lib/templateApi';

vi.mock('@/lib/templateApi', () => ({ listTemplates: vi.fn() }));

const listMock = vi.mocked(listTemplates);
const builtIn: Template = {
  id: 'built-in-template',
  name: 'Built-in fixture',
  fields: [],
  scope: 'built_in',
  version: 1,
  is_fork: false,
};
const personal: Template = {
  ...builtIn,
  id: 'personal-template',
  name: 'Personal fixture',
  scope: 'personal',
};
const globalTemplate: Template = {
  ...builtIn,
  id: 'global-template',
  name: 'Global fixture',
  scope: 'global',
};

function deferred() {
  let resolve!: (templates: Template[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Template[]>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPicker() {
  const onSelect = vi.fn();
  const onCancel = vi.fn();
  return {
    ...render(
      <MemoryRouter>
        <TemplatePicker onSelect={onSelect} onCancel={onCancel} />
      </MemoryRouter>
    ),
    onSelect,
    onCancel,
  };
}

function expectNoEmptyState() {
  expect(screen.queryByText(/^No (?:personal|global|built-in) templates/)).not.toBeInTheDocument();
}

beforeEach(() => {
  listMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('TemplatePicker scoped loading', () => {
  it('requests only the active scope and clears old cards while switching tabs', async () => {
    const pendingPersonal = deferred();
    const pendingGlobal = deferred();
    listMock.mockImplementation((scope) => {
      if (scope === 'built_in') return Promise.resolve([builtIn]);
      if (scope === 'personal') return pendingPersonal.promise;
      if (scope === 'global') return pendingGlobal.promise;
      throw new Error('The picker must not request all scopes');
    });
    renderPicker();

    expect(await screen.findByRole('button', { name: builtIn.name })).toBeInTheDocument();
    expect(listMock.mock.calls).toEqual([['built_in']]);

    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
    expect(listMock.mock.calls).toEqual([['built_in'], ['personal']]);
    expect(screen.queryByRole('button', { name: builtIn.name })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading templates...');
    expectNoEmptyState();

    await act(async () => pendingPersonal.resolve([personal, builtIn]));
    expect(screen.getByRole('button', { name: personal.name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: builtIn.name })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Global' }));
    expect(screen.queryByRole('button', { name: personal.name })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expectNoEmptyState();
    await act(async () => pendingGlobal.resolve([globalTemplate]));
    expect(screen.getByRole('button', { name: globalTemplate.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Global' })).toHaveAttribute('aria-pressed', 'true');
    expect(listMock.mock.calls).toEqual([['built_in'], ['personal'], ['global']]);
  });

  it('isolates a personal-scope failure and clears its error on a tab switch', async () => {
    const pendingBuiltIn = deferred();
    listMock
      .mockResolvedValueOnce([builtIn])
      .mockRejectedValueOnce(new Error('Personal storage is unavailable.'))
      .mockReturnValueOnce(pendingBuiltIn.promise);
    renderPicker();
    await screen.findByRole('button', { name: builtIn.name });

    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Personal storage is unavailable.');
    expectNoEmptyState();
    fireEvent.click(screen.getByRole('button', { name: 'Built-in' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: builtIn.name })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expectNoEmptyState();

    await act(async () => pendingBuiltIn.resolve([builtIn]));
    expect(screen.getByRole('button', { name: builtIn.name })).toBeInTheDocument();
    expect(listMock.mock.calls).toEqual([['built_in'], ['personal'], ['built_in']]);
  });

  it.each([
    ['built_in', 'Built-in', 'No built-in templates available.'],
    ['personal', 'Personal', 'No personal templates yet. Create one from a project.'],
    ['global', 'Global', 'No global templates available.'],
  ] as const)('shows a genuine empty state only after %s succeeds', async (scope, tab, message) => {
    const pending = deferred();
    listMock.mockImplementation((requestedScope) =>
      requestedScope === scope ? pending.promise : Promise.resolve([builtIn])
    );
    renderPicker();
    if (scope !== 'built_in') fireEvent.click(screen.getByRole('button', { name: tab }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expectNoEmptyState();

    await act(async () => pending.resolve([]));
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('TemplatePicker request lifecycle', () => {
  it.each([
    ['success', 'before'],
    ['failure', 'before'],
    ['success', 'after'],
    ['failure', 'after'],
  ] as const)('ignores stale %s settling %s the active response', async (outcome, timing) => {
    const stale = deferred();
    const current = deferred();
    listMock.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));

    if (timing === 'after') {
      await act(async () => current.resolve([personal]));
    }
    await act(async () => {
      if (outcome === 'success') stale.resolve([builtIn]);
      else stale.reject(new Error('Obsolete failure'));
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: builtIn.name })).not.toBeInTheDocument();
    expectNoEmptyState();
    if (timing === 'before') {
      expect(screen.getByRole('status')).toBeInTheDocument();
      await act(async () => current.resolve([personal]));
    }
    expect(screen.getByRole('button', { name: personal.name })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ignores an earlier request even after returning to the same scope', async () => {
    const stale = deferred();
    const fresh = { ...builtIn, name: 'Fresh built-in fixture' };
    listMock
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce([personal])
      .mockResolvedValueOnce([fresh]);
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
    await screen.findByRole('button', { name: personal.name });
    fireEvent.click(screen.getByRole('button', { name: 'Built-in' }));
    await screen.findByRole('button', { name: fresh.name });

    await act(async () => stale.resolve([builtIn]));
    expect(screen.getByRole('button', { name: fresh.name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: builtIn.name })).not.toBeInTheDocument();
  });

  it('ignores the cleaned-up effect request during StrictMode replay', async () => {
    const stale = deferred();
    const current = deferred();
    listMock.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    render(
      <StrictMode>
        <TemplatePicker onSelect={vi.fn()} onCancel={vi.fn()} />
      </StrictMode>
    );
    expect(listMock.mock.calls).toEqual([['built_in'], ['built_in']]);

    await act(async () => stale.reject(new Error('Discarded request')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    await act(async () => current.resolve([builtIn]));
    expect(screen.getByRole('button', { name: builtIn.name })).toBeInTheDocument();
  });

  it.each(['success', 'failure'] as const)('safely ignores a %s after unmount', async (outcome) => {
    const pending = deferred();
    listMock.mockReturnValueOnce(pending.promise);
    const { unmount, container, onSelect, onCancel } = renderPicker();
    unmount();

    await act(async () => {
      if (outcome === 'success') pending.resolve([builtIn]);
      else pending.reject(new Error('Unmounted request'));
    });
    expect(container).toBeEmptyDOMElement();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('retries only the failed active scope, clearing errors until the new request finishes', async () => {
    const retry = deferred();
    listMock
      .mockResolvedValueOnce([builtIn])
      .mockRejectedValueOnce(new Error('Template storage is unavailable.'))
      .mockReturnValueOnce(retry.promise);
    renderPicker();
    await screen.findByRole('button', { name: builtIn.name });
    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Template storage is unavailable.');
    expectNoEmptyState();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(listMock.mock.calls).toEqual([['built_in'], ['personal'], ['personal']]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expectNoEmptyState();

    await act(async () => retry.resolve([personal]));
    expect(screen.getByRole('button', { name: personal.name })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('TemplatePicker accessibility', () => {
  it('supports card selection by click, Enter, and Space and labels the close control', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValueOnce([builtIn]);
    const { onSelect, onCancel } = renderPicker();
    const card = await screen.findByRole('button', { name: builtIn.name });
    expect(card).toHaveAttribute('tabindex', '0');
    await user.click(card);
    expect(card).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown}');
    expect(onSelect.mock.calls).toEqual([[builtIn], [builtIn], [builtIn]]);

    await user.click(screen.getByRole('button', { name: 'Close template picker' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
