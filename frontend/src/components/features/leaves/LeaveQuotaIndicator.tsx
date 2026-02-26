'use client';

import { useTranslations } from 'next-intl';
import { Paper, Stack, Text, Progress, Group } from '@mantine/core';
import { useLeaveQuota } from '@/hooks/useLeaveRequests';

interface LeaveQuotaIndicatorProps {
  studentId: string | null;
}

export function LeaveQuotaIndicator({ studentId }: LeaveQuotaIndicatorProps) {
  const t = useTranslations('leave');
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
          <Text fw={600}>{t('leaveQuota')}</Text>
          <Text 
            size="sm" 
            c={isExceeded ? 'red' : 'dimmed'}
            fw={isExceeded ? 600 : 400}
          >
            {t('daysUsed', { used: quota.usedDays, total: quota.totalQuota })}
            {isExceeded && ` ${t('limitExceeded')}`}
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


