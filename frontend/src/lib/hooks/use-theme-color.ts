import { useMemo } from 'react';
import { useMantineTheme } from '@mantine/core';
import { useThemeStore } from '../store/theme-store';
import { PRIMARY_COLOR } from '../utils/themeColors';

/**
 * Hook to get the current primary theme color
 * Uses store color as source of truth
 * Reactive to theme changes via store
 */
export function useThemeColor(): string {
  const { primaryColor: storeColor, themeVersion } = useThemeStore();

  // Always prioritize store color - it's the source of truth and updates immediately
  // The store is updated first in updateThemeColor, so this will always have the latest value
  // CSS variables are updated for Mantine components, but React components should use the store
  return storeColor || PRIMARY_COLOR;
}

/**
 * Hook to get theme color with a darker shade for gradients
 * Reactive to theme changes
 */
export function useThemeColorShade(shade: number = 8): string {
  const theme = useMantineTheme();
  const { themeVersion } = useThemeStore(); // Subscribe to theme changes
  
  // Re-compute shade when theme changes
  // getThemeColorShade reads from CSS variables, so we need themeVersion to trigger re-render
  return useMemo(() => {
    // Get primary color from theme
    const primaryColor = (theme.other as any)?.primaryColor || PRIMARY_COLOR;
    // For now, return primary color - can be enhanced later with shade calculation
    return primaryColor;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeVersion, shade]); // themeVersion triggers re-render when theme changes
}

