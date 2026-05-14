'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  AppShell as MantineAppShell,
  Box,
  Burger,
  Group,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { StorageWarningBanner } from './StorageWarningBanner';
import { SetupBanner } from './SetupBanner';
import { ConnectionIndicator } from '@/components/common/ConnectionIndicator';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const theme = useMantineTheme();
  const locale = useLocale();
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isRtl = locale === 'ar';

  // Desktop navbar collapsed state (persisted to localStorage, like RMS)
  const [navbarCollapsed, setNavbarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('navbar-collapsed');
    return saved === 'true';
  });

  // Persist collapsed state and expose on body for CSS (DynamicThemeProvider uses this)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('navbar-collapsed', String(navbarCollapsed));
    document.body.setAttribute('data-navbar-collapsed', String(navbarCollapsed));
  }, [navbarCollapsed]);

  // On mobile use full drawer width; on desktop use collapsed/expanded width
  const navbarWidth = isMobile ? 280 : (navbarCollapsed ? 60 : 270);
  const cornerOffset = navbarWidth;

  return (
    <MantineAppShell
      header={{ height: 'calc(60px + env(safe-area-inset-top, 0px))' }}
      navbar={{
        width: navbarWidth,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" wrap="nowrap" style={{ minHeight: 60, overflow: 'hidden' }}>
          {/* Mobile menu toggle - visible only below sm, never shrinks */}
          <Box hiddenFrom="sm" style={{ flexShrink: 0 }}>
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              size="sm"
              aria-label="Toggle menu"
            />
          </Box>
          <Box style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <Header />
          </Box>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar
        p={
          navbarCollapsed && !isMobile
            ? { pt: 0, pb: theme.spacing.md, px: 0 }
            : 'md'
        }
      >
        <Sidebar
          collapsed={navbarCollapsed}
          onCollapseChange={setNavbarCollapsed}
          onMobileClose={() => mobileOpened && toggleMobile()}
          isMobile={isMobile}
        />
      </MantineAppShell.Navbar>

      {!isMobile && (
        <Box
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: 'calc(60px + env(safe-area-inset-top, 0px))',
            width: '16px',
            height: '16px',
            zIndex: 101,
            pointerEvents: 'none',
            left: isRtl ? undefined : `${cornerOffset}px`,
            right: isRtl ? `${cornerOffset}px` : undefined,
            background: isRtl
              ? 'radial-gradient(circle at 0 100%, transparent 16px, var(--theme-navbar-bg) 16px)'
              : 'radial-gradient(circle at 100% 100%, transparent 16px, var(--theme-navbar-bg) 16px)',
          }}
        />
      )}

      <MantineAppShell.Main>
          <ConnectionIndicator />
          <StorageWarningBanner />
          <SetupBanner />
          {children}
        </MantineAppShell.Main>
    </MantineAppShell>
  );
}

