import { useState, useEffect } from 'react';

/**
 * Returns a `now` timestamp (ms) that ticks every `intervalMs` milliseconds.
 *
 * Pass `enabled = false` to pause ticking — the hook stops the interval so the
 * component does not re-render unnecessarily (e.g. when no in-progress entries exist).
 * When `enabled` flips back to true, the timestamp refreshes immediately.
 *
 * @param intervalMs how often to refresh (default 1000ms = 1s)
 * @param enabled whether ticking is active (default true)
 */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    // Refresh immediately so the first tick after enabling is current.
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  return now;
}

export default useNow;
