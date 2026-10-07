/**
 * AI Messages preference — controls whether AI-generated toasts and popups are shown.
 *
 * Stored per-user in the local SQLite `user_preferences` table (see
 * functions/preferences.js), keyed by the logged-in user's email — so a
 * preference set on a shared laptop no longer leaks to the next account.
 * Default: true (AI messages enabled).
 *
 * Changes are broadcast via the preferences event (plus this module's own
 * event and the native `storage` event for other tabs) so open surfaces can
 * react immediately — the old code only read the preference when effects
 * happened to re-run, so flipping the toggle appeared to do nothing until a
 * full reload.
 */

import { useSyncExternalStore } from 'react';
import { getPref, setPref, PREFERENCES_CHANGED_EVENT } from './preferences';

const PREF_KEY = 'ai_messages_enabled';

/** Fired (same tab) whenever the preference changes. */
export const AI_MESSAGES_CHANGED_EVENT = 'dl-ai-messages-changed';

/**
 * Get whether AI messages (toasts, popups, greeting) are enabled.
 */
export function getAiMessagesEnabled(): boolean {
  return getPref(PREF_KEY) !== false;
}

/**
 * Set whether AI messages are enabled. Notifies all listeners in this tab and
 * other tabs so visible AI toasts can be dismissed without a reload.
 */
export function setAiMessagesEnabled(enabled: boolean) {
  // setPref refreshes the snapshot and fires PREFERENCES_CHANGED_EVENT
  // synchronously; we forward it as our own event for existing subscribers.
  void setPref(PREF_KEY, enabled);
  window.dispatchEvent(new Event(AI_MESSAGES_CHANGED_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener(AI_MESSAGES_CHANGED_EVENT, handler);
  window.addEventListener(PREFERENCES_CHANGED_EVENT, handler);
  // `storage` fires only in *other* tabs — covers multi-tab sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'dl_ai_messages' || e.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(AI_MESSAGES_CHANGED_EVENT, handler);
    window.removeEventListener(PREFERENCES_CHANGED_EVENT, handler);
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
