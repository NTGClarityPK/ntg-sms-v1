/**
 * Portal offline navigation whitelist (Resto-style).
 * Soft client routes only — never hard-reload the document.
 */

/** Paths (and subpaths) that remain usable while offline. */
export const OFFLINE_ALLOWED_PATH_PREFIXES = ['/attendance'] as const;

/** Soft-redirect target when the user is offline on a blocked page. */
export const OFFLINE_FALLBACK_PATH = '/attendance';

export function normalizePortalPath(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  // Strip locale prefixes if ever present in pathname (middleware usually rewrites).
  const cleaned = pathname.split('?')[0] || '/';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

/** True when this portal href may stay clickable / routable offline. */
export function isNavHrefAllowedOffline(href: string): boolean {
  const path = normalizePortalPath(href);
  return OFFLINE_ALLOWED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** True when the current location is allowed while offline. */
export function isPortalPathAllowedOffline(pathname: string | null | undefined): boolean {
  return isNavHrefAllowedOffline(normalizePortalPath(pathname));
}
