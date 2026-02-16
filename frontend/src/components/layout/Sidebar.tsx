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
  IconCalendar,
  IconChartBar,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconBook,
  IconSchool,
  IconClock,
  IconPlaneDeparture,
  IconWalk,
  IconUsersGroup,
  IconCalendarClock,
  IconFileText,
  IconCalendarEvent,
  IconBell,
  IconStar,
  IconAlertTriangle,
  type IconProps,
} from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import { getFeatureCodeForPath } from '@/lib/permission/navFeatureMap';

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
  { label: 'Student', href: '/students', icon: IconUsers },
  { label: 'User', href: '/users', icon: IconUsers },
  { label: 'Class', href: '/academic/class-sections', icon: IconSchool },
  { label: 'Teacher Mapping', href: '/academic/teacher-mapping', icon: IconBook },
  { label: 'Parent Association', href: '/parent-associations', icon: IconUsersGroup },
  { label: 'My Child', href: '/my-children', icon: IconUsersGroup },
  { label: 'Child Timetable', href: '/children-timetable', icon: IconCalendarClock },
  { label: 'Attendance', href: '/attendance', icon: IconCalendar },
  {
    label: 'Assessment',
    href: '/assessments',
    icon: IconFileText,
    showCondition: () => {
      // Management view - hidden for students (checked in filter)
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    label: 'My Assessment',
    href: '/my-assessments',
    icon: IconFileText,
    showCondition: () => {
      // Student-only view (checked in filter)
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    label: 'Behavioral',
    href: '/behavioral',
    icon: IconStar,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true; // Filtered in render for assessor roles
    },
  },
  { label: 'Leave', href: '/leaves', icon: IconPlaneDeparture },
  { label: 'Early Departure', href: '/early-departure', icon: IconWalk },
  { label: 'Notification', href: '/notifications', icon: IconBell },
  { 
    label: 'My Event', 
    href: '/my-events', 
    icon: IconCalendarEvent,
    showCondition: () => {
      // Show for parents, students, and teachers
      if (typeof window === 'undefined') return false;
      return true; // Will be filtered in render
    }
  },
  {
    label: 'Event',
    href: '/events',
    icon: IconCalendarEvent,
    showCondition: () => {
      // Show for school_admin, principal, and academic_coordinator
      if (typeof window === 'undefined') return false;
      return true; // Will be filtered in render
    }
  },
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
  { 
    label: 'My Timetable', 
    href: '/my-timetable', 
    icon: IconCalendarClock,
    showCondition: () => {
      // Show only for students - check if user has student role
      if (typeof window === 'undefined') return false;
      // This will be checked in the component using useAuth
      return true; // Will be filtered in render
    }
  },
  {
    label: 'Timetable',
    href: '/timetable',
    icon: IconCalendarClock,
    showCondition: () => {
      // Show for school_admin, principal, and academic_coordinator
      if (typeof window === 'undefined') return false;
      // This will be checked in the component using useAuth
      return true; // Will be filtered in render
    }
  },
  {
    label: 'Conflict Management',
    href: '/conflict-management',
    icon: IconAlertTriangle,
    showCondition: () => {
      // Show for school_admin, principal, and academic_coordinator
      if (typeof window === 'undefined') return false;
      // This will be checked in the component using useAuth
      return true; // Will be filtered in render
    }
  },
  { label: 'Report', href: '/reports', icon: IconChartBar },
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
  const { canView } = usePermissions();

  // Get theme config for navbar styling
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  const navbarConfig = themeConfig?.components?.navbar;
  const navButtonConfig = themeConfig?.components?.navButton;

  // Check if user is super admin (should see everything)
  const isSuperAdmin = user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'super_admin';
  }) || false;

  // Check if user is a teacher (subject_teacher or class_teacher)
  const isTeacher = user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'subject_teacher' || roleName === 'class_teacher';
  }) || false;
  
  // Check if user is a student
  const isStudent = user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'student';
  }) || false;
  
  // Check if user has admin/coordinator role for timetable management
  const canManageTimetable = user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'school_admin' || roleName === 'principal' || roleName === 'academic_coordinator';
  }) || false;

  // Check if user is a parent
  const isParent = user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'parent';
  }) || false;

  // Check if user can manage events (admin/coordinator)
  const canManageEvents = user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'school_admin' || roleName === 'principal' || roleName === 'academic_coordinator';
  }) || false;

  // Can assess behavioral (teachers, counselors, principal, admin)
  const canAssessBehavioral = user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return (
      roleName === 'class_teacher' ||
      roleName === 'subject_teacher' ||
      roleName === 'guidance_counselor' ||
      roleName === 'principal' ||
      roleName === 'school_admin'
    );
  }) || false;
  // Filter navigation items based on conditions
  const navItems = allNavItems.filter((item) => {
    // Super admin sees everything - bypass all filters
    if (isSuperAdmin) return true;

    const featureCode = getFeatureCodeForPath(item.href);
    if (featureCode && !canView(featureCode)) return false;

    // Check showCondition if it exists
    if (item.showCondition) {
      // For management Assessments page, hide for students
      if (item.href === '/assessments') {
        return !isStudent;
      }
      // For My Assessments, show only for students
      if (item.href === '/my-assessments') {
        return isStudent;
      }
      // For "My Schedule", show only if user is a teacher
      if (item.href === '/my-schedule') {
        return isTeacher;
      }
      // For "My Timetable", show only if user is a student
      if (item.href === '/my-timetable') {
        return isStudent;
      }
      // For "Timetable Management", show only if user has admin/coordinator role
      if (item.href === '/timetable') {
        return canManageTimetable;
      }
      // For "Conflict Management", show only if user has admin/coordinator role
      if (item.href === '/conflict-management') {
        return canManageTimetable;
      }
      // For "My Events", show for parents, students, and teachers
      if (item.href === '/my-events') {
        return isParent || isStudent || isTeacher;
      }
      // For "Events Management", show only if user has admin/coordinator role
      if (item.href === '/events') {
        return canManageEvents;
      }
      // For "Behavioral", show only for roles that can assess
      if (item.href === '/behavioral') {
        return canAssessBehavioral;
      }
      // Parent-facing view only page
      if (item.href === '/my-children') {
        return isParent;
      }
      // Parent-facing children timetable page
      if (item.href === '/children-timetable') {
        return isParent;
      }
      // Keep management label/page for non-parent roles only
      if (item.href === '/parent-associations') {
        return !isParent;
      }
      return item.showCondition();
    }
    // Keep management label/page for non-parent roles only
    if (item.href === '/parent-associations') {
      return !isParent;
    }
    // Parent-facing view only page
    if (item.href === '/my-children') {
      return isParent;
    }
    // Parent-facing children timetable page
    if (item.href === '/children-timetable') {
      return isParent;
    }
    return true;
  });

  // Group items like RMS: Main and Management
  const mainItems = navItems.filter(
    (item) =>
      item.href === '/dashboard' ||
      item.href === '/students' ||
      item.href === '/attendance' ||
      item.href === '/assessments' ||
      item.href === '/my-assessments' ||
      item.href === '/behavioral' ||
      item.href === '/leaves' ||
      item.href === '/early-departure' ||
      item.href === '/my-schedule' ||
      item.href === '/my-timetable' ||
      item.href === '/my-events'
      || item.href === '/my-children'
      || item.href === '/children-timetable'
  );
  const managementItems = navItems.filter(
    (item) =>
      item.href === '/users' ||
      item.href === '/academic/class-sections' ||
      item.href === '/academic/teacher-mapping' ||
      item.href === '/timetable' ||
      item.href === '/conflict-management' ||
      item.href === '/parent-associations' ||
      item.href === '/events' ||
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
      <ScrollArea 
        h="100%" 
        style={{ flex: 1 }}
        scrollbarSize={8}
        type="auto"
      >
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

