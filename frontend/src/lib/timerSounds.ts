/**
 * Timer sound notifications using Web Audio API.
 * Provides subtle audio feedback for timer actions.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      // Web Audio API not supported
      return null;
    }
  }
  return audioContext;
}

function playTone(
  frequency: number,
  duration: number,
  volume: number = 0.1,
  type: OscillatorType = 'sine'
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;
  gainNode.gain.value = volume;

  oscillator.start();

  // Fade out to avoid click
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

  setTimeout(() => {
    oscillator.stop();
  }, duration);
}

/**
 * Play a short beep for timer start
 */
export function playStartSound() {
  playTone(600, 150, 0.08);
}

/**
 * Play a two-tone beep for timer stop
 */
export function playStopSound() {
  playTone(500, 100, 0.1);
  setTimeout(() => playTone(400, 150, 0.1), 100);
}

/**
 * Play a single beep for pause/resume
 */
export function playPauseSound() {
  playTone(450, 100, 0.08);
}

/**
 * Play a three-tone ascending beep for countdown complete
 */
export function playCompleteSound() {
  playTone(600, 150, 0.12);
  setTimeout(() => playTone(800, 150, 0.12), 150);
  setTimeout(() => playTone(1000, 200, 0.12), 300);
}

/**
 * Play a subtle warning beep for 5-minute warning
 */
export function playWarningSound() {
  playTone(700, 100, 0.06);
  setTimeout(() => playTone(700, 100, 0.06), 150);
}
