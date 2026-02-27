'use client';

import { Paper, Text, Skeleton, Group, Stack } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { AttendanceSection as AttendanceSectionType } from '@/types/reports';

interface AttendanceSectionProps {
  data: AttendanceSectionType | null | undefined;
  isLoading: boolean;
}

export function AttendanceSection({ data, isLoading }: AttendanceSectionProps) {
  const t = useTranslations('reports');
  if (isLoading) {
    return (
      <Paper withBorder p="md">
        <Skeleton height={80} radius="sm" />
      </Paper>
    );
  }

  if (!data) {
    return (
      <Paper withBorder p="md">
        <Text fw={600} mb="xs">
          {t('attendanceSectionTitle')}
        </Text>
        <Text c="dimmed" size="sm">
          {t('attendanceNoData')}
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="md">
        {t('attendanceSectionTitle')}
      </Text>
      <Stack gap="xs">
        <Group gap="lg">
          <Text size="sm">
            {t('attendancePresent')}: <strong>{data.presentDays}</strong>
          </Text>
          <Text size="sm">
            {t('attendanceAbsent')}: <strong>{data.absentDays}</strong>
          </Text>
          <Text size="sm">
            {t('attendanceLate')}: <strong>{data.lateDays}</strong>
          </Text>
          <Text size="sm">
            {t('attendanceExcused')}: <strong>{data.excusedDays}</strong>
          </Text>
        </Group>
        <Text size="sm">
          {t('attendanceTotalDays')}: {data.totalDays} · {t('attendanceAttendanceLabel')}: <strong>
            {data.percentage}%
          </strong>
        </Text>
      </Stack>
    </Paper>
  );
}
