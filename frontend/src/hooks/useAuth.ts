'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  getUiLocaleCookieFromDocument,
  LOCALE_REPAIR_REFRESH_FLAG,
  normalizeUiLocale,
  readResolvedUiLocaleFromBrowser,
  setUiLocaleCookieOnDocument,
} from '@/lib/ui-locale';
import { syncProfilePreferredLocaleWithCookie } from '@/lib/locale-preference-sync';
import { User } from '@/types/auth';

function isEnglishFamily(l: string): boolean {
  return l === 'en' || l === 'en-US' || l === 'en-GB';
}

async function fetchCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>('/api/v1/auth/me');
  const user = response.data;

  if (typeof window !== 'undefined') {
    const rawPreferred =
      user.preferredLocale ?? (user as { preferred_locale?: string }).preferred_locale;
    const preferredNorm = normalizeUiLocale(rawPreferred ?? 'en-US');

    const cookieRaw = getUiLocaleCookieFromDocument();
    const cookieNorm = readResolvedUiLocaleFromBrowser();

    // Profile says English but cookie resolved to Arabic (repair legacy mismatch).
    const needsEnglishRepair =
      cookieNorm != null &&
      isEnglishFamily(preferredNorm) &&
      cookieNorm === 'ar';

    // When NEXT_LOCALE is missing in the browser, the server may still render English (default)
    // while preferred_locale is Arabic — never push profile into the cookie here or the next
    // refresh will follow the new cookie and flip the UI. Align the cookie with what we already
    // rendered: <html lang> from the root layout (next-intl / resolveUiLocaleForRequest).
    const cookieAbsent = cookieRaw == null || cookieRaw.trim() === '';

    const shouldRepairLocaleCookie = needsEnglishRepair || cookieAbsent;

    if (shouldRepairLocaleCookie) {
      const nextLocale = needsEnglishRepair
        ? preferredNorm
        : normalizeUiLocale(document.documentElement?.lang?.trim() || 'en-US');
      setUiLocaleCookieOnDocument(nextLocale);
      try {
        window.sessionStorage.setItem(LOCALE_REPAIR_REFRESH_FLAG, '1');
      } catch {
        // Non-blocking
      }
    }

    // Single source of truth: NEXT_LOCALE drives SSR; DB preference follows the cookie when they differ.
    const finalCookieNorm = readResolvedUiLocaleFromBrowser();
    await syncProfilePreferredLocaleWithCookie({
      cookieNorm: finalCookieNorm,
      profilePreferredRaw: rawPreferred,
    });
  }

  return user;
}

export function useAuth() {
  const {
    data: user,
    isLoading,
    error,
    refetch,
    isFetching,
    status,
  } =   useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: (failureCount, error) => {
      // Retry on network error (e.g. backend not ready on refresh), up to 2 times
      const isNetwork = (error as { code?: string; message?: string })?.code === 'ERR_NETWORK' || (error as Error)?.message === 'Network Error';
      return isNetwork && failureCount < 2;
    },
    retryDelay: 800,
    refetchOnWindowFocus: false,
    enabled: true,
    staleTime: 5 * 60 * 1000,  // 5 minutes - user data rarely changes
    gcTime: 10 * 60 * 1000,    // 10 minutes
  });

  // Store branch ID in localStorage when user data changes
  if (user?.currentBranch?.id && typeof window !== 'undefined') {
    localStorage.setItem('currentBranchId', user.currentBranch.id);
  }

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
    refetch,
  };
}

