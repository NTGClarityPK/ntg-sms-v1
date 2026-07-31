'use client';

import { useEffect, useState, type ComponentType } from 'react';
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
  alpha,
  useMantineTheme,
  Accordion,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconHome,
  IconUsers,
  IconCalendar,
  IconChartBar,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
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
  IconMedal,
  IconCash,
  IconCreditCard,
  IconId,
  IconCertificate,
  IconArrowsShuffle,
  IconArrowUpRight,
  type IconProps,
} from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscriptionFeatures } from '@/hooks/api/useSubscription';
import type { PlanFeatures } from '@/types/subscription';
import { useStudentSessionStore } from '@/lib/store/student-session-store';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import { getFeatureCodeForPath } from '@/lib/permission/navFeatureMap';
import type { NavItem } from './nav-types';
import {
  CollapsedNavDashboardButton,
  CollapsedNavGroupPopover,
} from './CollapsedNavGroupPopover';

const NAV_ICON_SIZE = 22;

/** Same idea as the sidebar rail toggle: swap icons by open state — no CSS rotation fights. */
const NAV_ACCORDION_CHEVRON_SIZE = 18;

/** Single source of truth for “School” / “Management” rail headings so typography cannot drift. */
const SIDEBAR_SECTION_LABEL_PROPS = {
  size: 'xs',
  c: 'dimmed',
  tt: 'uppercase',
  fw: 700,
  mb: 'xs',
} as const;

const navAccordionStyles = {
  control: {
    padding: 'var(--mantine-spacing-xs)',
  },
  label: { fontWeight: 600, fontSize: 'var(--mantine-font-size-sm)' },
  item: { border: 'none' },
  /** Mantine defaults pad `.accordion-content` with `spacing-md`, indenting links past Dashboard — flush so icons/labels align. */
  panel: { padding: 0 },
  content: {
    padding: 0,
    paddingTop: 'calc(var(--mantine-spacing-xs) / 2)',
  },
} as const;

// All navigation items (key used for next-intl navigation namespace)
const allNavItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: IconHome },
  { key: 'students', label: 'Student', href: '/students', icon: IconUsers },
  { key: 'users', label: 'User', href: '/users', icon: IconUsers },
  { key: 'classSections', label: 'Class', href: '/academic/class-sections', icon: IconSchool },
  { key: 'mapping', label: 'Mapping', href: '/mapping', icon: IconArrowsShuffle },
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
  { key: 'fees', label: 'Fees', href: '/fees', icon: IconCash },
  {
    key: 'idCards',
    label: 'ID Cards',
    href: '/id-cards',
    icon: IconId,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    key: 'certificates',
    label: 'Certificates',
    href: '/certificates',
    icon: IconCertificate,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  {
    key: 'myCertificates',
    label: 'My Certificates',
    href: '/my-certificates',
    icon: IconCertificate,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
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
  {
    key: 'substitution',
    label: 'Substitution',
    href: '/substitution',
    icon: IconArrowsShuffle,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
  { key: 'promotionPlacement', label: 'Promotion & Placement', href: '/promotion-placement', icon: IconArrowUpRight },
  { key: 'reports', label: 'Report', href: '/reports', icon: IconChartBar },
  { key: 'results', label: 'Results', href: '/results', icon: IconMedal },
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
  {
    key: 'billing',
    label: 'Billing',
    href: '/billing',
    icon: IconCreditCard,
    showCondition: () => {
      if (typeof window === 'undefined') return false;
      return true;
    },
  },
];

/** Only this School accordion stays open on load / refresh (all others collapsed). */
const SCHOOL_ACCORDION_DEFAULT_OPEN_KEY = 'sidebarGroupAcademics';

/** Grouped nav (expanded sidebar). Students & Attendance before Academics per product layout. */
const SCHOOL_NAV_GROUPS: readonly { i18nKey: string; hrefs: readonly string[] }[] = [
  {
    i18nKey: 'sidebarGroupStudentsAttendance',
    hrefs: [
      '/students',
      '/attendance',
      '/leaves',
      '/early-departure',
      '/behavioral',
      '/my-children',
      '/parent/pin-management',
    ],
  },
  {
    i18nKey: 'sidebarGroupAcademics',
    hrefs: [
      '/assessments',
      '/my-assessments',
      '/timetable',
      '/substitution',
      '/my-schedule',
      '/my-timetable',
      '/children-timetable',
      '/results',
    ],
  },
  {
    i18nKey: 'sidebarGroupCommunication',
    hrefs: ['/messages', '/notifications', '/events', '/my-events'],
  },
];

/** One icon per accordion group for the collapsed rail + flyout (Tabler). */
const COLLAPSED_GROUP_ICONS: Record<string, ComponentType<IconProps>> = {
  sidebarGroupStudentsAttendance: IconUsers,
  sidebarGroupAcademics: IconBook,
  sidebarGroupCommunication: IconMessage,
  sidebarGroupSetup: IconSettings,
  sidebarGroupResources: IconPackage,
  sidebarGroupSystem: IconChartBar,
};

const MANAGEMENT_NAV_GROUPS: readonly { i18nKey: string; hrefs: readonly string[] }[] = [
  {
    i18nKey: 'sidebarGroupSetup',
    hrefs: ['/academic/class-sections', '/promotion-placement', '/mapping', '/users', '/fees', '/id-cards', '/certificates'],
  },
  {
    i18nKey: 'sidebarGroupResources',
    hrefs: ['/library', '/inventory', '/uniform-request', '/reports'],
  },
  {
    i18nKey: 'sidebarGroupSystem',
    hrefs: ['/conflict-management', '/settings', '/billing', '/admin/storage'],
  },
];

function navItemsInHrefOrder(navItems: NavItem[], hrefs: readonly string[]): NavItem[] {
  return hrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
}

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
  /** Desktop fine pointer: hover + delay flyouts. Touch / coarse: tap to open popover. */
  const pointerFine = useMediaQuery('(pointer: fine)');
  const useHoverFlyouts = Boolean(pointerFine) && isMobile !== true;
  const router = useRouter();
  const pathname = usePathname();
  const theme = useMantineTheme();
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const { canView, canEdit } = usePermissions();
  const { data: planFeatures } = useSubscriptionFeatures();
  const { studentToken } = useStudentSessionStore();

  const subscriptionNavFeatures: Partial<Record<string, keyof PlanFeatures>> = {
    '/fees': 'hasFeeManagement',
    '/behavioral': 'hasBehavioralTracking',
    '/library': 'hasLibraryManagement',
    '/inventory': 'hasInventoryManagement',
    '/inventory/items': 'hasInventoryManagement',
    '/inventory/requests': 'hasInventoryManagement',
    '/inventory/history': 'hasInventoryManagement',
    '/uniform-request': 'hasInventoryManagement',
  };
  // When a parent is acting as a child, treat the sidebar as student mode
  const isActingAsStudent = !!studentToken;

  // Get theme config for navbar styling
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  const navbarConfig = themeConfig?.components?.navbar;
  const navButtonConfig = themeConfig?.components?.navButton;

  const isSchoolAdmin =
    user?.roles?.some((r) => (r.roleName ?? '').toLowerCase() === 'school_admin') ?? false;

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

  const canManageSubstitution = user?.roles?.some((r) => {
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
    return roleName === 'school_admin' || roleName === 'principal';
  }) || false;
  // Filter navigation items based on conditions
  const navItems = allNavItems.filter((item) => {
    // Hide dashboard in child mode — students use My Assessments as home
    if (item.href === '/dashboard' && isActingAsStudent) return false;

    // Request uniform: only for parents
    if (item.href === '/uniform-request') {
      return isParent;
    }

    // ID Cards — before permission-matrix check (matrix may not be seeded yet)
    if (item.href === '/id-cards') {
      if (isSchoolAdmin) return true;
      const canManageIdCards = user?.roles?.some((r) => {
        const roleName = r.roleName?.toLowerCase();
        return (
          roleName === 'principal' ||
          roleName === 'academic_coordinator' ||
          roleName === 'admin_assistant'
        );
      });
      return canManageIdCards || canView('id_cards');
    }

    if (item.href === '/certificates') {
      if (isStudent || isParent) return false;
      if (isSchoolAdmin) return true;
      return canView('certificates') || canEdit('certificates');
    }

    if (item.href === '/my-certificates') {
      return (isStudent || isParent) && canView('certificates');
    }

    const featureCode = getFeatureCodeForPath(item.href);
    // Mapping is a combined page; show it if user can view either mapping feature.
    if (item.href === '/mapping') {
      return canView('teacher_mapping') || canView('parent_associations');
    }
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
      // For "My Timetable": students only (class view). Teachers use My Schedule (`/my-schedule`).
      if (item.href === '/my-timetable') {
        return isStudent;
      }
      // For "Timetable Management", show only if user has admin/coordinator role
      if (item.href === '/timetable') {
        // Prefer permission matrix gating (Settings → Permission matrix).
        // Keep role-based fallback for existing deployments that rely on roles.
        return canView('timetable_management') || canManageTimetable;
      }
      // For "Conflict Management", visibility is permission-controlled (Settings → Permission matrix).
      if (item.href === '/conflict-management') {
        return true;
      }
      if (item.href === '/substitution') {
        return canView('teacher_substitution') || canManageSubstitution || isTeacher;
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
      // Storage: school_admin, principal only
      if (item.href === '/admin/storage') {
        return canManageStorage;
      }
      if (item.href === '/billing') {
        return isSchoolAdmin;
      }
      const subFeature = subscriptionNavFeatures[item.href];
      if (subFeature && planFeatures) {
        if (!planFeatures[subFeature]) return false;
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

  const dashboardItem = navItems.find((item) => item.href === '/dashboard');

  const schoolAccordionGroups = SCHOOL_NAV_GROUPS.map((def) => ({
    i18nKey: def.i18nKey,
    items: navItemsInHrefOrder(navItems, def.hrefs),
  })).filter((g) => g.items.length > 0);

  const managementAccordionGroups = MANAGEMENT_NAV_GROUPS.map((def) => ({
    i18nKey: def.i18nKey,
    items: navItemsInHrefOrder(navItems, def.hrefs),
  })).filter((g) => g.items.length > 0);

  const schoolAccordionKeysSig = schoolAccordionGroups.map((g) => g.i18nKey).join('|');
  const managementAccordionKeysSig = managementAccordionGroups.map((g) => g.i18nKey).join('|');

  const [schoolAccordionValue, setSchoolAccordionValue] = useState<string[]>(() =>
    schoolAccordionGroups.some((g) => g.i18nKey === SCHOOL_ACCORDION_DEFAULT_OPEN_KEY)
      ? [SCHOOL_ACCORDION_DEFAULT_OPEN_KEY]
      : [],
  );
  const [managementAccordionValue, setManagementAccordionValue] = useState<string[]>([]);
  /** Which collapsed group flyout is open (only one at a time). */
  const [collapsedFlyoutId, setCollapsedFlyoutId] = useState<string | null>(null);

  useEffect(() => {
    setSchoolAccordionValue(
      schoolAccordionGroups.some((g) => g.i18nKey === SCHOOL_ACCORDION_DEFAULT_OPEN_KEY)
        ? [SCHOOL_ACCORDION_DEFAULT_OPEN_KEY]
        : [],
    );
  }, [schoolAccordionKeysSig]);

  useEffect(() => {
    setManagementAccordionValue([]);
  }, [managementAccordionKeysSig]);

  useEffect(() => {
    if (!effectiveCollapsed) setCollapsedFlyoutId(null);
  }, [effectiveCollapsed]);

  const schoolFlatOrdered: NavItem[] = [
    ...(dashboardItem ? [dashboardItem] : []),
    ...SCHOOL_NAV_GROUPS.flatMap((def) => navItemsInHrefOrder(navItems, def.hrefs)),
  ];

  const managementFlatOrdered: NavItem[] = MANAGEMENT_NAV_GROUPS.flatMap((def) =>
    navItemsInHrefOrder(navItems, def.hrefs),
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
        type="hover"
        scrollHideDelay={400}
      >
        <Box
          style={
            effectiveCollapsed
              ? {
                  /**
                   * Align first rail control with page title text: `.page-title-bar` uses
                   * `padding-top: 14px` (DynamicThemeProvider). Navbar `pt` is 0 when collapsed
                   * so this offset is the single source for that visual line.
                   */
                  paddingTop: 14,
                  paddingBottom: theme.spacing.sm,
                }
              : undefined
          }
        >
          <Stack
            gap={effectiveCollapsed ? 0 : 'xs'}
            p={effectiveCollapsed ? { px: 0 } : 'md'}
          >
          {schoolFlatOrdered.length > 0 && (
            <>
              {!effectiveCollapsed && (
                <Text {...SIDEBAR_SECTION_LABEL_PROPS}>{tCommon('sidebarSchool')}</Text>
              )}
              {effectiveCollapsed ? (
                <Stack gap={2} align="stretch" w="100%">
                  {dashboardItem ? (
                    <CollapsedNavDashboardButton
                      item={dashboardItem}
                      label={tNav('dashboard')}
                      onNavigate={onMobileClose}
                    />
                  ) : null}
                  {schoolAccordionGroups.map((group) => {
                    const GroupIcon = COLLAPSED_GROUP_ICONS[group.i18nKey];
                    if (!GroupIcon || group.items.length === 0) return null;
                    return (
                      <CollapsedNavGroupPopover
                        key={group.i18nKey}
                        groupId={group.i18nKey}
                        groupLabel={tCommon(group.i18nKey)}
                        GroupIcon={GroupIcon}
                        items={group.items}
                        opened={collapsedFlyoutId === group.i18nKey}
                        onOpenChange={(open) => {
                          setCollapsedFlyoutId((prev) => {
                            if (open) return group.i18nKey;
                            return prev === group.i18nKey ? null : prev;
                          });
                        }}
                        useHoverInteraction={useHoverFlyouts}
                        getItemLabel={(key) => tNav(key)}
                        onNavigate={onMobileClose}
                        navHoverBackground={navbarConfig?.hoverBackground}
                        navHoverColor={navbarConfig?.hoverTextColor}
                        navActiveBackground={navbarConfig?.activeBackground}
                        navActiveTextColor={navbarConfig?.activeTextColor}
                        navDefaultTextColor={navbarConfig?.textColor}
                      />
                    );
                  })}
                </Stack>
              ) : (
                <>
                  {dashboardItem ? renderNavItem(dashboardItem) : null}
                  {schoolAccordionGroups.length > 0 ? (
                    <Accordion
                      multiple
                      value={schoolAccordionValue}
                      onChange={setSchoolAccordionValue}
                      variant="default"
                      chevronPosition="right"
                      disableChevronRotation
                      styles={navAccordionStyles}
                    >
                      {schoolAccordionGroups.map((group) => (
                        <Accordion.Item key={group.i18nKey} value={group.i18nKey}>
                          <Accordion.Control
                            id={`nav-accordion-school-${group.i18nKey}`}
                            chevron={
                              schoolAccordionValue.includes(group.i18nKey) ? (
                                <IconChevronDown size={NAV_ACCORDION_CHEVRON_SIZE} stroke={1.5} />
                              ) : (
                                <IconChevronRight size={NAV_ACCORDION_CHEVRON_SIZE} stroke={1.5} />
                              )
                            }
                          >
                            {tCommon(group.i18nKey)}
                          </Accordion.Control>
                          <Accordion.Panel>
                            <Stack gap={4}>{group.items.map(renderNavItem)}</Stack>
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  ) : null}
                </>
              )}
            </>
          )}

          {managementFlatOrdered.length > 0 && (
            <>
              {!effectiveCollapsed && schoolFlatOrdered.length > 0 && <Divider my="sm" />}
              {!effectiveCollapsed && (
                <Text {...SIDEBAR_SECTION_LABEL_PROPS}>{tCommon('sidebarManagement')}</Text>
              )}
              {effectiveCollapsed ? (
                <>
                  {schoolFlatOrdered.length > 0 && managementFlatOrdered.length > 0 && (
                    <Box
                      style={{
                        height: 2,
                        backgroundColor: alpha(theme.white, 0.1),
                        marginTop: 4,
                        marginBottom: 2,
                        borderRadius: 1,
                      }}
                    />
                  )}
                  <Stack gap={2} align="stretch" w="100%">
                    {managementAccordionGroups.map((group) => {
                      const GroupIcon = COLLAPSED_GROUP_ICONS[group.i18nKey];
                      if (!GroupIcon || group.items.length === 0) return null;
                      return (
                        <CollapsedNavGroupPopover
                          key={group.i18nKey}
                          groupId={group.i18nKey}
                          groupLabel={tCommon(group.i18nKey)}
                          GroupIcon={GroupIcon}
                          items={group.items}
                          opened={collapsedFlyoutId === group.i18nKey}
                          onOpenChange={(open) => {
                            setCollapsedFlyoutId((prev) => {
                              if (open) return group.i18nKey;
                              return prev === group.i18nKey ? null : prev;
                            });
                          }}
                          useHoverInteraction={useHoverFlyouts}
                          getItemLabel={(key) => tNav(key)}
                          onNavigate={onMobileClose}
                          navHoverBackground={navbarConfig?.hoverBackground}
                          navHoverColor={navbarConfig?.hoverTextColor}
                          navActiveBackground={navbarConfig?.activeBackground}
                          navActiveTextColor={navbarConfig?.activeTextColor}
                          navDefaultTextColor={navbarConfig?.textColor}
                        />
                      );
                    })}
                  </Stack>
                </>
              ) : (
                <Accordion
                  multiple
                  value={managementAccordionValue}
                  onChange={setManagementAccordionValue}
                  variant="default"
                  chevronPosition="right"
                  disableChevronRotation
                  styles={navAccordionStyles}
                >
                  {managementAccordionGroups.map((group) => (
                    <Accordion.Item key={group.i18nKey} value={group.i18nKey}>
                      <Accordion.Control
                        id={`nav-accordion-management-${group.i18nKey}`}
                        chevron={
                          managementAccordionValue.includes(group.i18nKey) ? (
                            <IconChevronDown size={NAV_ACCORDION_CHEVRON_SIZE} stroke={1.5} />
                          ) : (
                            <IconChevronRight size={NAV_ACCORDION_CHEVRON_SIZE} stroke={1.5} />
                          )
                        }
                      >
                        {tCommon(group.i18nKey)}
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap={4}>{group.items.map(renderNavItem)}</Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </>
          )}
        </Stack>
        </Box>
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

