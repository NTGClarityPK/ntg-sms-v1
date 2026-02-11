'use client';

import { Paper, Text, Skeleton, Group, Stack } from '@mantine/core';
import type { AttendanceSection as AttendanceSectionType } from '@/types/reports';

interface AttendanceSectionProps {
  data: AttendanceSectionType | null | undefined;
  isLoading: boolean;
}

export function AttendanceSection({ data, isLoading }: AttendanceSectionProps) {
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
        <Text fw={600} mb="xs">Attendance</Text>
        <Text c="dimmed" size="sm">No attendance data.</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="md">Attendance</Text>
      <Stack gap="xs">
        <Group gap="lg">
          <Text size="sm">Present: <strong>{data.presentDays}</strong></Text>
          <Text size="sm">Absent: <strong>{data.absentDays}</strong></Text>
          <Text size="sm">Late: <strong>{data.lateDays}</strong></Text>
          <Text size="sm">Excused: <strong>{data.excusedDays}</strong></Text>
        </Group>
        <Text size="sm">
          Total days: {data.totalDays} · Attendance: <strong>{data.percentage}%</strong>
        </Text>
      </Stack>
    </Paper>
  );
}
