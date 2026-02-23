'use client';

import {
  Stack,
  Text,
  Divider,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Box,
  Button,
} from '@mantine/core';
import {
  IconDashboard,
  IconMenu2,
  IconShoppingCart,
  IconClipboardList,
  IconPackage,
  IconUsers,
  IconUser,
  IconTruck,
  IconChartBar,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconDiscount,
  IconBook,
  IconCreditCard,
} from '@tabler/icons-react';
import { useLanguageStore } from '@/lib/store/language-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useMantineTheme } from '@mantine/core';
import { t } from '@/lib/utils/translations';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useSyncStatus } from '@/lib/hooks/use-sync-status';
import { useRoleAccessConfig } from '@/lib/hooks/use-role-access-config';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { planHasReports } from '@/lib/utils/subscription';
import { PlanId } from '@/lib/api/subscription';
import { notifications } from '@mantine/notifications';
import { getErrorColor } from '@/lib/utils/theme';
import { useState, useEffect } from 'react';
import type { ThemeConfig } from '@/lib/theme/themeConfig';

const navItems = [
  { href: '/portal/dashboard', icon: IconDashboard, key: 'dashboard', permission: null }, // Dashboard always visible
  { href: '/portal/menu', icon: IconMenu2, key: 'menu', permission: { resource: 'menu', action: 'view' } },
  { href: '/portal/pos', icon: IconShoppingCart, key: 'newOrder', permission: { resource: 'orders', action: 'create' } },
  { href: '/portal/orders', icon: IconClipboardList, key: 'orders', permission: { resource: 'orders', action: 'view' } },
  { href: '/portal/inventory', icon: IconPackage, key: 'inventory', permission: { resource: 'inventory', action: 'view' } },
  { href: '/portal/recipes', icon: IconBook, key: 'recipes', permission: { resource: 'inventory', action: 'view' } },
  { href: '/portal/employees', icon: IconUsers, key: 'employees', permission: { resource: 'employees', action: 'view' } },
  { href: '/portal/customers', icon: IconUser, key: 'customers', permission: { resource: 'customers', action: 'view' } },
  { href: '/portal/delivery', icon: IconTruck, key: 'delivery', permission: { resource: 'deliveries', action: 'view' } },
  { href: '/portal/coupons', icon: IconDiscount, key: 'coupons', permission: { resource: 'coupons', action: 'view' } },
  { href: '/portal/reports', icon: IconChartBar, key: 'reports', permission: { resource: 'reports', action: 'view' } },
  { href: '/portal/billing', icon: IconCreditCard, key: 'billing', permission: null, tenantOwnerOnly: true }, // Only visible to tenant owners
  { href: '/portal/settings', icon: IconSettings, key: 'settings', permission: { resource: 'settings', action: 'view' } },
] as const;

type NavItemKey = typeof navItems[number]['key'];

const NAV_ICON_SIZE = 22;

interface SidebarProps {
  onMobileClose?: () => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export function Sidebar({ onMobileClose, collapsed = false, onCollapseChange }: SidebarProps = {}) {
  const { language } = useLanguageStore();
  const pathname = usePathname();
  const theme = useMantineTheme();
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  const { hasPermission } = usePermissions();
  const syncStatus = useSyncStatus();
  const { isTabAccessibleForUser, isPathBlockedForUser, loading: configLoading } = useRoleAccessConfig();
  const { subscription, isFreePlan } = useSubscription();
  const [, forceUpdate] = useState(0);
  
  // Check navigator.onLine directly in render (always up-to-date)
  const navigatorOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  
  // Use both navigator and syncStatus - if either says offline, we're offline
  const isOnline = navigatorOnline && syncStatus.isOnline;
  
  // Force re-render when online/offline events fire
  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 Sidebar: Online event fired, navigator.onLine:', navigator.onLine);
      forceUpdate(prev => prev + 1);
    };
    const handleOffline = () => {
      console.log('🔴 Sidebar: Offline event fired, navigator.onLine:', navigator.onLine);
      forceUpdate(prev => prev + 1);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Also poll navigator.onLine every second as a fallback
    const pollInterval = setInterval(() => {
      const currentOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (currentOnline !== navigatorOnline) {
        console.log('🔌 Sidebar: Poll detected change - navigator.onLine:', currentOnline);
        forceUpdate(prev => prev + 1);
      }
    }, 1000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pollInterval);
    };
  }, [navigatorOnline]);
  
  // Debug log
  useEffect(() => {
    console.log('🔌 Sidebar render - isOnline:', isOnline, 'navigatorOnline:', navigatorOnline, 'syncStatus.isOnline:', syncStatus.isOnline);
  }, [isOnline, navigatorOnline, syncStatus.isOnline]);

  // Items that should be disabled when offline
  const offlineDisabledItems = ['/portal/dashboard', '/portal/employees', '/portal/customers', '/portal/reports'];

  // Filter items based on permissions and role access configurations
  const visibleItems = navItems.filter((item) => {
    // Get user
    const { user } = useAuthStore.getState();
    
    // Check if item is tenant owner only - bypass all other checks if user is tenant owner
    if ((item as any).tenantOwnerOnly) {
      const userRole = user?.role?.toLowerCase();
      const isTenantOwner = userRole === 'tenant_owner' || 
        (user?.roles && Array.isArray(user.roles) && 
          user.roles.some((r: any) => {
            const roleName = typeof r === 'string' ? r : (r?.name || r?.display_name_en || '');
            return roleName?.toLowerCase() === 'tenant_owner';
          }));
      
      if (!isTenantOwner) {
        return false;
      }
      // Tenant owner has access to billing, bypass other checks
      return true;
    }
    
    // If role access config is still loading, use fallback logic
    if (configLoading) {
      // If permissions aren't loaded yet, show items based on role as fallback
      if (!user?.permissions || user.permissions.length === 0) {
        const userRole = user?.role?.toLowerCase();
        const roleFallbacks: Record<string, string[]> = {
          // Super Admin: Full access to everything (legacy role, treat as manager)
          super_admin: ['/portal/dashboard', '/portal/menu', '/portal/pos', '/portal/orders', '/portal/inventory', '/portal/recipes', '/portal/employees', '/portal/customers', '/portal/delivery', '/portal/coupons', '/portal/reports', '/portal/settings'],
          // Manager: Full access to everything
          manager: ['/portal/dashboard', '/portal/menu', '/portal/pos', '/portal/orders', '/portal/inventory', '/portal/recipes', '/portal/employees', '/portal/customers', '/portal/delivery', '/portal/coupons', '/portal/reports', '/portal/settings'],
          // Tenant Owner: Full access to everything including billing
          tenant_owner: ['/portal/dashboard', '/portal/menu', '/portal/pos', '/portal/orders', '/portal/inventory', '/portal/recipes', '/portal/employees', '/portal/customers', '/portal/delivery', '/portal/coupons', '/portal/reports', '/portal/billing', '/portal/settings'],
          // Cashier: Orders (full), Menu (view), Customers (view/create/update), Reports (view)
          cashier: ['/portal/dashboard', '/portal/pos', '/portal/orders', '/portal/menu', '/portal/customers', '/portal/reports'],
          kitchen_staff: ['/portal/dashboard', '/portal/orders', '/portal/menu', '/portal/inventory', '/portal/recipes'],
          waiter: ['/portal/dashboard', '/portal/pos', '/portal/orders', '/portal/menu', '/portal/customers'],
          delivery: ['/portal/dashboard', '/portal/orders', '/portal/delivery', '/portal/customers'],
        };
        
        // Check all user roles
        if (user?.roles && Array.isArray(user.roles)) {
          for (const role of user.roles) {
            let roleName: string | null = null;
            if (typeof role === 'string') {
              roleName = role;
            } else if (role && typeof role === 'object') {
              // Role object has 'name' property
              roleName = (role as any).name || null;
            }
            if (roleName) {
              const normalizedRoleName = roleName.toLowerCase();
              if (roleFallbacks[normalizedRoleName]?.includes(item.href)) {
                return true;
              }
            }
          }
        }
        
        if (userRole && roleFallbacks[userRole]?.includes(item.href)) {
          return true;
        }
        
        // If no fallback for role and item has no permission requirement, allow dashboard only
        if (!item.permission && item.href === '/portal/dashboard') {
          return true; // Dashboard is default fallback
        }
        
        return false;
      }
      
      // If item has no permission requirement (like dashboard), default to visible while loading
      if (!item.permission) {
        return true;
      }
      
      return hasPermission(item.permission.resource, item.permission.action);
    }
    
    // Use combined role access configurations (checks all user roles)
    // Check if path is blocked for user (any role)
    if (isPathBlockedForUser(item.href)) {
      return false;
    }
    
    // Check if tab is accessible for user (any role)
    if (!isTabAccessibleForUser(item.href)) {
      return false;
    }
    
    // If item has no permission requirement (like dashboard), rely on role access config check above
    if (!item.permission) {
      // Already checked above, so return true if we got here
      return true;
    }
    
    // Also check permissions as a fallback
    if (!user?.permissions || user.permissions.length === 0) {
      // If no permissions, rely on role access config only (already checked above)
      return true;
    }
    
    return hasPermission(item.permission.resource, item.permission.action);
  });

  // Group menu items by category
  const mainItems = visibleItems.filter(
    (item) =>
      item.href === '/portal/dashboard' ||
      item.href.startsWith('/portal/pos') ||
      item.href === '/portal/orders' ||
      item.href === '/portal/delivery'
  );
  const managementItems = visibleItems.filter(
    (item) =>
      item.href === '/portal/menu' ||
      item.href === '/portal/customers' ||
      item.href === '/portal/inventory' ||
      item.href === '/portal/recipes' ||
      item.href === '/portal/employees' ||
      item.href === '/portal/coupons' ||
      item.href === '/portal/reports' ||
      item.href === '/portal/billing' ||
      item.href === '/portal/settings'
  );

  const isActive = (href: string) => {
    if (href === '/portal/dashboard') {
      return pathname === '/portal/dashboard';
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const navbarConfig = themeConfig?.components?.navbar;
  const navButtonConfig = themeConfig?.components?.navButton;

  const renderNavItems = (items: Array<typeof navItems[number]>) => {
    // Force re-check online status in render
    const renderTimeOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const finalIsOnline = renderTimeOnline && syncStatus.isOnline;
    
    // Check if user has reports access
    const hasReportsAccess = subscription 
      ? planHasReports(subscription.planId as PlanId)
      : false;
    
    return items.map((item) => {
      const label = t(`navigation.${item.key}` as any, language);
      const isOfflineDisabled = !finalIsOnline && offlineDisabledItems.includes(item.href);
      // Disable reports tab for free plan users
      const isReportsRestricted = item.href === '/portal/reports' && !hasReportsAccess;
      const isDisabled = isOfflineDisabled || isReportsRestricted;
      const active = isActive(item.href);
      
      const handleClick = (e: React.MouseEvent) => {
        if (isDisabled) {
          e.preventDefault();
          e.stopPropagation();
          
          // Show notification for free plan users trying to access reports
          if (isReportsRestricted) {
            notifications.show({
              title: t('common.accessDenied' as any, language) || 'Access Denied',
              message: t('subscription.upgradeRequired' as any, language) || 'Upgrade your plan to access Reports & Analytics.',
              color: getErrorColor(),
            });
          }
          
          return false;
        }
        onMobileClose?.();
      };

      const buttonContent = (
        <Button
          component={(isDisabled ? 'div' : Link) as any}
          href={isDisabled ? undefined : item.href}
          variant="subtle"
          size="md"
          fullWidth={!collapsed}
          leftSection={collapsed ? undefined : <item.icon size={NAV_ICON_SIZE} />}
          className="nav-item-button"
          data-active={active}
          data-collapsed={collapsed}
          onClick={handleClick}
          disabled={isDisabled}
          style={{
            backgroundColor: active 
              ? navbarConfig?.activeBackground 
              : navButtonConfig?.backgroundColor || 'transparent',
            color: active 
              ? navbarConfig?.activeTextColor 
              : navButtonConfig?.textColor || navbarConfig?.textColor,
            opacity: isDisabled ? 0.3 : 1,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
          }}
          styles={{
            root: {
              '&:hover:not(:disabled)': {
                backgroundColor: active 
                  ? navbarConfig?.activeBackground 
                  : navbarConfig?.hoverBackground,
                color: active 
                  ? navbarConfig?.activeTextColor 
                  : navbarConfig?.hoverTextColor,
              },
            },
          }}
        >
          {collapsed ? <item.icon size={NAV_ICON_SIZE} /> : label}
        </Button>
      );

      const tooltipLabel = isDisabled 
        ? (isReportsRestricted 
            ? (t('subscription.upgradeRequired' as any, language) || 'Upgrade your plan to access Reports & Analytics.')
            : (t('navigation.offlineDisabled' as any, language) || 'This section is not available offline'))
        : label;

      if (collapsed) {
        return (
          <Tooltip key={item.href} label={tooltipLabel} position="right" withArrow>
            <Box style={{ display: 'inline-block', width: '100%' }}>{buttonContent}</Box>
          </Tooltip>
        );
      }

      // For non-collapsed, wrap disabled items in tooltip too
      if (isDisabled) {
        return (
          <Tooltip key={item.href} label={tooltipLabel} position="right" withArrow>
            <Box style={{ display: 'inline-block', width: '100%' }}>{buttonContent}</Box>
          </Tooltip>
        );
      }

      return <Box key={item.href}>{buttonContent}</Box>;
    });
  };

  const isRTL = language === 'ar';

  return (
    <Stack h="100%" justify="space-between" gap={0}>
      {/* Main Navigation - Fixed at top */}
      {mainItems.length > 0 && (
        <Box style={{ flexShrink: 0 }}>
          <Stack gap="xs" p={collapsed ? "xs" : "md"}>
            {!collapsed && (
              <Text 
                size="xs" 
                tt="uppercase" 
                fw={700} 
                c="dimmed" 
                mb="xs"
                style={{ color: navbarConfig?.textColor }}
              >
                {t('dashboard.navigation', language)}
              </Text>
            )}
            {renderNavItems(mainItems)}
          </Stack>
        </Box>
      )}

      {/* Divider - Fixed, not part of scroll */}
      {!collapsed && mainItems.length > 0 && managementItems.length > 0 && (
        <Box style={{ flexShrink: 0, px: collapsed ? "xs" : "md" }}>
          <Divider my="sm" />
        </Box>
      )}

      {/* Management Section - Scrollable */}
      {managementItems.length > 0 && (
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <Stack gap="xs" p={collapsed ? "xs" : "md"}>
            {!collapsed && (
              <Text 
                size="xs" 
                tt="uppercase" 
                fw={700} 
                c="dimmed" 
                mb="xs"
                style={{ color: navbarConfig?.textColor }}
              >
                {t('dashboard.management', language)}
              </Text>
            )}
            {renderNavItems(managementItems)}
          </Stack>
        </ScrollArea>
      )}

      {/* Toggle Button */}
      <Box 
        p={collapsed ? "xs" : "md"} 
        style={{ 
          borderTop: `1px solid ${navbarConfig?.borderColor || 'transparent'}`,
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          flexShrink: 0,
        }}
      >
        <Tooltip 
          label={collapsed 
            ? (t('navigation.expand', language) || 'Expand') 
            : (t('navigation.collapse', language) || 'Collapse')} 
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
              backgroundColor: 'transparent',
              color: navbarConfig?.textColor,
            }}
            styles={{
              root: {
                '&:hover': {
                  backgroundColor: navbarConfig?.hoverBackground,
                  color: navbarConfig?.hoverTextColor,
                },
              },
            }}
          >
            {isRTL ? (
              // RTL: reversed logic
              collapsed ? <IconChevronLeft size={NAV_ICON_SIZE} /> : <IconChevronRight size={NAV_ICON_SIZE} />
            ) : (
              // LTR: normal logic
              collapsed ? <IconChevronRight size={NAV_ICON_SIZE} /> : <IconChevronLeft size={NAV_ICON_SIZE} />
            )}
          </ActionIcon>
        </Tooltip>
      </Box>
    </Stack>
  );
}
