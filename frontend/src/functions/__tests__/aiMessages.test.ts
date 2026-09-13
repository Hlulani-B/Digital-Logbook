import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getAiMessagesEnabled,
  setAiMessagesEnabled,
  useAiMessagesEnabled,
  AI_MESSAGES_CHANGED_EVENT,
} from '../aiMessages';

describe('AI Messages Preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getAiMessagesEnabled', () => {
    it('returns true by default when nothing is stored', () => {
      expect(getAiMessagesEnabled()).toBe(true);
    });

    it('returns false when explicitly disabled', () => {
      localStorage.setItem('dl_ai_messages', 'false');
      expect(getAiMessagesEnabled()).toBe(false);
    });

    it('returns true when explicitly enabled', () => {
      localStorage.setItem('dl_ai_messages', 'true');
      expect(getAiMessagesEnabled()).toBe(true);
    });

    it('returns true for invalid stored values', () => {
      localStorage.setItem('dl_ai_messages', 'garbage');
      expect(getAiMessagesEnabled()).toBe(true);
    });
  });

  describe('setAiMessagesEnabled', () => {
    it('stores false correctly', () => {
      setAiMessagesEnabled(false);
      expect(localStorage.getItem('dl_ai_messages')).toBe('false');
      expect(getAiMessagesEnabled()).toBe(false);
    });

    it('stores true correctly', () => {
      setAiMessagesEnabled(true);
      expect(localStorage.getItem('dl_ai_messages')).toBe('true');
      expect(getAiMessagesEnabled()).toBe(true);
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
    it('reflects the stored value on first render', () => {
      localStorage.setItem('dl_ai_messages', 'false');
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
  });
});
