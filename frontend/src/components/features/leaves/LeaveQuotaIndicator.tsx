'use client';

import { Paper, Stack, Text, Progress, Group } from '@mantine/core';
import { useLeaveQuota } from '@/hooks/useLeaveRequests';

interface LeaveQuotaIndicatorProps {
  studentId: string | null;
}

export function LeaveQuotaIndicator({ studentId }: LeaveQuotaIndicatorProps) {
  const quotaQuery = useLeaveQuota(studentId);

  if (!studentId || !quotaQuery.data) {
    return null;
  }

  const quota = quotaQuery.data;
  const isExceeded = quota.usedDays > quota.totalQuota;
  const percent =
    quota.totalQuota > 0
      ? Math.min(
          100,
          Math.round((quota.usedDays / quota.totalQuota) * 100),
        )
      : 0;

  return (
    <Paper withBorder p="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>Leave quota</Text>
          <Text 
            size="sm" 
            c={isExceeded ? 'red' : 'dimmed'}
            fw={isExceeded ? 600 : 400}
          >
            {quota.usedDays}/{quota.totalQuota} days used
            {isExceeded && ' (Limit exceeded)'}
          </Text>
        </Group>
        <Progress 
          value={percent} 
          color={isExceeded ? 'red' : undefined}
        />
      </Stack>
    </Paper>
  );
}


