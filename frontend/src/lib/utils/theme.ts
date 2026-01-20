/**
 * Default theme color constant
 */
export const DEFAULT_THEME_COLOR = '#4caf50';

/**
 * Get the current theme color from CSS custom properties
 * Falls back to default if not set
 */
export function getThemeColor(): string {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME_COLOR;
  }

  // Try to get from CSS custom property
  const cssColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-primary')
    .trim();

  if (cssColor) {
    return cssColor;
  }

  // Fallback to localStorage
  const storedColor = localStorage.getItem('theme-primary-color');
  if (storedColor) {
    return storedColor;
  }

  // Final fallback to default
  return DEFAULT_THEME_COLOR;
}

/**
 * Get theme color with darker shade for gradients
 * @param shade - Shade level (0-9, where 6 is base, 7-9 are darker)
 */
export function getThemeColorShade(shade: number = 8): string {
  const color = getThemeColor();
  
  // If shade is 6, return base color
  if (shade === 6) return color;
  
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  
  // Calculate shade based on Mantine's shade system
  // Shades 0-5: lighter (more white)
  // Shades 7-9: darker (more black)
  if (shade < 6) {
    // Lighten: mix with white
    const factor = (6 - shade) / 6;
    return mixColors(color, '#ffffff', factor * 0.9);
  } else {
    // Darken: mix with black
    const factor = (shade - 6) / 3;
    return mixColors(color, '#000000', factor * 0.4);
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Mix two colors
 * @param color1 - First color (hex)
 * @param color2 - Second color (hex)
 * @param weight - Weight of color2 (0-1)
 */
function mixColors(color1: string, color2: string, weight: number = 0.5): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return color1;

  const w = Math.max(0, Math.min(1, weight));
  const r = Math.round(rgb1.r * (1 - w) + rgb2.r * w);
  const g = Math.round(rgb1.g * (1 - w) + rgb2.g * w);
  const b = Math.round(rgb1.b * (1 - w) + rgb2.b * w);

  return rgbToHex(r, g, b);
}

/**
 * Get success color (lighter/green-tinted version of theme)
 */
export function getSuccessColor(): string {
  const themeColor = getThemeColor();
  // Mix with green to create success color
  return mixColors(themeColor, '#4caf50', 0.3);
}

/**
 * Get error color (red-tinted version)
 */
export function getErrorColor(): string {
  const themeColor = getThemeColor();
  // Mix with red to create error color
  return mixColors(themeColor, '#f44336', 0.4);
}

/**
 * Get warning color (orange/yellow-tinted version)
 */
export function getWarningColor(): string {
  const themeColor = getThemeColor();
  // Mix with orange to create warning color
  return mixColors(themeColor, '#ff9800', 0.3);
}

/**
 * Get info color (theme color itself)
 */
export function getInfoColor(): string {
  return getThemeColor();
}

/**
 * Get theme color from localStorage (legacy support)
 */
export function getLegacyThemeColor(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('theme-primary-color');
  }
  return null;
}

