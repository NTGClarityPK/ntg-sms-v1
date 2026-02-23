'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useRoleAccessConfig } from '@/lib/hooks/use-role-access-config';

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

  // First, try dashboard
  if (isTabAccessibleForUserFn('/portal/dashboard') && !isPathBlockedForUserFn('/portal/dashboard')) {
    return '/portal/dashboard';
  }

  // Then try other routes
  for (const route of portalRoutes) {
    if (isTabAccessibleForUserFn(route) && !isPathBlockedForUserFn(route)) {
      return route;
    }
  }

  // Profile is always accessible to everyone as a fallback
  return '/portal/profile';
}

export default function PortalPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { isTabAccessibleForUser, isPathBlockedForUser, loading } = useRoleAccessConfig();

  useEffect(() => {
    // Wait for auth and config to load
    if (loading || !isAuthenticated || !user) return;

    // Get first allowed portal route
    const allowedRoute = getFirstAllowedPortalRoute(isTabAccessibleForUser, isPathBlockedForUser);
    
    if (allowedRoute) {
      router.replace(allowedRoute);
    } else {
      // No portal routes are accessible, redirect to unauthorized
      router.replace('/portal/unauthorized');
    }
  }, [isAuthenticated, user, loading, isTabAccessibleForUser, isPathBlockedForUser, router]);

  // Show nothing while redirecting
  return null;
}

