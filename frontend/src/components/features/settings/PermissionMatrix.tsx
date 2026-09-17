'use client';

import { Table, Select, Button, Stack, Group, Text, MultiSelect, Paper, Alert, Box } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';
import type { Role, Feature, PermissionMatrix, Permission, UpdatePermissionsPayload } from '@/types/permissions';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { User } from '@/types/auth';
import { useClasses } from '@/hooks/useCoreLookups';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';
import { isPermissionMatrixCellLocked } from '@/lib/permission/familyHardDeny';

const SCHOOL_ADMIN_ROLE_NAME = 'school_admin';

interface PermissionMatrixProps {
  roles: Role[];
  features: Feature[];
  permissions: PermissionMatrix[];
}

export function PermissionMatrix({ roles, features, permissions }: PermissionMatrixProps) {
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const branchId = userTyped?.currentBranch?.id;
  const queryClient = useQueryClient();

  const rolesInMatrix = roles.filter((r) => r.name !== SCHOOL_ADMIN_ROLE_NAME);
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');

  // Hide legacy codes + non-sidebar capabilities (API/settings gates, not nav tabs).
  const managementFeatures = useMemo(() => {
    const filtered = features.filter(
      (f) =>
        ![
          'events',
          'my_events',
          'timetable',
          'my_timetable',
          'my_schedule',
          'staff',
          // Not sidebar tabs — gated elsewhere (Settings / Assessments APIs)
          'google_classroom_integration',
          'assessment_rubrics',
        ].includes(f.code),
    );
    return filtered;
  }, [features]);

  const [localPermissions, setLocalPermissions] = useState<Map<string, Permission>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const getFeatureLabel = (feature: Feature): string => {
    switch (feature.code) {
      // Core navigation features
      case 'dashboard':
        return tNav('dashboard');
      case 'students':
        return tNav('students');
      case 'user_management':
        return tNav('users');
      case 'class_sections':
        return tNav('classSections');
      case 'teacher_mapping':
        return tNav('teacherMapping');
      case 'parent_associations':
        return tNav('parentAssociations');

      // Timetable / schedule
      case 'timetable_management':
      case 'timetable':
        return tNav('timetable');
      case 'timetable_personal':
      case 'my_timetable':
        return tNav('myTimetable');
      case 'my_schedule':
        return tNav('mySchedule');
      case 'conflict_management':
        return tNav('conflictManagement');
      case 'teacher_substitution':
        return tNav('substitution');
      case 'promotion_placement':
        return tNav('promotionPlacement');

      // Attendance / behavioural / assessment
      case 'attendance':
        return tNav('attendance');
      case 'behavioral':
        return tNav('behavioral');
      case 'assessment':
        return tNav('assessments');
      case 'my_assessments':
        return tNav('myAssessments');

      // Leaves / early departure
      case 'leaves':
        return tNav('leaves');
      case 'early_departure':
        return tNav('earlyDeparture');

      // Communication (notifications + messages)
      case 'communication':
        return tNav('messages');

      // Events
      case 'events_management':
      case 'events':
        return tNav('events');
      case 'events_personal':
      case 'my_events':
        return tNav('myEvents');

      // Reports / results / settings
      case 'reports':
        return tNav('reports');
      case 'results':
        return tNav('results');
      case 'settings':
        return tNav('settings');

      // Library / inventory / staff / cards
      case 'library':
        return tNav('library');
      case 'inventory':
        return tNav('inventory');
      case 'id_cards':
        return tNav('idCards');
      case 'certificates':
        return tNav('certificates');
      case 'staff':
        // No dedicated nav key; reuse Users
        return tNav('users');

      // Fallback to backend-provided name
      default:
        return feature.name;
    }
  };

  const sortedManagementFeatures = useMemo(() => {
    return [...managementFeatures].sort((a, b) =>
      getFeatureLabel(a).localeCompare(getFeatureLabel(b), undefined, { sensitivity: 'base' }),
    );
    // getFeatureLabel depends on tNav; re-sort when feature list or locale labels change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managementFeatures, tNav]);

  const visibleFeatures =
    selectedFeatureIds.length === 0
      ? sortedManagementFeatures
      : sortedManagementFeatures.filter((f) => selectedFeatureIds.includes(f.id));

  const featureOptions = sortedManagementFeatures.map((f) => ({
    value: f.id,
    label: getFeatureLabel(f),
  }));
  const roleOptions = rolesInMatrix.map((r) => ({
    value: r.id,
    label: tCommon(`roleName.${r.name}` as any),
  }));
  const visibleRoles =
    selectedRoleIds.length === 0
      ? rolesInMatrix
      : rolesInMatrix.filter((r) => selectedRoleIds.includes(r.id));

  const studentRole = rolesInMatrix.find((r) => r.name?.toLowerCase() === 'student') ?? null;
  const leavesFeature = sortedManagementFeatures.find((f) => f.code === 'leaves') ?? null;
  const studentLeavesPermission: Permission =
    studentRole && leavesFeature
      ? localPermissions.get(`${studentRole.id}-${leavesFeature.id}`) || 'none'
      : 'none';

  const studentLeaveClassesKey =
    branchId ? `student_leave_request_class_ids:${branchId}` : 'student_leave_request_class_ids:';
  const classesQuery = useClasses();
  const leaveClassesSettingQuery = useSystemSetting<string[]>(studentLeaveClassesKey);
  const updateLeaveClassesSetting = useUpdateSystemSetting<string[]>(studentLeaveClassesKey);

  const classOptions =
    classesQuery.data?.data?.map((c) => ({
      value: c.id,
      label: c.displayName || c.name,
    })) ?? [];

  const remoteLeaveClassIds = useMemo(() => {
    const v = leaveClassesSettingQuery.data?.data?.value;
    return Array.isArray(v) ? (v.filter((x): x is string => typeof x === 'string') ?? []) : [];
  }, [leaveClassesSettingQuery.data?.data?.value]);

  const remoteLeaveClassIdsKey = useMemo(() => JSON.stringify([...remoteLeaveClassIds].sort()), [remoteLeaveClassIds]);

  const [localLeaveClassIds, setLocalLeaveClassIds] = useState<string[]>([]);
  useEffect(() => {
    // Only sync local state when the remote value actually changes.
    setLocalLeaveClassIds(remoteLeaveClassIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteLeaveClassIdsKey]);

  const leaveClassIdsChanged = useMemo(() => {
    const a = [...remoteLeaveClassIds].sort();
    const b = [...localLeaveClassIds].sort();
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return true;
    }
    return false;
  }, [remoteLeaveClassIds, localLeaveClassIds]);

  useEffect(() => {
    const roleById = new Map(rolesInMatrix.map((r) => [r.id, r]));
    const featureById = new Map(sortedManagementFeatures.map((f) => [f.id, f]));
    const newMap = new Map<string, Permission>();
    permissions.forEach((p) => {
      const key = `${p.roleId}-${p.featureId}`;
      const role = roleById.get(p.roleId);
      const feature = featureById.get(p.featureId);
      // Locked family × staff cells always display as none (nav is hard-hidden anyway).
      if (isPermissionMatrixCellLocked(role?.name, feature?.code)) {
        newMap.set(key, 'none');
      } else {
        newMap.set(key, p.permission);
      }
    });
    // Ensure locked cells exist even when DB has no row yet
    for (const role of rolesInMatrix) {
      for (const feature of sortedManagementFeatures) {
        if (!isPermissionMatrixCellLocked(role.name, feature.code)) continue;
        newMap.set(`${role.id}-${feature.id}`, 'none');
      }
    }
    setLocalPermissions(newMap);
    setHasChanges(false);
    // rolesInMatrix / sortedManagementFeatures are derived from props; re-sync when matrix loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions, roles, features]);

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdatePermissionsPayload) => {
      const response = await apiClient.put<{ data: PermissionMatrix[] }>('/api/v1/permissions', payload);
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['permissions', branchId] });
      if (response?.data?.data) {
        const roleById = new Map(rolesInMatrix.map((r) => [r.id, r]));
        const featureById = new Map(sortedManagementFeatures.map((f) => [f.id, f]));
        const newMap = new Map<string, Permission>();
        response.data.data.forEach((p) => {
          const key = `${p.roleId}-${p.featureId}`;
          const role = roleById.get(p.roleId);
          const feature = featureById.get(p.featureId);
          if (isPermissionMatrixCellLocked(role?.name, feature?.code ?? p.featureCode)) {
            newMap.set(key, 'none');
          } else {
            newMap.set(key, p.permission);
          }
        });
        setLocalPermissions(newMap);
      }
      setHasChanges(false);
      notifications.show({
        title: 'Success',
        message: tSettings('permissionsUpdatedSuccess', { defaultMessage: 'Permissions updated successfully' } as any),
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || tSettings('permissionsUpdatedError', { defaultMessage: 'Failed to update permissions' } as any),
        color: 'red',
      });
    },
  });

  const handlePermissionChange = (roleId: string, featureId: string, permission: Permission) => {
    const key = `${roleId}-${featureId}`;
    const newMap = new Map(localPermissions);
    newMap.set(key, permission);
    setLocalPermissions(newMap);
    setHasChanges(true);
  };

  const handleSave = () => {
    const payload: UpdatePermissionsPayload = {
      permissions: rolesInMatrix.flatMap((role) =>
        sortedManagementFeatures.map((feature) => {
          const locked = isPermissionMatrixCellLocked(role.name, feature.code);
          return {
            roleId: role.id,
            featureId: feature.id,
            permission: locked
              ? 'none'
              : localPermissions.get(`${role.id}-${feature.id}`) || 'none',
          };
        }),
      ),
    };
    updateMutation.mutate(payload);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Text size="sm" c="dimmed">
          {tSettings('permissionsIntroMain')}
          <br />
          <Text size="xs" c="dimmed" mt={4}>
            {tSettings('permissionsIntroHint')}
          </Text>
        </Text>
        {hasChanges && (
          <Button onClick={handleSave} loading={updateMutation.isPending}>
            {tSettings('permissionsSaveChanges')}
          </Button>
        )}
      </Group>

      <MultiSelect
        label={tSettings('permissionsTabsLabel')}
        placeholder={
          selectedFeatureIds.length === 0
            ? tSettings('permissionsTabsPlaceholderAll')
            : tSettings('permissionsTabsPlaceholderSome', { count: selectedFeatureIds.length })
        }
        description={tSettings('permissionsTabsDescription')}
        data={featureOptions}
        value={selectedFeatureIds}
        onChange={setSelectedFeatureIds}
        clearable
        searchable
      />

      <MultiSelect
        label={tSettings('permissionsRolesLabel')}
        placeholder={
          selectedRoleIds.length === 0
            ? tSettings('permissionsRolesPlaceholderAll')
            : tSettings('permissionsRolesPlaceholderSome', { count: selectedRoleIds.length })
        }
        description={tSettings('permissionsRolesDescription')}
        data={roleOptions}
        value={selectedRoleIds}
        onChange={setSelectedRoleIds}
        clearable
        searchable
      />

      <div style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{tSettings('permissionsRoleColumn')}</Table.Th>
              {visibleFeatures.map((feature) => (
                <Table.Th key={feature.id}>{getFeatureLabel(feature)}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibleRoles.map((role) => (
              <Table.Tr key={role.id}>
                <Table.Td>
                  <Text fw={500}>{tCommon(`roleName.${role.name}` as any)}</Text>
                </Table.Td>
                {visibleFeatures.map((feature) => {
                  const key = `${role.id}-${feature.id}`;
                  const isCellLocked = isPermissionMatrixCellLocked(role.name, feature.code);
                  const currentPermission = isCellLocked
                    ? 'none'
                    : localPermissions.get(key) || 'none';

                  const permissionColor: 'green' | 'blue' | 'gray' =
                    currentPermission === 'edit'
                      ? 'green'
                      : currentPermission === 'view'
                        ? 'blue'
                        : 'gray';

                  const PermissionDot = ({ color }: { color: 'green' | 'blue' | 'gray' }) => (
                    <Box
                      w={10}
                      h={10}
                      style={{
                        borderRadius: 999,
                        background: `var(--mantine-color-${color}-6)`,
                        flex: '0 0 10px',
                      }}
                    />
                  );

                  return (
                    <Table.Td key={feature.id}>
                      <Select
                        value={currentPermission}
                        disabled={isCellLocked}
                        leftSection={
                          <PermissionDot color={isCellLocked ? 'gray' : permissionColor} />
                        }
                        renderOption={({ option }) => (
                          <Group gap="xs" wrap="nowrap">
                            <PermissionDot color={(option.value as Permission) === 'edit' ? 'green' : (option.value as Permission) === 'view' ? 'blue' : 'gray'} />
                            <Text size="sm">{option.label}</Text>
                          </Group>
                        )}
                        onChange={(value) => {
                          if (isCellLocked) return;
                          handlePermissionChange(role.id, feature.id, value as Permission);
                        }}
                        data={[
                          { value: 'none', label: tSettings('permissionsOptionNone') },
                          { value: 'view', label: tSettings('permissionsOptionView') },
                          { value: 'edit', label: tSettings('permissionsOptionEdit') },
                        ]}
                        size="xs"
                        w={100}
                      />
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>

      {/* Student leave request configuration (scoped to this branch) */}
      {studentRole && leavesFeature && (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Stack gap={4}>
              <Text fw={700}>{tSettings('permissionsStudentLeavesTitle')}</Text>
              <Text size="sm" c="dimmed">
                {tSettings('permissionsStudentLeavesDescription')}
              </Text>
            </Stack>

            {studentLeavesPermission !== 'edit' && (
              <Alert color="yellow" variant="light">
                {tSettings('permissionsStudentLeavesGrantEditHint')}
              </Alert>
            )}

            <MultiSelect
              label={tSettings('permissionsStudentLeavesClassesLabel')}
              placeholder={tSettings('permissionsStudentLeavesClassesPlaceholder')}
              data={classOptions}
              value={localLeaveClassIds}
              disabled={studentLeavesPermission !== 'edit' || !branchId}
              onChange={setLocalLeaveClassIds}
              searchable
              clearable
              nothingFoundMessage={tSettings('permissionsStudentLeavesNoClasses')}
            />

            <Group justify="flex-end">
              <Button
                variant="light"
                disabled={
                  studentLeavesPermission !== 'edit' ||
                  !branchId ||
                  !leaveClassIdsChanged ||
                  updateLeaveClassesSetting.isPending
                }
                loading={updateLeaveClassesSetting.isPending}
                onClick={() => updateLeaveClassesSetting.mutate(localLeaveClassIds)}
              >
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

