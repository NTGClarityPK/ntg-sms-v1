'use client';

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
          Attendance Statistics
        </Text>
        <Group grow>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              Present
            </Text>
            <Badge variant="light" color={notifyColors.success} size="lg">
              {presentCount}
            </Badge>
          </Stack>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              Absent
            </Text>
            <Badge variant="light" color={notifyColors.error} size="lg">
              {absentCount}
            </Badge>
          </Stack>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              Late
            </Text>
            <Badge variant="light" color={notifyColors.warning} size="lg">
              {lateCount}
            </Badge>
          </Stack>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              Excused
            </Text>
            <Badge variant="light" color={notifyColors.info} size="lg">
              {excusedCount}
            </Badge>
          </Stack>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              Total
            </Text>
            <Text fw={600} size="lg">
              {totalStudents}
            </Text>
          </Stack>
        </Group>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Attendance Rate
            </Text>
            <Text fw={600}>{presentPercentage}%</Text>
          </Group>
          <Progress value={presentPercentage} color={notifyColors.success} />
        </Stack>
      </Stack>
    </Paper>
  );
}

