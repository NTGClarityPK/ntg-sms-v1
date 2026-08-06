'use client';

import { useEffect } from 'react';
import { Group, Text, Badge, Tooltip, Box, Image, Menu } from '@mantine/core';
import { IconCircle, IconSchool } from '@tabler/icons-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { UserMenu } from './UserMenu';
import { CurrentBranchBadge } from '@/components/features/branches/CurrentBranchBadge';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { ThemeModeToggle } from '@/components/common/ThemeModeToggle';
import { NotificationBell } from './NotificationBell';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import { useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useTenantMe } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useMyStudent } from '@/hooks/useStudents';
import { useTenantBrandingStore } from '@/lib/store/tenant-branding-store';
import { useThemeStore } from '@/lib/store/theme-store';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useStudentSessionStore } from '@/lib/store/student-session-store';
import { SubscriptionBadge } from '@/components/subscription/SubscriptionBadge';

const headerBadgeStyle = {
  cursor: 'default' as const,
  fontWeight: 500,
  height: '28px',
  display: 'flex' as const,
  alignItems: 'center' as const,
  padding: '0 10px',
};

export function Header() {
  const theme = useMantineTheme();
  const isMobileNav = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const themeConfig = (theme.other ?? {}) as ThemeConfig | undefined;
  const onlineBadgeColor = themeConfig?.components?.statusOnline?.badgeColor ?? '#22c55e';
  const offlineBadgeColor = themeConfig?.components?.statusOffline?.badgeColor ?? '#868e96';

  const colors = useThemeColors();
  const isOnline = useOnlineStatus();
  const tenantQuery = useTenantMe();
  const { name: tenantName, logoUrl: tenantLogo, setBranding } = useTenantBrandingStore();
  const { setPrimaryColor } = useThemeStore();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  
  // Check if user is a student and get class name
  const isStudent = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'student') || false;
  const { data: myStudentData } = useMyStudent();
  const studentClassName = myStudentData?.data?.className && myStudentData?.data?.sectionName
    ? `${myStudentData.data.className} - ${myStudentData.data.sectionName}`
    : null;

  const isParent = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'parent') || false;
  const isSchoolAdmin =
    user?.roles?.some((r) => (r.roleName ?? '').toLowerCase() === 'school_admin') ?? false;

  const { data: childrenData, refetch: refetchChildren } = useQuery({
    queryKey: ['auth', 'my-children'],
    queryFn: async () => {
      if (!isParent) return [];
      const response = await apiClient.get<
        Array<{
          id: string;
          studentId: string;
          firstName: string;
          lastName: string;
          branchId: string | null;
          isCurrent: boolean;
        }>
      >('/api/v1/auth/my-children');
      return response.data || [];
    },
    enabled: isParent,
    staleTime: 5 * 60 * 1000,
  });

  const children = Array.isArray(childrenData) ? childrenData : [];
  const { studentToken, setStudentToken, clearStudentToken } = useStudentSessionStore();
  const hasStudentToken = !!studentToken;

  useEffect(() => {
    const data = tenantQuery.data?.data;
    if (!data) return;

    setBranding({
      name: data.name || 'School',
      logoUrl: data.logoUrl || null,
    });
    setPrimaryColor(data.primaryColor || DEFAULT_THEME_COLOR);
  }, [tenantQuery.data?.data, setBranding, setPrimaryColor]);

  return (
    <Group justify="space-between" style={{ flex: 1, minWidth: 0 }} wrap="nowrap">
      {/* Left: logo + tenant name (compact on mobile) */}
      <Group gap="sm" align="center" style={{ minWidth: 0, flexShrink: 1 }} wrap="nowrap">
        <Group gap="xs" align="center" style={{ minWidth: 0 }} wrap="nowrap">
          <Box
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {tenantLogo ? (
              <Image
                src={tenantLogo}
                alt={tenantName || 'School logo'}
                width="100%"
                height="100%"
                fit="contain"
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <IconSchool size={26} stroke={1.5} />
            )}
          </Box>
          <div style={{ minWidth: 0 }}>
            <Text fw={700} size={isMobileNav ? 'sm' : 'lg'} style={{ lineHeight: 1 }} truncate>
              {tenantName || 'School'}
            </Text>
            <Text size="xs" c="dimmed" style={{ lineHeight: 1 }} visibleFrom="sm">
              School Management
            </Text>
          </div>
        </Group>
        {isStudent && studentClassName && (
          <Badge variant="light" color={colors.primary} size="lg" visibleFrom="sm">
            {studentClassName}
          </Badge>
        )}
      </Group>

      {/* Right: actions - hide non-essential on mobile so bar stays readable */}
      <Group gap={isMobileNav ? 'xs' : 'md'} align="center" style={{ flexShrink: 0 }} wrap="nowrap">
        {/* NTG Alma brand - desktop only */}
        <Box
          visibleFrom="sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.95,
            textDecoration: 'none',
            color: '#537d5d',
          }}
          component={Link}
          href="/home"
          id="header-link-ntg"
          title="NTG Alma"
        >
          <Group gap={10} align="center" wrap="nowrap">
            <Box style={{ width: 48, height: 48, display: 'flex', alignItems: 'center' }}>
              <Image
                src="/alma-logo-darkgreen.svg"
                alt="NTG Alma"
                width="100%"
                height="100%"
                fit="contain"
                style={{ objectFit: 'contain' }}
              />
            </Box>
            <Box
              component="span"
              style={{
                fontFamily: 'var(--font-audiowide)',
                lineHeight: 1,
                fontSize: 'var(--mantine-font-size-xl)',
                fontWeight: 400,
                whiteSpace: 'nowrap',
              }}
            >
              NTG Alma
            </Box>
          </Group>
        </Box>

        {isParent && children.length > 0 && (
          <Menu shadow="md" width={260}>
            <Menu.Target>
              <Badge
                id="header-child-switcher"
                variant="light"
                color={colors.primary}
                size={isMobileNav ? 'md' : 'lg'}
                leftSection={<IconSchool size={14} />}
                style={{
                  ...headerBadgeStyle,
                  cursor: 'pointer',
                  maxWidth: isMobileNav ? 120 : undefined,
                }}
                styles={
                  isMobileNav
                    ? {
                        label: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                      }
                    : undefined
                }
              >
                {hasStudentToken
                  ? isMobileNav
                    ? children.find((c) => c.isCurrent)?.firstName ||
                      children[0]?.firstName ||
                      'Child'
                    : `Acting as ${
                        children.find((c) => c.isCurrent)?.firstName ||
                        children[0]?.firstName ||
                        'Child'
                      }`
                  : isMobileNav
                    ? 'Child'
                    : 'Select child'}
              </Badge>
            </Menu.Target>
            <Menu.Dropdown>
              {children.map((child) => (
                <Menu.Item
                  key={child.id}
                  id={`header-child-${child.id}`}
                  onClick={async () => {
                    try {
                      const response = await apiClient.post<{
                        token: string;
                        student: {
                          id: string;
                          studentId: string;
                          firstName: string;
                          lastName: string;
                          branchId: string | null;
                        };
                      }>('/api/v1/auth/switch-child', { studentId: child.id });
                      const token = response.data?.token;
                      const student = response.data?.student;
                      // Drop old child's cached data BEFORE updating the token so the
                      // next render starts with a clean loading state for the new child
                      queryClient.removeQueries({
                        predicate: (query) =>
                          typeof query.queryKey[0] === 'string' &&
                          (query.queryKey[0] as string).startsWith('student'),
                      });
                      if (token) {
                        setStudentToken(token);
                      }
                      if (student?.branchId) {
                        window.localStorage.setItem('currentBranchId', student.branchId);
                      }
                      await refetchChildren();
                      // Dashboard is hidden in child mode — redirect away if currently there
                      if (pathname === '/dashboard' || pathname === '/') {
                        router.push('/my-assessments');
                      }
                    } catch {
                      // errors handled by apiClient notifications / interceptors
                    }
                  }}
                >
                  <Group justify="space-between" gap="xs">
                    <Box>
                      <Text size="sm" fw={500}>
                        {child.firstName} {child.lastName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {child.studentId}
                      </Text>
                    </Box>
                    {hasStudentToken && child.isCurrent && (
                      <Badge size="xs" color="green">
                        Current
                      </Badge>
                    )}
                  </Group>
                </Menu.Item>
              ))}
              {hasStudentToken && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    id="header-child-exit"
                    onClick={() => {
                      clearStudentToken();
                      queryClient.removeQueries({
                        predicate: (query) =>
                          typeof query.queryKey[0] === 'string' &&
                          (query.queryKey[0] as string).startsWith('student'),
                      });
                      refetchChildren().catch(() => {});
                      router.push('/dashboard');
                    }}
                  >
                    Exit child mode
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        )}

        {isSchoolAdmin && (
          <Box visibleFrom="sm" style={{ flexShrink: 0 }}>
            <SubscriptionBadge />
          </Box>
        )}
        <ThemeModeToggle />
        <LanguageSwitcher />
        <Group gap="xs" align="center" wrap="nowrap" visibleFrom="sm">
          {/* Online/Offline Status Badge (green when online, gray when offline) */}
          <Tooltip
            label={isOnline ? 'Connected to server' : 'No internet connection'}
            position="bottom"
            withArrow
          >
            <Badge
              variant="light"
              size="md"
              leftSection={
                <IconCircle
                  size={8}
                  fill="currentColor"
                  style={{ marginRight: 4 }}
                />
              }
              style={{
                ...headerBadgeStyle,
                backgroundColor: isOnline ? `${onlineBadgeColor}20` : `${offlineBadgeColor}20`,
                color: isOnline ? onlineBadgeColor : offlineBadgeColor,
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </Tooltip>
          <CurrentBranchBadge />
        </Group>
        <NotificationBell />
        <UserMenu />
      </Group>
    </Group>
  );
}

