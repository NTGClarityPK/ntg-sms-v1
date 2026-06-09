'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@mantine/hooks';

/** Page title bar headings at or above this length use compact mobile typography. */
export const PAGE_TITLE_BAR_LONG_MOBILE_MIN_LENGTH = 10;

/** Matches DynamicThemeProvider `@media (max-width: 767px)` for title bar rules. */
export const PAGE_TITLE_BAR_MOBILE_MEDIA = '(max-width: 767px)';

export const PAGE_TITLE_BAR_LONG_TITLE_CLASS = 'page-title-bar-title--long-mobile';

export function shouldUseCompactPageTitleBar(title: string, isMobile: boolean): boolean {
  return isMobile && title.trim().length >= PAGE_TITLE_BAR_LONG_MOBILE_MIN_LENGTH;
}

/** Class for Mantine `Title` in `.page-title-bar` when the visible label is long (mobile only). */
export function pageTitleBarTitleClassName(title: string, isMobile: boolean): string | undefined {
  return shouldUseCompactPageTitleBar(title, isMobile)
    ? PAGE_TITLE_BAR_LONG_TITLE_CLASS
    : undefined;
}

function applyLongTitleSizing(isMobile: boolean): void {
  if (typeof document === 'undefined') return;

  const headings = document.querySelectorAll<HTMLElement>(
    '.page-title-bar .mantine-Title-root[data-order="1"], .page-title-bar h1.mantine-Title-root',
  );

  headings.forEach((el) => {
    const text = (el.textContent ?? '').trim();
    const useCompact = shouldUseCompactPageTitleBar(text, isMobile);
    if (useCompact) {
      el.classList.add(PAGE_TITLE_BAR_LONG_TITLE_CLASS);
    } else {
      el.classList.remove(PAGE_TITLE_BAR_LONG_TITLE_CLASS);
    }
  });
}

/**
 * On mobile only, shrinks `.page-title-bar` h1 text when the visible title is >= 10 characters.
 * Short titles (e.g. Dashboard, Results) keep the default size.
 */
export function PageTitleBarLongTitleSizing() {
  const pathname = usePathname();
  const isMobile = useMediaQuery(PAGE_TITLE_BAR_MOBILE_MEDIA);

  useLayoutEffect(() => {
    applyLongTitleSizing(!!isMobile);
  }, [isMobile, pathname]);

  useEffect(() => {
    if (isMobile === undefined) return;

    applyLongTitleSizing(!!isMobile);
    const t1 = window.setTimeout(() => applyLongTitleSizing(!!isMobile), 0);
    const t2 = window.setTimeout(() => applyLongTitleSizing(!!isMobile), 150);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isMobile, pathname]);

  return null;
}
