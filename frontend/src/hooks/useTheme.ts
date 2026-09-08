import { useState, useEffect, useCallback, useMemo } from 'react';

export type Theme = 'light' | 'dark' | 'pink' | 'blue' | 'purple' | 'green' | 'brown' | 'navy' | 'darkpurple' | 'coffee' | 'oled' | 'teal' | 'solarized' | 'darkpink';

const VALID_THEMES: Theme[] = ['light', 'dark', 'pink', 'blue', 'purple', 'green', 'brown', 'navy', 'darkpurple', 'coffee', 'oled', 'teal', 'solarized', 'darkpink'];
const STORAGE_KEY = 'dl_theme';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_THEMES.includes(stored as Theme)) return stored as Theme;
  } catch {}
  return 'light';
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

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const isDark = theme === 'dark' || theme === 'navy' || theme === 'darkpurple' || theme === 'coffee' || theme === 'oled' || theme === 'teal' || theme === 'solarized' || theme === 'darkpink';

  return useMemo(
    () => ({ theme, setTheme, toggleTheme, isDark }),
    [theme, setTheme, toggleTheme, isDark]
  );
}
