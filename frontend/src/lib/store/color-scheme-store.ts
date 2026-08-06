import { create } from 'zustand';

export type ColorSchemeMode = 'light' | 'dark';

const STORAGE_KEY = 'theme';

interface ColorSchemeStore {
  theme: ColorSchemeMode;
  /** Apply and persist (user chose light/dark). */
  setTheme: (theme: ColorSchemeMode) => void;
  /** Apply without persisting (follow OS / hydrate). */
  applyTheme: (theme: ColorSchemeMode) => void;
  toggleTheme: () => void;
}

const readStoredTheme = (): ColorSchemeMode | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Non-blocking (private mode / blocked storage)
  }
  return null;
};

const readBrowserTheme = (): ColorSchemeMode => {
  if (typeof window === 'undefined') return 'light';
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Non-blocking
  }
  return 'light';
};

const getInitialTheme = (): ColorSchemeMode => {
  return readStoredTheme() ?? readBrowserTheme();
};

const persistTheme = (theme: ColorSchemeMode) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Non-blocking
  }
};

export const useColorSchemeStore = create<ColorSchemeStore>((set, get) => ({
  theme: typeof window !== 'undefined' ? getInitialTheme() : 'light',
  applyTheme: (theme) => {
    set({ theme });
  },
  setTheme: (theme) => {
    set({ theme });
    persistTheme(theme);
  },
  toggleTheme: () => {
    const next: ColorSchemeMode = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },
}));

/** Used by system-preference listeners when the user has not saved a choice. */
export function hasSavedColorSchemePreference(): boolean {
  return readStoredTheme() !== null;
}

export function getBrowserPreferredColorScheme(): ColorSchemeMode {
  return readBrowserTheme();
}
