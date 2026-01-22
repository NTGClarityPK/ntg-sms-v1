'use client';

import { Group, Title, Loader, Stack, Alert, Text, Button } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { PermissionMatrix } from '@/components/features/settings/PermissionMatrix';
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
          <Title order={1}>Permissions</Title>
        </Group>
      </div>

      <Stack gap="md">
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader color={colors.primary} />
          </Group>
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
          <PermissionMatrix roles={roles} features={features} permissions={permissions} />
        )}
      </Stack>
    </>
  );
}

