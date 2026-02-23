'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useBranchStore } from '@/lib/store/branch-store';
import { useRoleAccessConfig } from '@/lib/hooks/use-role-access-config';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { isRestrictedRoute, planHasReports } from '@/lib/utils/subscription';
import { PlanId } from '@/lib/api/subscription';
import { notifications } from '@mantine/notifications';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import { getErrorColor } from '@/lib/utils/theme';
import { authApi } from '@/lib/api/auth';

interface RouteGuardProps {
  children: React.ReactNode;
}

// Helper function to get first allowed route
function getFirstAllowedRoute(
  isTabAccessibleForUserFn: (path: string) => boolean,
  isPathBlockedForUserFn: (path: string) => boolean
): string | null {
  const allRoutes = [
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

  for (const route of allRoutes) {
    if (isTabAccessibleForUserFn(route) && !isPathBlockedForUserFn(route)) {
      return route;
    }
  }

  return null;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { selectedBranchId } = useBranchStore();
  const { isPathBlockedForUser, isTabAccessibleForUser, isKitchenDisplayEnabledForUser, loading } = useRoleAccessConfig();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const { language } = useLanguageStore();

  useEffect(() => {
    // Don't block if still loading or no user
    if (loading || subscriptionLoading || !user) return;

    // If user is authenticated but no branch is selected, logout and redirect to login
    if (user && !selectedBranchId) {
      console.log('[RouteGuard] User authenticated but no branch selected, logging out');
      authApi.logout();
      router.push('/login');
      return;
    }

    // Check subscription-based route restrictions (e.g., Reports for Free plan)
    // Check this early to prevent page rendering and API calls
    if (subscription && isRestrictedRoute(pathname)) {
      const planId = subscription.planId as PlanId;
      if (!planHasReports(planId)) {
        // Only show notification if we're actually on the reports route
        // This prevents showing notification when redirecting from other places
        if (pathname === '/portal/reports' || pathname.startsWith('/portal/reports/')) {
          notifications.show({
            title: t('common.accessDenied' as any, language) || 'Access Denied',
            message: t('subscription.upgradeRequired' as any, language) || 'Upgrade your plan to access Reports & Analytics.',
            color: getErrorColor(),
          });
        }
        router.push('/portal/dashboard');
        return;
      }
    }

    // Profile page is accessible to everyone - skip permission checks
    if (pathname === '/portal/profile') {
      return;
    }

    // Billing page is accessible only to tenant owners - skip permission checks
    if (pathname === '/portal/billing') {
      const isTenantOwner = user?.role?.toLowerCase() === 'tenant_owner' ||
        (user?.roles && Array.isArray(user.roles) &&
          user.roles.some((r: any) => {
            const roleName = typeof r === 'string' ? r : (r?.name || r?.display_name_en || '');
            return roleName?.toLowerCase() === 'tenant_owner';
          }));
      
      if (isTenantOwner) {
        return; // Allow access for tenant owners
      } else {
        // Redirect non-owners
        notifications.show({
          title: t('common.accessDenied' as any, language) || 'Access Denied',
          message: 'Only tenant owners can access billing information.',
          color: getErrorColor(),
        });
        router.push('/portal/dashboard');
        return;
      }
    }

    // Kitchen display page is accessible if kitchen display is enabled for user
    // Kitchen display is a special feature that can be enabled independently
    // It doesn't require any other permissions - if enabled, user can access it
    // IMPORTANT: This check must happen BEFORE the general permission checks
    // because /portal/orders/kitchen is not in the accessibleTabs list
    if (pathname === '/portal/orders/kitchen') {
      const kitchenDisplayEnabled = isKitchenDisplayEnabledForUser();
      
      console.log('[RouteGuard] Kitchen display check:', {
        pathname,
        kitchenDisplayEnabled,
        userRole: user?.role,
      });
      
      if (kitchenDisplayEnabled) {
        console.log('[RouteGuard] Allowing kitchen display access');
        return; // Allow access - kitchen display is enabled
      }
      
      // Redirect if kitchen display is not enabled
      console.log('[RouteGuard] Blocking kitchen display access - not enabled for user');
      notifications.show({
        title: t('common.accessDenied' as any, language) || 'Access Denied',
        message: t('orders.unauthorizedKitchenAccess' as any, language) || 'You do not have permission to access the kitchen display.',
        color: getErrorColor(),
      });
      // Try to redirect to first allowed route, or dashboard as fallback
      const firstAllowedRoute = getFirstAllowedRoute(isTabAccessibleForUser, isPathBlockedForUser);
      router.push(firstAllowedRoute || '/portal/dashboard');
      return;
    }

    // Check if path is blocked for user (checks all roles)
    // NOTE: This will NOT run for /portal/orders/kitchen because we return early above
    if (isPathBlockedForUser(pathname)) {
      // Find first allowed route
      const firstAllowedRoute = getFirstAllowedRoute(isTabAccessibleForUser, isPathBlockedForUser);
      if (firstAllowedRoute) {
        // notifications.show({
        //   title: t('common.accessDenied' as any, language) || 'Access Denied',
        //   message: t('common.pathBlocked' as any, language) || 'You do not have permission to access this page.',
        //   color: getErrorColor(),
        // });
        router.push(firstAllowedRoute);
      } else {
        router.push('/portal/unauthorized');
      }
      return;
    }

    // Check if tab is accessible for user (checks all roles)
    if (!isTabAccessibleForUser(pathname)) {
      // Find first allowed route
      const firstAllowedRoute = getFirstAllowedRoute(isTabAccessibleForUser, isPathBlockedForUser);
      if (firstAllowedRoute) {
        // notifications.show({
        //   title: t('common.accessDenied' as any, language) || 'Access Denied',
        //   message: t('common.pathNotAccessible' as any, language) || 'You do not have permission to access this page.',
        //   color: getErrorColor(),
        // });
        router.push(firstAllowedRoute);
      } else {
        router.push('/portal/unauthorized');
      }
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user, isPathBlockedForUser, isTabAccessibleForUser, isKitchenDisplayEnabledForUser, loading, subscriptionLoading, subscription, router, language]);

  return <>{children}</>;
}

