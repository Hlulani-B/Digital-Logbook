/**
 * Tone preference — how the notebook "talks" to the user.
 *
 * Stored in localStorage under key `dl_tone`.
 * Values: "soft" (default) | "tough" | "cynical"
 */

export type Tone = "soft" | "tough" | "cynical";

const TONE_KEY = "dl_tone";

/**
 * Get the user's current tone preference.
 */
export function getTone(): Tone {
  try {
    const val = localStorage.getItem(TONE_KEY);
    if (val === "tough" || val === "cynical" || val === "soft") return val;
  } catch {
    // ignore
  }
  return "soft";
}

/**
 * Set the user's tone preference.
 */
export function setTone(tone: Tone) {
  localStorage.setItem(TONE_KEY, tone);
}

/**
 * Returns a tone instruction string to append to AI prompts.
 * This shapes how the notebook "talks" to the user.
 */
export function getToneInstruction(): string {
  const tone = getTone();
  switch (tone) {
    case "tough":
      return "Be direct, no-nonsense, and slightly tough-love. Push the user to do better. Don't sugarcoat. Keep it real and accountable.";
    case "cynical":
      return "Be casual, witty, and slightly cynical/sarcastic. Like a friend who roasts you but still has your back. Keep it light and humorous.";
    case "soft":
    default:
      return "Be warm, gentle, and encouraging. Speak like a caring friend who believes in the user. Keep it soft and supportive.";
  }
}

/**
 * Tone option metadata for the UI selector.
 */
export const TONE_OPTIONS: { value: Tone; label: string; description: string; emoji: string }[] = [
  {
    value: "soft",
    label: "Soft & Encouraging",
    description: "Warm, gentle, believes in you. Like a supportive friend.",
    emoji: "🌿",
  },
  {
    value: "tough",
    label: "Tough Love",
    description: "Direct, no sugarcoating. Pushes you to be better.",
    emoji: "🔥",
  },
  {
    value: "cynical",
    label: "Casual & Cynical",
    description: "Witty, slightly sarcastic. Roasts you but has your back.",
    emoji: "😏",
  },
];
