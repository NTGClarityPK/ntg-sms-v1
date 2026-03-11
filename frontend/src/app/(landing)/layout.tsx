'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { marketingColors } from '@/lib/theme/marketingColors';

// Add global styles for CTA section white text and override Mantine defaults
function addCTAStyles() {
  if (typeof document === 'undefined') return;
  
  // Remove existing style to force re-application
  const existingStyle = document.getElementById('cta-white-text-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  const primaryColor = marketingColors.primary;
  const primaryDark = marketingColors.primaryDark;
  const textOnPrimary = marketingColors.textOnPrimary;
  
  const style = document.createElement('style');
  style.id = 'cta-white-text-styles';
  style.textContent = `
    .cta-white-text,
    .cta-white-text .mantine-Title-root,
    .cta-white-text .mantine-Text-root,
    .cta-white-text h1,
    .cta-white-text h2,
    .cta-white-text h3,
    .cta-white-text h4,
    .cta-white-text h5,
    .cta-white-text h6,
    .cta-white-text p,
    .cta-white-text span {
      color: #ffffff !important;
    }
    [data-mantine-color-scheme="light"] .cta-white-text,
    [data-mantine-color-scheme="light"] .cta-white-text .mantine-Title-root,
    [data-mantine-color-scheme="light"] .cta-white-text .mantine-Text-root,
    [data-mantine-color-scheme="light"] .cta-white-text h1,
    [data-mantine-color-scheme="light"] .cta-white-text h2,
    [data-mantine-color-scheme="light"] .cta-white-text h3,
    [data-mantine-color-scheme="light"] .cta-white-text p,
    [data-mantine-color-scheme="light"] .cta-white-text span {
      color: #ffffff !important;
    }
    [data-mantine-color-scheme="dark"] .cta-white-text,
    [data-mantine-color-scheme="dark"] .cta-white-text .mantine-Title-root,
    [data-mantine-color-scheme="dark"] .cta-white-text .mantine-Text-root,
    [data-mantine-color-scheme="dark"] .cta-white-text h1,
    [data-mantine-color-scheme="dark"] .cta-white-text h2,
    [data-mantine-color-scheme="dark"] .cta-white-text h3,
    [data-mantine-color-scheme="dark"] .cta-white-text h4,
    [data-mantine-color-scheme="dark"] .cta-white-text h5,
    [data-mantine-color-scheme="dark"] .cta-white-text h6,
    [data-mantine-color-scheme="dark"] .cta-white-text p,
    [data-mantine-color-scheme="dark"] .cta-white-text span {
      color: #ffffff !important;
    }
    /* Exclude buttons from white text rule - let them use their own colors */
    .cta-white-text .mantine-Button-root,
    .cta-white-text button,
    .cta-white-text .mantine-Button-root * {
      color: unset !important;
    }
    /* Force primary color for features page title */
    .features-page-title,
    .features-page-title h1 {
      color: var(--marketing-primary-color) !important;
    }
    /* Override Mantine default blue colors for Avatar - apply to ALL avatars */
    .mantine-Avatar-root,
    .mantine-Avatar-root[data-mantine-color-scheme],
    [data-mantine-color-scheme] .mantine-Avatar-root {
      background-color: ${primaryColor} !important;
      color: ${textOnPrimary} !important;
    }
    /* Override Mantine default blue colors for Button - simple override */
    .mantine-Button-root:not([data-no-color-override]) {
      --_button-bg: ${primaryColor} !important;
      --_button-hover: ${primaryDark} !important;
      --_button-color: ${textOnPrimary} !important;
    }
    /* Override any blue background colors */
    .mantine-Button-root:not([data-no-color-override])[style*="background-color: rgb(37, 99, 235)"],
    .mantine-Button-root:not([data-no-color-override])[style*="background-color: rgb(59, 130, 246)"],
    .mantine-Button-root:not([data-no-color-override])[style*="background-color: rgb(29, 78, 216)"] {
      background-color: ${primaryColor} !important;
      color: ${textOnPrimary} !important;
    }
    /* Override any blue color variables at root level */
    :root {
      --mantine-color-blue-0: ${primaryColor} !important;
      --mantine-color-blue-1: ${primaryColor} !important;
      --mantine-color-blue-2: ${primaryColor} !important;
      --mantine-color-blue-3: ${primaryColor} !important;
      --mantine-color-blue-4: ${primaryColor} !important;
      --mantine-color-blue-5: ${primaryColor} !important;
      --mantine-color-blue-6: ${primaryColor} !important;
      --mantine-color-blue-7: ${primaryColor} !important;
      --mantine-color-blue-8: ${primaryColor} !important;
      --mantine-color-blue-9: ${primaryDark} !important;
    }
    html {
      --mantine-color-blue-0: ${primaryColor} !important;
      --mantine-color-blue-1: ${primaryColor} !important;
      --mantine-color-blue-2: ${primaryColor} !important;
      --mantine-color-blue-3: ${primaryColor} !important;
      --mantine-color-blue-4: ${primaryColor} !important;
      --mantine-color-blue-5: ${primaryColor} !important;
      --mantine-color-blue-6: ${primaryColor} !important;
      --mantine-color-blue-7: ${primaryColor} !important;
      --mantine-color-blue-8: ${primaryColor} !important;
      --mantine-color-blue-9: ${primaryDark} !important;
    }
  `;
  // Insert at the beginning for highest priority
  document.head.insertBefore(style, document.head.firstChild);
}

// Helper function to generate Mantine color array from base color
function generateColorArray(baseColor: string): readonly [string, string, string, string, string, string, string, string, string, string] {
  // Convert hex to RGB
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Generate shades (Mantine expects 10 shades)
  const shades: string[] = [];
  for (let i = 0; i < 10; i++) {
    const factor = i / 9; // 0 to 1
    const newR = Math.round(r + (255 - r) * (1 - factor) * 0.9);
    const newG = Math.round(g + (255 - g) * (1 - factor) * 0.9);
    const newB = Math.round(b + (255 - b) * (1 - factor) * 0.9);
    shades.push(`#${[newR, newG, newB].map(x => x.toString(16).padStart(2, '0')).join('')}`);
  }
  // Set index 5 (primary) to the exact base color
  shades[5] = baseColor;
  // Ensure we have exactly 10 elements and return as tuple
  return [
    shades[0], shades[1], shades[2], shades[3], shades[4],
    shades[5], shades[6], shades[7], shades[8], shades[9]
  ] as const;
}

const marketingTheme = createTheme({
  fontFamily: 'var(--font-primary), Arial, sans-serif',
  headings: {
    fontFamily: 'var(--font-audiowide), Arial, sans-serif',
  },
  primaryColor: 'primary',
  colors: {
    primary: generateColorArray(marketingColors.primary),
    secondary: generateColorArray(marketingColors.secondary),
  },
  defaultRadius: 'md',
  components: {
    Button: {
      defaultProps: {
        color: 'primary',
      },
      styles: {
        root: {
          // Let individual buttons override via styles prop
        },
      },
    },
    Avatar: {
      defaultProps: {
        color: 'primary',
      },
      styles: {
        root: {
          backgroundColor: `${marketingColors.primary} !important`,
          color: `${marketingColors.textOnPrimary} !important`,
        },
      },
    },
  },
});

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  useEffect(() => {
    // Apply styles immediately
    addCTAStyles();
    
    // Set CSS variables for primary color and override Mantine defaults
    const applyColorOverrides = () => {
      if (typeof document === 'undefined') return;
      
      const root = document.documentElement;
      
      // Set marketing color variables
      root.style.setProperty('--marketing-primary-color', marketingColors.primary);
      root.style.setProperty('--marketing-primary-dark', marketingColors.primaryDark);
      root.style.setProperty('--marketing-text-on-primary', marketingColors.textOnPrimary);
      
      // Override ALL Mantine blue color variables
      for (let i = 0; i <= 9; i++) {
        const value = i === 9 ? marketingColors.primaryDark : marketingColors.primary;
        root.style.setProperty(`--mantine-color-blue-${i}`, value);
      }
      
      // Directly set styles on buttons and avatars - force primary color
      const buttons = document.querySelectorAll('.mantine-Button-root:not([data-no-color-override]):not([data-custom-bg])');
      buttons.forEach((button) => {
        const element = button as HTMLElement;
        // Always set primary color - CSS will handle the override priority
        element.style.setProperty('background-color', marketingColors.primary, 'important');
        element.style.setProperty('color', marketingColors.textOnPrimary, 'important');
      });
      
      // Always override avatars - they should always use primary color
      const avatars = document.querySelectorAll('.mantine-Avatar-root');
      avatars.forEach((avatar) => {
        const element = avatar as HTMLElement;
        // Only override if it doesn't have a custom color attribute
        if (!element.hasAttribute('data-custom-color')) {
          element.style.setProperty('background-color', marketingColors.primary, 'important');
          element.style.setProperty('color', marketingColors.textOnPrimary, 'important');
        }
      });
    };
    
    applyColorOverrides();
    
    // Re-apply after a short delay to ensure Mantine has rendered
    const timeoutId = setTimeout(() => {
      applyColorOverrides();
      addCTAStyles();
    }, 100);
    
    // Watch for DOM changes and re-apply styles when Mantine components are added
    let observer: MutationObserver | null = null;
    if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver((mutations) => {
        let shouldReapply = false;
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (
                element.classList?.contains('mantine-Button-root') ||
                element.classList?.contains('mantine-Avatar-root') ||
                element.querySelector?.('.mantine-Button-root') ||
                element.querySelector?.('.mantine-Avatar-root')
              ) {
                shouldReapply = true;
              }
            }
          });
        });
        
        if (shouldReapply) {
          setTimeout(() => {
            applyColorOverrides();
            addCTAStyles();
            // Also directly apply styles to newly added elements
            const newButtons = document.querySelectorAll('.mantine-Button-root:not([data-no-color-override])');
            newButtons.forEach((button) => {
              const element = button as HTMLElement;
              if (!element.hasAttribute('data-custom-bg')) {
                element.style.setProperty('background-color', marketingColors.primary, 'important');
                element.style.setProperty('color', marketingColors.textOnPrimary, 'important');
              }
            });
            const newAvatars = document.querySelectorAll('.mantine-Avatar-root');
            newAvatars.forEach((avatar) => {
              const element = avatar as HTMLElement;
              if (!element.hasAttribute('data-custom-color')) {
                element.style.setProperty('background-color', marketingColors.primary, 'important');
                element.style.setProperty('color', marketingColors.textOnPrimary, 'important');
              }
            });
          }, 50);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
    
    return () => {
      clearTimeout(timeoutId);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [pathname]); // Re-run on pathname change

  return (
    <MantineProvider theme={marketingTheme} defaultColorScheme="light">
      {children}
    </MantineProvider>
  );
}

