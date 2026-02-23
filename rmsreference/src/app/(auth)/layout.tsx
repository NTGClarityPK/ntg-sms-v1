'use client';

import { ReactNode, useMemo, useLayoutEffect, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, Title, Text, Card, useMantineTheme, Button, Group } from '@mantine/core';
import { IconToolsKitchen2, IconLanguage } from '@tabler/icons-react';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useLanguageStore } from '@/lib/store/language-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useBranchStore } from '@/lib/store/branch-store';
import { STORAGE_KEYS } from '@/shared/constants/app.constants';
import { t } from '@/lib/utils/translations';
import { LanguageSelector } from '@/components/layout/LanguageSelector';

interface AuthLayoutProps {
  children: ReactNode;
}

// Helper function to calculate shade from a base color (for auth pages)
function calculateShade(baseColor: string, shade: number = 8): string {
  // Convert hex to RGB
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Darken: mix with black
  const factor = (shade - 6) / 3;
  const darkenFactor = factor * 0.4;
  const newR = Math.round(Math.max(0, r * (1 - darkenFactor)));
  const newG = Math.round(Math.max(0, g * (1 - darkenFactor)));
  const newB = Math.round(Math.max(0, b * (1 - darkenFactor)));

  return `#${[newR, newG, newB].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

// Check localStorage directly for auth state (synchronous, no React hooks)
function checkAuthFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check for access token
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (accessToken) return true;
    
    // Check auth store
    const authStorage = localStorage.getItem('rms-auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      if (parsed?.state?.isAuthenticated && parsed?.state?.user) {
        return true;
      }
    }
  } catch (e) {
    // If parsing fails, assume not authenticated
    return false;
  }
  
  return false;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useLanguageStore();
  const authState = useAuthStore.getState();
  const { isAuthenticated: isAuth, user: authUser } = useAuthStore();
  const { selectedBranchId } = useBranchStore();
  const theme = useMantineTheme();
  const primary = DEFAULT_THEME_COLOR;
  const primaryShade = useMemo(() => calculateShade(DEFAULT_THEME_COLOR, 8), []);
  
  // Check auth state synchronously from localStorage
  const isAuthenticatedFromStorage = typeof window !== 'undefined' ? checkAuthFromStorage() : false;
  const isAuthenticated = isAuthenticatedFromStorage || (isAuth && authUser) || (authState.isAuthenticated && authState.user);
  
  // Show body after confirming user is not authenticated and handle redirect
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Never redirect if we're on the login page - let it handle branch selection
    if (pathname === '/login') {
      document.body.classList.add('auth-visible');
      document.body.style.visibility = 'visible';
      return;
    }
    
    if (isAuthenticated) {
      // Only redirect if a branch is selected
      // This allows the login page to show branch selection modal first
      if (selectedBranchId) {
        router.push('/portal');
      } else {
        // User is authenticated but no branch selected yet - allow login page to handle branch selection
        document.body.classList.add('auth-visible');
        document.body.style.visibility = 'visible';
      }
    } else {
      // Show content if not authenticated
      document.body.classList.add('auth-visible');
      document.body.style.visibility = 'visible';
    }
  }, [isAuthenticated, selectedBranchId, router, pathname]);

  // Don't render if authenticated AND branch is selected AND not on login page (after all hooks are called)
  // If authenticated but no branch selected, or on login page, allow login page to show branch selection
  if (isAuthenticated && selectedBranchId && pathname !== '/login') {
    return null;
  }

  return (
    <>
      {/* Inline script that runs immediately to check auth and hide body */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const accessToken = localStorage.getItem('${STORAGE_KEYS.ACCESS_TOKEN}');
                const branchStorage = localStorage.getItem('rms-branch-storage');
                const selectedBranchId = branchStorage ? JSON.parse(branchStorage)?.state?.selectedBranchId : null;
                
                if (accessToken && selectedBranchId) {
                  window.location.replace('/portal');
                  return;
                }
                const authStorage = localStorage.getItem('rms-auth-storage');
                if (authStorage) {
                  const parsed = JSON.parse(authStorage);
                  if (parsed?.state?.isAuthenticated && parsed?.state?.user && selectedBranchId) {
                    window.location.replace('/portal');
                    return;
                  }
                }
                // If not authenticated or no branch selected, ensure body is visible
                if (document.body) {
                  document.body.style.visibility = 'visible';
                }
              } catch (e) {
                // Ignore errors, show content
                if (document.body) {
                  document.body.style.visibility = 'visible';
                }
              }
            })();
          `,
        }}
      />
      <style dangerouslySetInnerHTML={{
        __html: `
          body {
            visibility: hidden !important;
          }
          body.auth-visible {
            visibility: visible !important;
          }
        `,
      }} />
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${primary} 0%, ${primaryShade} 100%)`,
        padding: '20px',
      }}
    >
      {/* Left Side - Decorative (Hidden on Mobile) */}
      <Box
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: '100vh',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        visibleFrom="md"
      >
        <Box
          style={{
            textAlign: 'center',
            color: 'white',
            zIndex: 10,
          }}
        >
          <Box
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
          >
            <IconToolsKitchen2 size={60} stroke={2} />
          </Box>
          <Title order={1} size="2.5rem" fw={800} mb="md" c="white">
            {t('navigation.restaurantManagement', language)}
          </Title>
          <Text size="lg" c="white" opacity={0.9}>
            {language === 'ar' ? 'قم بتبسيط عمليات مطعمك' : 'Streamline your restaurant operations'}
          </Text>
        </Box>
      </Box>

      {/* Right Side - Form Container */}
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          minHeight: '100vh',
          width: '100%',
          flex: 1,
        }}
      >
        <Card
          shadow="xl"
          radius="xl"
          padding="xl"
          withBorder
          style={{
            backdropFilter: 'blur(20px)',
            maxWidth: '650px',
            width: '100%',
            minHeight: '500px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* App Name Header */}
          <Box ta="center" mb="xl">
            <Title
              order={1}
              size="2.2rem"
              fw={800}
              style={{
                color: primary,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
  
                marginBottom: '8px',
              }}
            >
              RMS
            </Title>
            <Text size="sm" fw={500} style={{ color: '#4a4a4a' }}>
              {language === 'ar' ? 'نظام إدارة المطاعم' : 'Restaurant Management System'}
            </Text>
          </Box>

          {/* Language Switcher */}
          <Group justify="flex-end" mb="md">
            <LanguageSelector size="sm" />
          </Group>

      {children}
        </Card>
      </Box>
    </Box>
    </>
  );
}

