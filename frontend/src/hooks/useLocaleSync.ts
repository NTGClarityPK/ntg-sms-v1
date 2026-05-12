import { useEffect } from 'react';
import { normalizeUiLocale, readResolvedUiLocaleFromBrowser, setUiLocaleCookieOnDocument } from '@/lib/ui-locale';
import type { User } from '@/types/auth';
import { useAuth } from '@/hooks/useAuth';

function getUserPreferredLocaleRaw(user: User): string | undefined {
  if (typeof user.preferredLocale === 'string' && user.preferredLocale.trim()) {
    return user.preferredLocale;
  }
  const legacy = (user as unknown as { preferred_locale?: unknown }).preferred_locale;
  return typeof legacy === 'string' && legacy.trim() ? legacy : undefined;
}

/**
 * Initialise the UI cookie from the authenticated user's DB preference.
 * Important: cookie is the UI source of truth. We only write when cookie is absent.
 */
export function useLocaleSync(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const cookieNorm = readResolvedUiLocaleFromBrowser();

    // If a locale cookie already exists, never override it (prevents login/logout language flips).
    if (cookieNorm) return;

    const dbNorm = normalizeUiLocale(getUserPreferredLocaleRaw(user) ?? 'en-US');
    setUiLocaleCookieOnDocument(dbNorm);
  }, [user?.id]);
}

