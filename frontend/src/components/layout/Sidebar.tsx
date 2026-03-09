'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  IconMessage,
  IconStar,
  IconAlertTriangle,
  IconPackage,
  IconClipboardList,
  IconDatabase,
  IconKey,
  type IconProps,
} from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useStudentSessionStore } from '@/lib/store/student-session-store';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import { getFeatureCodeForPath } from '@/lib/permission/navFeatureMap';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<IconProps>;
  showCondition?: () => boolean;
}

const NAV_ICON_SIZE = 22;

// All navigation items (key used for next-intl navigation namespace)
const allNavItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: IconHome },
  { key: 'students', label: 'Student', href: '/students', icon: IconUsers },
  { key: 'users', label: 'User', href: '/users', icon: IconUsers },
  { key: 'classSections', label: 'Class', href: '/academic/class-sections', icon: IconSchool },
  { key: 'teacherMapping', label: 'Teacher', href: '/academic/teacher-mapping', icon: IconBook },
  { key: 'parentAssociations', label: 'Parent', href: '/parent-associations', icon: IconUsersGroup },
  { key: 'myChildren', label: 'My Child', href: '/my-children', icon: IconUsersGroup },
  { key: 'parentPinManagement', label: 'PIN Management', href: '/parent/pin-management', icon: IconKey },
  { key: 'childrenTimetable', label: 'Child Timetable', href: '/children-timetable', icon: IconCalendarClock },
  { key: 'attendance', label: 'Attendance', href: '/attendance', icon: IconCalendar },
  {
    key: 'assessments',
    label: 'Assessment',
    href: '/assessments',
    icon: IconFileText,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    key: 'myAssessments',
    label: 'My Assessment',
    href: '/my-assessments',
    icon: IconFileText,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    key: 'behavioral',
    label: 'Behavioral',
    href: '/behavioral',
    icon: IconStar,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  { key: 'leaves', label: 'Leave', href: '/leaves', icon: IconPlaneDeparture },
  { key: 'earlyDeparture', label: 'Early Departure', href: '/early-departure', icon: IconWalk },
  { key: 'notifications', label: 'Notification', href: '/notifications', icon: IconBell },
  { key: 'messages', label: 'Messages', href: '/messages', icon: IconMessage },
  { key: 'library', label: 'Library', href: '/library', icon: IconBook },
  { key: 'inventory', label: 'Inventory', href: '/inventory', icon: IconPackage },
  { key: 'uniformRequest', label: 'Request uniform', href: '/uniform-request', icon: IconClipboardList },
  {
    key: 'myEvents',
    label: 'My Event',
    href: '/my-events',
    icon: IconCalendarEvent,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    key: 'events',
    label: 'Event',
    href: '/events',
    icon: IconCalendarEvent,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    key: 'mySchedule',
    label: 'My Schedule',
    href: '/my-schedule',
    icon: IconClock,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    key: 'myTimetable',
    label: 'My Timetable',
    href: '/my-timetable',
    icon: IconCalendarClock,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    key: 'timetable',
    label: 'Timetable',
    href: '/timetable',
    icon: IconCalendarClock,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    key: 'conflictManagement',
    label: 'Conflict',
    href: '/conflict-management',
    icon: IconAlertTriangle,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  { key: 'reports', label: 'Report', href: '/reports', icon: IconChartBar },
  {
    key: 'storage',
    label: 'Storage',
    href: '/admin/storage',
    icon: IconDatabase,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  { key: 'settings', label: 'Settings', href: '/settings', icon: IconSettings },
];

interface SidebarProps {
  onMobileClose?: () => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  /** When true (mobile drawer), always show expanded layout with labels */
  isMobile?: boolean;
}

export function Sidebar({
  onMobileClose,
  collapsed = false,
  onCollapseChange,
  isMobile = false,
}: SidebarProps = {}) {
  // On mobile drawer always show full nav with labels; on desktop use collapsed state
  const effectiveCollapsed = collapsed && !isMobile;
  const router = useRouter();
  const pathname = usePathname();
  const theme = useMantineTheme();
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const { canView } = usePermissions();
  const { studentToken } = useStudentSessionStore();
  // When a parent is acting as a child, treat the sidebar as student mode
  const isActingAsStudent = !!studentToken;

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
  
  // Check if user is a student — also true when a parent is acting as a child
  const isStudent = isActingAsStudent || (user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'student';
  }) || false);
  
  // Check if user has admin/coordinator role for timetable management
  const canManageTimetable = user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'school_admin' || roleName === 'principal' || roleName === 'academic_coordinator';
  }) || false;

  // Check if user is a parent — suppressed in child mode so parent items disappear
  const isParent = !isActingAsStudent && (user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'parent';
  }) || false);

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
  const canManageStorage = user?.roles?.some((r) => {
    const roleName = r.roleName?.toLowerCase();
    return roleName === 'school_admin' || roleName === 'principal' || roleName === 'super_admin';
  }) || false;
  // Filter navigation items based on conditions
  const navItems = allNavItems.filter((item) => {
    // Super admin sees everything - bypass all filters
    if (isSuperAdmin) return true;

    // Hide dashboard in child mode — students use My Assessments as home
    if (item.href === '/dashboard' && isActingAsStudent) return false;

    // Request uniform: only for parents
    if (item.href === '/uniform-request') {
      return isParent;
    }

    const featureCode = getFeatureCodeForPath(item.href);
    // In student mode, items that have a showCondition control their own visibility
    // (e.g. /my-assessments checks isStudent). Skip the role-permission check for
    // those items so the parent's lack of my_assessments permission doesn't hide them.
    if (featureCode && !canView(featureCode)) {
      if (!isActingAsStudent || !item.showCondition) return false;
    }

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
      // Storage: school_admin, principal, super_admin only
      if (item.href === '/admin/storage') {
        return canManageStorage;
      }
      // Parent-facing view only page
      if (item.href === '/my-children') {
        return isParent;
      }
      if (item.href === '/parent/pin-management') {
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
    if (item.href === '/parent/pin-management') {
      return isParent;
    }
    // Parent-facing children timetable page
    if (item.href === '/children-timetable') {
      return isParent;
    }
    return true;
  });

  // Group items into logical sections
  const homeItems = navItems.filter(
    (item) =>
      item.href === '/dashboard' ||
      item.href === '/my-assessments'
  );

  const academicsItems = navItems.filter(
    (item) =>
      item.href === '/students' ||
      item.href === '/academic/class-sections' ||
      item.href === '/assessments' ||
      item.href === '/behavioral' ||
      item.href === '/timetable' ||
      item.href === '/my-timetable' ||
      item.href === '/my-schedule' ||
      item.href === '/children-timetable' ||
      item.href === '/my-children' ||
      item.href === '/parent/pin-management'
  );

  const attendanceItems = navItems.filter(
    (item) =>
      item.href === '/attendance' ||
      item.href === '/leaves' ||
      item.href === '/early-departure'
  );

  const peopleItems = navItems.filter(
    (item) =>
      item.href === '/academic/teacher-mapping' ||
      item.href === '/parent-associations' ||
      item.href === '/users'
  );

  const engageItems = navItems.filter(
    (item) =>
      item.href === '/messages' ||
      item.href === '/notifications' ||
      item.href === '/events' ||
      item.href === '/my-events' ||
      item.href === '/conflict-management'
  );

  const manageItems = navItems.filter(
    (item) =>
      item.href === '/library' ||
      item.href === '/inventory' ||
      item.href === '/uniform-request' ||
      item.href === '/reports' ||
      item.href === '/admin/storage' ||
      item.href === '/settings'
  );

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    
    // Apply active styling ONLY when collapsed (like RMS)
    const shouldShowActive = effectiveCollapsed && active;
    
    const content = (
      <Button
        id={`nav-link-${item.href.slice(1).replace(/\//g, '-')}`}
        component="button"
        type="button"
        variant="subtle"
        size="md"
        fullWidth={!effectiveCollapsed}
        leftSection={effectiveCollapsed ? undefined : <item.icon size={NAV_ICON_SIZE} />}
        className="nav-item-button"
        data-active={active}
        data-collapsed={effectiveCollapsed}
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
        {effectiveCollapsed ? <item.icon size={NAV_ICON_SIZE} /> : tNav(item.key)}
      </Button>
    );

    if (effectiveCollapsed) {
      return (
        <Tooltip key={item.href} label={tNav(item.key)} position="right" withArrow>
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
        <Stack gap="xs" p={effectiveCollapsed ? 'xs' : 'md'}>
          {/* Home Section */}
          {homeItems.length > 0 && (
            <>
              {!effectiveCollapsed && (
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                  {tCommon('sidebarHome')}
                </Text>
              )}
              {homeItems.map(renderNavItem)}
            </>
          )}

          {/* Academics Section */}
          {academicsItems.length > 0 && (
            <>
              {!effectiveCollapsed && (
                <>
                  <Divider my="sm" />
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                    {tCommon('sidebarAcademics')}
                  </Text>
                </>
              )}
              {academicsItems.map(renderNavItem)}
            </>
          )}

          {/* Attendance Section */}
          {attendanceItems.length > 0 && (
            <>
              {!effectiveCollapsed && (
                <>
                  <Divider my="sm" />
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                    {tCommon('sidebarAttendance')}
                  </Text>
                </>
              )}
              {attendanceItems.map(renderNavItem)}
            </>
          )}

          {/* People Section */}
          {peopleItems.length > 0 && (
            <>
              {!effectiveCollapsed && (
                <>
                  <Divider my="sm" />
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                    {tCommon('sidebarPeople')}
                  </Text>
                </>
              )}
              {peopleItems.map(renderNavItem)}
            </>
          )}

          {/* Engage Section */}
          {engageItems.length > 0 && (
            <>
              {!effectiveCollapsed && (
                <>
                  <Divider my="sm" />
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                    {tCommon('sidebarEngage')}
                  </Text>
                </>
              )}
              {engageItems.map(renderNavItem)}
            </>
          )}

          {/* Manage Section */}
          {manageItems.length > 0 && (
            <>
              {!effectiveCollapsed && <Divider my="sm" />}
              {!effectiveCollapsed && (
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                  {tCommon('sidebarManage')}
                </Text>
              )}
              {manageItems.map(renderNavItem)}
            </>
          )}
        </Stack>
      </ScrollArea>

      {/* Bottom collapse toggle - desktop only (mobile drawer closes via overlay) */}
      <Box
        p={collapsed ? 'xs' : 'md'}
        visibleFrom="sm"
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
            id="sidebar-toggle"
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

