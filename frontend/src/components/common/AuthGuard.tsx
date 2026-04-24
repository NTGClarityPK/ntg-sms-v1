'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton, Container, Stack } from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';
import { getSessionWithRetry } from '@/lib/auth';
import { useAuthStore } from '@/lib/store/auth-store';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const { user } = useAuth();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  // Check Supabase session directly - this is the source of truth
  useEffect(() => {
    const checkSupabaseSession = async () => {
      try {
        // Short boot window only (avoid multi-second artificial delays).
        const session = await getSessionWithRetry({ attempts: 3, delayMs: 50 });
        const nextHasSession = !!session?.access_token;
        setHasSession(nextHasSession);
        setCheckingSession(false);
        if (!nextHasSession) router.push('/login');
      } catch {
        setHasSession(false);
        setCheckingSession(false);
        router.push('/login');
      }
    };

    checkSupabaseSession();
  }, [router]);

  // If user is super admin, redirect to admin portal once session is confirmed
  useEffect(() => {
    if (!hasSession || !user) return;

    const isSuperAdmin = user.roles?.some(
      (r) => r.roleName?.toLowerCase() === 'super_admin',
    );

    if (isSuperAdmin) {
      router.push('/adminportal');
    }
  }, [hasSession, user, router]);

  // Critical: don't render the portal until Supabase session is known and `/auth/me` has produced a user.
  // `isLoading` alone is not enough: after `removeQueries(['auth','me'])` React Query can briefly report
  // not-loading while user is still undefined and error is unset → previously we rendered AppShell with no user (blank UI).
  // With persisted auth store, allow a brief hydration window before expecting `user`.
  if (checkingSession || (hasSession && !user && !hasHydrated)) {
    return (
      <Container size="sm" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Stack gap="md" align="center">
          <Skeleton height={40} width="60%" />
          <Skeleton height={200} width="100%" />
        </Stack>
      </Container>
    );
  }

  // If we have no session, keep the skeleton while routing to /login.
  if (!hasSession) {
    // Avoid rendering a blank portal shell if router navigation hasn't completed yet.
    return (
      <Container
        size="sm"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}
      >
        <Stack gap="md" align="center">
          <Skeleton height={40} width="60%" />
          <Skeleton height={200} width="100%" />
        </Stack>
      </Container>
    );
  }

  return <>{children}</>;
}

