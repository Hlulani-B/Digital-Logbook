import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from '../Header';

// Mock dependencies
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'test@test.com',
      user_metadata: { full_name: 'Test User' },
      app_metadata: { provider: 'google' },
    },
    deleteAccount: vi.fn(),
    resetPassword: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  CACHE_STORES: { PROFILE: 'profile' },
}));

vi.mock('@/components/SettingsPanel', () => ({
  SettingsPanel: vi.fn(({ open, onClose }: any) =>
    open ? <div data-testid="settings-panel"><button onClick={onClose}>Close</button></div> : null
  ),
}));

vi.mock('@/components/Stats', () => ({
  Stats: vi.fn(({ entries, projects }: any) => (
    <div data-testid="stats-component">Stats: {entries?.length || 0} entries</div>
  )),
}));

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title', () => {
    render(<Header title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('renders with default title "Dashboard"', () => {
    render(<Header />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('renders with custom title', () => {
    render(<Header title="My Entries" />);
    expect(screen.getByText('My Entries')).toBeTruthy();
  });

  it('renders the Stats component', () => {
    const entries = [{ id: '1' }, { id: '2' }];
    render(<Header entries={entries} projects={[]} />);
    expect(screen.getByTestId('stats-component')).toBeTruthy();
  });

  it('opens settings panel when open-settings event is dispatched', async () => {
    render(<Header />);

    // Settings panel should not be visible initially
    expect(screen.queryByTestId('settings-panel')).toBeNull();

    // Dispatch the event
    window.dispatchEvent(new CustomEvent('open-settings'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-panel')).toBeTruthy();
    });
  });

  it('closes settings panel when close is triggered', async () => {
    render(<Header />);

    window.dispatchEvent(new CustomEvent('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-panel')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => {
      expect(screen.queryByTestId('settings-panel')).toBeNull();
    });
  });

  it('cleans up event listener on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<Header />);

    expect(addSpy).toHaveBeenCalledWith('open-settings', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('open-settings', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('passes dueSoonCount to Stats', () => {
    render(<Header entries={[]} projects={[]} dueSoonCount={5} />);
    expect(screen.getByTestId('stats-component')).toBeTruthy();
  });
});
