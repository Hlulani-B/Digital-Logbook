import { describe, it, expect, beforeEach } from 'vitest';
import { getAiMessagesEnabled, setAiMessagesEnabled } from '../aiMessages';

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
});
