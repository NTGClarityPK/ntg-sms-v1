'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { supabase } from '@/lib/supabase/client';

function isEnglishFamily(l: string): boolean {
  return l === 'en' || l === 'en-US' || l === 'en-GB';
}

async function fetchCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>('/api/v1/auth/me');
  let user = response.data;

  // Critical: right after login/OAuth, we can have a branchId in localStorage (set by auth callback)
  // but `/auth/me` may still return `currentBranch: null` until the branch is selected server-side.
  // If we cache that response, dashboard queries stay disabled and the UI can get stuck on skeletons.
  if (typeof window !== 'undefined' && !user?.currentBranch?.id) {
    const branchIdHint = window.localStorage.getItem('currentBranchId');
    if (branchIdHint && branchIdHint.trim() !== '') {
      try {
        await apiClient.post('/api/v1/auth/select-branch', { branchId: branchIdHint });
        const refreshed = await apiClient.get<User>('/api/v1/auth/me');
        user = refreshed.data;
      } catch {
        // Non-blocking: if select-branch fails (e.g. user not allowed), keep original user.
      }
    }
  }

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
  const queryClient = useQueryClient();
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
      // Retry on network error, and on the "session not ready yet" 401 right after login.
      // This prevents dashboard from getting stuck on skeletons until manual refresh.
      const err = error as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: { error?: { message?: string }; message?: string } };
      };

      const isNetwork =
        err?.code === 'ERR_NETWORK' ||
        err?.message === 'Network Error';

      const status = err?.response?.status;
      const bodyMsg =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        err?.message ??
        '';
      const isNoToken401 =
        status === 401 &&
        typeof bodyMsg === 'string' &&
        bodyMsg.toLowerCase().includes('no token provided');

      if (isNoToken401) return failureCount < 5;
      if (isNetwork) return failureCount < 2;
      return false;
    },
    retryDelay: (attempt) => Math.min(250 * (attempt + 1), 1200),
    refetchOnWindowFocus: false,
    enabled: true,
    staleTime: 5 * 60 * 1000,  // 5 minutes - user data rarely changes
    gcTime: 10 * 60 * 1000,    // 10 minutes
  });

  // Keep branch ID in localStorage when user data changes (avoid side effects during render).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user?.currentBranch?.id) {
      window.localStorage.setItem('currentBranchId', user.currentBranch.id);
    }
  }, [user?.currentBranch?.id]);

  // When Supabase session becomes available/changes, refetch /auth/me.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
    refetch,
  };
}

