'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton, Container, Stack } from '@mantine/core';
import { getSessionWithRetry } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const { user } = useAuth();

  // Check Supabase session directly - this is the source of truth
  useEffect(() => {
    const checkSupabaseSession = async () => {
      // Important: right after login/signup redirects, Supabase session can take a moment to become readable.
      // If we immediately return `null` and rely on a router redirect, users can see an empty portal background.
      // Keep a short "boot window" with retries and only redirect once we are confident there is no session.
      const maxRounds = 6; // ~3s total
      for (let round = 0; round < maxRounds; round++) {
        try {
          const session = await getSessionWithRetry({ attempts: 10, delayMs: 100 });
          if (session?.access_token) {
            setHasSession(true);
            setCheckingSession(false);
            return;
          }
        } catch {
          // Ignore and retry; storage/network can throw transiently on first mount.
        }
        // Small delay before next round.
        await new Promise((r) => setTimeout(r, 500));
      }

      setHasSession(false);
      setCheckingSession(false);
      router.push('/login');
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
  if (checkingSession || (hasSession && !user)) {
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

