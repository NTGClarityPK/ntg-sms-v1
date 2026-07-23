'use client';

import { Stack, Text, Group, Badge, Skeleton, Alert } from '@mantine/core';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useEarlyDepartures } from '@/hooks/useEarlyDepartures';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function PendingTasksWidget() {
  const colors = useThemeColors();
  // Counts only — use meta.total (data.length with limit 10 wrongly capped the badge at 10).
  const leavesQuery = useLeaveRequests({ status: 'pending', page: 1, limit: 1 });
  const earlyQuery = useEarlyDepartures({ status: 'pending', page: 1, limit: 1 });

  const pendingLeaves = leavesQuery.data?.meta?.total ?? leavesQuery.data?.data?.length ?? 0;
  const pendingEarly = earlyQuery.data?.meta?.total ?? earlyQuery.data?.data?.length ?? 0;
  const isLoading = leavesQuery.isLoading || earlyQuery.isLoading;
  const error = leavesQuery.error ?? earlyQuery.error;

  if (error) {
    return (
      <Alert color={colors.error} title="Error">
        {error instanceof Error ? error.message : 'Failed to load pending tasks'}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack gap="sm">
        <Skeleton height={20} width="60%" />
        <Skeleton height={36} />
        <Skeleton height={36} />
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Group gap="md">
        <Badge variant="light" color={colors.info} size="lg">
          {pendingLeaves} leave request{pendingLeaves !== 1 ? 's' : ''} pending
        </Badge>
        <Badge variant="light" color={colors.warning} size="lg">
          {pendingEarly} early departure{pendingEarly !== 1 ? 's' : ''} pending
        </Badge>
      </Group>
    </Stack>
  );
}
