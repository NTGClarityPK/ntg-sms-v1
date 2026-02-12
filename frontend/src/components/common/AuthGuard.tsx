'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton, Container, Stack } from '@mantine/core';
import { getSession } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useThemeStore } from '@/lib/store/theme-store';
import type { Tenant } from '@/types/tenant';

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
          // Bootstrap tenant theme before rendering protected pages.
          // This keeps colour consistent for all users in the tenant on first paint.
          try {
            const tenantResponse = await apiClient.get<Tenant>('/api/v1/tenants/me');
            const tenantTheme = tenantResponse.data?.primaryColor || DEFAULT_THEME_COLOR;
            useThemeStore.getState().setPrimaryColor(tenantTheme);
          } catch {
            useThemeStore.getState().setPrimaryColor(DEFAULT_THEME_COLOR);
          }
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

