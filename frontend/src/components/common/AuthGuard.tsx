'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader, Container } from '@mantine/core';
import { getSession } from '@/lib/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

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
      } catch (error) {
        console.error('Session check error:', error);
        router.push('/login');
      } finally {
        setCheckingSession(false);
      }
    };

    checkSupabaseSession();
  }, [router]);

  if (checkingSession) {
    return (
      <Container size="sm" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Loader size="lg" />
      </Container>
    );
  }

  if (!hasSession) {
    return null;
  }

  return <>{children}</>;
}

