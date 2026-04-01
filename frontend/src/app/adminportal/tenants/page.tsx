'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconRefresh, IconTrash, IconPlayerStop, IconPlayerPlay, IconArrowBackUp } from '@tabler/icons-react';
import {
  useAllTenants,
  useCancelTenantDeletion,
  useRequestTenantDeletion,
  useSetTenantActive,
  useTenantStatistics,
} from '@/hooks/useTenant';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import type { Tenant } from '@/types/tenant';

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function AdminPortalTenantsPage() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();

  const tenantsQuery = useAllTenants();
  const statisticsQuery = useTenantStatistics();
  const setActiveMutation = useSetTenantActive();
  const requestDeletionMutation = useRequestTenantDeletion();
  const cancelDeletionMutation = useCancelTenantDeletion();

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const tenants = tenantsQuery.data?.data ?? [];
  const stats = statisticsQuery.data?.data ?? [];

  const statsByTenantId = useMemo(() => {
    return new Map(stats.map((s) => [s.tenantId, s]));
  }, [stats]);

  const tenantsSorted = useMemo(() => {
    return [...tenants].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [tenants]);

  const openDeactivateConfirm = (tenant: Tenant) => {
    modals.openConfirmModal({
      title: tenant.isActive ? 'Deactivate tenant' : 'Restore tenant',
      children: (
        <Text size="sm">
          {tenant.isActive ? (
            <>
              This will prevent staff, students, and parents from using the portal for{' '}
              <strong>{tenant.name}</strong>.
            </>
          ) : (
            <>
              This will restore access for <strong>{tenant.name}</strong>.
            </>
          )}
        </Text>
      ),
      labels: { confirm: tenant.isActive ? 'Deactivate' : 'Restore', cancel: 'Cancel' },
      confirmProps: { color: tenant.isActive ? 'orange' : 'blue' },
      onConfirm: async () => {
        try {
          await setActiveMutation.mutateAsync({ tenantId: tenant.id, isActive: !tenant.isActive });
          notifications.show({
            title: 'Success',
            message: tenant.isActive ? 'Tenant deactivated' : 'Tenant restored',
            color: notifyColors.success,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          notifications.show({ title: 'Error', message, color: notifyColors.error });
        }
      },
    });
  };

  const openDeleteConfirm = (tenant: Tenant) => {
    modals.openConfirmModal({
      title: 'Delete tenant (hard delete)',
      children: (
        <Stack gap="xs">
          <Text size="sm">
            You are about to permanently delete <strong>{tenant.name}</strong> and all its data.
          </Text>
          <Alert color={colors.warning} title="Warning">
            <Text size="sm">
              After you confirm, deletion will be scheduled in <strong>2 minutes</strong>. During those 2 minutes you
              can undo the deletion.
            </Text>
          </Alert>
        </Stack>
      ),
      labels: { confirm: 'Schedule delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await requestDeletionMutation.mutateAsync({ tenantId: tenant.id });
          notifications.show({
            title: 'Scheduled',
            message: 'Tenant deletion scheduled (you can undo for 2 minutes)',
            color: notifyColors.success,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          notifications.show({ title: 'Error', message, color: notifyColors.error });
        }
      },
    });
  };

  const handleUndoDeletion = async (tenant: Tenant) => {
    try {
      await cancelDeletionMutation.mutateAsync({ tenantId: tenant.id });
      notifications.show({
        title: 'Reverted',
        message: 'Tenant deletion cancelled',
        color: notifyColors.success,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const renderStatusBadges = (tenant: Tenant) => {
    const badges: React.ReactNode[] = [];

    const deletionStatus = tenant.deletionStatus ?? 'none';
    if (deletionStatus === 'pending' && tenant.deletionExecuteAt) {
      const executeAtMs = new Date(tenant.deletionExecuteAt).getTime();
      const secondsLeft = Math.max(0, Math.floor((executeAtMs - nowMs) / 1000));
      badges.push(
        <Badge key="pending" variant="light" color={colors.warning}>
          Deletion in {formatCountdown(secondsLeft)}
        </Badge>,
      );
    } else if (deletionStatus === 'executing') {
      badges.push(
        <Badge key="executing" variant="light" color={colors.warning}>
          Deleting…
        </Badge>,
      );
    }

    badges.push(
      <Badge key="active" variant="light" color={tenant.isActive ? colors.success : colors.error}>
        {tenant.isActive ? 'Active' : 'Inactive'}
      </Badge>,
    );

    return <Group gap="xs">{badges}</Group>;
  };

  const isBusy =
    tenantsQuery.isFetching ||
    statisticsQuery.isFetching ||
    setActiveMutation.isPending ||
    requestDeletionMutation.isPending ||
    cancelDeletionMutation.isPending;

  return (
    <>
      <div
        className="page-title-bar"
        style={{
          borderTopLeftRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <Group justify="space-between" w="100%">
          <Title order={1}>Tenants</Title>
          <Button
            id="admin-tenants-refresh"
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              tenantsQuery.refetch();
              statisticsQuery.refetch();
            }}
            loading={tenantsQuery.isFetching || statisticsQuery.isFetching}
          >
            Refresh
          </Button>
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
            <Text size="sm">Manage tenants (schools): deactivate/restore, or schedule a hard delete with a 2‑minute undo window.</Text>
          </Alert>

          {tenantsQuery.isLoading ? (
            <Stack gap="md">
              <Skeleton height={48} />
              <Skeleton height={220} />
            </Stack>
          ) : tenantsQuery.error ? (
            <Alert color={colors.error} title="Failed to load tenants">
              <Text size="sm">Please try again.</Text>
            </Alert>
          ) : statisticsQuery.error ? (
            <Alert color={colors.warning} title="Tenant list loaded, but admin details failed">
              <Group justify="space-between" mt="sm">
                <Text size="sm">The School Admins column may be incomplete. Please refresh.</Text>
                <Button
                  id="admin-tenants-retry-stats"
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => statisticsQuery.refetch()}
                  loading={statisticsQuery.isFetching}
                >
                  Retry
                </Button>
              </Group>
            </Alert>
          ) : tenantsSorted.length === 0 ? (
            <Paper withBorder p="lg">
              <Text c="dimmed" ta="center">
                No tenants found.
              </Text>
            </Paper>
          ) : (
            <Paper withBorder p="md">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tenant</Table.Th>
                    <Table.Th>Domain</Table.Th>
                    <Table.Th>School Admins</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th style={{ width: 420 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tenantsSorted.map((tenant) => {
                    const deletionStatus = tenant.deletionStatus ?? 'none';
                    const pending = deletionStatus === 'pending';
                    const tenantStats = statsByTenantId.get(tenant.id);
                    return (
                      <Table.Tr key={tenant.id}>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text fw={600}>{tenant.name}</Text>
                            <Text size="xs" c="dimmed">
                              {tenant.code}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          {tenant.domain ? (
                            <Badge size="sm" variant="light">
                              {tenant.domain}
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {statisticsQuery.isLoading ? (
                            <Skeleton height={18} width={160} />
                          ) : tenantStats && tenantStats.schoolAdmins.length > 0 ? (
                            <Stack gap={6}>
                              {tenantStats.schoolAdmins.slice(0, 3).map((a) => (
                                <Stack key={a.userId} gap={0}>
                                  <Text size="sm" fw={500}>
                                    {a.fullName || 'N/A'}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {a.email}
                                  </Text>
                                </Stack>
                              ))}
                              {tenantStats.schoolAdmins.length > 3 && (
                                <Text size="xs" c="dimmed">
                                  +{tenantStats.schoolAdmins.length - 3} more
                                </Text>
                              )}
                            </Stack>
                          ) : tenantStats ? (
                            <Text size="sm" c="dimmed">
                              No admins
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed">
                              Stats unavailable
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>{renderStatusBadges(tenant)}</Table.Td>
                        <Table.Td>
                          <Group gap="sm" justify="flex-end" wrap="nowrap">
                            <Button
                              id={`admin-tenant-${tenant.id}-toggle-active`}
                              variant="light"
                              color={tenant.isActive ? 'orange' : 'blue'}
                              leftSection={tenant.isActive ? <IconPlayerStop size={16} /> : <IconPlayerPlay size={16} />}
                              onClick={() => openDeactivateConfirm(tenant)}
                              disabled={isBusy || pending}
                            >
                              {tenant.isActive ? 'Deactivate' : 'Restore'}
                            </Button>

                            {pending ? (
                              <Button
                                id={`admin-tenant-${tenant.id}-undo-delete`}
                                variant="light"
                                leftSection={<IconArrowBackUp size={16} />}
                                onClick={() => handleUndoDeletion(tenant)}
                                disabled={isBusy}
                              >
                                Undo delete
                              </Button>
                            ) : (
                              <Button
                                id={`admin-tenant-${tenant.id}-delete`}
                                color="red"
                                leftSection={<IconTrash size={16} />}
                                onClick={() => openDeleteConfirm(tenant)}
                                disabled={isBusy}
                              >
                                Delete
                              </Button>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Stack>
      </div>
    </>
  );
}

