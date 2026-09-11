import { request, PROJECT_URL } from '../../lib/api';

/**
 * Submit a natural language entry to the backend.
 *
 * The POST is fire-and-forget — the backend processes the entry and pushes
 * the parsed result via SSE (entry_parsed event) as soon as AI parsing
 * finishes. The useSSEEntries hook handles the actual data update.
 *
 * We use a short timeout so the UI spinner clears quickly. The real data
 * arrives via SSE within seconds of the AI finishing.
 */
export async function addNaturalLanguageEntry(text) {
  try {
    // Fire the POST but don't wait for the full response.
    // The backend will process and push results via SSE.
    const data = await request(`${PROJECT_URL}/service/natural-language-entry`, {
      method: 'POST',
      body: JSON.stringify({ text }),
      timeoutMs: 15_000, // 15s — enough for cold start + request receipt
    });

    // If we got a response, check it
    if (data?.success === false) {
      return { success: false, message: data.message || 'Failed to create entry' };
    }

    return { success: true, data };
  } catch (error) {
    // Timeout or network error — the server may still be processing.
    // SSE will deliver the result if the backend succeeds.
    console.warn('[addNaturalLanguageEntry] POST did not complete:', error.message);
    return { success: true, data: {}, pending: true };
  }
}
