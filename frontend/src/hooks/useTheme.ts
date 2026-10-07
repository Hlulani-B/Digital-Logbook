import { useState, useEffect, useCallback, useMemo } from 'react';
import { getPref, setPref, PREFERENCES_CHANGED_EVENT } from '@/functions/preferences';

export type Theme =
  | 'light'
  | 'dark'
  | 'pink'
  | 'blue'
  | 'purple'
  | 'green'
  | 'brown'
  | 'navy'
  | 'darkpurple'
  | 'coffee'
  | 'oled'
  | 'teal'
  | 'solarized'
  | 'darkpink';

const VALID_THEMES: Theme[] = [
  'light',
  'dark',
  'pink',
  'blue',
  'purple',
  'green',
  'brown',
  'navy',
  'darkpurple',
  'coffee',
  'oled',
  'teal',
  'solarized',
  'darkpink',
];
const PREF_KEY = 'theme';

function asTheme(value: unknown): Theme | null {
  return VALID_THEMES.includes(value as Theme) ? (value as Theme) : null;
}

function getInitialTheme(): Theme {
  return asTheme(getPref(PREF_KEY)) ?? 'light';
}

function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Re-read when the active user's preference row finishes loading (login,
  // session restore) or changes elsewhere, so the applied theme always matches
  // the logged-in account rather than whoever last used this browser.
  useEffect(() => {
    const sync = () => setThemeState(getInitialTheme());
    window.addEventListener(PREFERENCES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, sync);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    void setPref(PREF_KEY, newTheme);
    applyTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const isDark =
    theme === 'dark' ||
    theme === 'navy' ||
    theme === 'darkpurple' ||
    theme === 'coffee' ||
    theme === 'oled' ||
    theme === 'teal' ||
    theme === 'solarized' ||
    theme === 'darkpink';

  return useMemo(
    () => ({ theme, setTheme, toggleTheme, isDark }),
    [theme, setTheme, toggleTheme, isDark]
  );
}
