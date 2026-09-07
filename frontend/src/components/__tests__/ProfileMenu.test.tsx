import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfileMenu } from '../ProfileMenu';

describe('ProfileMenu', () => {
  const defaultProps = {
    displayName: 'Alice',
    email: 'alice@example.com',
    avatarUrl: '',
    onManageProfile: vi.fn(),
    onSettings: vi.fn(),
    onSignOut: vi.fn(),
    signingOut: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  function renderMenu(overrides = {}) {
    return render(<ProfileMenu {...defaultProps} {...overrides} />);
  }

  it('renders the display name', () => {
    renderMenu();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('renders the first letter avatar when no avatarUrl', () => {
    renderMenu();
    // The avatar button contains the initial letter
    const avatarBtn = screen.getByRole('button', { name: /Alice/i });
    expect(avatarBtn).toBeTruthy();
    expect(avatarBtn.textContent).toContain('A');
  });

  it('renders an img when avatarUrl is provided', () => {
    renderMenu({ avatarUrl: 'https://example.com/pic.jpg' });
    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('https://example.com/pic.jpg');
  });

  it('opens dropdown on click', async () => {
    renderMenu();
    const avatarBtn = screen.getByRole('button', { name: /Alice/i });
    fireEvent.click(avatarBtn);

    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByText('Manage Profile')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Sign Out')).toBeTruthy();
  });

  it('shows email in dropdown header', async () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /Alice/i }));
    expect(screen.getByText('alice@example.com')).toBeTruthy();
  });

  it('calls onManageProfile when Manage Profile is clicked', async () => {
    const onManageProfile = vi.fn();
    renderMenu({ onManageProfile });

    fireEvent.click(screen.getByRole('button', { name: /Alice/i }));
    fireEvent.click(screen.getByText('Manage Profile'));

    expect(onManageProfile).toHaveBeenCalled();
  });

  it('calls onSettings when Settings is clicked', async () => {
    const onSettings = vi.fn();
    renderMenu({ onSettings });

    fireEvent.click(screen.getByRole('button', { name: /Alice/i }));
    fireEvent.click(screen.getByText('Settings'));

    expect(onSettings).toHaveBeenCalled();
  });

  it('calls onSignOut when Sign Out is clicked', async () => {
    const onSignOut = vi.fn();
    renderMenu({ onSignOut });

    fireEvent.click(screen.getByRole('button', { name: /Alice/i }));
    fireEvent.click(screen.getByText('Sign Out'));

    expect(onSignOut).toHaveBeenCalled();
  });

  it('shows "Signing out..." when signingOut is true', async () => {
    renderMenu({ signingOut: true });

    fireEvent.click(screen.getByRole('button', { name: /Alice/i }));
    const signOutBtn = screen.getByText('Signing out...');
    expect(signOutBtn).toBeTruthy();
    expect(signOutBtn.hasAttribute('disabled')).toBe(true);
  });

  it('closes dropdown on Escape key', async () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /Alice/i }));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('closes dropdown on outside click', async () => {
    render(<div data-testid="outside"><ProfileMenu {...defaultProps} /></div>);
    fireEvent.click(screen.getByRole('button', { name: /Alice/i }));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('sets aria-expanded correctly', () => {
    renderMenu();
    const btn = screen.getByRole('button', { name: /Alice/i });
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });
});
