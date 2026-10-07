/**
 * AI-messages preference tests.
 *
 * The preference moved from the shared `localStorage` key `dl_ai_messages` to
 * the per-user `user_preferences` SQLite store (functions/preferences.js), so
 * these tests drive it through initPreferences() and assert against the cache
 * row instead of localStorage. The legacy key is still covered — migrating it
 * is what keeps existing users' opt-outs working.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the SQLite cache layer with a minimal in-memory table so preferences
// never touch sql.js/IndexedDB in tests.
const rows: Record<string, string> = {};
const run = vi.fn((sql: string, params?: unknown[]) => {
  if (sql.includes('INSERT INTO user_preferences')) {
    rows[params![0] as string] = params![1] as string;
  }
});
const exec = vi.fn((sql: string, params?: unknown[]) => {
  const data = rows[params![0] as string];
  return data ? [{ values: [[data]] }] : [];
});
vi.mock('@/lib/cache.js', () => ({
  CACHE_STORES: { USER_PREFERENCES: 'user_preferences' },
  getSharedDB: async () => ({ exec, run }),
  persistDB: () => {},
}));

const { initPreferences, resetPreferences, setPref } = await import('@/functions/preferences');
const {
  getAiMessagesEnabled,
  setAiMessagesEnabled,
  useAiMessagesEnabled,
  AI_MESSAGES_CHANGED_EVENT,
} = await import('../aiMessages');

describe('AI Messages Preference', () => {
  beforeEach(async () => {
    localStorage.clear();
    for (const key of Object.keys(rows)) delete rows[key];
    await initPreferences('user@test.com');
  });

  describe('getAiMessagesEnabled', () => {
    it('returns true by default when nothing is stored', () => {
      expect(getAiMessagesEnabled()).toBe(true);
    });

    it('returns false when explicitly disabled', () => {
      setAiMessagesEnabled(false);
      expect(getAiMessagesEnabled()).toBe(false);
    });

    it('returns true when explicitly enabled', () => {
      setAiMessagesEnabled(false);
      setAiMessagesEnabled(true);
      expect(getAiMessagesEnabled()).toBe(true);
    });

    it('migrates a legacy dl_ai_messages=false opt-out exactly once', async () => {
      localStorage.setItem('dl_ai_messages', 'false');
      resetPreferences();
      await initPreferences('legacy@test.com');
      expect(getAiMessagesEnabled()).toBe(false);
      // The legacy key is consumed so a later account never inherits it.
      expect(localStorage.getItem('dl_ai_messages')).toBeNull();
    });
  });

  describe('setAiMessagesEnabled', () => {
    it('persists the flag into the active user row', async () => {
      setAiMessagesEnabled(false);
      await vi.waitFor(() => {
        const data = JSON.parse(rows['user@test.com']);
        expect(data.ai_messages_enabled).toBe(false);
      });
      expect(getAiMessagesEnabled()).toBe(false);
    });

    it('can toggle back and forth', () => {
      setAiMessagesEnabled(false);
      expect(getAiMessagesEnabled()).toBe(false);

      setAiMessagesEnabled(true);
      expect(getAiMessagesEnabled()).toBe(true);

      setAiMessagesEnabled(false);
      expect(getAiMessagesEnabled()).toBe(false);
    });
  });

  describe('per-user isolation', () => {
    it('shows defaults for a new account and restores the owner’s choice', async () => {
      setAiMessagesEnabled(false);
      await vi.waitFor(() => {
        expect(JSON.parse(rows['user@test.com']).ai_messages_enabled).toBe(false);
      });

      // Second account on the same device must not see the first one's opt-out.
      await initPreferences('other@test.com');
      expect(getAiMessagesEnabled()).toBe(true);

      // Back to the first account: the stored choice returns.
      await initPreferences('user@test.com');
      expect(getAiMessagesEnabled()).toBe(false);
    });

    it('resets to defaults on logout', async () => {
      setAiMessagesEnabled(false);
      await vi.waitFor(() => {
        expect(JSON.parse(rows['user@test.com']).ai_messages_enabled).toBe(false);
      });
      resetPreferences();
      expect(getAiMessagesEnabled()).toBe(true);
    });
  });

  describe('change notification', () => {
    it('setAiMessagesEnabled dispatches the change event on window', () => {
      const listener = vi.fn();
      window.addEventListener(AI_MESSAGES_CHANGED_EVENT, listener);
      setAiMessagesEnabled(false);
      expect(listener).toHaveBeenCalledTimes(1);
      setAiMessagesEnabled(true);
      expect(listener).toHaveBeenCalledTimes(2);
      window.removeEventListener(AI_MESSAGES_CHANGED_EVENT, listener);
    });
  });

  describe('useAiMessagesEnabled', () => {
    it('reflects the stored value on first render', async () => {
      await setPref('ai_messages_enabled', false);
      const { result } = renderHook(() => useAiMessagesEnabled());
      expect(result.current).toBe(false);
    });

    it('defaults to enabled when nothing is stored', () => {
      const { result } = renderHook(() => useAiMessagesEnabled());
      expect(result.current).toBe(true);
    });

    it('updates immediately when the preference is toggled (no reload)', () => {
      const { result } = renderHook(() => useAiMessagesEnabled());
      expect(result.current).toBe(true);

      act(() => {
        setAiMessagesEnabled(false);
      });
      expect(result.current).toBe(false);

      act(() => {
        setAiMessagesEnabled(true);
      });
      expect(result.current).toBe(true);
    });

    it('re-renders when another user’s row loads (login switch)', async () => {
      const { result } = renderHook(() => useAiMessagesEnabled());
      expect(result.current).toBe(true);

      setAiMessagesEnabled(false);
      await initPreferences('friend@test.com');
      expect(result.current).toBe(true);
    });
  });
});
