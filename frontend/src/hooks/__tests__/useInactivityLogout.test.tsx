import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInactivityLogout } from '../useInactivityLogout';

const mockSignOut = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('useInactivityLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSignOut.mockReset();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not sign out while activity occurs within the timeout', () => {
    renderHook(() => useInactivityLogout({ enabled: true, timeoutMs: 5_000 }));

    // Simulate activity before timeout expires.
    vi.advanceTimersByTime(3_000);
    window.dispatchEvent(new Event('mousemove'));
    vi.advanceTimersByTime(3_000);

    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signs the user out and redirects after the timeout expires without activity', async () => {
    renderHook(() => useInactivityLogout({ enabled: true, timeoutMs: 5_000 }));

    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/signin', { replace: true });
  });

  it('does nothing when disabled', () => {
    renderHook(() => useInactivityLogout({ enabled: false, timeoutMs: 5_000 }));

    vi.advanceTimersByTime(10_000);

    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
