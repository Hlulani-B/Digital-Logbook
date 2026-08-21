import { addNaturalLanguageEntry } from "@/functions/project/natural_language.js";

/**
 * Create a live speech transcriber using the browser's Web Speech API.
 * Transcription happens entirely in the browser — no backend needed.
 *
 * @returns {{ start: () => void, stop: () => void, getTranscript: () => string, onResult: (cb: (text: string, isFinal: boolean) => void) => void }}
 */
export function createTranscriber() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    throw new Error(
      "Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari."
    );
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let finalTranscript = "";
  let resultCallback = null;

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.transcript[i];
      if (event.results[i].isFinal) {
        finalTranscript += t;
      } else {
        interim += t;
      }
    }
    if (resultCallback) {
      resultCallback(finalTranscript + interim, !!event.results[event.results.length - 1]?.isFinal);
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
  };

  recognition.onend = () => {
    // Recognition ended — final transcript is available via getTranscript()
  };

  return {
    start() {
      finalTranscript = "";
      recognition.start();
    },
    stop() {
      recognition.stop();
    },
    getTranscript() {
      return finalTranscript.trim();
    },
    onResult(cb) {
      resultCallback = cb;
    },
  };
}

/**
 * Convenience: record speech and return the final transcript.
 * Starts recognition, waits for it to end, then resolves with the text.
 * @returns {Promise<string>}
 */
export function getTranscript() {
  return new Promise((resolve, reject) => {
    try {
      const transcriber = createTranscriber();
      transcriber.start();
      // The caller should call stop() — this is mainly for simple one-shot use
      resolve(transcriber);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Send transcribed text to the natural language quick-add pipeline.
 * @param {string} text - The transcribed text to add as an entry
 * @returns {Promise<{success: boolean, data?: any, message?: string}>}
 */
export async function quickAdd(text) {
  return await addNaturalLanguageEntry(text);
}
