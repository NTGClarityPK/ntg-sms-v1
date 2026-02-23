'use client';

import { Stack, Text, Group, Badge, Skeleton, Alert } from '@mantine/core';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useEarlyDepartures } from '@/hooks/useEarlyDepartures';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function PendingTasksWidget() {
  const colors = useThemeColors();
  const leavesQuery = useLeaveRequests({ status: 'pending', limit: 10 });
  const earlyQuery = useEarlyDepartures({ status: 'pending', limit: 10 });

  const leavesData = leavesQuery.data?.data ?? [];
  const earlyData = earlyQuery.data?.data ?? [];
  const pendingLeaves = leavesData.length;
  const pendingEarly = earlyData.length;
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
