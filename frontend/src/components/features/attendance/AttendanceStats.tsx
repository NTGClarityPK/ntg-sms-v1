'use client';

import { useTranslations } from 'next-intl';
import { Group, Paper, Stack, Text, Badge, Progress } from '@mantine/core';
import type { Attendance } from '@/types/attendance';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface AttendanceStatsProps {
  attendance: Attendance[];
  totalStudents: number;
}

export function AttendanceStats({
  attendance,
  totalStudents,
}: AttendanceStatsProps) {
  const t = useTranslations('attendance');
  const notifyColors = useThemeColors();

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;
  const lateCount = attendance.filter((a) => a.status === 'late').length;
  const excusedCount = attendance.filter((a) => a.status === 'excused').length;

  const presentPercentage =
    totalStudents > 0
      ? Math.round(((presentCount + lateCount) / totalStudents) * 100)
      : 0;

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={500} size="lg">
          {t('attendanceStatistics')}
        </Text>
        <Group grow>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('present')}
            </Text>
            <Badge variant="light" color={notifyColors.success} size="lg">
              {presentCount}
            </Badge>
          </Stack>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('absent')}
            </Text>
            <Badge variant="light" color={notifyColors.error} size="lg">
              {absentCount}
            </Badge>
          </Stack>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('late')}
            </Text>
            <Badge variant="light" color={notifyColors.warning} size="lg">
              {lateCount}
            </Badge>
          </Stack>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('excused')}
            </Text>
            <Badge variant="light" color={notifyColors.info} size="lg">
              {excusedCount}
            </Badge>
          </Stack>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('total')}
            </Text>
            <Text fw={600} size="lg">
              {totalStudents}
            </Text>
          </Stack>
        </Group>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t('attendanceRate')}
            </Text>
            <Text fw={600}>{presentPercentage}%</Text>
          </Group>
          <Progress value={presentPercentage} color={notifyColors.success} />
        </Stack>
      </Stack>
    </Paper>
  );
}



