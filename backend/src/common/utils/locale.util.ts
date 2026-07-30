/**
 * Shared UI locale contract for tenant defaults and user overrides.
 * Keep aligned with frontend/src/lib/ui-locale.ts where practical.
 */

export const SYSTEM_DEFAULT_LOCALE = 'en-GB' as const;

export const TENANT_DEFAULT_LOCALES = ['en-GB', 'en-US', 'ar'] as const;
export type TenantDefaultLocale = (typeof TENANT_DEFAULT_LOCALES)[number];

export const SUPPORTED_UI_LOCALES = ['en', 'en-US', 'en-GB', 'ar'] as const;
export type SupportedUiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

const TENANT_SET = new Set<string>(TENANT_DEFAULT_LOCALES);
const SUPPORTED_SET = new Set<string>(SUPPORTED_UI_LOCALES);

export function isTenantDefaultLocale(value: string): value is TenantDefaultLocale {
  return TENANT_SET.has(value);
}

export function isSupportedUiLocale(value: string): value is SupportedUiLocale {
  return SUPPORTED_SET.has(value);
}

/** Normalise a stored or requested locale; unknown values become the system default. */
export function normalizeUiLocale(raw: string | null | undefined): string {
  if (raw == null) return SYSTEM_DEFAULT_LOCALE;
  const value = raw.trim();
  if (!value) return SYSTEM_DEFAULT_LOCALE;
  if (SUPPORTED_SET.has(value)) {
    return value === 'en' ? SYSTEM_DEFAULT_LOCALE : value;
  }
  const lower = value.toLowerCase();
  if (lower === 'en') return SYSTEM_DEFAULT_LOCALE;
  if (lower === 'ar') return 'ar';
  return SYSTEM_DEFAULT_LOCALE;
}

/** Tenant default: only en-GB | en-US | ar. */
export function normalizeTenantDefaultLocale(raw: string | null | undefined): TenantDefaultLocale {
  const normalized = normalizeUiLocale(raw);
  if (isTenantDefaultLocale(normalized)) return normalized;
  return SYSTEM_DEFAULT_LOCALE;
}

/**
 * Effective UI locale for a user in a tenant context.
 * User override wins; otherwise tenant default; otherwise system default.
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

/** Content/name translation language when a request omits `language`. */
export function resolveContentLanguage(language: string | null | undefined): string {
  return normalizeUiLocale(language);
}
