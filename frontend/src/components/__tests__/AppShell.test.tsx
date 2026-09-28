import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../AppShell';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/dashboard', search: '', hash: '', state: null, key: '' }),
  };
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'test@test.com' },
    signOut: vi.fn(),
  }),
}));

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div data-testid="child">Hello</div>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('renders the navbar with hamburger menu', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Toggle menu')).toBeTruthy();
  });

  it('renders the hamburger button', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Toggle menu')).toBeTruthy();
  });

  it('opens drawer on hamburger click', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    expect(screen.getByText('Navigation')).toBeTruthy();
  });

  it('shows supported navigation items without Today or Tracker view links', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('All Items')).toBeTruthy();
    expect(screen.getByText('My Stats')).toBeTruthy();
    expect(screen.getByText('Kanban')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tracker' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Tracker' })).toBeNull();
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.getByText('Streaks')).toBeTruthy();
  });

  it('navigates to /dashboard when Home is clicked', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('Home'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to /entries when All Entries is clicked', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('All Items'));
    expect(mockNavigate).toHaveBeenCalledWith('/entries');
  });

  it('navigates to /calendar when Calendar is clicked', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('Calendar'));
    expect(mockNavigate).toHaveBeenCalledWith('/calendar');
  });

  it('navigates to /streaks when Streaks is clicked', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    fireEvent.click(screen.getByText('Streaks'));
    expect(mockNavigate).toHaveBeenCalledWith('/streaks');
  });

  it('renders ProfileMenu', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    );
    // ProfileMenu renders an avatar button with aria-haspopup attribute
    const avatarBtn = document.querySelector('.avatar-btn');
    expect(avatarBtn).toBeTruthy();
    expect(avatarBtn!.getAttribute('aria-haspopup')).toBe('true');
  });
});
