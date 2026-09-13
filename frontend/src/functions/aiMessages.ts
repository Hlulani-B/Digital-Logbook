/**
 * AI Messages preference — controls whether AI-generated toasts and popups are shown.
 *
 * Stored in localStorage under key `dl_ai_messages`.
 * Default: true (AI messages enabled).
 *
 * Changes are broadcast via a custom event (and the native `storage` event
 * for other tabs) so open surfaces can react immediately — the old code only
 * read the preference when effects happened to re-run, so flipping the toggle
 * appeared to do nothing until a full reload.
 */

import { useSyncExternalStore } from 'react';

const AI_MESSAGES_KEY = 'dl_ai_messages';

/** Fired (same tab) whenever the preference changes. */
export const AI_MESSAGES_CHANGED_EVENT = 'dl-ai-messages-changed';

/**
 * Get whether AI messages (toasts, popups, greeting) are enabled.
 */
export function getAiMessagesEnabled(): boolean {
  try {
    const val = localStorage.getItem(AI_MESSAGES_KEY);
    if (val === 'false') return false;
  } catch {
    // ignore
  }
  return true; // default: enabled
}

/**
 * Set whether AI messages are enabled. Notifies all listeners in this tab and
 * other tabs so visible AI toasts can be dismissed without a reload.
 */
export function setAiMessagesEnabled(enabled: boolean) {
  localStorage.setItem(AI_MESSAGES_KEY, String(enabled));
  window.dispatchEvent(new Event(AI_MESSAGES_CHANGED_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener(AI_MESSAGES_CHANGED_EVENT, handler);
  // `storage` fires only in *other* tabs — covers multi-tab sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === AI_MESSAGES_KEY || e.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(AI_MESSAGES_CHANGED_EVENT, handler);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Reactive version of getAiMessagesEnabled() — components using this hook
 * re-render the instant the preference is toggled anywhere.
 */
export function useAiMessagesEnabled(): boolean {
  return useSyncExternalStore(subscribe, getAiMessagesEnabled, getAiMessagesEnabled);
}
