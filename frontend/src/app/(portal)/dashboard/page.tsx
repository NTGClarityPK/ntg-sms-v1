'use client';

import { useMemo } from 'react';
import { Group, Title, Stack, Skeleton, SimpleGrid } from '@mantine/core';
import {
  useDashboardWidgets,
  useDashboardPreferencesQuery,
  useDashboardPreferences,
} from '@/hooks/useDashboard';
import { useAuth } from '@/hooks/useAuth';
import type { DashboardWidget } from '@/types/dashboard';
import type { User } from '@/types/auth';
import { DashboardGrid } from '@/components/features/dashboard/DashboardGrid';
import { WidgetContainer } from '@/components/features/dashboard/WidgetContainer';
import { renderDashboardWidgetContent } from '@/components/features/dashboard/widgetRegistry';
import { RoleSwitcher } from '@/components/features/dashboard/RoleSwitcher';
import { AdminDashboardOverview } from '@/components/features/dashboard/AdminDashboardOverview';
import { TeacherDashboardOverview } from '@/components/features/dashboard/TeacherDashboardOverview';
import { ParentDashboardOverview } from '@/components/features/dashboard/ParentDashboardOverview';
import { StudentDashboardOverview } from '@/components/features/dashboard/StudentDashboardOverview';

const ADMIN_ROLES = [
  'school_admin',
  'principal',
  'academic_coordinator',
  'admin_assistant',
  'super_admin',
];

const TEACHER_ROLES = ['class_teacher', 'subject_teacher', 'guidance_counselor'];

function isAdminRole(roleName: string | undefined): boolean {
  if (!roleName) return false;
  return ADMIN_ROLES.includes(roleName.toLowerCase());
}

function isTeacherRole(roleName: string | undefined): boolean {
  if (!roleName) return false;
  return TEACHER_ROLES.includes(roleName.toLowerCase());
}

/** Full-page skeleton matching the widget grid layout so transition is smooth. */
function DashboardGridSkeleton() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} height={160} radius="md" />
      ))}
    </SimpleGrid>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const { data: preferences, isFetched: preferencesFetched } = useDashboardPreferencesQuery();
  const savePreferences = useDashboardPreferences();

  // Resolve role only after preferences have loaded so we don't fetch widgets for roles[0]
  // and then refetch when preferences arrive (avoids staggered/flashing for multi-role users).
  const selectedRoleName = useMemo(() => {
    const roles = userTyped?.roles ?? [];
    if (!roles.length) return undefined;
    if (!preferencesFetched) return undefined;
    const selectedId = preferences?.selectedRoleId;
    const selected = selectedId
      ? roles.find((r) => r.roleId === selectedId)
      : null;
    return selected?.roleName ?? roles[0]?.roleName;
  }, [userTyped?.roles, preferences?.selectedRoleId, preferencesFetched]);

  const showAdminOverview = isAdminRole(selectedRoleName);
  const showTeacherOverview = isTeacherRole(selectedRoleName);
  const showParentOverview = selectedRoleName?.toLowerCase() === 'parent';
  const showStudentOverview = selectedRoleName?.toLowerCase() === 'student';

  const showRoleOverview =
    showAdminOverview ||
    showTeacherOverview ||
    showParentOverview ||
    showStudentOverview;

  const { data: widgets, isLoading: widgetsLoading } = useDashboardWidgets(
    showRoleOverview ? undefined : selectedRoleName,
  );

  const widgetIdsOrder = preferences?.widgetIds;

  const showWidgetGridSkeleton =
    !showRoleOverview &&
    (!preferencesFetched || selectedRoleName === undefined || widgetsLoading || widgets === undefined);

  const handleRoleChange = (roleId: string) => {
    savePreferences.mutate({ selectedRoleId: roleId });
  };

  const renderWidget = (widget: DashboardWidget) => {
    const content = renderDashboardWidgetContent(widget);
    return (
      <WidgetContainer widget={widget}>
        {content}
      </WidgetContainer>
    );
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Dashboard</Title>
          <RoleSwitcher
            user={userTyped}
            selectedRoleId={preferences?.selectedRoleId}
            onRoleChange={handleRoleChange}
            disabled={savePreferences.isPending}
          />
        </Group>
      </div>
      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        {showAdminOverview ? (
          <AdminDashboardOverview user={userTyped} />
        ) : showTeacherOverview ? (
          <TeacherDashboardOverview user={userTyped} />
        ) : showParentOverview ? (
          <ParentDashboardOverview user={userTyped} />
        ) : showStudentOverview ? (
          <StudentDashboardOverview user={userTyped} />
        ) : showWidgetGridSkeleton ? (
          <DashboardGridSkeleton />
        ) : (
          <Stack gap="md">
            <DashboardGrid
              widgets={widgets ?? []}
              renderWidget={renderWidget}
              widgetIdsOrder={widgetIdsOrder}
            />
          </Stack>
        )}
      </div>
    </>
  );
}
