'use client';

import { Stack, Text, Group, Badge, Skeleton, Alert } from '@mantine/core';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useEarlyDepartures } from '@/hooks/useEarlyDepartures';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function PendingApprovalsWidget() {
  const colors = useThemeColors();
  // Counts only — avoid loading 100 leave/early rows (quota + timetable work) on the dashboard.
  const leavesQuery = useLeaveRequests({ status: 'pending', page: 1, limit: 1 });
  const earlyQuery = useEarlyDepartures({ status: 'pending', page: 1, limit: 1 });

  const pendingLeaves = leavesQuery.data?.meta?.total ?? leavesQuery.data?.data?.length ?? 0;
  const pendingEarly = earlyQuery.data?.meta?.total ?? earlyQuery.data?.data?.length ?? 0;
  const isLoading = leavesQuery.isLoading || earlyQuery.isLoading;
  const error = leavesQuery.error ?? earlyQuery.error;

  if (error) {
    return (
      <Alert color={colors.error} title="Error">
        {error instanceof Error ? error.message : 'Failed to load pending approvals'}
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

  const total = pendingLeaves + pendingEarly;

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {total} item{total !== 1 ? 's' : ''} need your review
      </Text>
      <Group gap="xs">
        <Badge variant="light" color={colors.info}>
          {pendingLeaves} leave{pendingLeaves !== 1 ? 's' : ''}
        </Badge>
        <Badge variant="light" color={colors.warning}>
          {pendingEarly} early departure{pendingEarly !== 1 ? 's' : ''}
        </Badge>
      </Group>
    </Stack>
  );
}
