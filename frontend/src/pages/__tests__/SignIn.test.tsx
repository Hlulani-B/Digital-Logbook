import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignIn } from '../SignIn';

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    signInWithGoogle: vi.fn(),
    signInWithGitHub: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
  }),
}));

vi.mock('@/functions/profile/login.js', () => ({
  checkUser: vi.fn().mockResolvedValue({ exists: true, deleted: false }),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      signOut: vi.fn(),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

vi.mock('@/lib/validation', () => ({
  validateEmailForAuth: vi.fn().mockReturnValue(null),
  suggestEmailCorrection: vi.fn().mockReturnValue(null),
}));

describe('SignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderSignIn() {
    return render(
      <MemoryRouter initialEntries={['/signin']}>
        <SignIn />
      </MemoryRouter>
    );
  }

  it('renders the Welcome title', () => {
    renderSignIn();
    expect(screen.getByText('Welcome')).toBeTruthy();
  });

  it('renders the sign-in subtitle', () => {
    renderSignIn();
    expect(screen.getByText('Sign in to continue to your logbook')).toBeTruthy();
  });

  it('renders email and password fields', () => {
    renderSignIn();
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('renders the Sign In button', () => {
    renderSignIn();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('renders OAuth buttons for Google and GitHub', () => {
    renderSignIn();
    expect(screen.getByLabelText('Continue with Google')).toBeTruthy();
    expect(screen.getByLabelText('Continue with GitHub')).toBeTruthy();
  });

  it('toggles to sign-up mode', () => {
    renderSignIn();
    fireEvent.click(screen.getByText("Don't have an account? Create one"));
    expect(screen.getByText('Create Account')).toBeTruthy();
    expect(screen.getByLabelText('Confirm password')).toBeTruthy();
  });

  it('toggles back to sign-in mode', () => {
    renderSignIn();
    fireEvent.click(screen.getByText("Don't have an account? Create one"));
    fireEvent.click(screen.getByText('Already have an account? Sign in'));
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('shows forgot password link in sign-in mode', () => {
    renderSignIn();
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });

  it('hides forgot password link in sign-up mode', () => {
    renderSignIn();
    fireEvent.click(screen.getByText("Don't have an account? Create one"));
    expect(screen.queryByText('Forgot password?')).toBeNull();
  });

  it('renders the Digital Logbook caption', () => {
    renderSignIn();
    expect(screen.getByText('Digital Logbook')).toBeTruthy();
    expect(screen.getByText('Track your time, own your progress')).toBeTruthy();
  });

  it('has correct input types', () => {
    renderSignIn();
    const emailInput = screen.getByLabelText('Email address') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(emailInput.type).toBe('email');
    expect(passwordInput.type).toBe('password');
  });

  it('has required attributes on inputs', () => {
    renderSignIn();
    const emailInput = screen.getByLabelText('Email address') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(emailInput.required).toBe(true);
    expect(passwordInput.required).toBe(true);
  });

  it('has correct autocomplete attributes', () => {
    renderSignIn();
    const emailInput = screen.getByLabelText('Email address') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(emailInput.autocomplete).toBe('email');
    expect(passwordInput.autocomplete).toBe('current-password');
  });

  it('shows password hint in sign-up mode', () => {
    renderSignIn();
    fireEvent.click(screen.getByText("Don't have an account? Create one"));
    expect(screen.getByText('Password must be at least 6 characters.')).toBeTruthy();
  });

  it('renders the "or continue with" divider', () => {
    renderSignIn();
    expect(screen.getByText('or continue with')).toBeTruthy();
  });
});
