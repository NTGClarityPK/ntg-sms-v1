'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton, Container, Stack, Alert, Text } from '@mantine/core';
import { getSession } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useThemeStore } from '@/lib/store/theme-store';
import type { User } from '@/types/auth';

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Check Supabase session and verify super admin role
  useEffect(() => {
    const checkAdminSession = async () => {
      try {
        const session = await getSession();
        if (session?.access_token) {
          // Fetch user data to check if super admin
          try {
            const userResponse = await apiClient.get<User>('/api/v1/auth/me');
            const user = userResponse.data;
            
            const hasSuperAdminRole = user?.roles?.some(
              (r) => r.roleName?.toLowerCase() === 'super_admin'
            );

            if (!hasSuperAdminRole) {
              // Not super admin - redirect to regular portal
              router.push('/dashboard');
              return;
            }

            setIsSuperAdmin(true);
            useThemeStore.getState().setPrimaryColor(DEFAULT_THEME_COLOR);
            setHasSession(true);
          } catch (error) {
            console.error('Failed to fetch user data:', error);
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setCheckingSession(false);
      }
    };

    checkAdminSession();
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

  if (!hasSession || !isSuperAdmin) {
    return (
      <Container size="sm" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Alert color="red" title="Access Denied">
          <Text size="sm">This portal is only accessible to super administrators.</Text>
        </Alert>
      </Container>
    );
  }

  return <>{children}</>;
}
