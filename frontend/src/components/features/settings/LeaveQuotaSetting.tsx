'use client';

import { Alert, Button, Group, NumberInput, Paper, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useLeaveQuota, useSetLeaveQuota } from '@/hooks/useAssessmentSettings';

interface LeaveQuotaSettingProps {
  academicYearId?: string;
}

export function LeaveQuotaSetting({ academicYearId }: LeaveQuotaSettingProps) {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const quotaQuery = useLeaveQuota(academicYearId);
  const setQuota = useSetLeaveQuota();
  const [value, setValue] = useState<number>(0);

  useEffect(() => {
    if (quotaQuery.data?.data) setValue(quotaQuery.data.data.annualQuota);
  }, [quotaQuery.data?.data]);

  if (!academicYearId) {
    return (
      <Alert color={colors.warning} title="No active academic year">
        Create and activate an academic year to configure leave quota.
      </Alert>
    );
  }

  if (quotaQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load leave quota">
        <Text size="sm">Please try again.</Text>
      </Alert>
    );
  }

  const onSave = async () => {
    try {
      await setQuota.mutateAsync({ academicYearId, annualQuota: value });
      notifications.show({ title: 'Success', message: 'Leave quota saved', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  return (
    <>
      <Text size="lg" fw={500} mb="xs">Leave Quota</Text>
      <Text size="sm" c="dimmed" mb="md">
        Set the annual leave quota for students per academic year. This limit determines the maximum number of leave days 
        a student can take during the academic year. The system tracks used and remaining leave days for each student.
      </Text>
      <Paper withBorder p="md">
        <Stack gap="md">
          <Text fw={600}>Annual leave quota</Text>
        <NumberInput id="leave-quota-value" label="Quota" min={0} value={value} onChange={(v) => setValue(Number(v) || 0)} />
        <Group justify="flex-end">
          <Button id="leave-quota-save" variant="light" onClick={onSave} loading={setQuota.isPending || quotaQuery.isLoading}>
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
    </>
  );
}


