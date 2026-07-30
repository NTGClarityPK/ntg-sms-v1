/**
 * Single source of truth for UI locale cookie + normalisation.
 * Message bundles exist for: en, en-US, en-GB, ar (see messages/*.json).
 *
 * Resolution rules (must stay aligned everywhere):
 * - **Authoritative for UI (SSR + refresh)**: `NEXT_LOCALE` — see {@link resolveUiLocaleForRequest}.
 * - **Effective locale after auth**: `preferredLocale ?? tenantDefaultLocale ?? en-GB`.
 * - **`profiles.preferred_locale`**: personal override; `null` means inherit tenant default.
 * - **Middleware + next-intl server (`i18n/request.ts`)**: use {@link resolveUiLocaleForRequest} only.
 * - **Browser reads**: use {@link readResolvedUiLocaleFromBrowser} (or next-intl’s `useLocale()` after cookie is canonical).
 */

export const UI_LOCALE_COOKIE = 'NEXT_LOCALE';
export const UI_LOCALE_COOKIE_MAX_AGE = 31536000;
export const SYSTEM_DEFAULT_LOCALE = 'en-GB';

const SUPPORTED = new Set(['en', 'en-US', 'en-GB', 'ar']);
const TENANT_DEFAULTS = new Set(['en-GB', 'en-US', 'ar']);

export function normalizeUiLocale(raw: string | null | undefined): string {
  if (raw == null) return SYSTEM_DEFAULT_LOCALE;
  const value = raw.trim();
  if (!value) return SYSTEM_DEFAULT_LOCALE;
  if (SUPPORTED.has(value)) {
    return value === 'en' ? SYSTEM_DEFAULT_LOCALE : value;
  }
  const lower = value.toLowerCase();
  if (lower === 'en') return SYSTEM_DEFAULT_LOCALE;
  if (lower === 'ar') return 'ar';
  return SYSTEM_DEFAULT_LOCALE;
}

export function normalizeTenantDefaultLocale(raw: string | null | undefined): string {
  const normalized = normalizeUiLocale(raw);
  return TENANT_DEFAULTS.has(normalized) ? normalized : SYSTEM_DEFAULT_LOCALE;
}

/**
 * Effective UI locale: user override wins; otherwise tenant default; otherwise system default.
 */
export function resolveEffectiveLocale(
  preferredLocale: string | null | undefined,
  tenantDefaultLocale: string | null | undefined,
): string {
  if (preferredLocale != null && preferredLocale.trim() !== '') {
    return normalizeUiLocale(preferredLocale);
  }
  return normalizeTenantDefaultLocale(tenantDefaultLocale);
}

export function isSupportedUiLocale(value: string): boolean {
  return SUPPORTED.has(value.trim());
}

function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * True when the raw Cookie header string actually includes a NEXT_LOCALE=… entry.
 */
export function hasNextLocaleInCookieHeader(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader?.trim()) return false;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  return parts.some((p) => p.startsWith(`${UI_LOCALE_COOKIE}=`));
}

/**
 * Resolve NEXT_LOCALE from the raw Cookie header deterministically.
 * When multiple cookies with the same name exist, take the last occurrence in the header string.
 */
export function resolveLocaleFromCookieHeader(cookieHeader: string | null | undefined): string {
  if (!cookieHeader) return SYSTEM_DEFAULT_LOCALE;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  const matches = parts.filter((p) => p.startsWith(`${UI_LOCALE_COOKIE}=`));
  if (matches.length === 0) return SYSTEM_DEFAULT_LOCALE;
  const last = matches[matches.length - 1];
  const raw = last.substring(UI_LOCALE_COOKIE.length + 1);
  return normalizeUiLocale(decodeCookieValue(raw));
}

/** Resolve locale from one or more cookie values (handles duplicate NEXT_LOCALE cookies). */
export function resolveLocaleFromServerCookieValues(values: Iterable<string>): string {
  const list = [...values]
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (list.length === 0) return SYSTEM_DEFAULT_LOCALE;
  return normalizeUiLocale(decodeCookieValue(list[list.length - 1]));
}

export function normalizedUiLocaleFromCookieJarEntry(raw: string): string {
  return normalizeUiLocale(decodeCookieValue(raw.trim()));
}

/**
 * Canonical locale for middleware + RSC / `next-intl` server config.
 */
export function resolveUiLocaleForRequest(input: {
  cookieHeader: string | null | undefined;
  cookieJarValues: Iterable<string>;
}): string {
  const jar = [...input.cookieJarValues]
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (hasNextLocaleInCookieHeader(input.cookieHeader)) {
    return resolveLocaleFromCookieHeader(input.cookieHeader);
  }
  if (jar.length > 0) {
    return resolveLocaleFromServerCookieValues(jar);
  }
  return SYSTEM_DEFAULT_LOCALE;
}

export function getUiLocaleCookieFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';').map((p) => p.trim());
  const found = parts.filter((p) => p.startsWith(`${UI_LOCALE_COOKIE}=`));
  if (found.length === 0) return null;
  const rawValues = found.map((p) => p.substring(UI_LOCALE_COOKIE.length + 1)).filter((v) => v.length > 0);
  if (rawValues.length === 0) return null;
  if (rawValues.length === 1) return rawValues[0];
  return rawValues[rawValues.length - 1] ?? null;
}

export function readResolvedUiLocaleFromBrowser(): string | null {
  const raw = getUiLocaleCookieFromDocument();
  if (raw == null || raw.trim() === '') return null;
  return normalizeUiLocale(decodeCookieValue(raw));
}

export function setUiLocaleCookieOnDocument(locale: string): void {
  if (typeof document === 'undefined') return;
  const value = normalizeUiLocale(locale);
  document.cookie = `${UI_LOCALE_COOKIE}=${value}; path=/; max-age=${UI_LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Reconcile the UI cookie to the server-resolved effective locale.
 * Returns true when the cookie value changed.
 */
export function reconcileUiLocaleCookie(effectiveLocale: string): boolean {
  const next = normalizeUiLocale(effectiveLocale);
  const existing = readResolvedUiLocaleFromBrowser();
  if (existing === next) return false;
  setUiLocaleCookieOnDocument(next);
  return true;
}
