'use client';

import { Badge, Group, Paper, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useMemo, useState } from 'react';
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

  const matrixRoles = useMemo(
    () => roles.filter((r) => r.name !== SCHOOL_ADMIN_ROLE_NAME),
    [roles],
  );

  const roleOptions = matrixRoles.map((r) => ({
    value: r.id,
    label: r.displayName,
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
    let rows = features.map((feature) => ({
      featureId: feature.id,
      featureName: feature.name,
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
  }, [features, rolePermissionMap, search, accessFilter]);

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
          label="Role"
          placeholder="Select a role"
          data={roleOptions}
          value={selectedRoleId}
          onChange={setSelectedRoleId}
          searchable
          clearable
        />
        <TextInput
          label="Search tabs"
          placeholder="Search by tab name"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <Select
          label="Access filter"
          data={[
            { value: 'all', label: 'All' },
            { value: 'none', label: 'None' },
            { value: 'view', label: 'View' },
            { value: 'edit', label: 'Edit' },
          ]}
          value={accessFilter}
          onChange={(value) => setAccessFilter((value as Permission | 'all') || 'all')}
        />
      </Group>

      {selectedRoleId ? (
        <>
          <Paper withBorder p="sm">
            <Group gap="md">
              <Text size="sm">Edit: {counts.edit}</Text>
              <Text size="sm">View: {counts.view}</Text>
              <Text size="sm">None: {counts.none}</Text>
            </Group>
          </Paper>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tab</Table.Th>
                <Table.Th>Assigned Access</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredRows.map((row) => (
                <Table.Tr key={row.featureId}>
                  <Table.Td>{row.featureName}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={getBadgeColor(row.permission)}>
                      {row.permission === 'edit'
                        ? 'Edit'
                        : row.permission === 'view'
                          ? 'View'
                          : 'None'}
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
            Select a role to see all assigned access levels.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}

