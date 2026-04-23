'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { User } from '@/types/auth';
import { supabase } from '@/lib/supabase/client';

/** Temporary diagnostics — `npm run dev` only; stripped from production bundles via `NODE_ENV`. */
const AUTH_ME_DIAG = process.env.NODE_ENV === 'development';

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

  if (AUTH_ME_DIAG) {
    console.log('🔵 USE_AUTH STATE:', {
      user,
      isLoading,
      error,
      status,
      timestamp: new Date().toISOString(),
    });
  }

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

