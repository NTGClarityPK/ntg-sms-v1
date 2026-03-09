'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton, Container, Stack } from '@mantine/core';
import { getSession } from '@/lib/auth';
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
      try {
        const session = await getSession();
        if (session?.access_token) {
          setHasSession(true);
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setCheckingSession(false);
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

  if (checkingSession) {
    return (
      <Container size="sm" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Stack gap="md" align="center">
          <Skeleton height={40} width="60%" />
          <Skeleton height={200} width="100%" />
        </Stack>
      </Container>
    );
  }

  if (!hasSession) {
    return null;
  }

  return <>{children}</>;
}

