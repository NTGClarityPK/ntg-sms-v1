'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton, Container, Stack } from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';
import { getSessionWithRetry, isLogoutInProgress } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth-store';

interface AuthGuardProps {
  children: React.ReactNode;
}

function hasCachedPortalUser(): boolean {
  return Boolean(useAuthStore.getState().user);
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const { user } = useAuth();

  const redirectToLogin = () => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/login')) return;
    // Never hard-kick while offline if we still have a cached portal user —
    // that tears down the shell and breaks attendance offline mode.
    if (isBrowserOffline() && hasCachedPortalUser()) return;
    window.location.replace('/login');
  };

  // Check Supabase session directly - this is the source of truth
  useEffect(() => {
    const checkSupabaseSession = async () => {
      if (isLogoutInProgress()) {
        setHasSession(false);
        setCheckingSession(false);
        redirectToLogin();
        return;
      }
      try {
        const session = await getSessionWithRetry({ attempts: 3, delayMs: 50 });
        const nextHasSession = !!session?.access_token;
        if (nextHasSession) {
          setHasSession(true);
          setCheckingSession(false);
          return;
        }
        // Offline: keep shell alive using persisted auth store (Resto-style).
        if (isBrowserOffline() && hasCachedPortalUser()) {
          setHasSession(true);
          setCheckingSession(false);
          return;
        }
        setHasSession(false);
        setCheckingSession(false);
        redirectToLogin();
      } catch {
        if (isBrowserOffline() && hasCachedPortalUser()) {
          setHasSession(true);
          setCheckingSession(false);
          return;
        }
        setHasSession(false);
        setCheckingSession(false);
        redirectToLogin();
      }
    };

    void checkSupabaseSession();
  }, [router]);

  // Re-check when Supabase signs out (logout must not leave portal on a blank page).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_OUT' && session?.access_token) return;
      // Offline TOKEN_REFRESHED failures can surface oddly — only hard-kick on real sign-out.
      if (event === 'SIGNED_OUT') {
        setHasSession(false);
        setCheckingSession(false);
        redirectToLogin();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Don't render the portal until session is known and `/auth/me` has produced a user.
  // After logout, `hasSession` can flip false while persisted store still hydrates — never render children without `user`.
  if (checkingSession || !hasSession || (hasSession && !user)) {
    return (
      <Container size="sm" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Stack gap="md" align="center">
          <Skeleton height={40} width="60%" />
          <Skeleton height={200} width="100%" />
        </Stack>
      </Container>
    );
  }

  return <>{children}</>;
}
