'use client';

import { Table, Select, Button, Stack, Group, Text } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';
import type { Role, Feature, PermissionMatrix, Permission, UpdatePermissionsPayload } from '@/types/permissions';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useState, useEffect } from 'react';
import type { User } from '@/types/auth';

interface PermissionMatrixProps {
  roles: Role[];
  features: Feature[];
  permissions: PermissionMatrix[];
}

export function PermissionMatrix({ roles, features, permissions }: PermissionMatrixProps) {
  const colors = useThemeColors();
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const branchId = userTyped?.currentBranch?.id;
  const queryClient = useQueryClient();

  // State to track changes
  const [localPermissions, setLocalPermissions] = useState<Map<string, Permission>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  // Sync localPermissions when permissions prop changes (e.g., after refresh)
  useEffect(() => {
    const newMap = new Map<string, Permission>();
    permissions.forEach((p) => {
      const key = `${p.roleId}-${p.featureId}`;
      newMap.set(key, p.permission);
    });
    
    // Always update to ensure we have the latest data from the server
    // This will reset any unsaved local changes, which is correct behavior
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
      // Update local state with the returned data to ensure sync
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
      permissions: roles.flatMap((role) =>
        features.map((feature) => ({
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
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Configure permissions for each role and feature. Changes apply to the current branch.
        </Text>
        {hasChanges && (
          <Button onClick={handleSave} loading={updateMutation.isPending}>
            Save Changes
          </Button>
        )}
      </Group>

      <div style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Role</Table.Th>
              {features.map((feature) => (
                <Table.Th key={feature.id}>{feature.name}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {roles.map((role) => (
              <Table.Tr key={role.id}>
                <Table.Td>
                  <Text fw={500}>{role.displayName}</Text>
                </Table.Td>
                {features.map((feature) => {
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

