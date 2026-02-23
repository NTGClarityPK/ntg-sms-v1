'use client';

import { useMemo } from 'react';
import { Group, Title, Stack, Skeleton } from '@mantine/core';
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

const ADMIN_ROLES = [
  'school_admin',
  'principal',
  'academic_coordinator',
  'admin_assistant',
  'super_admin',
];

function isAdminRole(roleName: string | undefined): boolean {
  if (!roleName) return false;
  return ADMIN_ROLES.includes(roleName.toLowerCase());
}

export default function DashboardPage() {
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const { data: preferences } = useDashboardPreferencesQuery();
  const savePreferences = useDashboardPreferences();

  const selectedRoleName = useMemo(() => {
    const roles = userTyped?.roles ?? [];
    const selectedId = preferences?.selectedRoleId;
    const selected = selectedId
      ? roles.find((r) => r.roleId === selectedId)
      : null;
    return selected?.roleName ?? roles[0]?.roleName;
  }, [userTyped?.roles, preferences?.selectedRoleId]);

  const showAdminOverview = isAdminRole(selectedRoleName);

  const { data: widgets, isLoading: widgetsLoading } = useDashboardWidgets(
    selectedRoleName,
  );

  const widgetIdsOrder = preferences?.widgetIds;

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
        ) : widgetsLoading || widgets === undefined ? (
          <Stack gap="md">
            <Skeleton height={120} />
            <Skeleton height={200} />
          </Stack>
        ) : (
          <Stack gap="md">
            <DashboardGrid
              widgets={widgets}
              renderWidget={renderWidget}
              widgetIdsOrder={widgetIdsOrder}
            />
          </Stack>
        )}
      </div>
    </>
  );
}
