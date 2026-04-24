'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { User } from '@/types/auth';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth-store';

/**
 * Diagnostics for debugging auth bootstrap.
 * Off by default to avoid noisy logs; enable locally by setting:
 * `NEXT_PUBLIC_AUTH_ME_DIAG=true`
 */
const AUTH_ME_DIAG =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_AUTH_ME_DIAG === 'true';

async function fetchCurrentUser(): Promise<User> {
  if (AUTH_ME_DIAG) {
    console.log('🟡 FETCH_CURRENT_USER: Starting...');
  }

  try {
    const response = await apiClient.get<User>('/api/v1/auth/me');
    const user = response.data;

    if (AUTH_ME_DIAG) {
      console.log('🟡 FETCH_CURRENT_USER: Got response:', {
        hasUser: !!user,
        userId: user?.id,
        currentBranch: user?.currentBranch,
      });
    }

    // Critical: right after login/OAuth, we can have a branchId in localStorage (set by auth callback)
    // but `/auth/me` may still return `currentBranch: null` until the branch is selected server-side.
    // Keep this logic, but do NOT do anything else in this function that can block returning the user.
    if (typeof window !== 'undefined' && !user?.currentBranch?.id) {
      const branchIdHint = window.localStorage.getItem('currentBranchId');
      if (branchIdHint && branchIdHint.trim() !== '') {
        try {
          await apiClient.post('/api/v1/auth/select-branch', { branchId: branchIdHint });
          const refreshed = await apiClient.get<User>('/api/v1/auth/me');
          if (AUTH_ME_DIAG) {
            console.log('🟢 FETCH_CURRENT_USER: Returning user (after branch selection):', {
              userId: refreshed.data?.id,
              currentBranchId: refreshed.data?.currentBranch?.id,
            });
          }
          return refreshed.data;
        } catch (branchErr: unknown) {
          if (AUTH_ME_DIAG) {
            console.warn('Branch selection failed; continuing with original user.', branchErr);
          }
        }
      }
    }

    if (AUTH_ME_DIAG) {
      console.log('🟢 FETCH_CURRENT_USER: Returning user:', {
        userId: user?.id,
        currentBranchId: user?.currentBranch?.id,
      });
    }

    return user;
  } catch (error: unknown) {
    if (AUTH_ME_DIAG) {
      console.error('❌ FETCH_CURRENT_USER: Error:', error);
    }
    throw error;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const storeUser = useAuthStore((s) => s.user);
  const setStoreUser = useAuthStore((s) => s.setUser);
  const storeBranchId = useAuthStore((s) => s.branchId);
  const setStoreBranchId = useAuthStore((s) => s.setBranchId);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const hasSessionRef = useRef<boolean | null>(null);
  hasSessionRef.current = hasSession;

  // Bootstrap: detect whether a Supabase session exists.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        const nextHasSession = !!data.session?.access_token;
        setHasSession(nextHasSession);
      } catch {
        if (!alive) return;
        setHasSession(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
    // Prefer instant render from persisted Zustand, then refresh in background.
    initialData: storeUser ?? undefined,
    initialDataUpdatedAt: storeUser ? Date.now() : undefined,
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

      // If the user is logged out, do not loop retries.
      if (isNoToken401 && hasSessionRef.current === false) return false;
      if (isNoToken401) return failureCount < 5;
      if (isNetwork) return failureCount < 2;
      return false;
    },
    // Keep dashboard responsive on first mount after sign-in.
    retryDelay: (attempt) => Math.min(100 * (attempt + 1), 600),
    refetchOnWindowFocus: false,
    // Critical: avoid calling `/auth/me` when logged out (prevents loops on logout redirects).
    enabled: hasSession === true,
    staleTime: 5 * 60 * 1000,  // 5 minutes - user data rarely changes
    gcTime: 10 * 60 * 1000,    // 10 minutes
  });

  // Intentionally no render-time logging by default (too noisy).

  // Keep Zustand store in sync with freshest `/auth/me`.
  useEffect(() => {
    if (!user) return;
    setStoreUser(user as User);
  }, [user, setStoreUser]);

  // Keep branch ID in localStorage when user data changes (avoid side effects during render).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user?.currentBranch?.id) {
      window.localStorage.setItem('currentBranchId', user.currentBranch.id);
    }
  }, [user?.currentBranch?.id]);

  // Also keep branch ID in Zustand for fast access in guards/hooks.
  useEffect(() => {
    const nextBranchId = user?.currentBranch?.id ?? null;
    if (!nextBranchId) return;
    if (storeBranchId === nextBranchId) return;
    setStoreBranchId(nextBranchId);
  }, [user?.currentBranch?.id, storeBranchId, setStoreBranchId, user]);

  // When Supabase session becomes available/changes, refetch /auth/me.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setHasSession(false);
        try {
          window.localStorage.removeItem('currentBranchId');
        } catch {
          // ignore
        }
        // Clear persisted auth snapshot so guards don't think we're logged in.
        useAuthStore.getState().clear();
        queryClient.cancelQueries({ queryKey: ['auth', 'me'] });
        queryClient.removeQueries({ queryKey: ['auth', 'me'] });
        return;
      }

      if (event === 'SIGNED_IN') {
        setHasSession(true);
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setHasSession(true);
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const resolvedUser = useMemo(() => (user as User | undefined) ?? storeUser ?? undefined, [user, storeUser]);

  return {
    user: resolvedUser,
    // When we don't yet know session state, treat as loading.
    isLoading: hasSession === null ? true : isLoading,
    isAuthenticated: !!resolvedUser && !error,
    error,
    refetch,
  };
}

