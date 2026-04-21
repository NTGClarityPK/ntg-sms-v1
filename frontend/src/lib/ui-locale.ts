/**
 * Single source of truth for UI locale cookie + normalisation.
 * Message bundles exist for: en, en-US, en-GB, ar (see messages/*.json).
 *
 * Resolution rules (must stay aligned everywhere):
 * - **Authoritative for UI (SSR + refresh)**: `NEXT_LOCALE` — see {@link resolveUiLocaleForRequest}.
 * - **`profiles.preferred_locale`**: kept in sync from the cookie after `/auth/me` when they differ (cookie wins); login/OAuth
 *   only seeds the cookie when it is unset ({@link applyPreferredLocaleToCookieOnlyIfUnset}).
 * - **Middleware + next-intl server (`i18n/request.ts`)**: use {@link resolveUiLocaleForRequest} only.
 * - **Browser reads**: use {@link readResolvedUiLocaleFromBrowser} (or next-intl’s `useLocale()` after cookie is canonical).
 * - Low-level helpers ({@link resolveLocaleFromCookieHeader}, etc.) exist for tests and edge cases; prefer the functions above.
 */

export const UI_LOCALE_COOKIE = 'NEXT_LOCALE';
export const UI_LOCALE_COOKIE_MAX_AGE = 31536000;

/** Session flag: client repaired NEXT_LOCALE; trigger one RSC refresh (see LocaleRepairRefresh). */
export const LOCALE_REPAIR_REFRESH_FLAG = 'ntg_locale_cookie_repaired';

const SUPPORTED = new Set(['en', 'en-US', 'en-GB', 'ar']);

export function normalizeUiLocale(raw: string | null | undefined): string {
  if (raw == null) return 'en';
  const value = raw.trim();
  if (!value) return 'en';
  if (SUPPORTED.has(value)) return value;
  const lower = value.toLowerCase();
  if (lower === 'en') return 'en';
  if (lower === 'ar') return 'ar';
  return 'en';
}

export function isSupportedUiLocale(value: string): boolean {
  return SUPPORTED.has(value.trim());
}

function decodeCookieValue(raw: string): string {
  // Cookie values may be URL-encoded; decode safely.
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * True when the raw Cookie header string actually includes a NEXT_LOCALE=… entry.
 * (Do not conflate "no cookie" with `resolveLocaleFromCookieHeader` defaulting to `en`.)
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
  if (!cookieHeader) return 'en';
  const parts = cookieHeader.split(';').map((p) => p.trim());
  const matches = parts.filter((p) => p.startsWith(`${UI_LOCALE_COOKIE}=`));
  if (matches.length === 0) return 'en';
  const last = matches[matches.length - 1];
  const raw = last.substring(UI_LOCALE_COOKIE.length + 1);
  return normalizeUiLocale(decodeCookieValue(raw));
}

/** Resolve locale from one or more cookie values (handles duplicate NEXT_LOCALE cookies). */
export function resolveLocaleFromServerCookieValues(values: Iterable<string>): string {
  const list = [...values]
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (list.length === 0) return 'en';
  // When multiple cookies exist, prefer the last value (most recently set).
  return normalizeUiLocale(decodeCookieValue(list[list.length - 1]));
}

/**
 * Normalise one raw cookie jar value (Next.js `cookies().getAll` / request store), same rules as the HTTP header path.
 */
export function normalizedUiLocaleFromCookieJarEntry(raw: string): string {
  return normalizeUiLocale(decodeCookieValue(raw.trim()));
}

/**
 * Canonical locale for middleware + RSC / `next-intl` server config.
 * Prefer explicit `NEXT_LOCALE` in the raw `Cookie` header (last wins). If the header omits `NEXT_LOCALE`,
 * use the cookie jar (last wins). Never treat {@link resolveLocaleFromCookieHeader}’s default `en` as valid when the header
 * omits `NEXT_LOCALE` (that was causing wrong locale until a full refresh).
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
  return 'en';
}

export function getUiLocaleCookieFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';').map((p) => p.trim());
  const found = parts.filter((p) => p.startsWith(`${UI_LOCALE_COOKIE}=`));
  if (found.length === 0) return null;
  const rawValues = found.map((p) => p.substring(UI_LOCALE_COOKIE.length + 1)).filter((v) => v.length > 0);
  if (rawValues.length === 0) return null;
  if (rawValues.length === 1) return rawValues[0];
  // Duplicate cookie names: browsers can send multiple values. Prefer the last one (most recently set).
  return rawValues[rawValues.length - 1] ?? null;
}

/**
 * Resolved `NEXT_LOCALE` from `document.cookie` (last occurrence wins). Returns `null` if absent.
 * Matches server-side {@link resolveUiLocaleForRequest} semantics for a single browser cookie string.
 */
export function readResolvedUiLocaleFromBrowser(): string | null {
  const raw = getUiLocaleCookieFromDocument();
  if (raw == null || raw.trim() === '') return null;
  return normalizeUiLocale(decodeCookieValue(raw));
}

/**
 * Login / OAuth only: apply `profiles.preferred_locale` to `NEXT_LOCALE` when no cookie exists yet.
 * Never overwrite an existing cookie — preferred_locale may still be `ar` while the user already has
 * `NEXT_LOCALE=en` from the language switcher or from alignment with the server-rendered locale.
 */
export function applyPreferredLocaleToCookieOnlyIfUnset(
  preferredRaw: string | null | undefined,
): void {
  if (typeof document === 'undefined') return;
  const raw = getUiLocaleCookieFromDocument();
  if (raw != null && raw.trim() !== '') return;
  setUiLocaleCookieOnDocument(normalizeUiLocale(preferredRaw ?? 'en-US'));
}

export function setUiLocaleCookieOnDocument(locale: string): void {
  if (typeof document === 'undefined') return;
  const value = normalizeUiLocale(locale);
  document.cookie = `${UI_LOCALE_COOKIE}=${value}; path=/; max-age=${UI_LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
