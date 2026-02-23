import { useMemo } from 'react';
import { useTheme } from './use-theme';
import { marketingColors as baseMarketingColors } from '../theme/marketingColors';

/**
 * Hook that provides theme-aware marketing colors
 * Returns colors that adapt to light/dark mode
 */
export function useMarketingColors() {
  const { isDark } = useTheme();

  return useMemo(() => {
    if (!isDark) {
      // Light mode - return original colors
      return baseMarketingColors;
    }

    // Dark mode - return adjusted colors
    return {
      ...baseMarketingColors,
      // Background colors - dark in dark mode
      backgroundPrimary: '#25262b',
      backgroundSecondary: '#2c2e33',
      backgroundTertiary: '#373a40',
      primaryBackground: '#2c2e33',
      secondaryBackground: '#373a40',
      
      // Card gradient - dark in dark mode
      gradientCard: 'linear-gradient(135deg, #25262b 0%, #2c2e33 100%)',
      
      // Text colors - light in dark mode
      textPrimary: '#c1c2c5',
      textSecondary: '#909296',
      textTertiary: '#5c5f66',
      
      // Border colors - adjusted for dark mode
      borderPrimary: 'rgba(255, 255, 255, 0.1)',
      borderSecondary: 'rgba(255, 255, 255, 0.1)',
      borderHover: 'rgba(255, 255, 255, 0.2)',
      borderSecondaryHover: 'rgba(255, 255, 255, 0.2)',
      
      // Shadow colors - adjusted for dark mode
      shadowCard: 'rgba(0, 0, 0, 0.3)',
      shadowCardHover: 'rgba(0, 0, 0, 0.5)',
    };
  }, [isDark]);
}
