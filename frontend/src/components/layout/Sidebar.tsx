'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Stack,
  Button,
  Tooltip,
  Box,
  ScrollArea,
  ActionIcon,
  Text,
  Divider,
  useMantineTheme,
} from '@mantine/core';
import {
  IconHome,
  IconUsers,
  IconUser,
  IconCalendar,
  IconChartBar,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconBook,
  IconSchool,
  IconClock,
  type IconProps,
} from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import type { ThemeConfig } from '@/lib/theme/themeConfig';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<IconProps>;
  showCondition?: () => boolean;
}

const NAV_ICON_SIZE = 22;

// All navigation items
const allNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: IconHome },
  { label: 'Students', href: '/students', icon: IconUsers },
  { label: 'Staff', href: '/staff', icon: IconUser },
  { label: 'Users', href: '/users', icon: IconUsers },
  { label: 'Class Sections', href: '/academic/class-sections', icon: IconSchool },
  { label: 'Teacher Mapping', href: '/academic/teacher-mapping', icon: IconBook },
  { label: 'Attendance', href: '/attendance', icon: IconCalendar },
  { 
    label: 'My Schedule', 
    href: '/my-schedule', 
    icon: IconClock,
    showCondition: () => {
      // Show only for teachers - check if user has teacher role
      if (typeof window === 'undefined') return false;
      // This will be checked in the component using useAuth
      return true; // Will be filtered in render
    }
  },
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
  const theme = useMantineTheme();
  const { user } = useAuth();
  
  // Get theme config for navbar styling
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  const navbarConfig = themeConfig?.components?.navbar;
  const navButtonConfig = themeConfig?.components?.navButton;

  // Check if user is a teacher
  const isTeacher = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'teacher') || false;

  // Filter navigation items based on conditions
  const navItems = allNavItems.filter((item) => {
    // Check showCondition if it exists
    if (item.showCondition) {
      // For "My Schedule", show only if user is a teacher
      if (item.href === '/my-schedule') {
        return isTeacher;
      }
      return item.showCondition();
    }
    return true;
  });

  // Group items like RMS: Main and Management
  const mainItems = navItems.filter(
    (item) =>
      item.href === '/dashboard' ||
      item.href === '/students' ||
      item.href === '/attendance' ||
      item.href === '/my-schedule'
  );
  const managementItems = navItems.filter(
    (item) =>
      item.href === '/staff' ||
      item.href === '/users' ||
      item.href === '/academic/class-sections' ||
      item.href === '/academic/teacher-mapping' ||
      item.href === '/reports' ||
      item.href === '/settings'
  );

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    
    // Apply active styling ONLY when collapsed (like RMS)
    const shouldShowActive = collapsed && active;
    
    const content = (
      <Button
        component="button"
        type="button"
        variant="subtle"
        size="md"
        fullWidth={!collapsed}
        leftSection={collapsed ? undefined : <item.icon size={NAV_ICON_SIZE} />}
        className="nav-item-button"
        data-active={active}
        data-collapsed={collapsed}
        onClick={() => {
          router.push(item.href);
          onMobileClose?.();
        }}
        style={{
          backgroundColor: shouldShowActive 
            ? navbarConfig?.activeBackground 
            : navButtonConfig?.backgroundColor || 'transparent',
          color: shouldShowActive 
            ? navbarConfig?.activeTextColor 
            : navButtonConfig?.textColor || navbarConfig?.textColor,
        }}
        styles={{
          root: {
            '&:hover:not(:disabled)': {
              backgroundColor: shouldShowActive 
                ? navbarConfig?.activeBackground 
                : navbarConfig?.hoverBackground,
              color: shouldShowActive 
                ? navbarConfig?.activeTextColor 
                : navbarConfig?.hoverTextColor,
            },
          },
        }}
      >
        {collapsed ? <item.icon size={NAV_ICON_SIZE} /> : item.label}
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
          {/* Main Navigation */}
          {!collapsed && mainItems.length > 0 && (
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
              Main
            </Text>
          )}
          {mainItems.map(renderNavItem)}

          {/* Management Section */}
          {managementItems.length > 0 && (
            <>
              {!collapsed && <Divider my="sm" />}
              {!collapsed && (
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                  Management
                </Text>
              )}
              {managementItems.map(renderNavItem)}
            </>
          )}
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

