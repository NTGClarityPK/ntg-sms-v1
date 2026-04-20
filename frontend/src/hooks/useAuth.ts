'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  getUiLocaleCookieFromDocument,
  isSupportedUiLocale,
  LOCALE_REPAIR_REFRESH_FLAG,
  normalizeUiLocale,
  setUiLocaleCookieOnDocument,
} from '@/lib/ui-locale';
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
    const cookieNorm =
      cookieRaw != null && cookieRaw.trim() !== '' ? normalizeUiLocale(cookieRaw) : null;

    const cookieMissingOrInvalid =
      cookieRaw == null || cookieRaw.trim() === '' || !isSupportedUiLocale(cookieRaw);

    const shouldSyncFromApi =
      cookieMissingOrInvalid || (isEnglishFamily(preferredNorm) && cookieNorm === 'ar');

    if (shouldSyncFromApi) {
      setUiLocaleCookieOnDocument(preferredNorm);
      try {
        window.sessionStorage.setItem(LOCALE_REPAIR_REFRESH_FLAG, '1');
      } catch {
        // Non-blocking
      }
    }
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

