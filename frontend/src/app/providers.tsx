'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { queryClient } from '@/lib/query-client';
import { createDynamicTheme } from '@/lib/utils/createDynamicTheme';
import { DynamicThemeProvider } from '@/components/providers/DynamicThemeProvider';
import { InstallPrompt } from '@/components/common/InstallPrompt';
import { PushSubscribe } from '@/components/common/PushSubscribe';
import { InstallAppProvider } from '@/lib/install-app-context';
import { SafariInstallModal } from '@/components/common/SafariInstallModal';
import { FaviconUpdater } from '@/components/common/FaviconUpdater';
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeStore } from '@/lib/store/theme-store';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { NextStepRoot } from '@/components/onboarding/NextStepRoot';
import { LocaleRepairRefresh } from '@/components/common/LocaleRepairRefresh';

/** In development, unregister any existing service workers so the production sw.js (and workbox) are not used. */
function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => reg.unregister());
    });
  }, []);
  return null;
}

/** Auth routes where theme must be default green, not tenant primary */
function isAuthRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/select-child')
  );
}

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme: colorScheme } = useTheme();
  const { primaryColor } = useThemeStore();
  // On auth pages use default green so login/signup/branch selector are not tenant-themed
  const effectivePrimary = isAuthRoute(pathname) ? DEFAULT_THEME_COLOR : (primaryColor || DEFAULT_THEME_COLOR);
  const mantineTheme = createDynamicTheme(effectivePrimary, colorScheme);

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={colorScheme}>
      <ModalsProvider>
        <FaviconUpdater />
        <DynamicThemeProvider>
          {children}
        </DynamicThemeProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeWrapper>
        <InstallAppProvider>
          <LocaleRepairRefresh />
          <DevServiceWorkerCleanup />
          <Notifications />
          <InstallPrompt />
          <SafariInstallModal />
          <PushSubscribe />
          <NextStepRoot>{children}</NextStepRoot>
        </InstallAppProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeWrapper>
    </QueryClientProvider>
  );
}

