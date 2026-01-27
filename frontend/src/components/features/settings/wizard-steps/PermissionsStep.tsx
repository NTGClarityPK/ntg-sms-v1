'use client';

import { Button, Group, Select, Stack, Table, Text } from '@mantine/core';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { PermissionData } from './types';
import { useRoles, useFeatures } from '@/hooks/useRoles';

interface PermissionsStepProps {
  data: PermissionData[];
  onChange: (data: PermissionData[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PermissionsStep({ data, onChange, onNext, onBack }: PermissionsStepProps) {
  const colors = useThemeColors();
  const { data: rolesRes } = useRoles();
  const { data: featuresRes } = useFeatures();

  const roles = rolesRes?.data ?? [];
  const features = featuresRes?.data ?? [];

  const adminRole = roles.find((r) => r.name === 'school_admin') ?? roles[0];

  const ensureInitialPermissions = () => {
    if (!adminRole || features.length === 0) return;

    if (data.length === 0) {
      const initial: PermissionData[] = features.map((f) => ({
        roleId: adminRole.id,
        featureId: f.id,
        permission: 'edit',
      }));
      onChange(initial);
    }
  };

  ensureInitialPermissions();

  const handlePermissionChange = (featureId: string, value: string | null) => {
    if (!adminRole || !value) return;

    const existingIndex = data.findIndex(
      (p) => p.roleId === adminRole.id && p.featureId === featureId,
    );

    const updated: PermissionData[] = [...data];
    if (existingIndex >= 0) {
      updated[existingIndex] = { ...updated[existingIndex], permission: value as PermissionData['permission'] };
    } else {
      updated.push({ roleId: adminRole.id, featureId, permission: value as PermissionData['permission'] });
    }
    onChange(updated);
  };

  const handleNext = () => {
    onNext();
  };

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        Permissions
      </Text>
      <Text size="sm" c="dimmed">
        Configure initial permissions for the School Admin role. You can refine other roles later from the Permissions
        settings page.
      </Text>

      {adminRole && features.length > 0 ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Role</Table.Th>
              <Table.Th>Feature</Table.Th>
              <Table.Th>Permission</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {features.map((feature) => {
              const current = data.find(
                (p) => p.roleId === adminRole.id && p.featureId === feature.id,
              );
              const value = current?.permission ?? 'edit';

              return (
                <Table.Tr key={feature.id}>
                  <Table.Td>
                    <Text size="sm">{adminRole.displayName || 'School Admin'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{feature.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={[
                        { value: 'none', label: 'None' },
                        { value: 'view', label: 'View' },
                        { value: 'edit', label: 'Edit' },
                      ]}
                      value={value}
                      onChange={(val) => handlePermissionChange(feature.id, val)}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          Loading roles and features...
        </Text>
      )}

      <Group justify="space-between" mt="xl">
        <Button variant="light" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} color={colors.primary}>
          Next
        </Button>
      </Group>
    </Stack>
  );
}

