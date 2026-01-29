'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Stack,
  Button,
  Tooltip,
  Box,
  ScrollArea,
  ActionIcon,
} from '@mantine/core';
import {
  IconHome,
  IconUsers,
  IconCalendar,
  IconChartBar,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  type IconProps,
} from '@tabler/icons-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<IconProps>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: IconHome },
  { label: 'Students', href: '/students', icon: IconUsers },
  { label: 'Attendance', href: '/attendance', icon: IconCalendar },
  { label: 'Reports', href: '/reports', icon: IconChartBar },
  { label: 'Settings', href: '/settings', icon: IconSettings },
];

interface SidebarProps {
  onMobileClose?: () => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export function Sidebar({
  onMobileClose,
  collapsed = false,
  onCollapseChange,
}: SidebarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    const content = (
      <Button
        component="button"
        type="button"
        variant="subtle"
        size="md"
        fullWidth={!collapsed}
        leftSection={collapsed ? undefined : <item.icon size={20} />}
        className="nav-item-button"
        data-active={active}
        data-collapsed={collapsed}
        onClick={() => {
          router.push(item.href);
          onMobileClose?.();
        }}
      >
        {collapsed ? <item.icon size={20} /> : item.label}
      </Button>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href} label={item.label} position="right" withArrow>
          <Box style={{ display: 'inline-block', width: '100%' }}>{content}</Box>
        </Tooltip>
      );
    }

    return (
      <Box key={item.href} style={{ display: 'inline-block', width: '100%' }}>
        {content}
      </Box>
    );
  };

  return (
    <Stack h="100%" justify="space-between" gap={0}>
      {/* Scrollable navigation area - matches RMS structure */}
      <ScrollArea h="100%" style={{ flex: 1 }}>
        <Stack gap="xs" p={collapsed ? 'xs' : 'md'}>
          {navItems.map(renderNavItem)}
        </Stack>
      </ScrollArea>

      {/* Bottom collapse toggle button - like RMS (button beneath nav items) */}
      <Box
        p={collapsed ? 'xs' : 'md'}
        style={{
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <Tooltip
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          position="right"
          withArrow
        >
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => onCollapseChange?.(!collapsed)}
            className="nav-toggle-button"
            style={{
              width: collapsed ? 'auto' : '100%',
            }}
          >
            {collapsed ? (
              <IconChevronRight size={20} />
            ) : (
              <IconChevronLeft size={20} />
            )}
          </ActionIcon>
        </Tooltip>
      </Box>
    </Stack>
  );
}

