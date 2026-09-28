import { useState, useEffect, useCallback } from 'react';

/**
 * Keyboard shortcut definitions.
 * Each shortcut has a key combination, description, and action.
 */
export interface KeyboardShortcut {
  key: string; // e.g., "Ctrl+K", "?", "g then d"
  description: string;
  category: 'navigation' | 'actions' | 'general';
  action: () => void;
}

/**
 * Parse a key event into a shortcut string.
 */
export function parseKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  // Don't add modifier-only keys
  const key = e.key;
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    if (key.length === 1) {
      parts.push(key.toUpperCase());
    } else {
      parts.push(key);
    }
  }

  return parts.join('+');
}

/**
 * Check if a keyboard event matches a shortcut string.
 */
export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseKeyEvent(e);
  return parsed === shortcut;
}

/**
 * Hook to register keyboard shortcuts.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        if (matchesShortcut(e, shortcut.key)) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Default keyboard shortcuts for the application.
 */
export function getDefaultShortcuts(navigate: (path: string) => void): KeyboardShortcut[] {
  return [
    // Navigation
    {
      key: 'G then D',
      description: 'Go to Dashboard',
      category: 'navigation',
      action: () => navigate('/dashboard'),
    },
    {
      key: 'G then P',
      description: 'Go to Projects',
      category: 'navigation',
      action: () => navigate('/projects'),
    },
    {
      key: 'G then T',
      description: 'Go to Timeline',
      category: 'navigation',
      action: () => navigate('/timeline'),
    },
    {
      key: 'G then C',
      description: 'Go to Calendar',
      category: 'navigation',
      action: () => navigate('/calendar'),
    },

    // Actions
    {
      key: 'N',
      description: 'New entry',
      category: 'actions',
      action: () => navigate('/create-template'),
    },
    {
      key: '/',
      description: 'Focus search',
      category: 'actions',
      action: () => {
        const searchInput = document.querySelector(
          'input[type="search"], .search-input'
        ) as HTMLInputElement;
        if (searchInput) searchInput.focus();
      },
    },

    // General
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      category: 'general',
      action: () => {
        // Dispatch custom event to show help modal
        window.dispatchEvent(new CustomEvent('show-keyboard-help'));
      },
    },
    {
      key: 'Escape',
      description: 'Close modal/drawer',
      category: 'general',
      action: () => {
        // Escape is handled elsewhere, this is just for documentation
      },
    },
  ];
}
