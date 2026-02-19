'use client';

import { useEffect, useState } from 'react';
import { AppShell as MantineAppShell, Box, Burger, Group } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { StorageWarningBanner } from './StorageWarningBanner';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const isMobile = useMediaQuery('(max-width: 767px)');

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
  const navbarWidth = isMobile ? 280 : (navbarCollapsed ? 100 : 270);

  return (
    <MantineAppShell
      header={{ height: 60 }}
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
          <Box style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            <Header />
          </Box>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p={navbarCollapsed && !isMobile ? 'xs' : 'md'}>
        <Sidebar
          collapsed={navbarCollapsed}
          onCollapseChange={setNavbarCollapsed}
          onMobileClose={() => mobileOpened && toggleMobile()}
          isMobile={isMobile}
        />
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
          <StorageWarningBanner />
          {children}
        </MantineAppShell.Main>
    </MantineAppShell>
  );
}

