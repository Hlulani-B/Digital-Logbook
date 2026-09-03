import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '@/lib/supabase';

// Default inactivity timeout: 30 minutes.
const DEFAULT_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

interface UseInactivityLogoutOptions {
  enabled?: boolean;
  timeoutMs?: number;
}

/**
 * Automatically signs the user out after a period of inactivity.
 *
 * Activity is detected from mouse, keyboard, touch, and scroll events on the
 * window. When the timeout expires, the user is signed out via Supabase and
 * redirected to the sign-in page.
 */
export function useInactivityLogout({
  enabled = true,
  timeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
}: UseInactivityLogoutOptions = {}) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performLogout = useCallback(async () => {
    try {
      await getSupabase().auth.signOut();
    } catch {
      // Best effort: even if the network call fails, redirect so the UI
      // does not appear to stay authenticated.
    }
    navigate('/signin', { replace: true });
  }, [navigate]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void performLogout();
    }, timeoutMs);
  }, [enabled, timeoutMs, performLogout]);

  useEffect(() => {
    if (!enabled) return;

    resetTimer();

    const handleActivity = () => {
      resetTimer();
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer]);
}
