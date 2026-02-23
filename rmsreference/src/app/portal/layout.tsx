'use client';

import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useBranchStore } from '@/lib/store/branch-store';
import { useLanguageStore } from '@/lib/store/language-store';
import { authApi } from '@/lib/api/auth';
import { rolesApi } from '@/lib/api/roles';
import { tokenStorage } from '@/lib/api/client';
import { ErrorBoundary } from '@/shared/error-boundary';
import { errorLogger, ErrorSeverity } from '@/shared/error-logging';
import { RouteGuard } from '@/components/common/RouteGuard';
import { useRoleAccessConfig } from '@/lib/hooks/use-role-access-config';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const { isAuthenticated, user, setUser, setPermissions } = useAuthStore();
  const { selectedBranchId } = useBranchStore();
  const { language } = useLanguageStore();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const { isTabAccessibleForUser, isPathBlockedForUser, loading: configLoading } = useRoleAccessConfig();
  
  // Navbar collapsed state (persisted to localStorage)
  const [navbarCollapsed, setNavbarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('navbar-collapsed');
      return saved === 'true';
    }
    return false; // Default to expanded
  });

  useEffect(() => {
    // Save collapsed state to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('navbar-collapsed', String(navbarCollapsed));
      // Set data attribute on body for CSS targeting
      document.body.setAttribute('data-navbar-collapsed', String(navbarCollapsed));
    }
  }, [navbarCollapsed]);

  useEffect(() => {

    // Initialize authentication state on mount
    const initializeAuth = async () => {
      try {
        const accessToken = tokenStorage.getAccessToken();
        const refreshToken = tokenStorage.getRefreshToken();

        // If no tokens at all, clear auth state and redirect
        if (!accessToken && !refreshToken) {
          // Check current auth state from store
          const currentAuthState = useAuthStore.getState();
          if (currentAuthState.isAuthenticated) {
            currentAuthState.logout();
          }
          setIsInitializing(false);
          router.push('/login');
          return;
        }

        // If we have tokens, verify they're valid by calling /auth/me
        // The axios interceptor will handle token refresh automatically if needed
        try {
          // Get current language from store
          const currentLanguage = useLanguageStore.getState().language;
          const userData = await authApi.getCurrentUser(currentLanguage);
          // If we get here, token is valid (or was refreshed by interceptor)
          setUser(userData);
          
          // Check if branch is selected - if not, logout and redirect
          const currentBranchId = useBranchStore.getState().selectedBranchId;
          if (!currentBranchId) {
            console.log('[PortalLayout] User authenticated but no branch selected during init, logging out');
            tokenStorage.clearTokens();
            useBranchStore.getState().setSelectedBranchId(null); // Explicitly clear branch
            useAuthStore.getState().logout();
            setIsInitializing(false);
            router.push('/login');
            return;
          }
          
          // Load user permissions (non-blocking - don't fail login if this fails)
          if (userData?.id) {
            // Use a timeout to prevent hanging on permission loading
            const permissionsPromise = rolesApi.getUserPermissions(userData.id);
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Permissions loading timeout')), 5000)
            );
            
            try {
              const permissions = await Promise.race([permissionsPromise, timeoutPromise]);
              setPermissions(permissions);
              
              // If no permissions and user is tenant_owner or manager, log warning but don't block
              if (permissions.length === 0 && (userData.role === 'tenant_owner' || userData.role === 'manager')) {
                console.warn('User has no permissions assigned. Please run migration 014_assign_roles_to_existing_users.sql to assign roles.');
                // For tenant owners, set empty permissions array but allow login
                setPermissions([]);
              }
            } catch (permError: any) {
              console.error('Failed to load user permissions:', permError);
              // Always allow tenant owners and managers to proceed even without permissions
              if (userData.role === 'tenant_owner' || userData.role === 'manager') {
                console.warn('Owner/Manager user permissions failed to load. Continuing with empty permissions - user can still access system.');
                // Set empty permissions but don't block login
                setPermissions([]);
              } else {
                // For other users, also set empty permissions but log the error
                setPermissions([]);
              }
              // Continue without permissions - user will have limited access but can still login
            }
          }
        } catch (error: any) {
          // If error is 401 and interceptor couldn't refresh, clear everything
          // The interceptor should have already redirected, but just in case:
          if (error?.response?.status === 401 || !refreshToken) {
            tokenStorage.clearTokens();
            useAuthStore.getState().logout();
            setIsInitializing(false);
            // Only redirect if interceptor didn't already redirect
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              router.push('/login');
            }
            return;
          }
          // Other errors, just log and continue
          console.error('Auth initialization error:', error);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        tokenStorage.clearTokens();
        useAuthStore.getState().logout();
        setIsInitializing(false);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          router.push('/login');
        }
      } finally {
        setIsInitializing(false);
        hasInitializedRef.current = true; // Mark as initialized
      }
      };

      initializeAuth();

    // Cleanup on unmount
    return () => {
      // No cleanup needed for direct communication
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - router and setUser are stable, isAuthenticated/user are checked inside the function

  // Track if we've done the initial auth check to avoid duplicate calls on mount
  const hasInitializedRef = useRef(false);
  
  // Refresh user data when language changes to get translated username
  // Skip on initial mount to avoid duplicate call with initializeAuth
  useEffect(() => {
    // Skip if we haven't initialized yet (will be handled by initializeAuth)
    if (!hasInitializedRef.current) {
      return;
    }
    
    if (isAuthenticated && user?.id) {
      const refreshUser = async () => {
        try {
          const currentLanguage = useLanguageStore.getState().language;
          const userData = await authApi.getCurrentUser(currentLanguage);
          setUser(userData);
        } catch (error) {
          console.error('Failed to refresh user on language change:', error);
        }
      };
      refreshUser();
    }
  }, [language, isAuthenticated, user?.id, setUser]);

  // Redirect to first allowed route if dashboard is not accessible
  // This hook must be before any conditional returns
  useEffect(() => {
    if (!isAuthenticated || !user || configLoading || isInitializing) return;

    // Check if current path is portal dashboard and if it's not accessible (checks all user roles)
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    if (currentPath === '/portal/dashboard' || currentPath === '/portal') {
      if (isPathBlockedForUser('/portal/dashboard') || !isTabAccessibleForUser('/portal/dashboard')) {
        // Find first allowed portal route
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
          if (isTabAccessibleForUser(route) && !isPathBlockedForUser(route)) {
            router.replace(route);
            return;
          }
        }

        // If no routes are accessible, redirect to profile (always accessible) or unauthorized
        // Profile is accessible to everyone, so use it as fallback
        router.replace('/portal/profile');
      }
    }
  }, [isAuthenticated, user, configLoading, isInitializing, isTabAccessibleForUser, isPathBlockedForUser, router]);

  // Show loading state while initializing
  if (isInitializing) {
    return null;
  }

  // Check authentication and branch selection after initialization
  if (!isAuthenticated) {
    return null;
  }

  // If authenticated but no branch selected, logout and redirect to login to select branch
  if (isAuthenticated && !selectedBranchId) {
    // Explicitly clear branch store
    useBranchStore.getState().setSelectedBranchId(null);
    // Logout the user to clear auth state
    authApi.logout();
    // Redirect to login
    router.push('/login');
    return null;
  }

  // Calculate navbar width based on collapsed state
  const navbarWidth = navbarCollapsed ? 100 : 270;

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: navbarWidth,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <Header mobileOpened={mobileOpened} toggleMobile={toggleMobile} />
      <AppShell.Navbar p={navbarCollapsed ? "xs" : "md"}>
        <Sidebar 
          onMobileClose={() => mobileOpened && toggleMobile()} 
          collapsed={navbarCollapsed}
          onCollapseChange={setNavbarCollapsed}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <ErrorBoundary
          onError={(error, errorInfo) => {
            errorLogger.logError(error, ErrorSeverity.HIGH, {
              component: 'DashboardLayout',
              errorInfo: errorInfo.componentStack,
            });
          }}
        >
          <RouteGuard>
            {children}
          </RouteGuard>
        </ErrorBoundary>
      </AppShell.Main>
    </AppShell>
  );
}

