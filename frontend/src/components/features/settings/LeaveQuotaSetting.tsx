'use client';

import { useTranslations } from 'next-intl';
import { Alert, Button, Group, NumberInput, Paper, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useLeaveQuota, useSetLeaveQuota } from '@/hooks/useAssessmentSettings';

interface LeaveQuotaSettingProps {
  academicYearId?: string;
  showHeader?: boolean;
}

export function LeaveQuotaSetting({ academicYearId, showHeader = true }: LeaveQuotaSettingProps) {
  const t = useTranslations('leave');
  const tCommon = useTranslations('common');
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
      <Alert color={colors.warning} title={t('noActiveAcademicYear')}>
        {t('createActivateAcademicYear')}
      </Alert>
    );
  }

  if (quotaQuery.error) {
    return (
      <Alert color={colors.error} title={t('failedToLoadLeaveQuota')}>
        <Text size="sm">{t('pleaseTryAgain')}</Text>
      </Alert>
    );
  }

  const onSave = async () => {
    try {
      await setQuota.mutateAsync({ academicYearId, annualQuota: value });
      notifications.show({ title: tCommon('success'), message: t('leaveQuotaSaved'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  return (
    <Stack gap="xs">
      {showHeader && (
        <Stack gap={4}>
          <Text size="lg" fw={600}>
            {t('leaveQuotaTitle')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('leaveQuotaDescription')}
          </Text>
        </Stack>
      )}
      <Paper withBorder p="md">
        <Stack gap="md">
          <Text fw={600}>{t('annualLeaveQuota')}</Text>
        <NumberInput id="leave-quota-value" label={t('quota')} min={0} value={value} onChange={(v) => setValue(Number(v) || 0)} />
        <Group justify="flex-end">
          <Button id="leave-quota-save" variant="light" onClick={onSave} loading={setQuota.isPending || quotaQuery.isLoading}>
            {t('save')}
          </Button>
        </Group>
      </Stack>
    </Paper>
    </Stack>
  );
}


