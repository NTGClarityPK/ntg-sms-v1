'use client';

import { useEffect, useState } from 'react';
import { AppShell as MantineAppShell, Burger, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { ConnectionIndicator } from '@/components/common/ConnectionIndicator';

interface AdminAppShellProps {
  children: React.ReactNode;
}

export function AdminAppShell({ children }: AdminAppShellProps) {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();

  // Desktop navbar collapsed state (persisted to localStorage)
  const [navbarCollapsed, setNavbarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('admin-navbar-collapsed');
    return saved === 'true';
  });

  // Persist collapsed state and expose on body for CSS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('admin-navbar-collapsed', String(navbarCollapsed));
    document.body.setAttribute('data-navbar-collapsed', String(navbarCollapsed));
  }, [navbarCollapsed]);

  // Calculate navbar width based on collapsed state
  const navbarWidth = navbarCollapsed ? 100 : 270;

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
        <Group h="100%" px="md">
          <Burger
            opened={mobileOpened}
            onClick={toggleMobile}
            hiddenFrom="sm"
            size="sm"
          />
          <AdminHeader />
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p={navbarCollapsed ? 'xs' : 'md'}>
        <AdminSidebar
          collapsed={navbarCollapsed}
          onCollapseChange={setNavbarCollapsed}
          onMobileClose={() => mobileOpened && toggleMobile()}
        />
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <ConnectionIndicator />
        {children}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
