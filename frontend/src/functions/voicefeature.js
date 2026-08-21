import { PROJECT_URL } from "@/lib/api";
import { addNaturalLanguageEntry } from "@/functions/project/natural_language.js";

/**
 * Send recorded audio to the project-service transcription endpoint.
 * Returns the transcribed text.
 * @param {Blob} audioBlob - The recorded audio blob
 * @returns {Promise<string>} The transcribed text
 */
export async function getTranscript(audioBlob) {
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const { data: { session } } = await getSupabase().auth.getSession();
    const token = session?.access_token || "";

    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    const res = await fetch(`${PROJECT_URL}/service/transcribe`, {
      method: "POST",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Transcription failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return data.transcript || "";
  } catch (error) {
    console.error("Error in getTranscript:", error);
    throw error;
  }
}

/**
 * Send transcribed text to the natural language quick-add pipeline.
 * @param {string} text - The transcribed text to add as an entry
 * @returns {Promise<{success: boolean, data?: any, message?: string}>}
 */
export async function quickAdd(text) {
  return await addNaturalLanguageEntry(text);
}
