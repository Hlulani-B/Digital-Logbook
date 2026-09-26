/**
 * Offline display — real component test.
 *
 * The cache-layer tests prove addEntry writes and emits. This one proves the
 * whole chain the user actually exercises: while offline, open a project, add an
 * item through the AddEntry form, and it must appear in the feed with no server
 * available. Everything the page renders through is real (AddEntry, EntryBox,
 * lib/cache, functions/project/*); only network, auth and unrelated chrome are
 * mocked.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The wasm build of sql.js cannot locate sql-wasm.wasm under Node.
vi.mock('sql.js', async () => {
  const mod = await import('sql.js/dist/sql-asm.js');
  return { default: mod.default ?? mod };
});

const mockRequest = vi.fn();
vi.mock('@/lib/api', () => ({
  request: (...args) => mockRequest(...args),
  PROJECT_URL: 'http://localhost:5003',
}));

const EMAIL = 'offline@test.com';
const PROJECT = 'OfflineProject';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { email: EMAIL }, signOut: vi.fn() }),
}));

vi.mock('@/components/NavBar', () => ({ NavBar: () => null }));
vi.mock('@/components/Header', () => ({ Header: () => null }));
vi.mock('@/components/ProjectSettingsPanel', () => ({ ProjectSettingsPanel: () => null }));
vi.mock('@/pages/VoiceFeature', () => ({ default: () => null }));
vi.mock('@/lib/recentlyViewed', () => ({ trackViewedProject: vi.fn() }));
vi.mock('@/lib/recentlyCreated', () => ({ trackCreatedEntry: vi.fn() }));
vi.mock('@/functions/project/priority.js', () => ({ setPriority: vi.fn() }));
vi.mock('@/functions/project/search.js', () => ({ searchEntriesInProject: vi.fn() }));
vi.mock('@/functions/project/natural_language.js', () => ({
  addNaturalLanguageEntry: vi.fn(),
}));
vi.mock('@/functions/ai.js', () => ({ askAI: vi.fn(), parseAIResponse: (s: string) => s }));
vi.mock('@/functions/tone', () => ({ getToneInstruction: () => '' }));
vi.mock('@/functions/aiMessages', () => ({
  getAiMessagesEnabled: () => false,
  useAiMessagesEnabled: () => false,
}));

// Imported lazily so the mocks above are registered first.
const { ProjectDetailPage } = await import('@/pages/ProjectDetailPage');
const { NotesProvider } = await import('@/context/NotesContext');
const { cacheSet, CACHE_STORES } = await import('@/lib/cache');
const { getEntries } = await import('@/functions/project/entries.js');

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

describe('ProjectDetailPage offline', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setOnline(false);
    mockRequest.mockRejectedValue(new Error('Failed to fetch'));
    localStorage.setItem('project-view-mode', 'cards');

    // What a device that synced before going offline would have in the cache.
    await cacheSet(CACHE_STORES.PROJECTS, EMAIL, {
      success: true,
      data: [{ project_name: PROJECT }],
    });
    await cacheSet(CACHE_STORES.FIELDS, `${EMAIL}:${PROJECT}`, {
      success: true,
      data: [{ field_name: 'task', data_type: 'text', is_required: false }],
    });
    await cacheSet(CACHE_STORES.ENTRIES, `${EMAIL}:${PROJECT}`, { success: true, data: [] });
  });

  it('shows an item added while offline in the feed', async () => {
    const { container } = render(
      <NotesProvider>
        <MemoryRouter initialEntries={[`/project/${PROJECT}`]}>
          <Routes>
            <Route path="/project/:projectName" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </NotesProvider>
    );

    // Open the New item modal and fill the single column.
    fireEvent.click(screen.getByText('New'));
    const input = await waitFor(() => {
      const el = document.getElementById('field-task') as HTMLInputElement | null;
      expect(el).toBeTruthy();
      return el!;
    });
    fireEvent.change(input, { target: { value: 'offline task' } });
    fireEvent.submit(container.querySelector('form.add-entry')!);

    // The optimistic row must reach the feed from the cache alone.
    await waitFor(
      () => {
        expect(container.textContent).toContain('offline task');
      },
      { timeout: 10000 }
    );

    // ...and it must be in the cache the page reads, not just in component state.
    const stored = await getEntries(EMAIL, PROJECT);
    expect((stored?.data || []).map((e: any) => e.id)).toHaveLength(1);
    expect((stored.data as any[])[0]._optimistic).toBe(true);
  }, 120000);
});
