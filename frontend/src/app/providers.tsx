'use client';

import { useEffect } from 'react';
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
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeStore } from '@/lib/store/theme-store';

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

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme: colorScheme } = useTheme();
  const { primaryColor } = useThemeStore();
  const mantineTheme = createDynamicTheme(primaryColor, colorScheme);

  return (
    <MantineProvider theme={mantineTheme}>
      <ModalsProvider>
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
          <DevServiceWorkerCleanup />
          <Notifications />
          <InstallPrompt />
          <SafariInstallModal />
          <PushSubscribe />
          {children}
        </InstallAppProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeWrapper>
    </QueryClientProvider>
  );
}

