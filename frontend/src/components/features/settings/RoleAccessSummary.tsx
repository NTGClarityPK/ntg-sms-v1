'use client';

import { Badge, Group, Paper, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Feature, Role, PermissionMatrix, Permission } from '@/types/permissions';

const SCHOOL_ADMIN_ROLE_NAME = 'school_admin';

interface RoleAccessSummaryProps {
  roles: Role[];
  features: Feature[];
  permissions: PermissionMatrix[];
}

export function RoleAccessSummary({ roles, features, permissions }: RoleAccessSummaryProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [accessFilter, setAccessFilter] = useState<Permission | 'all'>('all');
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');

  const matrixRoles = useMemo(
    () => roles.filter((r) => r.name !== SCHOOL_ADMIN_ROLE_NAME),
    [roles],
  );

  // Align with Assign Access tab: hide deprecated / redundant feature codes
  // (same display label for different codes, e.g. `events_management` + `events` → "Events",
  // `user_management` + `staff` → "Users" — nav uses `user_management` for /users).
  const managementFeatures = useMemo(() => {
    return features.filter(
      (f) =>
        ![
          'events',
          'my_events',
          'timetable',
          'my_timetable',
          'my_schedule',
          'staff',
        ].includes(f.code),
    );
  }, [features]);

  const roleOptions = matrixRoles.map((r) => ({
    value: r.id,
    label: tCommon(`roleName.${r.name}` as any),
  }));

  const rolePermissionMap = useMemo(() => {
    if (!selectedRoleId) return new Map<string, Permission>();
    const map = new Map<string, Permission>();
    permissions
      .filter((p) => p.roleId === selectedRoleId)
      .forEach((p) => map.set(p.featureId, p.permission));
    return map;
  }, [permissions, selectedRoleId]);

  const filteredRows = useMemo(() => {
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

        // Reports / settings
        case 'reports':
          return tNav('reports');
        case 'settings':
          return tNav('settings');

        // Library / inventory / staff
        case 'library':
          return tNav('library');
        case 'inventory':
          return tNav('inventory');
        case 'staff':
          return tNav('users');

        default:
          return feature.name;
      }
    };

    let rows = managementFeatures.map((feature) => ({
      featureId: feature.id,
      featureName: getFeatureLabel(feature),
      permission: rolePermissionMap.get(feature.id) || 'none',
    }));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((row) => row.featureName.toLowerCase().includes(q));
    }

    if (accessFilter !== 'all') {
      rows = rows.filter((row) => row.permission === accessFilter);
    }

    return rows.sort((a, b) => a.featureName.localeCompare(b.featureName));
  }, [managementFeatures, rolePermissionMap, search, accessFilter]);

  const counts = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc[row.permission] += 1;
        return acc;
      },
      { none: 0, view: 0, edit: 0 } as Record<Permission, number>,
    );
  }, [filteredRows]);

  const getBadgeColor = (permission: Permission): string => {
    if (permission === 'edit') return 'green';
    if (permission === 'view') return 'blue';
    return 'gray';
  };

  return (
    <Stack gap="md">
      <Group grow align="flex-end">
        <Select
          label={tSettings('roleFilterLabel')}
          placeholder={tSettings('roleFilterPlaceholder')}
          data={roleOptions}
          value={selectedRoleId}
          onChange={setSelectedRoleId}
          searchable
          clearable
        />
        <TextInput
          label={tSettings('roleSearchTabsLabel')}
          placeholder={tSettings('roleSearchTabsPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <Select
          label={tSettings('roleAccessFilterLabel')}
          data={[
            { value: 'all', label: tSettings('roleAccessFilterAll') },
            { value: 'none', label: tSettings('roleAccessFilterNone') },
            { value: 'view', label: tSettings('roleAccessFilterView') },
            { value: 'edit', label: tSettings('roleAccessFilterEdit') },
          ]}
          value={accessFilter}
          onChange={(value) => setAccessFilter((value as Permission | 'all') || 'all')}
        />
      </Group>

      {selectedRoleId ? (
        <>
          <Paper withBorder p="sm">
            <Group gap="md">
              <Text size="sm">{tSettings('roleAccessCountEdit', { count: counts.edit })}</Text>
              <Text size="sm">{tSettings('roleAccessCountView', { count: counts.view })}</Text>
              <Text size="sm">{tSettings('roleAccessCountNone', { count: counts.none })}</Text>
            </Group>
          </Paper>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tSettings('roleAccessTabColumn')}</Table.Th>
                <Table.Th>{tSettings('roleAccessAssignedAccessColumn')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredRows.map((row) => (
                <Table.Tr key={row.featureId}>
                  <Table.Td>{row.featureName}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={getBadgeColor(row.permission)}>
                      {row.permission === 'edit'
                        ? tSettings('permissionsOptionEdit')
                        : row.permission === 'view'
                          ? tSettings('permissionsOptionView')
                          : tSettings('permissionsOptionNone')}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      ) : (
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed">
            {tSettings('roleAccessEmptyState')}
          </Text>
        </Paper>
      )}
    </Stack>
  );
}

