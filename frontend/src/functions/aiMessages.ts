/**
 * AI Messages preference — controls whether AI-generated toasts and popups are shown.
 *
 * Stored in localStorage under key `dl_ai_messages`.
 * Default: true (AI messages enabled).
 */

const AI_MESSAGES_KEY = 'dl_ai_messages';

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
 * Set whether AI messages are enabled.
 */
export function setAiMessagesEnabled(enabled: boolean) {
  localStorage.setItem(AI_MESSAGES_KEY, String(enabled));
}
