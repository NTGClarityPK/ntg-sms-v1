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
 * Keep the UI cookie aligned with the authenticated user's DB preference.
 * This is intentionally one-way (DB -> cookie) to avoid locale "ping-pong" during navigation.
 */
export function useLocaleSync(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const dbNorm = normalizeUiLocale(getUserPreferredLocaleRaw(user) ?? 'en-US');
    const cookieNorm = readResolvedUiLocaleFromBrowser();

    if (cookieNorm !== dbNorm) {
      setUiLocaleCookieOnDocument(dbNorm);
    }
  }, [user?.id]);
}

