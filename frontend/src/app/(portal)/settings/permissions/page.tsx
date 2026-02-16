'use client';

import { Group, Title, Skeleton, Stack, Alert, Text, Button, Tabs } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { PermissionMatrix } from '@/components/features/settings/PermissionMatrix';
import { RoleAccessSummary } from '@/components/features/settings/RoleAccessSummary';
import { usePermissions } from '@/hooks/usePermissions';
import { useRoles, useFeatures } from '@/hooks/useRoles';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export default function PermissionsPage() {
  const colors = useThemeColors();
  const { permissions, isLoading, error, refetch } = usePermissions();
  const { data: rolesData } = useRoles();
  const { data: featuresData } = useFeatures();

  const roles = rolesData?.data || [];
  const features = featuresData?.data || [];

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Permission</Title>
        </Group>
      </div>

      <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
        <Stack gap="md">
          {isLoading ? (
            <Stack gap="md">
              <Skeleton height={40} width="30%" />
              <Skeleton height={400} />
            </Stack>
          ) : error ? (
          <Alert color={colors.error} title="Failed to load permissions">
            <Group justify="space-between" mt="sm">
              <Text size="sm">Please try again.</Text>
              <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
                Retry
              </Button>
            </Group>
          </Alert>
        ) : (
          <Tabs defaultValue="matrix">
            <Tabs.List>
              <Tabs.Tab value="matrix">Assign Access</Tabs.Tab>
              <Tabs.Tab value="role-access">Role Access View</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="matrix" pt="md">
              <PermissionMatrix roles={roles} features={features} permissions={permissions} />
            </Tabs.Panel>

            <Tabs.Panel value="role-access" pt="md">
              <RoleAccessSummary roles={roles} features={features} permissions={permissions} />
            </Tabs.Panel>
          </Tabs>
        )}
        </Stack>
      </div>
    </>
  );
}

