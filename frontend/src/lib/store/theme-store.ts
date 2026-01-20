import { create } from 'zustand';
import { PRIMARY_COLOR } from '../utils/themeColors';

interface ThemeStore {
  primaryColor: string;
  themeVersion: number; // Increment to force re-renders
  setPrimaryColor: (color: string) => void;
}

// Initialize from localStorage if available to prevent blue flash
const getInitialColor = (): string => {
  if (typeof window === 'undefined') return PRIMARY_COLOR;
  const stored = localStorage.getItem('theme-primary-color');
  return stored || PRIMARY_COLOR;
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  primaryColor: getInitialColor(),
  themeVersion: 0,
  setPrimaryColor: (color: string) => {
    set((state) => ({ 
      primaryColor: color, 
      themeVersion: state.themeVersion + 1 
    }));
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme-primary-color', color);
    }
    // Dispatch custom event for non-React code
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('theme-change', { detail: { color } }));
    }
  },
}));

