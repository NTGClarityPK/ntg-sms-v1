'use client';

import { useEffect, useRef } from 'react';
import { useTenantBrandingStore } from '@/lib/store/tenant-branding-store';
import { useThemeStore } from '@/lib/store/theme-store';

const DEFAULT_FAVICON_HREF = '/alma-logo-darkgreen.svg';

const APPLE_TOUCH_ATTR = 'data-tenant-apple-touch';

function guessImageMimeFromUrl(url: string): string {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

function appendIconLink(attrs: { rel: string; href: string; type?: string; sizes?: string }): void {
  const link = document.createElement('link');
  link.rel = attrs.rel;
  link.href = attrs.href;
  if (attrs.type) link.type = attrs.type;
  if (attrs.sizes) link.sizes = attrs.sizes;
  document.head.appendChild(link);
}

/**
 * Only removes <link> nodes we appended. Do not remove Next.js-managed head tags —
 * that causes React to throw when it reconciles metadata (removeChild on null parent).
 */
function removeOurAppleTouchLinks(): void {
  document.querySelectorAll(`link[${APPLE_TOUCH_ATTR}]`).forEach((node) => {
    node.remove();
  });
}

/**
 * Updates every favicon link in place so Chrome does not keep a stale NTG URL.
 * Mutating existing nodes avoids fighting the App Router metadata reconciler.
 */
function applyFaviconToExistingIconLinks(href: string, type: string): void {
  const icons = document.querySelectorAll('head link[rel="icon"]');
  if (icons.length === 0) {
    appendIconLink({ rel: 'icon', href, type });
    return;
  }
  icons.forEach((node) => {
    const link = node as HTMLLinkElement;
    link.href = href;
    if (type) link.type = type;
  });
}

function absoluteUrlFromPublicPath(path: string): string {
  if (typeof window === 'undefined') return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildManifestJson(options: {
  name: string;
  shortName: string;
  iconSrc: string;
  iconType: string;
  themeColor: string;
}): string {
  const { name, shortName, iconSrc, iconType, themeColor } = options;
  return JSON.stringify({
    name,
    short_name: shortName.slice(0, 12),
    description: 'Multi-tenant school management system',
    theme_color: themeColor,
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      {
        src: iconSrc,
        sizes: '192x192',
        type: iconType,
        purpose: 'any',
      },
      {
        src: iconSrc,
        sizes: '512x512',
        type: iconType,
        purpose: 'any',
      },
    ],
  });
}

function applyManifestHref(blobUrl: string): void {
  let manifestLink = document.querySelector('head link[rel="manifest"]') as HTMLLinkElement | null;
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  manifestLink.href = blobUrl;
}

/**
 * Updates document favicon, apple-touch-icon, and Web App Manifest from tenant branding.
 * Icon and manifest links from Next metadata are updated in place; only apple-touch links
 * we add are removed/recreated each run.
 */
export function useFavicon() {
  const { name: tenantName, logoUrl } = useTenantBrandingStore();
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const manifestBlobRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const revokeManifestBlob = () => {
      if (manifestBlobRef.current) {
        URL.revokeObjectURL(manifestBlobRef.current);
        manifestBlobRef.current = null;
      }
    };

    removeOurAppleTouchLinks();

    const displayName = tenantName?.trim() || 'NTG Alma';
    const shortName = tenantName?.trim() || 'NTG Alma';
    const themeColor = primaryColor || '#4caf50';

    const defaultIconAbs = absoluteUrlFromPublicPath(DEFAULT_FAVICON_HREF);
    const defaultIconType = 'image/svg+xml';

    if (logoUrl) {
      const separator = logoUrl.includes('?') ? '&' : '?';
      const faviconHref = logoUrl.startsWith('data:')
        ? logoUrl
        : `${logoUrl}${separator}_docicon=${Date.now()}`;
      const mime = guessImageMimeFromUrl(logoUrl);

      applyFaviconToExistingIconLinks(faviconHref, mime);

      const touch = document.createElement('link');
      touch.rel = 'apple-touch-icon';
      touch.href = faviconHref;
      touch.type = mime;
      touch.sizes = '180x180';
      touch.setAttribute(APPLE_TOUCH_ATTR, 'true');
      document.head.appendChild(touch);

      const manifestIconAbs = logoUrl.startsWith('data:') ? faviconHref : logoUrl.split('?')[0];
      const manifestBody = buildManifestJson({
        name: displayName,
        shortName,
        iconSrc: manifestIconAbs,
        iconType: mime,
        themeColor,
      });
      const blob = new Blob([manifestBody], { type: 'application/manifest+json' });
      revokeManifestBlob();
      const blobUrl = URL.createObjectURL(blob);
      manifestBlobRef.current = blobUrl;
      applyManifestHref(blobUrl);
    } else {
      applyFaviconToExistingIconLinks(DEFAULT_FAVICON_HREF, defaultIconType);

      const touch = document.createElement('link');
      touch.rel = 'apple-touch-icon';
      touch.href = DEFAULT_FAVICON_HREF;
      touch.type = defaultIconType;
      touch.sizes = '180x180';
      touch.setAttribute(APPLE_TOUCH_ATTR, 'true');
      document.head.appendChild(touch);

      const manifestBody = buildManifestJson({
        name: displayName,
        shortName,
        iconSrc: defaultIconAbs,
        iconType: defaultIconType,
        themeColor,
      });
      const blob = new Blob([manifestBody], { type: 'application/manifest+json' });
      revokeManifestBlob();
      const blobUrl = URL.createObjectURL(blob);
      manifestBlobRef.current = blobUrl;
      applyManifestHref(blobUrl);
    }

    return () => {
      revokeManifestBlob();
    };
  }, [logoUrl, tenantName, primaryColor]);
}
