/**
 * Single source of truth for UI locale cookie + normalisation.
 * Message bundles exist for: en, en-US, en-GB, ar (see messages/*.json).
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

/** Resolve locale from one or more cookie values (handles duplicate NEXT_LOCALE cookies). */
export function resolveLocaleFromServerCookieValues(values: Iterable<string>): string {
  const list = [...values]
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (list.length === 0) return 'en';
  // When multiple cookies exist, prefer the last value (most recently set).
  return normalizeUiLocale(list[list.length - 1]);
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

export function setUiLocaleCookieOnDocument(locale: string): void {
  if (typeof document === 'undefined') return;
  const value = normalizeUiLocale(locale);
  document.cookie = `${UI_LOCALE_COOKIE}=${value}; path=/; max-age=${UI_LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
