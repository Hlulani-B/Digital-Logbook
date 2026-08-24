import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
};

const mockSession = {
  user: mockUser,
  access_token: 'test-token',
};

const unsubscribe = vi.fn();
const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signOut = vi.fn();
const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const signInWithOAuth = vi.fn();
const rpc = vi.fn();
const getSession = vi.fn();
const onAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe } },
}));

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession,
      onAuthStateChange,
      signInWithPassword,
      signUp,
      signOut,
      resetPasswordForEmail,
      updateUser,
      signInWithOAuth,
    },
    rpc,
  }),
}));

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="user">{auth.user ? auth.user.email : 'no-user'}</span>
      <button onClick={() => auth.signInWithEmail('test@example.com', 'password')}>
        Sign In
      </button>
      <button onClick={() => auth.signUpWithEmail('test@example.com', 'password')}>
        Sign Up
      </button>
      <button onClick={() => auth.signOut()}>Sign Out</button>
      <button onClick={() => auth.resetPassword('test@example.com')}>Reset Password</button>
      <button onClick={() => auth.updatePassword('newpassword')}>Update Password</button>
      <button onClick={() => auth.deleteAccount()}>Delete Account</button>
      <button onClick={() => auth.restoreAccount()}>Restore Account</button>
      <button onClick={() => auth.signInWithGoogle()}>Google</button>
      <button onClick={() => auth.signInWithGitHub()}>GitHub</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    signInWithPassword.mockResolvedValue({ error: null });
    signUp.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });
    signInWithOAuth.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with no user when no session exists', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(getSession).toHaveBeenCalled();
    expect(onAuthStateChange).toHaveBeenCalled();
  });

  it('should set user when a session exists on mount', async () => {
    getSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });

  it('should update auth state when onAuthStateChange fires', async () => {
    let authCallback: (_event: string, session: typeof mockSession | null) => void = () => {};
    onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe } } };
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    act(() => {
      authCallback('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });

  it('should call signInWithPassword with email and password', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Sign In'));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
  });

  it('should call signUp with email, password, and redirect URL', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Sign Up'));

    expect(signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });

  it('should call signOut', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Sign Out'));

    expect(signOut).toHaveBeenCalled();
  });

  it('should call resetPasswordForEmail with email and redirect URL', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Reset Password'));

    expect(resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
  });

  it('should call updateUser with new password', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Update Password'));

    expect(updateUser).toHaveBeenCalledWith({ password: 'newpassword' });
  });

  it('should call delete_user RPC and then signOut', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Delete Account'));

    expect(rpc).toHaveBeenCalledWith('delete_user');
    expect(signOut).toHaveBeenCalled();
  });

  it('should throw if delete_user RPC fails', async () => {
    rpc.mockResolvedValue({ error: { message: 'deletion failed' } });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(result.current.deleteAccount()).rejects.toThrow('deletion failed');
  });

  it('should call restore_user RPC', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Restore Account'));

    expect(rpc).toHaveBeenCalledWith('restore_user');
  });

  it('should call signInWithOAuth for Google and GitHub', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Google'));

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    await user.click(screen.getByText('GitHub'));

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it('should throw when useAuth is called outside AuthProvider', () => {
    function BadComponent() {
      useAuth();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow('useAuth must be used within an AuthProvider');
  });
});
