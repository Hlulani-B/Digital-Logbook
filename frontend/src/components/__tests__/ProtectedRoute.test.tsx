import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

const mockGetSession = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

import { useAuth } from '@/context/AuthContext';

function renderProtected(authOverrides = {}) {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    ...authOverrides,
  });

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/protected" element={<ProtectedRoute><div data-testid="protected-content">Protected</div></ProtectedRoute>} />
        <Route path="/signin" element={<div>Sign In Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
  });

  it('shows loading spinner while auth is loading', () => {
    renderProtected({ loading: true });
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders children when user is authenticated', async () => {
    renderProtected({ user: { email: 'test@test.com' } });
    expect(await screen.findByTestId('protected-content')).toBeTruthy();
  });

  it('redirects to /signin when user is not authenticated', async () => {
    renderProtected({ user: null });
    await waitFor(() => {
      expect(screen.getByText('Sign In Page')).toBeTruthy();
    });
  });

  it('uses fallback session check when context has no user', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'fallback@test.com' } } },
    });

    renderProtected({ user: null });

    // The fallback should find the session and render children
    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeTruthy();
    });
  });

  it('redirects when fallback also finds no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderProtected({ user: null });

    await waitFor(() => {
      expect(screen.getByText('Sign In Page')).toBeTruthy();
    });
  });
});
