'use client';

import { Table, Select, Button, Stack, Group, Text, MultiSelect } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';
import type { Role, Feature, PermissionMatrix, Permission, UpdatePermissionsPayload } from '@/types/permissions';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import type { User } from '@/types/auth';

const SCHOOL_ADMIN_ROLE_NAME = 'school_admin';
const DEFAULT_VISIBLE_TAB_COUNT = 5;

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

  // Hide deprecated legacy codes and keep explicit personal/management split.
  const managementFeatures = features.filter(
    (f) =>
      ![
        'events',
        'my_events',
        'timetable',
        'my_timetable',
        'my_schedule',
      ].includes(f.code),
  );

  const [localPermissions, setLocalPermissions] = useState<Map<string, Permission>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const hasSetInitialDefault = useRef(false);

  const visibleFeatures =
    selectedFeatureIds.length === 0
      ? managementFeatures
      : managementFeatures.filter((f) => selectedFeatureIds.includes(f.id));

  const featureOptions = managementFeatures.map((f) => ({ value: f.id, label: f.name }));
  const roleOptions = rolesInMatrix.map((r) => ({ value: r.id, label: r.displayName }));
  const visibleRoles =
    selectedRoleIds.length === 0
      ? rolesInMatrix
      : rolesInMatrix.filter((r) => selectedRoleIds.includes(r.id));

  useEffect(() => {
    if (managementFeatures.length > 0 && !hasSetInitialDefault.current) {
      hasSetInitialDefault.current = true;
      setSelectedFeatureIds(managementFeatures.slice(0, DEFAULT_VISIBLE_TAB_COUNT).map((f) => f.id));
    }
  }, [managementFeatures]);

  useEffect(() => {
    const newMap = new Map<string, Permission>();
    permissions.forEach((p) => {
      const key = `${p.roleId}-${p.featureId}`;
      newMap.set(key, p.permission);
    });
    setLocalPermissions(newMap);
    setHasChanges(false);
  }, [permissions]);

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdatePermissionsPayload) => {
      const response = await apiClient.put<{ data: PermissionMatrix[] }>('/api/v1/permissions', payload);
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['permissions', branchId] });
      if (response?.data?.data) {
        const newMap = new Map<string, Permission>();
        response.data.data.forEach((p) => {
          const key = `${p.roleId}-${p.featureId}`;
          newMap.set(key, p.permission);
        });
        setLocalPermissions(newMap);
      }
      setHasChanges(false);
      notifications.show({
        title: 'Success',
        message: 'Permissions updated successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update permissions',
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
        managementFeatures.map((feature) => ({
          roleId: role.id,
          featureId: feature.id,
          permission: localPermissions.get(`${role.id}-${feature.id}`) || 'none',
        })),
      ),
    };
    updateMutation.mutate(payload);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Text size="sm" c="dimmed">
          Configure permissions for each role and feature. School Admin has full access and is not shown. Changes apply to the current branch.
          <br />
          <Text size="xs" c="dimmed" mt={4}>
            Use explicit split permissions: Events (Management) vs Events (Personal), and Timetable (Management) vs Timetable (Personal).
          </Text>
        </Text>
        {hasChanges && (
          <Button onClick={handleSave} loading={updateMutation.isPending}>
            Save Changes
          </Button>
        )}
      </Group>

      <MultiSelect
        label="Show tabs"
        placeholder={
          selectedFeatureIds.length === 0
            ? 'All tabs'
            : `${selectedFeatureIds.length} tab${selectedFeatureIds.length === 1 ? '' : 's'} selected`
        }
        description="Select which tabs to show in the matrix. Five tabs are shown by default. Clear selection to show all."
        data={featureOptions}
        value={selectedFeatureIds}
        onChange={setSelectedFeatureIds}
        clearable
        searchable
      />

      <MultiSelect
        label="Show roles"
        placeholder={
          selectedRoleIds.length === 0
            ? 'All roles'
            : `${selectedRoleIds.length} role${selectedRoleIds.length === 1 ? '' : 's'} selected`
        }
        description="Select which roles to show on the left side. Clear selection to show all."
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
              <Table.Th>Role</Table.Th>
              {visibleFeatures.map((feature) => (
                <Table.Th key={feature.id}>{feature.name}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibleRoles.map((role) => (
              <Table.Tr key={role.id}>
                <Table.Td>
                  <Text fw={500}>{role.displayName}</Text>
                </Table.Td>
                {visibleFeatures.map((feature) => {
                  const key = `${role.id}-${feature.id}`;
                  const currentPermission = localPermissions.get(key) || 'none';

                  return (
                    <Table.Td key={feature.id}>
                      <Select
                        value={currentPermission}
                        onChange={(value) =>
                          handlePermissionChange(role.id, feature.id, value as Permission)
                        }
                        data={[
                          { value: 'none', label: 'None' },
                          { value: 'view', label: 'View' },
                          { value: 'edit', label: 'Edit' },
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
    </Stack>
  );
}

