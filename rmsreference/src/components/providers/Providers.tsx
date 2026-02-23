'use client';

import { ReactNode } from 'react';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { useLanguageStore } from '@/lib/store/language-store';
import { useApiLimitStore } from '@/lib/store/api-limit-store';
import { useFavicon } from '@/lib/hooks/use-favicon';
import { ThemeProvider } from './ThemeProvider';
import { DynamicThemeProvider } from './DynamicThemeProvider';
import { ApiLimitErrorModal } from '@/components/common/ApiLimitErrorModal';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';

interface ProvidersProps {
  children: ReactNode;
}

function FaviconProvider({ children }: { children: ReactNode }) {
  useFavicon(); // Initialize dynamic favicon
  return <>{children}</>;
}

export function Providers({ children }: ProvidersProps) {
  const { language, isRTL } = useLanguageStore();
  const dir = isRTL() ? 'rtl' : 'ltr';
  const { isOpen, dailyLimit, currentCount, closeModal } = useApiLimitStore();

  return (
    <ThemeProvider>
      <ModalsProvider>
        <DynamicThemeProvider>
          <Notifications 
            position="top-right" 
            zIndex={10000}
            containerWidth={400}
          />
          <ApiLimitErrorModal
            opened={isOpen}
            onClose={closeModal}
            dailyLimit={dailyLimit}
            currentCount={currentCount}
          />
          <FaviconProvider>
            <div dir={dir} lang={language} suppressHydrationWarning>
              {children}
            </div>
          </FaviconProvider>
        </DynamicThemeProvider>
      </ModalsProvider>
    </ThemeProvider>
  );
}

