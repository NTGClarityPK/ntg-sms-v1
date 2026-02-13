'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
  Badge,
} from '@mantine/core';
import { IconLockOpen, IconRefresh } from '@tabler/icons-react';
import { useAllTenants } from '@/hooks/useTenant';
import { useBranchesByTenantId } from '@/hooks/useBranches';
import { useAcademicYearsByTenant, useUnlockAcademicYear } from '@/hooks/useAcademicYears';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import type { AcademicYear } from '@/types/settings';

export default function UnlockAcademicYearPage() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const tenantsQuery = useAllTenants();
  const branchesQuery = useBranchesByTenantId(selectedTenantId);
  const academicYearsQuery = useAcademicYearsByTenant(selectedTenantId);
  const unlockMutation = useUnlockAcademicYear();

  // Get tenant ID from branch if branch is selected
  const tenantId = selectedTenantId;

  // Filter locked academic years
  const lockedYears = academicYearsQuery.data?.data?.filter((year) => year.isLocked) || [];

  const handleUnlock = (year: AcademicYear) => {
    if (!tenantId) return;

    modals.openConfirmModal({
      title: 'Unlock Academic Year',
      children: (
        <Text size="sm">
          Are you sure you want to unlock <strong>{year.name}</strong>? This will allow modifications to be made again.
        </Text>
      ),
      labels: { confirm: 'Unlock', cancel: 'Cancel' },
      confirmProps: { color: 'blue' },
      onConfirm: async () => {
        try {
          await unlockMutation.mutateAsync({ id: year.id, tenantId });
          notifications.show({
            title: 'Success',
            message: `Academic year "${year.name}" has been unlocked`,
            color: notifyColors.success,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          notifications.show({
            title: 'Error',
            message,
            color: notifyColors.error,
          });
        }
      },
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Unlock Academic Year</Title>
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
        <Stack gap="lg">
          <Alert color="blue" title="Super Admin Tool">
            <Text size="sm">
              This tool allows you to unlock academic years that have been locked. Select a tenant and branch to view locked academic years.
            </Text>
          </Alert>

          <Card withBorder p="md">
            <Stack gap="md">
              <Select
                label="Tenant"
                placeholder="Select a tenant"
                value={selectedTenantId}
                onChange={(value) => {
                  setSelectedTenantId(value);
                  setSelectedBranchId(null); // Reset branch when tenant changes
                }}
                data={
                  tenantsQuery.data?.data?.map((tenant) => ({
                    value: tenant.id,
                    label: `${tenant.name} (${tenant.code})`,
                  })) || []
                }
                searchable
                disabled={tenantsQuery.isLoading}
              />

              {selectedTenantId && (
                <>
                  <Select
                    label="Branch"
                    placeholder="Select a branch (optional)"
                    value={selectedBranchId}
                    onChange={setSelectedBranchId}
                    data={
                      branchesQuery.data?.data?.map((branch) => ({
                        value: branch.id,
                        label: branch.name,
                      })) || []
                    }
                    searchable
                    disabled={branchesQuery.isLoading}
                    clearable
                  />

                  {branchesQuery.isLoading && (
                    <Stack gap="md">
                      <Skeleton height={40} />
                      <Skeleton height={200} />
                    </Stack>
                  )}
                </>
              )}

              {tenantsQuery.isLoading && (
                <Stack gap="md">
                  <Skeleton height={40} />
                  <Skeleton height={40} />
                </Stack>
              )}

              {tenantsQuery.error && (
                <Alert color={colors.error} title="Failed to load tenants">
                  <Group justify="space-between" mt="sm">
                    <Text size="sm">Please try again.</Text>
                    <Button
                      variant="light"
                      leftSection={<IconRefresh size={16} />}
                      onClick={() => tenantsQuery.refetch()}
                    >
                      Retry
                    </Button>
                  </Group>
                </Alert>
              )}
            </Stack>
          </Card>

          {selectedTenantId && (
            <Card withBorder p="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={3}>Locked Academic Years</Title>
                  <Button
                    variant="light"
                    leftSection={<IconRefresh size={16} />}
                    onClick={() => academicYearsQuery.refetch()}
                    loading={academicYearsQuery.isFetching}
                  >
                    Refresh
                  </Button>
                </Group>

                {academicYearsQuery.isLoading ? (
                  <Stack gap="md">
                    <Skeleton height={100} />
                    <Skeleton height={100} />
                  </Stack>
                ) : academicYearsQuery.error ? (
                  <Alert color={colors.error} title="Failed to load academic years">
                    <Group justify="space-between" mt="sm">
                      <Text size="sm">Please try again.</Text>
                      <Button
                        variant="light"
                        leftSection={<IconRefresh size={16} />}
                        onClick={() => academicYearsQuery.refetch()}
                      >
                        Retry
                      </Button>
                    </Group>
                  </Alert>
                ) : lockedYears.length === 0 ? (
                  <Alert color={colors.info} title="No locked academic years">
                    <Text size="sm">
                      {academicYearsQuery.data?.data?.length === 0
                        ? 'No academic years found for this tenant.'
                        : 'All academic years for this tenant are unlocked.'}
                    </Text>
                  </Alert>
                ) : (
                  <Stack gap="sm">
                    {lockedYears.map((year) => (
                      <Card key={year.id} withBorder p="md">
                        <Group justify="space-between" align="flex-start">
                          <Stack gap="xs">
                            <Group gap="sm">
                              <Text fw={600}>{year.name}</Text>
                              <Badge variant="light" color={colors.warning}>
                                Locked
                              </Badge>
                              {year.isActive && (
                                <Badge variant="light" color={colors.success}>
                                  Active
                                </Badge>
                              )}
                            </Group>
                            <Text c="dimmed" size="sm">
                              {year.startDate} → {year.endDate}
                            </Text>
                          </Stack>

                          <Button
                            leftSection={<IconLockOpen size={16} />}
                            onClick={() => handleUnlock(year)}
                            loading={unlockMutation.isPending}
                            color="blue"
                          >
                            Unlock
                          </Button>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          )}

          {!selectedTenantId && (
            <Alert color={colors.info} title="Select a tenant">
              <Text size="sm">Please select a tenant to view locked academic years.</Text>
            </Alert>
          )}
        </Stack>
      </div>
    </>
  );
}
