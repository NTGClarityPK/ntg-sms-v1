'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Stack, Paper, Title, Text, Button, Center } from '@mantine/core';
import { IconShieldOff, IconHome } from '@tabler/icons-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useRoleAccessConfig } from '@/lib/hooks/use-role-access-config';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';

// Helper function to get first allowed portal route
function getFirstAllowedPortalRoute(
  isTabAccessibleForUserFn: (path: string) => boolean,
  isPathBlockedForUserFn: (path: string) => boolean
): string | null {
  const portalRoutes = [
    '/portal/dashboard',
    '/portal/menu',
    '/portal/pos',
    '/portal/orders',
    '/portal/inventory',
    '/portal/recipes',
    '/portal/employees',
    '/portal/customers',
    '/portal/delivery',
    '/portal/coupons',
    '/portal/reports',
    '/portal/settings',
  ];

  for (const route of portalRoutes) {
    if (isTabAccessibleForUserFn(route) && !isPathBlockedForUserFn(route)) {
      return route;
    }
  }

  // Profile is always accessible to everyone as a fallback
  return '/portal/profile';
}

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isTabAccessibleForUser, isPathBlockedForUser, loading } = useRoleAccessConfig();
  const { language } = useLanguageStore();

  useEffect(() => {
    if (loading || !user) return;

    // Check if user has manager, tenant_owner, or super_admin in any role
    const userRoleNames: string[] = [];
    if (user.role) {
      userRoleNames.push(user.role.toLowerCase());
    }
    if (user.roles && Array.isArray(user.roles)) {
      user.roles.forEach((role: any) => {
        let roleName: string | null = null;
        if (typeof role === 'string') {
          roleName = role;
        } else if (role && typeof role === 'object') {
          // Role object has 'name' property (from Role interface)
          roleName = role.name || null;
        }
        if (roleName) {
          const normalizedRoleName = roleName.toLowerCase();
          if (!userRoleNames.includes(normalizedRoleName)) {
            userRoleNames.push(normalizedRoleName);
          }
        }
      });
    }

    // Managers and tenant owners should never see this page
    if (userRoleNames.some(r => r === 'manager' || r === 'tenant_owner' || r === 'super_admin')) {
      router.replace('/portal/dashboard');
      return;
    }

    // Try to find an allowed portal route (checks all user roles)
    const firstAllowedRoute = getFirstAllowedPortalRoute(isTabAccessibleForUser, isPathBlockedForUser);
    if (firstAllowedRoute) {
      // Auto-redirect after 3 seconds
      const timer = setTimeout(() => {
        router.replace(firstAllowedRoute);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, loading, isTabAccessibleForUser, isPathBlockedForUser, router]);

  const handleGoToAllowedRoute = () => {
    if (!user) return;

    const firstAllowedRoute = getFirstAllowedPortalRoute(isTabAccessibleForUser, isPathBlockedForUser);
    if (firstAllowedRoute) {
      router.replace(firstAllowedRoute);
    }
  };

  return (
    <Center h="100vh" p="md">
      <Paper p="xl" radius="md" withBorder style={{ maxWidth: 500, width: '100%' }}>
        <Stack align="center" gap="md">
          <IconShieldOff size={64} color="red" />
          <Title order={2} ta="center">
            {t('common.accessDenied' as any, language) || 'Access Denied'}
          </Title>
          <Text c="dimmed" ta="center" size="sm">
            {t('common.noAccessibleRoutes' as any, language) || 
              'You do not have access to any pages. Please contact your administrator to configure your role permissions.'}
          </Text>
          {user && (
            <Button
              leftSection={<IconHome size={16} />}
              onClick={handleGoToAllowedRoute}
              variant="light"
            >
              {t('common.goToAllowedPage' as any, language) || 'Go to Allowed Page'}
            </Button>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}

