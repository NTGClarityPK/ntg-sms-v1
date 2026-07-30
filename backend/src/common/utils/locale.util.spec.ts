import {
  isTenantDefaultLocale,
  normalizeTenantDefaultLocale,
  normalizeUiLocale,
  resolveContentLanguage,
  resolveEffectiveLocale,
  SYSTEM_DEFAULT_LOCALE,
} from './locale.util';

describe('locale.util', () => {
  it('uses en-GB as system default', () => {
    expect(normalizeUiLocale(null)).toBe(SYSTEM_DEFAULT_LOCALE);
    expect(normalizeUiLocale(undefined)).toBe('en-GB');
    expect(normalizeUiLocale('')).toBe('en-GB');
    expect(normalizeUiLocale('en')).toBe('en-GB');
  });

  it('preserves supported locales', () => {
    expect(normalizeUiLocale('en-US')).toBe('en-US');
    expect(normalizeUiLocale('en-GB')).toBe('en-GB');
    expect(normalizeUiLocale('ar')).toBe('ar');
  });

  it('resolves effective locale with user override winning', () => {
    expect(resolveEffectiveLocale('ar', 'en-GB')).toBe('ar');
    expect(resolveEffectiveLocale('en-US', 'ar')).toBe('en-US');
    expect(resolveEffectiveLocale(null, 'ar')).toBe('ar');
    expect(resolveEffectiveLocale(undefined, 'en-US')).toBe('en-US');
    expect(resolveEffectiveLocale(null, null)).toBe('en-GB');
  });

  it('normalises tenant defaults', () => {
    expect(normalizeTenantDefaultLocale('en-GB')).toBe('en-GB');
    expect(normalizeTenantDefaultLocale('ar')).toBe('ar');
    expect(normalizeTenantDefaultLocale('en')).toBe('en-GB');
    expect(isTenantDefaultLocale('en-US')).toBe(true);
    expect(isTenantDefaultLocale('en')).toBe(false);
  });

  it('uses en-GB for content language fallback instead of ar', () => {
    expect(resolveContentLanguage(undefined)).toBe('en-GB');
    expect(resolveContentLanguage('ar')).toBe('ar');
  });
});
