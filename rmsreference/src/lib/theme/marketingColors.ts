/**
 * Marketing Website Color Configuration
 * 
 * This file controls all colors used across the marketing website.
 * Change PRIMARY_COLOR and SECONDARY_COLOR to update the entire color scheme.
 */

// ============================================
// CHANGE THESE TWO COLORS TO UPDATE EVERYTHING
// ============================================
const PRIMARY_COLOR = '#e74c3c';    // ← Change this
const SECONDARY_COLOR = '#c0392b';  // ← Change this

// ============================================
// Utility Functions (Don't modify)
// ============================================

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

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function lighten(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * percent));
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * percent));
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * percent));
  return rgbToHex(r, g, b);
}

function darken(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.round(rgb.r * (1 - percent)));
  const g = Math.max(0, Math.round(rgb.g * (1 - percent)));
  const b = Math.max(0, Math.round(rgb.b * (1 - percent)));
  return rgbToHex(r, g, b);
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Calculate relative luminance (for contrast calculation)
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  
  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Determine if text should be light or dark based on background
 */
function getContrastText(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor);
  // If background is dark (luminance < 0.5), use light text, otherwise dark text
  return luminance < 0.5 ? '#ffffff' : '#1a1a1a';
}

/**
 * Mix two colors together
 */
function mixColors(color1: string, color2: string, weight: number = 0.5): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return color1;
  
  const r = Math.round(rgb1.r * (1 - weight) + rgb2.r * weight);
  const g = Math.round(rgb1.g * (1 - weight) + rgb2.g * weight);
  const b = Math.round(rgb1.b * (1 - weight) + rgb2.b * weight);
  
  return rgbToHex(r, g, b);
}

// ============================================
// Auto-Generated Colors (Updates automatically)
// ============================================

// Calculate base text colors from primary color (darker shades for readability)
const baseTextDark = darken(PRIMARY_COLOR, 0.7);
const baseTextMedium = darken(PRIMARY_COLOR, 0.5);
const baseTextLight = darken(PRIMARY_COLOR, 0.3);

// Calculate background colors as very light tints
const bgPrimary = lighten(PRIMARY_COLOR, 0.95);
const bgSecondary = lighten(mixColors(PRIMARY_COLOR, SECONDARY_COLOR, 0.5), 0.92);
const bgTertiary = lighten(mixColors(PRIMARY_COLOR, SECONDARY_COLOR, 0.3), 0.9);

// Calculate text colors for buttons (contrast-based)
const textOnPrimary = getContrastText(PRIMARY_COLOR);
const textOnSecondary = getContrastText(SECONDARY_COLOR);
const ctaTextColor = getContrastText(PRIMARY_COLOR);
const ctaTextSecondaryColor = hexToRgba(ctaTextColor === '#ffffff' ? '#ffffff' : '#1a1a1a', 0.9);

// Calculate button colors
const ctaButtonPrimaryBg = textOnPrimary === '#ffffff' ? '#ffffff' : '#1a1a1a';
const ctaButtonPrimaryText = PRIMARY_COLOR;
const ctaButtonSecondaryBg = hexToRgba(textOnPrimary === '#ffffff' ? '#ffffff' : '#1a1a1a', 0.2);
const ctaButtonSecondaryText = textOnPrimary === '#ffffff' ? '#ffffff' : '#1a1a1a';
const ctaButtonSecondaryBorder = hexToRgba(textOnPrimary === '#ffffff' ? '#ffffff' : '#1a1a1a', 0.5);

export const marketingColors = {
  // Primary Color Palette (auto-generated from PRIMARY_COLOR)
  primary: PRIMARY_COLOR,
  primaryDark: darken(PRIMARY_COLOR, 0.15),
  primaryDarker: darken(PRIMARY_COLOR, 0.3),
  primaryLight: lighten(PRIMARY_COLOR, 0.15),
  primaryLighter: lighten(PRIMARY_COLOR, 0.3),
  primaryLightest: lighten(PRIMARY_COLOR, 0.5),
  primaryUltraLight: lighten(PRIMARY_COLOR, 0.7),
  primaryBackground: lighten(PRIMARY_COLOR, 0.85),

  // Secondary Color Palette (auto-generated from SECONDARY_COLOR)
  secondary: SECONDARY_COLOR,
  secondaryDark: darken(SECONDARY_COLOR, 0.15),
  secondaryDarker: darken(SECONDARY_COLOR, 0.3),
  secondaryLight: lighten(SECONDARY_COLOR, 0.15),
  secondaryLighter: lighten(SECONDARY_COLOR, 0.3),
  secondaryLightest: lighten(SECONDARY_COLOR, 0.5),
  secondaryUltraLight: lighten(SECONDARY_COLOR, 0.7),
  secondaryBackground: lighten(SECONDARY_COLOR, 0.85),

  // Text Colors (auto-generated from primary color)
  textPrimary: baseTextDark,
  textSecondary: baseTextMedium,
  textTertiary: baseTextLight,
  textOnPrimary: textOnPrimary,
  textOnSecondary: textOnSecondary,

  // Background Colors (auto-generated as light tints)
  backgroundPrimary: bgPrimary,
  backgroundSecondary: bgSecondary,
  backgroundTertiary: bgTertiary,

  // Border Colors (auto-generated with opacity)
  borderPrimary: hexToRgba(PRIMARY_COLOR, 0.2),
  borderSecondary: hexToRgba(SECONDARY_COLOR, 0.2),
  borderHover: hexToRgba(PRIMARY_COLOR, 0.5),
  borderSecondaryHover: hexToRgba(SECONDARY_COLOR, 0.5),

  // Shadow Colors (auto-generated with opacity)
  shadowPrimary: hexToRgba(PRIMARY_COLOR, 0.4),
  shadowPrimaryHover: hexToRgba(PRIMARY_COLOR, 0.5),
  shadowSecondary: hexToRgba(SECONDARY_COLOR, 0.2),
  shadowSecondaryHover: hexToRgba(SECONDARY_COLOR, 0.3),
  shadowCard: hexToRgba(PRIMARY_COLOR, 0.1),
  shadowCardHover: hexToRgba(PRIMARY_COLOR, 0.2),

  // Gradient Colors (auto-generated)
  gradientPrimary: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${darken(PRIMARY_COLOR, 0.15)} 100%)`,
  gradientPrimaryToSecondary: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${SECONDARY_COLOR} 100%)`,
  gradientSecondary: `linear-gradient(135deg, ${SECONDARY_COLOR} 0%, ${darken(SECONDARY_COLOR, 0.15)} 100%)`,
  gradientBackgroundPrimary: `linear-gradient(135deg, ${hexToRgba(PRIMARY_COLOR, 0.15)} 0%, ${hexToRgba(SECONDARY_COLOR, 0.15)} 100%)`,
  gradientBackgroundSecondary: `linear-gradient(135deg, ${hexToRgba(SECONDARY_COLOR, 0.15)} 0%, ${hexToRgba(PRIMARY_COLOR, 0.15)} 100%)`,
  gradientBackgroundLight: `linear-gradient(135deg, ${hexToRgba(PRIMARY_COLOR, 0.08)} 0%, ${hexToRgba(SECONDARY_COLOR, 0.08)} 100%)`,
  gradientCard: `linear-gradient(135deg, ${bgPrimary} 0%, ${bgSecondary} 100%)`,

  // CTA Section (auto-generated)
  ctaBackground: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${darken(PRIMARY_COLOR, 0.15)} 100%)`,
  ctaText: ctaTextColor,
  ctaTextSecondary: ctaTextSecondaryColor,
  ctaButtonPrimary: ctaButtonPrimaryBg,
  ctaButtonPrimaryText: ctaButtonPrimaryText,
  ctaButtonSecondary: ctaButtonSecondaryBg,
  ctaButtonSecondaryText: ctaButtonSecondaryText,
  ctaButtonSecondaryBorder: ctaButtonSecondaryBorder,
  ctaShadow: hexToRgba(PRIMARY_COLOR, 0.4),
};
