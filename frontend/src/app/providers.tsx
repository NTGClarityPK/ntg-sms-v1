'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { queryClient } from '@/lib/query-client';
import { createDynamicTheme } from '@/lib/utils/createDynamicTheme';
import { DynamicThemeProvider } from '@/components/providers/DynamicThemeProvider';
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeStore } from '@/lib/store/theme-store';

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
        <Notifications />
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeWrapper>
    </QueryClientProvider>
  );
}

