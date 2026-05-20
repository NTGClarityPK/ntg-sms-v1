'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useMantineTheme } from '@mantine/core';
import { useThemeStore } from '@/lib/store/theme-store';
import { useTheme } from '@/lib/hooks/use-theme';
import { generateThemeConfig } from '@/lib/theme/themeConfig';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import { isAuthPathname } from '@/lib/utils/auth-pathname';

/**
 * Provider that applies theme styles to all components
 * 
 * Strategy:
 * 1. CSS Variables for components that can use them
 * 2. CSS Injection with !important for components using CSS classes (Navbar, Header)
 * 3. Direct DOM manipulation for components with inline style overrides (mantine-datatable)
 */
export function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useMantineTheme();
  const { primaryColor: storeColor, themeVersion } = useThemeStore();
  const { isDark } = useTheme();
  
  // Public auth routes: never apply portal-wide !important overrides (see cleanup effect below).
  const isAuthPage = isAuthPathname(pathname);

  // After SPA navigation from the app, `#mantine-theme-override` can still contain rules like
  // `.mantine-Text-root { color: … !important }` which override `c="white"` on the auth hero.
  // Full page load on /login never injects those rules; this matches that behaviour.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isAuthPage) return;

    const styleElement = document.getElementById('mantine-theme-override');
    if (styleElement) {
      styleElement.textContent = '';
    }
    document.body.style.removeProperty('background-color');
    document.body.style.removeProperty('color');
    document.body.style.removeProperty('font-family');
  }, [isAuthPage]);
  
  // Get theme config from Mantine theme as fallback
  const mantineThemeConfig = (theme.other as any) as ThemeConfig | undefined;
  
  // Generate reactive theme config from store color - this updates immediately when theme changes
  const themeConfig = useMemo(() => {
    if (storeColor) {
      return generateThemeConfig(storeColor, isDark);
    }
    return mantineThemeConfig;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeColor, isDark, themeVersion, mantineThemeConfig]);

  // Set dir and lang attributes on html element for RTL support (if needed in future)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    // Future: Add RTL support when language system is implemented
    // const html = document.documentElement;
    // const dir = language === 'ar' ? 'rtl' : 'ltr';
    // const lang = language === 'ar' ? 'ar' : 'en';
    // html.setAttribute('dir', dir);
    // html.setAttribute('lang', lang);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || !themeConfig) return;
    // Skip theme application on auth pages
    if (isAuthPage) return;

    const config = themeConfig;

    // 1. Set CSS Variables for maximum compatibility
    const root = document.documentElement;
    
    // Primary colors
    root.style.setProperty('--theme-primary', config.colors.primary);
    root.style.setProperty('--theme-primary-light', config.colors.primaryLight);
    root.style.setProperty('--theme-primary-dark', config.colors.primaryDark);
    
    // Background colors
    root.style.setProperty('--theme-background', config.colors.background);
    root.style.setProperty('--theme-surface', config.colors.surface);
    root.style.setProperty('--theme-surface-variant', config.colors.surfaceVariant);
    
    // Text colors
    root.style.setProperty('--theme-text', config.colors.text);
    root.style.setProperty('--theme-text-secondary', config.colors.textSecondary);
    root.style.setProperty('--theme-text-muted', config.colors.textMuted);
    
    // Border colors
    root.style.setProperty('--theme-border', config.colors.border);
    root.style.setProperty('--theme-border-light', config.colors.borderLight);
    
    // Component-specific CSS variables
    root.style.setProperty('--theme-navbar-bg', config.components.navbar.backgroundColor);
    root.style.setProperty('--theme-header-bg', config.components.header.backgroundColor);
    root.style.setProperty('--theme-card-bg', config.components.card.backgroundColor);
    root.style.setProperty('--theme-table-bg', config.components.table.backgroundColor);
    root.style.setProperty('--theme-table-header-bg', config.components.table.headerBackground);
    
    // Badge color generation base colors
    const badgeConfig = isDark ? config.components.badge.darkTheme : config.components.badge.lightTheme;
    root.style.setProperty('--theme-badge-bg-base', badgeConfig.backgroundBase);
    root.style.setProperty('--theme-badge-text-base', badgeConfig.textBase);
    root.style.setProperty('--theme-badge-variation-count', String(config.components.badge.variationCount ?? 10));
    root.style.setProperty('--theme-badge-filled-success-text', config.components.badge.filledSuccessTextColor);
    
    // Avatar colors
    root.style.setProperty('--theme-avatar-bg', config.components.avatar.backgroundColor);
    root.style.setProperty('--theme-avatar-text', config.components.avatar.textColor);

    // Status inactive (e.g. inactive class section card/badge)
    root.style.setProperty('--theme-status-inactive-badge', config.components.statusInactive.badgeColor);
    root.style.setProperty('--theme-card-inactive-bg', config.components.statusInactive.cardBackground);
    root.style.setProperty('--theme-card-inactive-border', config.components.statusInactive.cardBorder);

    // Header online/offline badge colours (green when online, gray when offline)
    root.style.setProperty('--theme-status-online-badge', config.components.statusOnline.badgeColor);
    root.style.setProperty('--theme-status-offline-badge', config.components.statusOffline.badgeColor);

    // Teacher mapping matrix: teacher name badge
    const matrixBadge = config.components.matrixTeacherBadge;
    if (matrixBadge) {
      root.style.setProperty('--theme-matrix-teacher-badge-bg', matrixBadge.backgroundColor);
      root.style.setProperty('--theme-matrix-teacher-badge-text', matrixBadge.textColor);
    }

    // 2. Apply body styles
    document.body.style.backgroundColor = config.components.page.backgroundColor;
    document.body.style.color = config.colors.text;
    document.body.style.fontFamily = config.typography.fontFamily.primary;
  }, [themeConfig, isAuthPage, isDark]);

  // 3. CSS Injection for components using CSS classes (Navbar, Header, etc.)
  useEffect(() => {
    if (typeof document === 'undefined' || !themeConfig) return;
    // Skip theme application on auth pages
    if (isAuthPage) return;

    const config = themeConfig;
    
    // Helper function to get button config with fallback to base button config
    const getButtonConfig = (buttonType: 'actionIcon' | 'headerButton' | 'navButton') => {
      const base = config.components.button;
      const specific = config.components[buttonType];
      return {
        backgroundColor: specific?.backgroundColor ?? base.backgroundColor,
        textColor: specific?.textColor ?? base.textColor,
        hoverColor: specific?.hoverColor ?? base.hoverColor,
        hoverTextColor: specific?.hoverTextColor ?? base.hoverTextColor ?? base.textColor,
        disabledOpacity: specific?.disabledOpacity ?? base.disabledOpacity ?? 0.6,
      };
    };
    
    const actionIconConfig = getButtonConfig('actionIcon');
    const headerButtonConfig = getButtonConfig('headerButton');
    const navButtonConfig = getButtonConfig('navButton');
    
    let styleElement = document.getElementById('mantine-theme-override');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'mantine-theme-override';
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      /* Navbar (Sidebar) */
      .mantine-AppShell-navbar {
        background-color: ${config.components.navbar.backgroundColor} !important;
        border-right-color: ${config.components.navbar.borderColor} !important;
        border-left-color: ${config.components.navbar.borderColor} !important;
        color: ${config.components.navbar.textColor} !important;
        font-family: ${config.typography.fontFamily.primary} !important;
      }
      
      /* RTL - Remove navbar border to match LTR */
      html[dir="rtl"] .mantine-AppShell-navbar,
      [dir="rtl"] .mantine-AppShell-navbar {
        border-inline-end: none !important;
        border-inline-start: none !important;
      }
      
      /* Header — safe-area for PWA / iOS notch; height comes from AppShell (calc + inset) */
      .mantine-AppShell-header {
        background-color: ${config.components.header.backgroundColor} !important;
        border-bottom-color: ${config.components.header.borderColor} !important;
        color: ${config.components.header.textColor} !important;
        padding-top: env(safe-area-inset-top, 0px) !important;
        padding-left: env(safe-area-inset-left, 0px) !important;
        padding-right: env(safe-area-inset-right, 0px) !important;
        box-sizing: border-box !important;
      }
      
      /* Page Title Bar */
      .page-title-bar {
        position: fixed !important;
        top: calc(60px + env(safe-area-inset-top, 0px)) !important; /* Below header */
        left: 270px !important; /* To the right of navbar (expanded) */
        right: 0 !important;
        height: 60px !important; /* Same height as header */
        background-color: ${config.components.titleBar.backgroundColor} !important;
        z-index: 100 !important;
        display: flex !important;
        align-items: center !important;
        border-bottom: none !important;
        transition: left 0.3s ease !important;
        border-top-left-radius: 12px !important;
        overflow: hidden !important;
        /* Pages already add inner padding (many screens use paddingLeft/Right md),
           and AppShell main also has padding="md". To keep title text aligned with
           content below, mirror the effective double padding here. */
        padding-left: max(calc(var(--mantine-spacing-md) * 2), env(safe-area-inset-left, 0px)) !important;
        padding-right: max(calc(var(--mantine-spacing-md) * 2), env(safe-area-inset-right, 0px)) !important;
        /* Slightly lower title text within the bar */
        padding-top: 14px !important;
      }

      /* Force visible inner rounded join with sidebar/header edge */
      .page-title-bar::before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: -12px !important;
        width: 12px !important;
        height: 12px !important;
        border-top-right-radius: 12px !important;
        box-shadow: 6px -6px 0 6px ${config.components.titleBar.backgroundColor} !important;
        pointer-events: none !important;
      }
      
      /* Page Sub Title Bar - Same position as title bar */
      .page-sub-title-bar {
        position: fixed !important;
        top: calc(60px + env(safe-area-inset-top, 0px)) !important; /* Same position as title bar */
        left: 270px !important; /* To the right of navbar (expanded) */
        right: 0 !important;
        height: 60px !important; /* Same height as title bar */
        background-color: ${config.components.subTitleBar.backgroundColor} !important;
        z-index: 98 !important;
        transition: left 0.3s ease !important;
      }
      
      /* Adjust for collapsed navbar (desktop) */
      @media (min-width: 768px) {
        body[data-navbar-collapsed="true"] .page-title-bar {
          left: 60px !important;
        }
        
        body[data-navbar-collapsed="true"] .page-sub-title-bar {
          left: 60px !important;
        }
      }
      
      /* When navbar is hidden on mobile, align to edge */
      @media (max-width: 767px) {
        .page-title-bar,
        .page-sub-title-bar {
          left: 0 !important;
        }
      }

      /* RTL Support - Title and Subtitle Bars */
      html[dir="rtl"] .page-title-bar,
      [dir="rtl"] .page-title-bar {
        left: 0 !important;
        right: 270px !important;
        width: calc(100% - 270px) !important;
        border-top-left-radius: 0 !important;
        border-top-right-radius: 12px !important;
        padding-left: max(calc(var(--mantine-spacing-md) * 2), env(safe-area-inset-left, 0px)) !important;
        padding-right: max(calc(var(--mantine-spacing-md) * 2), env(safe-area-inset-right, 0px)) !important;
        transition: right 0.3s ease, width 0.3s ease !important;
      }

      html[dir="rtl"] .page-title-bar::before,
      [dir="rtl"] .page-title-bar::before {
        left: auto !important;
        right: -12px !important;
        border-top-right-radius: 0 !important;
        border-top-left-radius: 12px !important;
        box-shadow: -6px -6px 0 6px ${config.components.titleBar.backgroundColor} !important;
      }
      
      html[dir="rtl"] .page-sub-title-bar,
      [dir="rtl"] .page-sub-title-bar {
        left: 0 !important;
        right: 270px !important;
        width: calc(100% - 270px) !important;
        transition: right 0.3s ease, width 0.3s ease !important;
      }
      
      /* RTL - Collapsed navbar */
      @media (min-width: 768px) {
        html[dir="rtl"] body[data-navbar-collapsed="true"] .page-title-bar,
        [dir="rtl"] body[data-navbar-collapsed="true"] .page-title-bar {
          right: 60px !important;
          width: calc(100% - 60px) !important;
        }
        
        html[dir="rtl"] body[data-navbar-collapsed="true"] .page-sub-title-bar,
        [dir="rtl"] body[data-navbar-collapsed="true"] .page-sub-title-bar {
          right: 60px !important;
          width: calc(100% - 60px) !important;
        }
      }
      
      /* RTL - Mobile */
      @media (max-width: 767px) {
        html[dir="rtl"] .page-title-bar,
        [dir="rtl"] .page-title-bar,
        html[dir="rtl"] .page-sub-title-bar,
        [dir="rtl"] .page-sub-title-bar {
          right: 0 !important;
          width: 100% !important;
        }
      }
      
      /* Title bar content - start aligned with padding to match content div */
      .page-title-bar .mantine-Title-root {
        margin: 0 !important;
        text-align: left !important;
        line-height: 1.15 !important;
      }
      
      html[dir="rtl"] .page-title-bar .mantine-Title-root,
      [dir="rtl"] .page-title-bar .mantine-Title-root {
        text-align: right !important;
        padding-left: 0 !important;
        padding-right: var(--mantine-spacing-md) !important;
      }
      
      /* Title bar button group alignment */
      .page-title-bar .mantine-Group-root[data-justify="space-between"],
      .page-title-bar .mantine-Group-root[style*="justify-content: space-between"] {
        padding-right: 0 !important;
        padding-left: 0 !important;
      }
      
      html[dir="rtl"] .page-title-bar .mantine-Group-root[data-justify="space-between"],
      [dir="rtl"] .page-title-bar .mantine-Group-root[data-justify="space-between"],
      html[dir="rtl"] .page-title-bar .mantine-Group-root[style*="justify-content: space-between"],
      [dir="rtl"] .page-title-bar .mantine-Group-root[style*="justify-content: space-between"] {
        padding-right: 0 !important;
        padding-left: 0 !important;
      }
      
      /* Add top margin to main content to account for title bar */
      /* Note: Horizontal padding comes from AppShell padding="md" prop (like RMS) */
      .mantine-AppShell-main {
        /* Header + Title bar + safe-area + spacing */
        padding-top: calc(120px + env(safe-area-inset-top, 0px) - 6px) !important;
      }
      
      /* Reduce margin-top for content div after title bar */
      .page-title-bar ~ div:not(.page-sub-title-bar) {
        margin-top: 0 !important;
      }
      
      /* Remove padding from tabs component to align with title bar text */
      .page-title-bar ~ * .mantine-Tabs-root {
        padding-inline-start: 0 !important;
      }
      
      .page-title-bar ~ * .mantine-Tabs-list {
        padding-inline-start: 0 !important;
        margin-inline-start: 0 !important;
      }
      
      /* Form action buttons alignment - align with cards inside Tabs.Panel */
      div[style*="paddingLeft"] form .mantine-Tabs-root ~ .mantine-Group-root,
      div[style*="padding-left"] form .mantine-Tabs-root ~ .mantine-Group-root {
        padding-inline-end: var(--mantine-spacing-md) !important;
      }
      
      html[dir="rtl"] div[style*="paddingLeft"] form .mantine-Tabs-root ~ .mantine-Group-root,
      [dir="rtl"] div[style*="padding-left"] form .mantine-Tabs-root ~ .mantine-Group-root {
        padding-inline-end: 0 !important;
        padding-inline-start: var(--mantine-spacing-md) !important;
      }
      
      /* Navbar Navigation Buttons */
      .nav-item-button {
        font-family: ${config.typography.fontFamily.primary} !important;
        border-radius: 8px !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
      }
      
      /* Collapsed state - perfect centering */
      .nav-item-button[data-collapsed="true"] {
        justify-content: center !important;
        width: auto !important;
        min-width: auto !important;
        padding: 0.75rem !important;
        margin: 0 auto !important;
      }

      /*
       * Collapsed rail (navbar only): lock row size so global padding + active border/shadow
       * do not make the active group taller than neighbours (uneven vertical gaps).
       */
      .mantine-AppShell-navbar .nav-item-button[data-collapsed="true"] {
        box-sizing: border-box !important;
        height: 48px !important;
        min-height: 48px !important;
        max-height: 48px !important;
        width: 48px !important;
        min-width: 48px !important;
        padding: 0 !important;
      }
      
      /* Ensure button inner content is centered when collapsed */
      .nav-item-button[data-collapsed="true"] .mantine-Button-inner {
        justify-content: center !important;
        width: 100% !important;
      }
      
      /* Remove leftSection margin when collapsed */
      .nav-item-button[data-collapsed="true"] .mantine-Button-leftSection {
        margin-inline-end: 0 !important;
        margin-inline-start: 0 !important;
      }
      
      /* Expanded state */
      .nav-item-button[data-collapsed="false"] {
        justify-content: flex-start !important;
        width: 100% !important;
        padding: 0.5rem 1rem !important;
      }
      
      /*
       * Active / hover tints must apply only inside the AppShell navbar.
       * Collapsed-group flyouts render in a portal (not under .mantine-AppShell-navbar); if these
       * rules stay global, important overrides inline styles on flyout rows and every option looks tinted.
       */
      .mantine-AppShell-navbar .nav-item-button[data-active="true"] {
        background-color: ${config.components.navbar.activeBackground} !important;
        color: ${config.components.navbar.activeTextColor} !important;
        font-weight: 600 !important;
      }
      
      /* Hover state - only apply if not active */
      .mantine-AppShell-navbar .nav-item-button:hover:not([data-active="true"]) {
        background-color: ${config.components.navbar.hoverBackground} !important;
        color: ${config.components.navbar.hoverTextColor} !important;
      }
      
      /* Active state hover - keep active colors */
      .mantine-AppShell-navbar .nav-item-button[data-active="true"]:hover {
        background-color: ${config.components.navbar.activeBackground} !important;
        color: ${config.components.navbar.activeTextColor} !important;
      }
      
      /* Active state in collapsed mode - border on inline-start (flips in RTL) */
      .mantine-AppShell-navbar .nav-item-button[data-active="true"][data-collapsed="true"] {
        background-color: ${config.components.navbar.activeBackground} !important;
        border-inline-start: 4px solid ${config.components.navbar.activeTextColor} !important;
        border-start-end-radius: 8px !important;
        border-end-end-radius: 8px !important;
        border-end-start-radius: 8px !important;
        border-start-start-radius: 0 !important;
        position: relative !important;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1) !important;
        font-weight: 700 !important;
      }
      
      /* Make active icon stand out more in collapsed mode */
      .mantine-AppShell-navbar .nav-item-button[data-active="true"][data-collapsed="true"] svg {
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12)) !important;
      }
      
      /* Navbar Toggle Button */
      .nav-toggle-button {
        transition: all 0.2s ease !important;
        border-radius: 8px !important;
      }
      
      .nav-toggle-button:hover {
        background-color: ${config.components.navbar.hoverBackground} !important;
        color: ${config.components.navbar.hoverTextColor} !important;
      }
      
      /* Ensure collapsed navbar buttons are centered */
      body[data-navbar-collapsed="true"] .mantine-AppShell-navbar .nav-item-button {
        margin-inline: auto !important;
      }
      
      /* Center toggle button when collapsed */
      body[data-navbar-collapsed="true"] .mantine-AppShell-navbar .nav-toggle-button {
        margin-inline: auto !important;
      }
      
      /* Input Components */
      .mantine-TextInput-input,
      .mantine-Textarea-input,
      .mantine-Select-input,
      .mantine-NumberInput-input {
        background-color: ${config.components.input.backgroundColor} !important;
        border-color: ${config.components.input.borderColor} !important;
        color: ${config.components.input.textColor} !important;
        font-family: ${config.typography.fontFamily.primary} !important;
      }
      
      .mantine-TextInput-label,
      .mantine-Textarea-label,
      .mantine-Select-label,
      .mantine-NumberInput-label,
      .mantine-DatePickerInput-label,
      .mantine-DatePickerInput-label[data-range],
      label[class*="mantine-DatePickerInput-label"] {
        color: ${config.components.input.textColor} !important;
        font-family: ${config.typography.fontFamily.primary} !important;
      }
      
      /* DatePickerInput Component */
      .mantine-DatePickerInput-input,
      input[class*="mantine-DatePickerInput-input"] {
        background-color: ${config.components.input.backgroundColor} !important;
        border-color: ${config.components.input.borderColor} !important;
        color: ${config.components.input.textColor} !important;
        font-family: ${config.typography.fontFamily.primary} !important;
      }
      
      /* Ensure all DatePicker labels are styled */
      .mantine-DatePickerInput-root label,
      .mantine-DatePickerInput-wrapper label {
        color: ${config.components.input.textColor} !important;
        font-family: ${config.typography.fontFamily.primary} !important;
      }
      
      /* Global Text Color: color uses !important, so it overrides parent colour and inline styles on
         Mantine Text. For contrasting text on a tinted row or bubble, use Box (see Messages module). */
      .mantine-Text-root {
        color: ${config.colors.text} !important;
        font-family: ${config.typography.fontFamily.primary} !important;
      }
      
      /* Page Headers (Title components) - Base styles */
      .mantine-Title-root,
      h1.mantine-Title-root,
      h2.mantine-Title-root,
      h3.mantine-Title-root,
      h4.mantine-Title-root,
      h5.mantine-Title-root,
      h6.mantine-Title-root {
        font-family: ${config.typography.fontFamily.heading} !important;
        font-weight: ${config.typography.fontWeight.bold} !important;
      }
      
      /* Page titles (order={1} or h1) - default pageHeaderColor */
      .mantine-Title-root[data-order="1"],
      h1.mantine-Title-root {
        color: ${config.typography.pageHeaderColor} !important;
        font-size: ${config.typography.titleSize.h1} !important;
      }
      
      /* Main header per screen: title bar heading overrides to theme primary (higher specificity) */
      .page-title-bar .mantine-Title-root[data-order="1"],
      .page-title-bar h1.mantine-Title-root {
        color: ${config.typography.pageTitleBarHeaderColor} !important;
      }
      
      /* Section titles (order={2} or h2) - Use pageSectionHeaderColor */
      .mantine-Title-root[data-order="2"],
      h2.mantine-Title-root {
        color: ${config.typography.pageSectionHeaderColor} !important;
        font-size: ${config.typography.titleSize.h2} !important;
      }
      
      /* Subsection titles (order={3} or h3) - Use pageSectionHeaderColor */
      .mantine-Title-root[data-order="3"],
      h3.mantine-Title-root {
        color: ${config.typography.pageSectionHeaderColor} !important;
        font-size: ${config.typography.titleSize.h3} !important;
      }
      
      /* Minor section titles (order={4} or h4) - Use pageSectionHeaderColor */
      .mantine-Title-root[data-order="4"],
      h4.mantine-Title-root {
        color: ${config.typography.pageSectionHeaderColor} !important;
        font-size: ${config.typography.titleSize.h4} !important;
      }
      
      /* Text components used as page titles (fallback styling) */
      .mantine-Text-root[size="xl"][fw="700"],
      .mantine-Text-root[size="xl"][style*="font-weight: 700"],
      .mantine-Text-root[size="xl"][style*="font-weight:700"] {
        color: ${config.typography.pageHeaderColor} !important;
        font-family: ${config.typography.fontFamily.heading} !important;
        font-size: ${config.typography.titleSize.h1} !important;
        font-weight: ${config.typography.fontWeight.bold} !important;
      }
      
      /* Navbar Section Headers (uppercase Text in sidebar) - Override inline color from c="dimmed" */
      .mantine-AppShell-navbar .mantine-Text-root[size="xs"][tt="uppercase"],
      .mantine-AppShell-navbar .mantine-Text-root[size="xs"][style*="text-transform: uppercase"],
      .mantine-AppShell-navbar .mantine-Text-root[size="xs"] {
        color: ${config.typography.navbarSectionHeaderColor} !important;
      }
      
      /* Button Styles - Override ALL button styles including inline styles to use themeConfig */
      .mantine-Button-root,
      button.mantine-Button-root,
      .mantine-Button-root[style],
      button[class*="mantine-Button-root"] {
        background-color: ${config.components.button.backgroundColor} !important;
        color: ${config.components.button.textColor} !important;
        font-family: ${config.typography.fontFamily.primary} !important;
        font-weight: ${config.typography.fontWeight.medium} !important;
        border: none !important;
      }
      
      /* Button Hover */
      .mantine-Button-root:hover:not(:disabled):not([data-disabled]),
      button.mantine-Button-root:hover:not(:disabled):not([data-disabled]) {
        background-color: ${config.components.button.hoverColor} !important;
        color: ${config.components.button.hoverTextColor ?? config.components.button.textColor} !important;
      }
      
      /* Button Active State */
      .mantine-Button-root:active:not(:disabled):not([data-disabled]) {
        background-color: ${config.components.button.hoverColor} !important;
      }
      
      /* Button Disabled */
      .mantine-Button-root:disabled,
      button.mantine-Button-root:disabled,
      .mantine-Button-root[data-disabled] {
        opacity: ${config.components.button.disabledOpacity ?? 0.6} !important;
        background-color: ${config.components.button.backgroundColor} !important;
      }
      
      /* Override inline styles on buttons */
      .mantine-Button-root[style*="background"],
      button[style*="background"][class*="mantine-Button"],
      .mantine-Button-root[style*="color"],
      button[style*="color"][class*="mantine-Button"] {
        background-color: ${config.components.button.backgroundColor} !important;
        color: ${config.components.button.textColor} !important;
      }
      
      /* ActionIcon Styles - Inherits from button if not specified */
      .mantine-ActionIcon-root,
      button.mantine-ActionIcon-root {
        background-color: ${actionIconConfig.backgroundColor} !important;
        color: ${actionIconConfig.textColor} !important;
        font-family: ${config.typography.fontFamily.primary} !important;
        border: none !important;
      }
      
      .mantine-ActionIcon-root:hover:not(:disabled):not([data-disabled]),
      button.mantine-ActionIcon-root:hover:not(:disabled):not([data-disabled]) {
        background-color: ${actionIconConfig.hoverColor} !important;
        color: ${actionIconConfig.hoverTextColor} !important;
      }
      
      .mantine-ActionIcon-root:active:not(:disabled):not([data-disabled]) {
        background-color: ${actionIconConfig.hoverColor} !important;
      }
      
      .mantine-ActionIcon-root:disabled,
      button.mantine-ActionIcon-root:disabled,
      .mantine-ActionIcon-root[data-disabled] {
        opacity: ${actionIconConfig.disabledOpacity} !important;
        background-color: ${actionIconConfig.backgroundColor} !important;
      }
      
      /* Header Button Styles - Inherits from button if not specified */
      .mantine-AppShell-header .mantine-Button-root,
      .mantine-AppShell-header button.mantine-Button-root {
        background-color: ${headerButtonConfig.backgroundColor} !important;
        color: ${headerButtonConfig.textColor} !important;
      }
      
      .mantine-AppShell-header .mantine-Button-root:hover:not(:disabled):not([data-disabled]),
      .mantine-AppShell-header button.mantine-Button-root:hover:not(:disabled):not([data-disabled]) {
        background-color: ${headerButtonConfig.hoverColor} !important;
        color: ${headerButtonConfig.hoverTextColor} !important;
      }
      
      .mantine-AppShell-header .mantine-Button-root:active:not(:disabled):not([data-disabled]) {
        background-color: ${headerButtonConfig.hoverColor} !important;
      }
      
      .mantine-AppShell-header .mantine-Button-root:disabled,
      .mantine-AppShell-header button.mantine-Button-root:disabled,
      .mantine-AppShell-header .mantine-Button-root[data-disabled] {
        opacity: ${headerButtonConfig.disabledOpacity} !important;
        background-color: ${headerButtonConfig.backgroundColor} !important;
      }
      
      /* Nav Button Styles - Inherits from button if not specified (expand/collapse, etc.) */
      .mantine-AppShell-navbar .mantine-Button-root,
      .mantine-AppShell-navbar button.mantine-Button-root,
      .mantine-AppShell-navbar .mantine-ActionIcon-root,
      .mantine-AppShell-navbar button.mantine-ActionIcon-root {
        background-color: ${navButtonConfig.backgroundColor} !important;
        color: ${navButtonConfig.textColor} !important;
      }
      
      .mantine-AppShell-navbar .mantine-Button-root:hover:not(:disabled):not([data-disabled]),
      .mantine-AppShell-navbar button.mantine-Button-root:hover:not(:disabled):not([data-disabled]),
      .mantine-AppShell-navbar .mantine-ActionIcon-root:hover:not(:disabled):not([data-disabled]),
      .mantine-AppShell-navbar button.mantine-ActionIcon-root:hover:not(:disabled):not([data-disabled]) {
        background-color: ${navButtonConfig.hoverColor} !important;
        color: ${navButtonConfig.hoverTextColor} !important;
      }
      
      .mantine-AppShell-navbar .mantine-Button-root:active:not(:disabled):not([data-disabled]),
      .mantine-AppShell-navbar .mantine-ActionIcon-root:active:not(:disabled):not([data-disabled]) {
        background-color: ${navButtonConfig.hoverColor} !important;
      }
      
      .mantine-AppShell-navbar .mantine-Button-root:disabled,
      .mantine-AppShell-navbar button.mantine-Button-root:disabled,
      .mantine-AppShell-navbar .mantine-Button-root[data-disabled],
      .mantine-AppShell-navbar .mantine-ActionIcon-root:disabled,
      .mantine-AppShell-navbar button.mantine-ActionIcon-root:disabled,
      .mantine-AppShell-navbar .mantine-ActionIcon-root[data-disabled] {
        opacity: ${navButtonConfig.disabledOpacity} !important;
        background-color: ${navButtonConfig.backgroundColor} !important;
      }
      
      /* Switch Component Styles */
      .mantine-Switch-track {
        background-color: ${config.components.switch.trackColor} !important;
        border-color: ${config.components.switch.trackColor} !important;
      }
      
      .mantine-Switch-input:checked + .mantine-Switch-track {
        background-color: ${config.components.switch.checkedTrackColor} !important;
        border-color: ${config.components.switch.checkedTrackColor} !important;
      }
      
      .mantine-Switch-input:disabled + .mantine-Switch-track,
      .mantine-Switch-track[data-disabled] {
        background-color: ${config.components.switch.disabledTrackColor ?? config.components.switch.trackColor} !important;
        border-color: ${config.components.switch.disabledTrackColor ?? config.components.switch.trackColor} !important;
        opacity: 0.6 !important;
      }
      
      .mantine-Switch-thumb {
        background-color: ${config.components.switch.thumbColor} !important;
        border-color: ${config.components.switch.thumbColor} !important;
      }
      
      .mantine-Switch-input:checked + .mantine-Switch-track .mantine-Switch-thumb {
        background-color: ${config.components.switch.checkedThumbColor ?? config.components.switch.thumbColor} !important;
        border-color: ${config.components.switch.checkedThumbColor ?? config.components.switch.thumbColor} !important;
      }
      
      .mantine-Switch-input:disabled + .mantine-Switch-track .mantine-Switch-thumb,
      .mantine-Switch-track[data-disabled] .mantine-Switch-thumb {
        background-color: ${config.components.switch.disabledThumbColor ?? config.components.switch.thumbColor} !important;
        border-color: ${config.components.switch.disabledThumbColor ?? config.components.switch.thumbColor} !important;
      }
      
      .mantine-Switch-label {
        color: ${config.components.switch.labelColor ?? config.colors.text} !important;
      }
      
      .mantine-Switch-input:disabled ~ .mantine-Switch-label,
      .mantine-Switch-root[data-disabled] .mantine-Switch-label {
        color: ${config.components.switch.disabledLabelColor ?? config.components.switch.labelColor ?? config.colors.textMuted} !important;
      }
      
      /* Radio Component Styles */
      /* Mantine v7 uses data attributes on the root for checked/disabled states. */
      .mantine-Radio-radio {
        border-color: ${config.components.radio.uncheckedColor} !important;
        background-color: transparent !important;
      }

      .mantine-Radio-root[data-checked] .mantine-Radio-radio {
        border-color: ${config.components.radio.checkedColor} !important;
        background-color: ${config.components.radio.checkedColor} !important;
      }

      .mantine-Radio-root[data-disabled] .mantine-Radio-radio {
        border-color: ${config.components.radio.disabledColor ?? config.components.radio.uncheckedColor} !important;
        background-color: transparent !important;
        opacity: 0.6 !important;
      }

      .mantine-Radio-root[data-checked][data-disabled] .mantine-Radio-radio {
        background-color: ${config.components.radio.disabledColor ?? config.components.radio.checkedColor} !important;
        opacity: 0.6 !important;
      }

      /* Make sure the inner checked indicator is visible across Mantine versions. */
      .mantine-Radio-root[data-checked] .mantine-Radio-inner,
      .mantine-Radio-root[data-checked] .mantine-Radio-icon {
        color: ${config.components.radio.dotColor ?? '#ffffff'} !important;
      }
      
      .mantine-Radio-label {
        color: ${config.components.radio.labelColor ?? config.colors.text} !important;
      }
      
      .mantine-Radio-input:disabled ~ .mantine-Radio-label,
      .mantine-Radio-root[data-disabled] .mantine-Radio-label {
        color: ${config.components.radio.disabledLabelColor ?? config.components.radio.labelColor ?? config.colors.textMuted} !important;
      }

      /* Avatar Component Styles - Override all possible selectors and CSS variables */
      .mantine-Avatar-root,
      .mantine-Avatar-root[style],
      [class*="mantine-Avatar-root"],
      button .mantine-Avatar-root,
      .mantine-Button-root .mantine-Avatar-root,
      .mantine-Menu-target .mantine-Avatar-root {
        background-color: ${config.components.avatar.backgroundColor} !important;
        color: ${config.components.avatar.textColor} !important;
        --avatar-color: ${config.components.avatar.textColor} !important;
      }
      
      /* Override any inline color styles that Mantine might apply */
      .mantine-Avatar-root[style*="color"],
      button .mantine-Avatar-root[style*="color"],
      .mantine-Button-root .mantine-Avatar-root[style*="color"],
      .mantine-Menu-target .mantine-Avatar-root[style*="color"] {
        color: ${config.components.avatar.textColor} !important;
      }
      
      /* Button Outline Variant - Remove border */
      .mantine-Button-root[data-variant="outline"] {
        border: none !important;
      }
      
      /* Teacher mapping matrix: assigned-teacher button (distinct from primary Assign button) */
      .mantine-Button-root[data-matrix-assigned-teacher],
      button.mantine-Button-root[data-matrix-assigned-teacher] {
        background-color: ${config.components.matrixAssignedTeacherButton?.backgroundColor ?? '#0d9488'} !important;
        color: ${config.components.matrixAssignedTeacherButton?.textColor ?? '#ffffff'} !important;
      }
      .mantine-Button-root[data-matrix-assigned-teacher]:hover:not(:disabled):not([data-disabled]),
      button.mantine-Button-root[data-matrix-assigned-teacher]:hover:not(:disabled):not([data-disabled]) {
        background-color: ${config.components.matrixAssignedTeacherButton?.hoverColor ?? '#0f766e'} !important;
        color: ${config.components.matrixAssignedTeacherButton?.textColor ?? '#ffffff'} !important;
      }
      
      /* Teacher mapping matrix: green Assign / + button */
      .mantine-Button-root[data-matrix-assign-button],
      button.mantine-Button-root[data-matrix-assign-button] {
        background-color: ${config.components.matrixAssignButton?.backgroundColor ?? '#16a34a'} !important;
        color: ${config.components.matrixAssignButton?.textColor ?? '#ffffff'} !important;
      }
      .mantine-Button-root[data-matrix-assign-button]:hover:not(:disabled):not([data-disabled]),
      button.mantine-Button-root[data-matrix-assign-button]:hover:not(:disabled):not([data-disabled]) {
        background-color: ${config.components.matrixAssignButton?.hoverColor ?? '#15803d'} !important;
        color: ${config.components.matrixAssignButton?.textColor ?? '#ffffff'} !important;
      }
      
      /* Override inline hover styles */
      .mantine-Button-root[style*="background"]:hover:not(:disabled):not([data-disabled]),
      button[style*="background"][class*="mantine-Button"]:hover:not(:disabled):not([data-disabled]),
      .mantine-Button-root[style*="color"]:hover:not(:disabled):not([data-disabled]),
      button[style*="color"][class*="mantine-Button"]:hover:not(:disabled):not([data-disabled]) {
        background-color: ${config.components.button.hoverColor} !important;
        color: ${config.components.button.textColor} !important;
      }
      
      /* Table Header Hover */
      .mantine-Table-thead .mantine-Table-th:hover {
        background-color: ${config.components.table.headerHoverBackground} !important;
      }
      
      /* Mantine Tabs - Style using themeConfig tabs */
      .mantine-Tabs-root {
        background-color: ${config.components.tabs.backgroundColor} !important;
        border-color: ${config.components.tabs.borderColor} !important;
        border-radius: 8px !important; /* Add rounded corners on all sides */
        overflow: hidden !important; /* Ensure content respects border-radius */
      }
      
      .mantine-Tabs-list {
        border-bottom-color: ${config.components.tabs.borderColor} !important;
      }
      
      .mantine-Tabs-tab {
        color: ${config.components.tabs.textColor} !important;
        font-family: ${config.typography.fontFamily.primary} !important;
        border-radius: 8px 8px 0 0 !important; /* Rounded top corners */
        transition: all 0.2s ease !important;
      }
      
      .mantine-Tabs-tab:hover:not([data-disabled]) {
        background-color: ${config.components.tabs.hoverTabBackgroundColor} !important;
        color: ${config.components.tabs.hoverTabFontColor} !important;
        border-radius: 8px 8px 0 0 !important;
      }
      
      .mantine-Tabs-tab[data-active] {
        background-color: ${config.components.tabs.selectedTabBackgroundColor} !important;
        color: ${config.components.tabs.selectedTabFontColor} !important;
        border-bottom-color: ${config.components.tabs.selectedTabFontColor} !important;
        border-radius: 8px 8px 0 0 !important;
      }
      
      /* Ensure nested elements also get the correct color */
      .mantine-Tabs-tab[data-active] * {
        color: ${config.components.tabs.selectedTabFontColor} !important;
      }
      
      /* Filter Chips - configurable from themeConfig.filterChip */
      .filter-chip-group .mantine-ChipGroup-root {
        display: inline-flex !important;
        flex-wrap: wrap !important;
        gap: var(--mantine-spacing-xs) !important;
      }

      .filter-chip-group .mantine-Chip-label {
        background-color: ${config.components.filterChip.backgroundColor} !important;
        color: ${config.components.filterChip.textColor} !important;
        border-radius: 20px !important;
        transition: all 0.2s ease !important;
      }

      .filter-chip-group .mantine-Chip-label:hover {
        background-color: ${config.components.filterChip.hoverBackgroundColor} !important;
        color: ${config.components.filterChip.hoverTextColor} !important;
      }

      .filter-chip-group .mantine-Chip-input:checked + .mantine-Chip-label {
        background-color: ${config.components.filterChip.selectedBackgroundColor} !important;
        color: ${config.components.filterChip.selectedTextColor} !important;
      }

      /* Green/success filled badges and Stepper completed step: white text (e.g. onboarding Review screen) */
      .mantine-Stepper-stepIcon[data-completed],
      .mantine-Stepper-step[data-completed] .mantine-Stepper-stepIcon {
        color: ${config.components.badge.filledSuccessTextColor} !important;
      }
      .mantine-Stepper-stepIcon[data-completed] svg,
      .mantine-Stepper-step[data-completed] .mantine-Stepper-stepIcon svg {
        color: ${config.components.badge.filledSuccessTextColor} !important;
        fill: ${config.components.badge.filledSuccessTextColor} !important;
      }
      .mantine-Badge-root[data-variant="filled"][data-color="green"],
      .mantine-Badge-root[data-variant="filled"][data-color="primary"] {
        color: ${config.components.badge.filledSuccessTextColor} !important;
      }
      .mantine-Badge-root[data-variant="filled"][data-color="green"] *,
      .mantine-Badge-root[data-variant="filled"][data-color="primary"] * {
        color: inherit !important;
      }
    `;
  }, [themeConfig, isAuthPage]);

  // 4. Direct DOM manipulation for headers (Title and section headers)
  useEffect(() => {
    if (typeof document === 'undefined' || !themeConfig) return;
    // Skip theme application on auth pages
    if (isAuthPage) return;

    const config = themeConfig;
    
    const applyHeaderStyles = () => {
      // Page Headers (Title components) - Apply colors and sizes based on order
      document.querySelectorAll('.mantine-Title-root, h1.mantine-Title-root, h2.mantine-Title-root, h3.mantine-Title-root, h4.mantine-Title-root').forEach((title) => {
        const el = title as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        const order = el.getAttribute('data-order') || el.getAttribute('order');
        
        el.style.fontFamily = config.typography.fontFamily.heading;
        el.style.fontWeight = String(config.typography.fontWeight.bold);
        
        // Apply colors and sizes based on order/tag
        if (order === '1' || tagName === 'h1') {
          const inPageTitleBar = el.closest('.page-title-bar');
          el.style.color = inPageTitleBar
            ? config.typography.pageTitleBarHeaderColor
            : config.typography.pageHeaderColor;
          el.style.fontSize = config.typography.titleSize.h1;
        } else if (order === '2' || tagName === 'h2') {
          el.style.color = config.typography.pageSectionHeaderColor;
          el.style.fontSize = config.typography.titleSize.h2;
        } else if (order === '3' || tagName === 'h3') {
          el.style.color = config.typography.pageSectionHeaderColor;
          el.style.fontSize = config.typography.titleSize.h3;
        } else if (order === '4' || tagName === 'h4') {
          el.style.color = config.typography.pageSectionHeaderColor;
          el.style.fontSize = config.typography.titleSize.h4;
        }
      });
      
      // Text components used as page titles (fallback)
      document.querySelectorAll('.mantine-Text-root[size="xl"]').forEach((text) => {
        const el = text as HTMLElement;
        const fontWeight = window.getComputedStyle(el).fontWeight;
        if (fontWeight === '700' || fontWeight === 'bold' || el.style.fontWeight === '700') {
          el.style.color = config.typography.pageHeaderColor;
          el.style.fontFamily = config.typography.fontFamily.heading;
          el.style.fontSize = config.typography.titleSize.h1;
          el.style.fontWeight = String(config.typography.fontWeight.bold);
        }
      });
      
      // Navbar Section Headers (Text with size="xs" in sidebar) - Override inline color from c="dimmed"
      document.querySelectorAll('.mantine-AppShell-navbar .mantine-Text-root[size="xs"]').forEach((text) => {
        const el = text as HTMLElement;
        // Check if it's uppercase (section header) by checking computed style or text content
        const computedStyle = window.getComputedStyle(el);
        const isUppercase = computedStyle.textTransform === 'uppercase' || 
                           el.textContent === el.textContent?.toUpperCase() ||
                           el.getAttribute('style')?.includes('text-transform: uppercase') ||
                           el.getAttribute('tt') === 'uppercase';
        if (isUppercase || el.style.fontWeight === '700' || computedStyle.fontWeight === '700') {
          el.style.color = config.typography.navbarSectionHeaderColor;
        }
      });
      
      // Page Section Headers (Text with size="xs" and uppercase on pages, not in navbar)
      document.querySelectorAll('.mantine-Text-root[size="xs"]').forEach((text) => {
        const el = text as HTMLElement;
        // Skip if it's in navbar
        if (el.closest('.mantine-AppShell-navbar')) return;
        
        const computedStyle = window.getComputedStyle(el);
        const isUppercase = computedStyle.textTransform === 'uppercase' || 
                           el.textContent === el.textContent?.toUpperCase();
        const isBold = computedStyle.fontWeight === '700' || el.style.fontWeight === '700';
        
        // If it's uppercase and bold, it's likely a section header
        if (isUppercase && isBold) {
          el.style.color = config.typography.pageSectionHeaderColor;
        }
      });
    };

    applyHeaderStyles();
    
    const observer = new MutationObserver(() => {
      setTimeout(applyHeaderStyles, 10);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'size'],
    });

    const interval = setInterval(applyHeaderStyles, 300);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [themeConfig, isAuthPage]);

  // 5. Direct DOM manipulation for inputs (ensures styling applies)
  useEffect(() => {
    if (typeof document === 'undefined' || !themeConfig) return;
    // Skip theme application on auth pages
    if (isAuthPage) return;

    const config = themeConfig;
    
    const applyInputStyles = () => {
      // TextInput
      document.querySelectorAll('.mantine-TextInput-input').forEach((input) => {
        const el = input as HTMLElement;
        el.style.backgroundColor = config.components.input.backgroundColor;
        el.style.borderColor = config.components.input.borderColor;
        el.style.color = config.components.input.textColor;
        el.style.fontFamily = config.typography.fontFamily.primary;
      });
      
      // Textarea
      document.querySelectorAll('.mantine-Textarea-input').forEach((textarea) => {
        const el = textarea as HTMLElement;
        el.style.backgroundColor = config.components.input.backgroundColor;
        el.style.borderColor = config.components.input.borderColor;
        el.style.color = config.components.input.textColor;
        el.style.fontFamily = config.typography.fontFamily.primary;
      });
      
      // Select
      document.querySelectorAll('.mantine-Select-input').forEach((select) => {
        const el = select as HTMLElement;
        el.style.backgroundColor = config.components.input.backgroundColor;
        el.style.borderColor = config.components.input.borderColor;
        el.style.color = config.components.input.textColor;
        el.style.fontFamily = config.typography.fontFamily.primary;
      });
      
      // NumberInput
      document.querySelectorAll('.mantine-NumberInput-input').forEach((input) => {
        const el = input as HTMLElement;
        el.style.backgroundColor = config.components.input.backgroundColor;
        el.style.borderColor = config.components.input.borderColor;
        el.style.color = config.components.input.textColor;
        el.style.fontFamily = config.typography.fontFamily.primary;
      });
      
      // DatePickerInput
      document.querySelectorAll('.mantine-DatePickerInput-input').forEach((input) => {
        const el = input as HTMLElement;
        el.style.backgroundColor = config.components.input.backgroundColor;
        el.style.borderColor = config.components.input.borderColor;
        el.style.color = config.components.input.textColor;
        el.style.fontFamily = config.typography.fontFamily.primary;
      });
      
      // DatePickerInput labels (including range labels)
      document.querySelectorAll('.mantine-DatePickerInput-label, label[class*="mantine-DatePickerInput-label"], .mantine-DatePickerInput-root label, .mantine-DatePickerInput-wrapper label').forEach((label) => {
        const el = label as HTMLElement;
        el.style.color = config.components.input.textColor;
        el.style.fontFamily = config.typography.fontFamily.primary;
      });
    };

    applyInputStyles();
    
    const observer = new MutationObserver(() => {
      setTimeout(applyInputStyles, 10);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    const interval = setInterval(applyInputStyles, 300);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [themeConfig, isAuthPage]);

  // 6. Direct DOM manipulation for Mantine Table (overrides inline styles)
  useEffect(() => {
    if (typeof document === 'undefined' || !themeConfig) return;
    // Skip theme application on auth pages
    if (isAuthPage) return;

    const config = themeConfig;
    
    const applyTableStyles = () => {
      // Table element
      document.querySelectorAll('.mantine-Table-table').forEach((table) => {
        const el = table as HTMLElement;
        el.style.backgroundColor = config.components.table.backgroundColor;
        el.style.borderColor = config.components.table.borderColor;
        el.style.color = config.components.table.textColor;
        el.style.fontFamily = config.typography.fontFamily.primary;
      });
      
      // Table header
      document.querySelectorAll('.mantine-Table-thead').forEach((thead) => {
        (thead as HTMLElement).style.backgroundColor = config.components.table.headerBackground;
      });
      
      // Table header cells
      document.querySelectorAll('.mantine-Table-th').forEach((th) => {
        const el = th as HTMLElement;
        el.style.borderBottomColor = config.components.table.borderColor;
        el.style.color = config.components.table.textColor;
        el.style.fontFamily = config.typography.fontFamily.primary;
        // Add hover effect
        el.onmouseenter = () => {
          el.style.backgroundColor = config.components.table.headerHoverBackground;
        };
        el.onmouseleave = () => {
          el.style.backgroundColor = config.components.table.headerBackground;
        };
      });
      
      // Table data cells
      document.querySelectorAll('.mantine-Table-td').forEach((td) => {
        const el = td as HTMLElement;
        el.style.borderBottomColor = config.colors.borderLight;
        el.style.color = config.components.table.textColor;
        el.style.fontFamily = config.typography.fontFamily.primary;
      });
      
      // Table hover styles for rows
      let hoverStyle = document.getElementById('table-hover-styles');
      if (!hoverStyle) {
        hoverStyle = document.createElement('style');
        hoverStyle.id = 'table-hover-styles';
        document.head.appendChild(hoverStyle);
      }
      hoverStyle.textContent = `
        .mantine-Table-tr:hover {
          background-color: ${config.components.table.hoverBackground} !important;
        }
        .mantine-Table-tr:hover .mantine-Table-td {
          color: ${config.components.table.hoverTextColor} !important;
        }
      `;
    };

    applyTableStyles();
    
    // Reapply on DOM changes
    const observer = new MutationObserver(() => {
      setTimeout(applyTableStyles, 10);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    const interval = setInterval(applyTableStyles, 300);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [themeConfig, isAuthPage]);


  return <>{children}</>;
}

