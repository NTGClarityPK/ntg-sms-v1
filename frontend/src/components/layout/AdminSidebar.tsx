'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Stack,
  Button,
  Tooltip,
  Box,
  ScrollArea,
  ActionIcon,
  useMantineTheme,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconBuilding,
  IconCreditCard,
  IconHome,
  IconLockOpen,
  IconHistory,
  IconBuildings,
  type IconProps,
} from '@tabler/icons-react';
import type { ThemeConfig } from '@/lib/theme/themeConfig';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<IconProps>;
}

const NAV_ICON_SIZE = 22;

// Admin portal navigation items
const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/adminportal', icon: IconHome },
  { label: 'Assign Branch', href: '/adminportal/assign-branch', icon: IconBuilding },
  { label: 'Tenants', href: '/adminportal/tenants', icon: IconBuildings },
  { label: 'Unlock Academic Year', href: '/adminportal/unlock-academic-year', icon: IconLockOpen },
  { label: 'Payment Model', href: '/adminportal/payment-models', icon: IconCreditCard },
  { label: 'Audit Trail', href: '/adminportal/audit-trail', icon: IconHistory },
];

interface AdminSidebarProps {
  onMobileClose?: () => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export function AdminSidebar({
  onMobileClose,
  collapsed = false,
  onCollapseChange,
}: AdminSidebarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useMantineTheme();

  // Get theme config for navbar styling
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  const navbarConfig = themeConfig?.components?.navbar;
  const navButtonConfig = themeConfig?.components?.navButton;

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);

    const navId = `nav-link-${item.href.replace(/^\//, '').replaceAll('/', '-')}`;
    
    // Apply active styling ONLY when collapsed (like RMS)
    const shouldShowActive = collapsed && active;
    
    const content = (
      <Button
        id={navId}
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
      {/* Scrollable navigation area */}
      <ScrollArea
        h="100%"
        style={{ flex: 1 }}
        scrollbarSize={8}
        type="hover"
        scrollHideDelay={400}
      >
        <Stack gap="xs" p={collapsed ? 'xs' : 'md'}>
          {adminNavItems.map(renderNavItem)}
        </Stack>
      </ScrollArea>

      {/* Bottom collapse toggle button */}
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
