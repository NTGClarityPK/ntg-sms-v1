import { useEffect, useState } from 'react';
import {
  getBrowserPreferredColorScheme,
  hasSavedColorSchemePreference,
  useColorSchemeStore,
  type ColorSchemeMode,
} from '@/lib/store/color-scheme-store';

/**
 * Hook to manage theme mode (light/dark).
 * Backed by a shared Zustand store so header, settings, and MantineProvider stay in sync.
 * Persists the user's choice in localStorage (`theme`) when they toggle or save.
 */
export function useTheme() {
  const theme = useColorSchemeStore((s) => s.theme);
  const setTheme = useColorSchemeStore((s) => s.setTheme);
  const applyTheme = useColorSchemeStore((s) => s.applyTheme);
  const toggleTheme = useColorSchemeStore((s) => s.toggleTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Re-sync from storage / browser on mount (covers SSR → client) without locking OS preference
    if (!hasSavedColorSchemePreference()) {
      applyTheme(getBrowserPreferredColorScheme());
    }

    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Only follow the OS when the user has not saved a preference
      if (!hasSavedColorSchemePreference()) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleThemeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleThemeChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleThemeChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleThemeChange);
      }
    };
  }, [applyTheme]);

  return {
    theme,
    setTheme: (newTheme: ColorSchemeMode) => setTheme(newTheme),
    toggleTheme,
    isDark: theme === 'dark',
    resolvedTheme: theme,
    mounted,
  };
}
